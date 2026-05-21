"""
Winnougan LTX Sigma Schedule
──────────────────────────────
Outputs the correct ManualSigmas tensor for LTX-2.3 workflows.

Replaces the ManualSigmas node with its cryptic number strings.
You pick a preset from a dropdown — the node outputs the right
sigma tensor ready to wire into SamplerCustomAdvanced.

Presets
───────
Stage 1 — Distilled 4-step
    0.85, 0.725, 0.4219, 0.0
    The standard first-stage schedule for the distilled model.
    Fast, 4 denoising steps. Use for main generation.

Stage 1 — Distilled 8-step (quality)
    1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0
    Higher quality 8-step first-stage schedule.
    Slower but more detail. Use when quality matters more than speed.

Stage 2 — Upscaler 3-step
    0.421875, 0.2109375, 0.0
    Lightweight refinement pass after the spatial upscaler.
    3 steps at low denoise — adds detail without replacing composition.

Stage 2 — Upscaler 4-step
    0.525, 0.421875, 0.2109375, 0.0
    Slightly stronger refinement for the upscaler stage.
    Use when stage 2 detail needs more work.

Custom
    Enter your own comma-separated sigma values.
"""

import torch
import logging

log = logging.getLogger("Winnougan")
NODE_NAME = "Winnougan LTX Sigma Schedule"

# All sigma schedules verified from Lightricks' official LTX-2.3 workflows
PRESETS = {
    "Stage 1 — Distilled 4-step (fast)": [0.85, 0.725, 0.421875, 0.0],
    "Stage 1 — Distilled 8-step (quality)": [1.0, 0.99375, 0.9875, 0.98125, 0.975, 0.909375, 0.725, 0.421875, 0.0],
    "Stage 2 — Upscaler 3-step": [0.421875, 0.2109375, 0.0],
    "Stage 2 — Upscaler 4-step": [0.525, 0.421875, 0.2109375, 0.0],
    "Custom": [],
}


def parse_sigmas(text: str) -> list[float]:
    """Parse a comma-separated sigma string into a list of floats."""
    values = []
    for part in text.replace(" ", "").split(","):
        part = part.strip()
        if part:
            try:
                values.append(float(part))
            except ValueError:
                raise ValueError(f"[{NODE_NAME}] Invalid sigma value: '{part}'")
    if not values:
        raise ValueError(f"[{NODE_NAME}] No sigma values provided.")
    return values


class WinnouganLTXSigmaSchedule:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "preset": (list(PRESETS.keys()), {
                    "default": "Stage 1 — Distilled 4-step (fast)",
                    "tooltip": (
                        "Select a preset sigma schedule. "
                        "Stage 1 is used for main generation. "
                        "Stage 2 is used for the spatial upscaler refinement pass. "
                        "Use 'Custom' to enter your own values."
                    ),
                }),
                "custom_sigmas": ("STRING", {
                    "default": "0.85, 0.725, 0.421875, 0.0",
                    "multiline": False,
                    "tooltip": "Custom sigma values, comma-separated. Only used when preset is 'Custom'.",
                }),
            }
        }

    RETURN_TYPES  = ("SIGMAS", "INT", "STRING")
    RETURN_NAMES  = ("sigmas", "steps", "schedule_info")
    FUNCTION      = "get_sigmas"

    def get_sigmas(self, preset, custom_sigmas):
        if preset == "Custom":
            values = parse_sigmas(custom_sigmas)
        else:
            values = PRESETS[preset]

        # Steps = number of values minus the trailing 0.0
        steps = len(values) - 1 if values[-1] == 0.0 else len(values)

        sigmas = torch.FloatTensor(values)

        # Build info string
        val_str = ", ".join(f"{v:.6g}" for v in values)
        info = (
            f"Preset  : {preset}\n"
            f"Steps   : {steps}\n"
            f"Sigmas  : {val_str}\n"
            f"Min σ   : {min(v for v in values if v > 0):.6g}\n"
            f"Max σ   : {max(values):.6g}"
        )

        log.info(f"[{NODE_NAME}] {preset} → {steps} steps: {val_str}")

        return (sigmas, steps, info)


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXSigmaSchedule": WinnouganLTXSigmaSchedule,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXSigmaSchedule": "🔥 Winnougan LTX Sigma Schedule",
}
