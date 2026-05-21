"""
Winnougan LTX Resolution & Frame Calculator
─────────────────────────────────────────────
Solves LTX-2.3's strict dimension rules automatically:

  • Width and height must be divisible by 32
  • Frame count must be 8n+1 (9, 17, 25, 33, 41 … 97 …)

You enter seconds and pick a resolution. The node outputs clean integers
ready to wire directly into EmptyLTXVLatentVideo and your image resize node.
"""

import math
import logging
import folder_paths

log = logging.getLogger("Winnougan")
NODE_NAME = "Winnougan LTX Resolution & Frame Calculator"

# All resolutions are pre-snapped to multiples of 32 (LTX requirement).
# Standard broadcast resolutions like 720 and 1080 are NOT divisible by 32,
# so LTX uses its own conventions — these match what Lightricks recommends.
RESOLUTION_PRESETS = {
    "Custom":                    (0,    0),
    # Landscape — LTX native resolutions (all divisible by 32)
    "LTX 512p  (768x512)":       ( 768,  512),   # fast draft
    "LTX 720p  (1280x736)":      (1280,  736),   # 736 = nearest ÷32 to 720
    "LTX 1080p (1920x1088)":     (1920, 1088),   # 1088 = nearest ÷32 to 1080
    "LTX 1440p (2560x1440)":     (2560, 1440),   # already valid
    "LTX 4K    (3840x2160)":     (3840, 2160),   # already valid
    # Portrait / vertical
    "Portrait 512p  (512x768)":  ( 512,  768),
    "Portrait 720p  (736x1280)": ( 736, 1280),
    "Portrait 1080p (1088x1920)":(1088, 1920),
    # Square
    "Square 512  (512x512)":     ( 512,  512),
    "Square 1024 (1024x1024)":   (1024, 1024),
}


def snap32(value: int) -> int:
    """Round UP to nearest multiple of 32."""
    return int(math.ceil(value / 32) * 32)


def seconds_to_ltx_frames(seconds: float, fps: int = 24) -> int:
    """
    Convert seconds to the nearest valid LTX frame count (8n+1).
    Always rounds UP so you get at least the requested duration.
    Minimum 9 frames.
    """
    raw = max(9, int(math.ceil(seconds * fps)))
    n = math.ceil((raw - 1) / 8)
    return 8 * n + 1


class WinnouganLTXResolutionCalculator:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "preset": (list(RESOLUTION_PRESETS.keys()), {
                    "default": "LTX 720p  (1280x736)",
                    "tooltip": "Target output resolution. Use 'Custom' to enter width/height manually.",
                }),
                "target_width": ("INT", {
                    "default": 1920, "min": 64, "max": 8192, "step": 32,
                    "tooltip": "Only used when preset is 'Custom'.",
                }),
                "target_height": ("INT", {
                    "default": 1080, "min": 64, "max": 8192, "step": 32,
                    "tooltip": "Only used when preset is 'Custom'.",
                }),
                "fps": ("FLOAT", {
                    "default": 24.0,
                    "min": 1.0, "max": 120.0, "step": 1.0,
                    "tooltip": "Playback framerate. LTX native is 24fps. Use 30fps for social media.",
                }),
                "duration_seconds": ("FLOAT", {
                    "default": 4.0, "min": 0.5, "max": 60.0, "step": 0.5,
                    "tooltip": "Video duration in seconds. Automatically snapped to nearest valid LTX frame count (8n+1).",
                }),
            }
        }

    RETURN_TYPES  = ("INT", "INT", "INT", "INT", "INT", "INT", "FLOAT", "INT", "FLOAT", "STRING")
    RETURN_NAMES  = ("width", "height", "draft_width", "draft_height", "frames", "raw_frames", "fps", "fps_int", "actual_seconds", "info")
    FUNCTION      = "calculate"

    @classmethod
    def IS_CHANGED(cls, preset, target_width, target_height, fps, duration_seconds):
        """Return a value that changes whenever inputs change — forces re-execution."""
        return (preset, target_width, target_height, fps, duration_seconds)

    def calculate(self, preset, target_width, target_height, fps, duration_seconds):

        # Resolve resolution — normalize whitespace in key to be safe
        resolved = None
        if preset and preset.strip() != "Custom":
            # Try exact match first, then whitespace-normalized match
            if preset in RESOLUTION_PRESETS:
                resolved = RESOLUTION_PRESETS[preset]
            else:
                for key, val in RESOLUTION_PRESETS.items():
                    if key.split("(")[0].strip() == preset.split("(")[0].strip():
                        resolved = val
                        break

        if resolved:
            w, h = resolved
        else:
            w, h = target_width, target_height

        log.info(f"[{NODE_NAME}] Preset='{preset}' → {w}×{h}")

        # Snap to ×32
        width  = snap32(w)
        height = snap32(h)

        # Draft = half resolution for stage 1 (EmptyLTXVLatentVideo)
        # This matches the old a/2 ComfyMath nodes
        draft_width  = snap32(width  // 2)
        draft_height = snap32(height // 2)

        # Convert seconds → valid LTX frame count (8n+1, for EmptyLTXVLatentVideo)
        frames         = seconds_to_ltx_frames(duration_seconds, int(fps))
        actual_seconds = frames / fps

        # Raw frame count — plain seconds×fps, no LTX snapping.
        # Use this for PromptRelay max_frames, frame counters, etc.
        raw_frames = max(1, round(duration_seconds * fps))

        # Snap warning
        snap_note = ""
        if width != w or height != h:
            snap_note = f"  ⚠ Snapped {w}×{h} → {width}×{height} (must be ÷32)\n"

        frame_note = ""
        requested_frames = int(math.ceil(duration_seconds * fps))
        if frames != requested_frames:
            frame_note = f"  ⚠ Snapped {requested_frames} → {frames} frames (must be 8n+1)\n"

        info = (
            f"═══ Winnougan LTX Calculator ═══\n"
            f"\n"
            f"Resolution : {width} × {height}\n"
            f"{snap_note}"
            f"Duration   : {duration_seconds}s @ {fps:.0f}fps\n"
            f"raw_frames : {raw_frames}  (seconds × fps)\n"
            f"frames     : {frames}  (LTX 8n+1 snapped)\n"
            f"{frame_note}"
            f"\n"
            f"Wire to EmptyLTXVLatentVideo:\n"
            f"  width  → {width}\n"
            f"  height → {height}\n"
            f"  length → frames ({frames})\n"
            f"\n"
            f"Wire to PromptRelay max_frames:\n"
            f"  raw_frames → {raw_frames}\n"
            f"\n"
            f"REMINDER: use same seed if multi-pass"
        )

        log.info(
            f"[{NODE_NAME}] target={width}×{height} draft={draft_width}×{draft_height} | "
            f"raw={raw_frames} ltx_frames={frames} ({actual_seconds:.2f}s @ {fps:.0f}fps)"
        )

        return (width, height, draft_width, draft_height, frames, raw_frames, fps, int(fps), actual_seconds, info)


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXResolutionCalculator": WinnouganLTXResolutionCalculator,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXResolutionCalculator": "⚡ Winnougan LTX Resolution & Frame Calculator",
}
