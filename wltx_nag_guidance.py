"""
Winnougan LTX NAG Guidance
────────────────────────────
Normalized Attention Guidance for LTX-2.3 distilled models.

NAG restores effective negative prompting on distilled models.
Standard CFG negative prompting doesn't work well with distilled
LTX because the model was trained without it. NAG uses a different
approach — it normalises the attention output rather than applying
classifier-free guidance at the noise prediction level.

Improvements over KJ's LTX2_NAG
──────────────────────────────────
  • Single conditioning input — accepts your negative conditioning
    directly and splits video/audio internally. KJ's version requires
    two separate inputs wired from different places.
  • Plain-English parameter descriptions instead of math jargon.
  • Preset profiles: Subtle, Balanced (recommended), Strong, Maximum.
  • Fire theme panel showing active settings after execution.
  • `inplace` hidden by default — it changes numerical results subtly
    and most users should leave it off.

How to wire it
──────────────
  [Gigachad Prompt Encoder (negative)] → conditioning
  [Model] → model → [output model] → [Sampler]

Wire your NEGATIVE conditioning in. The model passes through with
the NAG patch applied. Leave the rest of your workflow unchanged.

References
──────────
  NAG paper: https://github.com/ChenDarYen/Normalized-Attention-Guidance
  KJ implementation: LTX2_NAG in ComfyUI-KJNodes
"""

import types
import torch
import logging
import comfy.model_management as mm
import comfy.ldm.modules.attention as _comfy_attn

log = logging.getLogger("Winnougan")
NODE_NAME = "Winnougan LTX NAG Guidance"

# ── NAG math (identical to KJ's implementation) ──────────────────────────────

def _compute_attention(self, query, context, attn_precision=None, transformer_options={}):
    k = self.k_norm(self.to_k(context)).to(query.dtype)
    v = self.to_v(context).to(query.dtype)
    x = _comfy_attn.optimized_attention(
        query, k, v,
        heads=self.heads,
        attn_precision=attn_precision,
        transformer_options=transformer_options,
    ).flatten(2)
    del k, v
    return x


def _nag_attention(self, query, context_positive, nag_context,
                   attn_precision=None, transformer_options={}):
    x_positive = _compute_attention(self, query, context_positive, attn_precision, transformer_options)
    x_negative = _compute_attention(self, query, nag_context,       attn_precision, transformer_options)
    return x_positive, x_negative


def _normalized_attention_guidance(self, x_positive, x_negative):
    if self.nag_inplace:
        nag = x_negative.mul_(self.nag_scale - 1).neg_().add_(x_positive, alpha=self.nag_scale)
    else:
        nag = x_positive * self.nag_scale - x_negative * (self.nag_scale - 1)
    del x_negative

    norm_pos = torch.norm(x_positive, p=1, dim=-1, keepdim=True)
    norm_nag = torch.norm(nag,        p=1, dim=-1, keepdim=True)

    scale = norm_nag / norm_pos
    torch.nan_to_num_(scale, nan=10.0)
    mask = scale > self.nag_tau
    del scale

    adj = (norm_pos * self.nag_tau) / (norm_nag + 1e-7)
    del norm_pos, norm_nag

    nag.mul_(torch.where(mask, adj, torch.ones_like(adj)))
    del mask, adj

    if self.nag_inplace:
        nag.sub_(x_positive).mul_(self.nag_alpha).add_(x_positive)
    else:
        nag = nag * self.nag_alpha + x_positive * (1 - self.nag_alpha)
    del x_positive

    return nag


def _ltxv_crossattn_forward_nag(self, x, context, mask=None,
                                 transformer_options={}, **kwargs):
    if context.shape[0] == 1:
        x_pos, context_pos = x, context
        x_neg, context_neg = None, None
    else:
        x_pos, x_neg   = torch.chunk(x,       2, dim=0)
        context_pos, context_neg = torch.chunk(context, 2, dim=0)

    q_pos   = self.q_norm(self.to_q(x_pos))
    del x_pos
    x_positive, x_negative = _nag_attention(
        self, q_pos, context_pos, self.nag_context,
        attn_precision=self.attn_precision,
        transformer_options=transformer_options,
    )
    del context_pos, q_pos
    x_pos_out = _normalized_attention_guidance(self, x_positive, x_negative)
    del x_positive, x_negative

    if x_neg is not None and context_neg is not None:
        q_neg = self.q_norm(self.to_q(x_neg))
        k_neg = self.k_norm(self.to_k(context_neg))
        v_neg = self.to_v(context_neg)
        x_neg_out = _comfy_attn.optimized_attention(
            q_neg, k_neg, v_neg,
            heads=self.heads,
            attn_precision=self.attn_precision,
            transformer_options=transformer_options,
        )
        out = torch.cat([x_pos_out, x_neg_out], dim=0)
    else:
        out = x_pos_out

    if self.to_gate_logits is not None:
        gate = self.to_gate_logits(x)
        b, t, _ = out.shape
        out = out.view(b, t, self.heads, self.dim_head)
        out = out * (2.0 * torch.sigmoid(gate)).unsqueeze(-1)
        out = out.view(b, t, self.heads * self.dim_head)

    return self.to_out(out)


