"""
Winnougan LTX Sound Notification
──────────────────────────────────
Plays a custom sound file when a render completes or fails.

  • Success sound — plays when the generation finishes successfully
  • Error sound   — plays when ComfyUI hits an error (OOM, interrupt, etc.)

Supports any audio format the browser can play:
  mp3, wav, ogg, aac, flac, aiff, m4a, webm

The node is a passthrough — connect it anywhere in your workflow
(model, latent, image, anything) and it will fire after that node
executes. The sounds are triggered from the JS frontend so they
play through your speakers, not the server.

Usage
─────
  1. Drop the node into your workflow
  2. Set the path to your success and/or error sound files
  3. Wire any output from the previous node into "any_input"
  4. The "any_output" passes through unchanged
"""

import os
import logging

log = logging.getLogger("Winnougan")
NODE_NAME = "Winnougan LTX Sound Notification"

SUPPORTED_FORMATS = [".mp3", ".wav", ".ogg", ".aac", ".flac", ".aiff", ".m4a", ".webm"]


class WinnouganLTXSoundNotification:
    NAME     = NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "success_sound": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "tooltip": (
                        "Full path to sound file played when render completes. "
                        "Supports mp3, wav, ogg, aac, flac, aiff, m4a. "
                        "Leave empty to use no success sound."
                    ),
                }),
                "error_sound": ("STRING", {
                    "default": "",
                    "multiline": False,
                    "tooltip": (
                        "Full path to sound file played when render errors (OOM, interrupt, etc.). "
                        "Leave empty to use no error sound."
                    ),
                }),
                "volume": ("FLOAT", {
                    "default": 0.8,
                    "min": 0.0,
                    "max": 1.0,
                    "step": 0.05,
                    "tooltip": "Playback volume. 1.0 = full, 0.0 = silent.",
                }),
            },
            "optional": {
                "any_input": ("*", {}),
            },
        }

    RETURN_TYPES  = ("*",)
    RETURN_NAMES  = ("any_output",)
    FUNCTION      = "notify"
    OUTPUT_NODE   = True

    def notify(self, success_sound, error_sound, volume, any_input=None):
        # Strip quotes from paths
        success_sound = success_sound.strip().strip('"').strip("'").strip()
        error_sound   = error_sound.strip().strip('"').strip("'").strip()

        # Validate files exist
        success_valid = bool(success_sound) and os.path.isfile(success_sound)
        error_valid   = bool(error_sound)   and os.path.isfile(error_sound)

        if success_sound and not success_valid:
            log.warning(f"[{NODE_NAME}] Success sound not found: '{success_sound}'")
        if error_sound and not error_valid:
            log.warning(f"[{NODE_NAME}] Error sound not found: '{error_sound}'")

        # Pass paths and volume to the JS frontend via ui dict
        # The JS will handle playing them at the right moment
        return {
            "ui": {
                "success_sound": [success_sound if success_valid else ""],
                "error_sound":   [error_sound   if error_valid   else ""],
                "volume":        [volume],
            },
            "result": (any_input,),
        }


NODE_CLASS_MAPPINGS = {
    "WinnouganLTXSoundNotification": WinnouganLTXSoundNotification,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXSoundNotification": "🔥 Winnougan LTX Sound Notification",
}
