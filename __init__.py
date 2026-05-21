"""
ComfyUI_WLTX_nodes
Winnougan's LTX-2.3 utility nodes for ComfyUI
"""

from .wltx_resolution_calculator import (
    NODE_CLASS_MAPPINGS as CALC_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as CALC_DISPLAY,
)
from .wltx_sound_notification import (
    NODE_CLASS_MAPPINGS as SOUND_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SOUND_DISPLAY,
)
from .wltx_image_resize import (
    NODE_CLASS_MAPPINGS as RESIZE_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as RESIZE_DISPLAY,
)
from .wltx_sigma_schedule import (
    NODE_CLASS_MAPPINGS as SIGMA_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as SIGMA_DISPLAY,
)
from .wltx_conditioning import (
    NODE_CLASS_MAPPINGS as COND_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as COND_DISPLAY,
)
from .wltx_latent_preview import (
    NODE_CLASS_MAPPINGS as PREVIEW_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as PREVIEW_DISPLAY,
)
from .wltx_nag_guidance import (
    NODE_CLASS_MAPPINGS as NAG_MAPPINGS,
    NODE_DISPLAY_NAME_MAPPINGS as NAG_DISPLAY,
)


def _print_banner():
    PATREON_URL = "https://www.patreon.com/c/u5867556"
    LINK  = f"\033]8;;{PATREON_URL}\033\\{PATREON_URL}\033]8;;\033\\"
    FIRE  = "\033[38;2;255;100;0m"
    RED   = "\033[38;2;255;69;0m"
    AMBER = "\033[38;2;255;200;100m"
    DARK  = "\033[38;2;139;0;0m"
    RESET = "\033[0m"
    BOLD  = "\033[1m"

    banner = f"""
{FIRE}{'='*58}{RESET}
{FIRE}  \U0001f525  {BOLD}{AMBER}WINNOUGAN LTX NODES  |  ComfyUI_WLTX_nodes{RESET}{FIRE}  \U0001f525{RESET}
{DARK}{'='*58}{RESET}
{RED}  \U0001f3ac LTX-2.3 utility nodes by Lord Winnougan{RESET}
{FIRE}  \u2b50 Support on Patreon:{RESET}
{AMBER}  \U0001f449 {LINK}{RESET}
{DARK}{'-'*58}{RESET}
{FIRE}  \u26a1 Nodes loaded:{RESET}
{DARK}     Winnougan LTX Resolution & Frame Calculator
     Winnougan LTX Sound Notification
     Winnougan LTX Image Resize
     Winnougan LTX Sigma Schedule
     Winnougan LTX Save Conditioning
     Winnougan LTX Load Conditioning
     Winnougan LTX Latent Preview
     Winnougan LTX NAG Guidance{RESET}
{FIRE}{'='*58}{RESET}
"""
    print(banner)


_print_banner()


# ── Sound file server endpoint ────────────────────────────────────────────────
try:
    import os
    from aiohttp import web
    from server import PromptServer

    @PromptServer.instance.routes.post("/wltx_sound")
    async def wltx_sound_serve(request):
        try:
            data = await request.json()
            path = data.get("path", "").strip().strip('"').strip("'").strip()
            if not path or not os.path.isfile(path):
                return web.Response(status=404, text="Sound file not found")
            ext = os.path.splitext(path)[1].lower()
            mime_map = {
                ".mp3":  "audio/mpeg",
                ".wav":  "audio/wav",
                ".ogg":  "audio/ogg",
                ".aac":  "audio/aac",
                ".flac": "audio/flac",
                ".aiff": "audio/aiff",
                ".aif":  "audio/aiff",
                ".m4a":  "audio/mp4",
                ".webm": "audio/webm",
            }
            mime = mime_map.get(ext, "audio/mpeg")
            with open(path, "rb") as f:
                audio_data = f.read()
            return web.Response(
                body=audio_data,
                content_type=mime,
                headers={"Cache-Control": "no-cache"},
            )
        except Exception as e:
            return web.Response(status=500, text=str(e))

except Exception as e:
    import logging
    logging.getLogger("Winnougan").warning(f"[WLTX Sound] Could not register sound endpoint: {e}")


NODE_CLASS_MAPPINGS = {
    **CALC_MAPPINGS,
    **SOUND_MAPPINGS,
    **RESIZE_MAPPINGS,
    **SIGMA_MAPPINGS,
    **COND_MAPPINGS,
    **PREVIEW_MAPPINGS,
    **NAG_MAPPINGS,
}

NODE_DISPLAY_NAME_MAPPINGS = {
    **CALC_DISPLAY,
    **SOUND_DISPLAY,
    **RESIZE_DISPLAY,
    **SIGMA_DISPLAY,
    **COND_DISPLAY,
    **PREVIEW_DISPLAY,
    **NAG_DISPLAY,
}

WEB_DIRECTORY = "./js"
__all__ = ["NODE_CLASS_MAPPINGS", "NODE_DISPLAY_NAME_MAPPINGS", "WEB_DIRECTORY"]