class _NAGCrossAttentionPatch:
    """Descriptor that binds NAG parameters onto a cross-attention module."""
    def __init__(self, context, nag_scale, nag_alpha, nag_tau, inplace):
        self.nag_context = context
        self.nag_scale   = nag_scale
        self.nag_alpha   = nag_alpha
        self.nag_tau     = nag_tau
        self.nag_inplace = inplace

    def __get__(self, obj, objtype=None):
        patch = self
        def wrapped(self_module, *args, **kwargs):
            self_module.nag_context = patch.nag_context
            self_module.nag_scale   = patch.nag_scale
            self_module.nag_alpha   = patch.nag_alpha
            self_module.nag_tau     = patch.nag_tau
            self_module.nag_inplace = patch.nag_inplace
            return _ltxv_crossattn_forward_nag(self_module, *args, **kwargs)
        return types.MethodType(wrapped, obj)


# ── Presets ───────────────────────────────────────────────────────────────────

PRESETS = {
    "Balanced (recommended)": {"scale": 11.0, "alpha": 0.25, "tau": 2.5},
    "Subtle":                  {"scale":  6.0, "alpha": 0.15, "tau": 3.5},
    "Strong":                  {"scale": 16.0, "alpha": 0.35, "tau": 2.0},
    "Maximum":                 {"scale": 25.0, "alpha": 0.50, "tau": 1.5},
    "Custom":                  {"scale": 11.0, "alpha": 0.25, "tau": 2.5},
}


# ── Node ─────────────────────────────────────────────────────────────────────

