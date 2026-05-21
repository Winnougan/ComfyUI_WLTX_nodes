"""
Winnougan LTX Image Resize
────────────────────────────
Purpose-built image resize node for the LTX-2.3 pipeline.

Designed to accept width and height directly from the
Winnougan LTX Resolution & Frame Calculator node and resize
your input image correctly for LTX video generation.

Key improvements over generic resize nodes:
  • Accepts width/height as direct integer inputs — wire straight
    from the calculator, no math expression nodes needed
  • Auto-snaps output to multiples of 32 (LTX hard requirement)
  • Smart aspect ratio modes designed for video generation
  • Outputs actual width/height integers for downstream use
  • Clear mode names that make sense for video workflows

Modes
─────
  fit_inside      — scale to fit within target, preserve aspect ratio
                    (letterbox/pillarbox). Best for portrait images
                    going to landscape video and vice versa.
  fill_and_crop   — scale to fill target entirely, crop excess center.
                    Best when you want no black bars.
  stretch         — ignore aspect ratio, exactly fill target.
                    Only use when aspect ratios already match.
  fit_width       — match target width exactly, scale height to match.
  fit_height      — match target height exactly, scale width to match.
"""

import math
import torch
import logging
from comfy.utils import common_upscale

log = logging.getLogger("Winnougan")
NODE_NAME = "Winnougan LTX Image Resize"

RESIZE_MODES = [
    "fit_inside",
    "fill_and_crop",
    "stretch",
    "fit_width",
    "fit_height",
]

INTERPOLATION_MODES = [
    "lanczos",
    "bicubic",
    "bilinear",
    "nearest",
    "area",
]


def snap32(v: int) -> int:
    """Round to nearest multiple of 32."""
    return max(32, int(round(v / 32) * 32))


def resize_image(image: torch.Tensor, target_w: int, target_h: int,
                 mode: str, interpolation: str) -> torch.Tensor:
    """
    Resize a BHWC image tensor to target dimensions.
    Returns a BHWC tensor.
    """
    B, H, W, C = image.shape
    img = image.movedim(-1, 1)  # BHWC → BCHW for common_upscale

    if mode == "stretch":
        out = common_upscale(img, target_w, target_h, interpolation, "disabled")

    elif mode == "fit_inside":
        ratio = min(target_w / W, target_h / H)
        new_w = snap32(int(W * ratio))
        new_h = snap32(int(H * ratio))
        out = common_upscale(img, new_w, new_h, interpolation, "disabled")

    elif mode == "fill_and_crop":
        ratio = max(target_w / W, target_h / H)
        scale_w = int(W * ratio)
        scale_h = int(H * ratio)
        scaled = common_upscale(img, scale_w, scale_h, interpolation, "disabled")
        # Center crop
        cx = (scale_w - target_w) // 2
        cy = (scale_h - target_h) // 2
        out = scaled[:, :, cy:cy + target_h, cx:cx + target_w]

    elif mode == "fit_width":
        ratio = target_w / W
        new_h = snap32(int(H * ratio))
        out = common_upscale(img, target_w, new_h, interpolation, "disabled")

    elif mode == "fit_height":
        ratio = target_h / H
        new_w = snap32(int(W * ratio))
        out = common_upscale(img, new_w, target_h, interpolation, "disabled")

    else:
        out = common_upscale(img, target_w, target_h, interpolation, "disabled")

    return out.movedim(1, -1)  # BCHW → BHWC


class WinnouganLTXImageResize:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "image": ("IMAGE",),
                "width": ("INT", {
                    "default": 768, "min": 32, "max": 8192, "step": 32,
                    "tooltip": "Target width in pixels. Wire from Winnougan LTX Calculator 'width' output. Auto-snapped to multiple of 32.",
                }),
                "height": ("INT", {
                    "default": 512, "min": 32, "max": 8192, "step": 32,
                    "tooltip": "Target height in pixels. Wire from Winnougan LTX Calculator 'height' output. Auto-snapped to multiple of 32.",
                }),
                "mode": (RESIZE_MODES, {
                    "default": "fit_inside",
                    "tooltip": (
                        "fit_inside: scale to fit within target, preserving aspect ratio. "
                        "fill_and_crop: scale to fill target, crop excess from center. "
                        "stretch: ignore aspect ratio, fill target exactly. "
                        "fit_width: match width exactly, scale height proportionally. "
                        "fit_height: match height exactly, scale width proportionally."
                    ),
                }),
                "interpolation": (INTERPOLATION_MODES, {
                    "default": "lanczos",
                    "tooltip": "Interpolation method. Lanczos is best quality for downscaling. Bicubic for upscaling.",
                }),
            },
        }

    RETURN_TYPES  = ("IMAGE", "INT", "INT")
    RETURN_NAMES  = ("image", "width", "height")
    FUNCTION      = "resize"

    def resize(self, image: torch.Tensor, width: int, height: int,
               mode: str, interpolation: str):

        # Snap target dimensions to ×32
        target_w = snap32(width)
        target_h = snap32(height)

        if target_w != width or target_h != height:
            log.info(f"[{NODE_NAME}] Snapped target {width}×{height} → {target_w}×{target_h}")

        out = resize_image(image, target_w, target_h, mode, interpolation)

        actual_h = out.shape[1]
        actual_w = out.shape[2]

        log.info(
            f"[{NODE_NAME}] {image.shape[2]}×{image.shape[1]} → {actual_w}×{actual_h} "
            f"[{mode}, {interpolation}]"
        )

        return (out, actual_w, actual_h)


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXImageResize": WinnouganLTXImageResize,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXImageResize": "🔥 Winnougan LTX Image Resize",
}