class WinnouganLTXNAGGuidance:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "model": ("MODEL",),
                "preset": (list(PRESETS.keys()), {
                    "default": "Balanced (recommended)",
                    "tooltip": (
                        "Balanced is the right choice for most generations. "
                        "Subtle for gentle steering, Strong/Maximum for aggressive "
                        "negative prompting. Custom lets you set values manually."
                    ),
                }),
                "nag_scale": ("FLOAT", {
                    "default": 11.0, "min": 0.0, "max": 50.0, "step": 0.5,
                    "tooltip": (
                        "How strongly NAG pushes away from the negative prompt. "
                        "Higher = stronger effect. Only used when preset is Custom."
                    ),
                }),
                "nag_alpha": ("FLOAT", {
                    "default": 0.25, "min": 0.0, "max": 1.0, "step": 0.01,
                    "tooltip": (
                        "Blend between guided and original attention. "
                        "0 = no effect, 1 = full NAG. Only used when preset is Custom."
                    ),
                }),
                "nag_tau": ("FLOAT", {
                    "default": 2.5, "min": 0.1, "max": 10.0, "step": 0.1,
                    "tooltip": (
                        "Clipping threshold — limits how far NAG can deviate from "
                        "the positive attention. Lower = more aggressive. "
                        "Only used when preset is Custom."
                    ),
                }),
            },
            "optional": {
                "negative_conditioning": ("CONDITIONING", {
                    "tooltip": (
                        "Your NEGATIVE conditioning from Gigachad Prompt Encoder. "
                        "Wire the same negative conditioning you send to your sampler. "
                        "If not connected, NAG will be disabled."
                    ),
                }),
                "inplace": ("BOOLEAN", {
                    "default": False,
                    "tooltip": (
                        "Modify tensors in-place to save a small amount of memory. "
                        "Changes numerical results slightly. Leave off unless you "
                        "are very tight on VRAM."
                    ),
                }),
            },
        }

    RETURN_TYPES  = ("MODEL", "STRING")
    RETURN_NAMES  = ("model", "nag_info")
    FUNCTION      = "apply_nag"

    def apply_nag(self, model, preset,
                  nag_scale, nag_alpha, nag_tau,
                  negative_conditioning=None, inplace=False):

        # Apply preset values unless Custom
        if preset != "Custom":
            p        = PRESETS[preset]
            nag_scale = p["scale"]
            nag_alpha = p["alpha"]
            nag_tau   = p["tau"]

        if nag_scale == 0 or negative_conditioning is None:
            reason = "scale=0" if nag_scale == 0 else "no conditioning connected"
            info = f"NAG disabled ({reason})"
            log.info(f"[{NODE_NAME}] {info}")
            return (model, info)

        device        = mm.get_torch_device()
        offload       = mm.unet_offload_device()
        model_clone   = model.clone()
        diff          = model_clone.get_model_object("diffusion_model")

        dtype = model.model.manual_cast_dtype or diff.dtype

        # ── Extract conditioning tensor ───────────────────────────────────────
        cond_tensor = negative_conditioning[0][0].to(device, dtype)

        # Detect if conditioning is combined (video+audio concatenated)
        # LTX combines them along the last dim: [..., vid_dim + audio_dim]
        vid_dim   = getattr(diff, "cross_attention_dim",       None)
        audio_dim = getattr(diff, "audio_cross_attention_dim", None)

        if (vid_dim is not None and audio_dim is not None and
                cond_tensor.shape[-1] == vid_dim + audio_dim):
            context_video = cond_tensor[..., :vid_dim]
            context_audio = cond_tensor[..., vid_dim:]
            has_audio     = True
        else:
            context_video = cond_tensor
            context_audio = None
            has_audio     = False

        # ── Run caption projection / embeddings connector (same as KJ) ────────
        img_dim   = diff.inner_dim
        audio_out = diff.audio_inner_dim if has_audio else None

        # Video path
        if diff.caption_proj_before_connector and diff.caption_projection_first_linear:
            diff.caption_projection.to(device)
            context_video = diff.caption_projection(context_video)
            diff.caption_projection.to(offload)

        if hasattr(diff, "video_embeddings_connector"):
            diff.video_embeddings_connector.to(device)
            context_video = diff.video_embeddings_connector(context_video)[0]
            diff.video_embeddings_connector.to(offload)

        context_video = context_video.view(1, -1, img_dim)

        # Audio path
        if has_audio and diff.audio_caption_projection is not None:
            if diff.caption_proj_before_connector and diff.caption_projection_first_linear:
                diff.audio_caption_projection.to(device)
                context_audio = diff.audio_caption_projection(context_audio)
                diff.audio_caption_projection.to(offload)

            if hasattr(diff, "audio_embeddings_connector"):
                diff.audio_embeddings_connector.to(device)
                context_audio = diff.audio_embeddings_connector(context_audio)[0]
                diff.audio_embeddings_connector.to(offload)

            context_audio = context_audio.view(1, -1, audio_out)

        # ── Patch transformer blocks ──────────────────────────────────────────
        for idx, block in enumerate(diff.transformer_blocks):
            # Video cross-attention
            patch_v = _NAGCrossAttentionPatch(
                context_video, nag_scale, nag_alpha, nag_tau, inplace
            ).__get__(block.attn2, block.__class__)
            model_clone.add_object_patch(
                f"diffusion_model.transformer_blocks.{idx}.attn2.forward", patch_v
            )

            # Audio cross-attention
            if has_audio and context_audio is not None and hasattr(block, "audio_attn2"):
                patch_a = _NAGCrossAttentionPatch(
                    context_audio, nag_scale, nag_alpha, nag_tau, inplace
                ).__get__(block.audio_attn2, block.__class__)
                model_clone.add_object_patch(
                    f"diffusion_model.transformer_blocks.{idx}.audio_attn2.forward", patch_a
                )

        # ── Info string ───────────────────────────────────────────────────────
        info = (
            f"Preset  : {preset}\n"
            f"Scale   : {nag_scale}\n"
            f"Alpha   : {nag_alpha}\n"
            f"Tau     : {nag_tau}\n"
            f"Audio   : {'✅ patched' if has_audio else '❌ video-only'}\n"
            f"Inplace : {inplace}\n"
            f"Blocks  : {len(diff.transformer_blocks)}"
        )

        log.info(
            f"[{NODE_NAME}] Applied — preset={preset} scale={nag_scale} "
            f"alpha={nag_alpha} tau={nag_tau} audio={has_audio}"
        )

        return (model_clone, info)


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXNAGGuidance": WinnouganLTXNAGGuidance,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXNAGGuidance": "🔥 Winnougan LTX NAG Guidance",
}
