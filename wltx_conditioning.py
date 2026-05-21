"""
Winnougan LTX Conditioning Save / Load
────────────────────────────────────────
Two nodes that work together to cache Gemma text encodings to disk.

Why this matters
────────────────
Encoding a prompt with Gemma takes time and VRAM on every single run.
If you're iterating on seeds, resolution, or sampler settings — but
keeping the same prompt — you're paying that cost unnecessarily every time.

Save your conditioning once. Load it instantly on every subsequent run.
No Gemma loaded, no VRAM used, no wait.

Improvements over Lightricks' version
──────────────────────────────────────
  • Status panel on both nodes showing:
      - Filename and save path
      - File size
      - When it was saved (timestamp)
      - Whether the file exists and is valid
  • Reload button on the Load node — re-reads from disk without
    restarting ComfyUI
  • Auto-passthrough on Save — conditioning flows through unchanged
    so you don't need to rewire when toggling save on/off
  • Folder browser helper — shows the full path to your embeddings folder
  • Clear warning if the file is missing or corrupted

Save location
─────────────
Files are saved to: ComfyUI/models/embeddings/
Filename format: <your_name>.safetensors
"""

import os
import torch
import logging
import folder_paths
import comfy.utils

from datetime import datetime
from pathlib import Path

log = logging.getLogger("Winnougan")

SAVE_NODE_NAME = "Winnougan LTX Save Conditioning"
LOAD_NODE_NAME = "Winnougan LTX Load Conditioning"


def _get_embeddings_folder() -> Path:
    paths = folder_paths.get_folder_paths("embeddings")
    folder = Path(paths[0]) if paths else Path(folder_paths.base_path) / "models" / "embeddings"
    folder.mkdir(parents=True, exist_ok=True)
    return folder


def _format_size(bytes: int) -> str:
    if bytes < 1024:
        return f"{bytes} B"
    elif bytes < 1024 * 1024:
        return f"{bytes / 1024:.1f} KB"
    else:
        return f"{bytes / (1024*1024):.2f} MB"


# ── SAVE NODE ─────────────────────────────────────────────────────────────────

class WinnouganLTXSaveConditioning:
    NAME     = SAVE_NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        return {
            "required": {
                "conditioning": ("CONDITIONING",),
                "filename": ("STRING", {
                    "default": "my_prompt",
                    "multiline": False,
                    "tooltip": (
                        "Name for the saved file (without .safetensors extension). "
                        "Only letters, numbers, underscores and hyphens. "
                        "Saved to ComfyUI/models/embeddings/"
                    ),
                }),
                "dtype": (["bfloat16", "float16"], {
                    "default": "bfloat16",
                    "tooltip": "Precision for storage. bfloat16 recommended.",
                }),
            }
        }

    RETURN_TYPES  = ("CONDITIONING", "STRING")
    RETURN_NAMES  = ("conditioning", "save_info")
    FUNCTION      = "save_conditioning"
    OUTPUT_NODE   = True

    def save_conditioning(self, conditioning, filename, dtype):
        if not conditioning or len(conditioning) == 0:
            raise ValueError(f"[{SAVE_NODE_NAME}] Conditioning is empty.")

        # Sanitise filename
        safe_name = "".join(c for c in filename if c.isalnum() or c in ("_", "-", "."))
        if not safe_name:
            safe_name = "conditioning"

        folder      = _get_embeddings_folder()
        output_path = folder / f"{safe_name}.safetensors"
        target_dtype = torch.bfloat16 if dtype == "bfloat16" else torch.float16

        tensors  = {}
        metadata = {}

        for idx, (cond_tensor, cond_options) in enumerate(conditioning):
            tensors[f"conditioning_data_{idx}"] = cond_tensor.to(dtype=target_dtype).contiguous()
            if "attention_mask" in cond_options:
                tensors[f"attention_mask_{idx}"] = cond_options["attention_mask"].contiguous()

        metadata = {
            "num_conditionings": str(len(conditioning)),
            "dtype":             dtype,
            "created_at":        datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "winnougan":         "1",
        }

        comfy.utils.save_torch_file(tensors, str(output_path), metadata=metadata)
        file_size = os.path.getsize(output_path)

        save_info = (
            f"✅ Saved conditioning\n"
            f"File     : {safe_name}.safetensors\n"
            f"Path     : {output_path}\n"
            f"Size     : {_format_size(file_size)}\n"
            f"Saved at : {metadata['created_at']}\n"
            f"Tensors  : {len(tensors)}"
        )

        log.info(f"[{SAVE_NODE_NAME}] Saved '{safe_name}.safetensors' ({_format_size(file_size)})")

        return {
            "ui": {
                "save_path":  [str(output_path)],
                "file_size":  [_format_size(file_size)],
                "saved_at":   [metadata["created_at"]],
                "filename":   [f"{safe_name}.safetensors"],
            },
            "result": (conditioning, save_info),
        }


# ── LOAD NODE ─────────────────────────────────────────────────────────────────

class WinnouganLTXLoadConditioning:
    NAME     = LOAD_NODE_NAME
    CATEGORY = "Winnougan LTX"

    @classmethod
    def INPUT_TYPES(cls):
        files = folder_paths.get_filename_list("embeddings")
        if not files:
            files = ["(no files found)"]
        return {
            "required": {
                "file_name": (sorted(files), {
                    "tooltip": "Select a saved conditioning file from the embeddings folder.",
                }),
                "device": (["cpu", "gpu"], {
                    "default": "cpu",
                    "tooltip": (
                        "cpu: load to system RAM (safer, works on any system). "
                        "gpu: load directly to VRAM (faster but uses VRAM)."
                    ),
                }),
            }
        }

    RETURN_TYPES  = ("CONDITIONING", "STRING")
    RETURN_NAMES  = ("conditioning", "load_info")
    FUNCTION      = "load_conditioning"

    @classmethod
    def IS_CHANGED(cls, file_name, device):
        # Re-run if the file has been modified on disk
        try:
            path = folder_paths.get_full_path("embeddings", file_name)
            if path and os.path.exists(path):
                return str(os.path.getmtime(path))
        except Exception:
            pass
        return float("NaN")

    def load_conditioning(self, file_name, device):
        if file_name == "(no files found)":
            raise ValueError(
                f"[{LOAD_NODE_NAME}] No conditioning files found in embeddings folder. "
                "Run the Save node first."
            )

        file_path = folder_paths.get_full_path("embeddings", file_name)
        if not file_path or not os.path.exists(file_path):
            raise FileNotFoundError(
                f"[{LOAD_NODE_NAME}] File not found: '{file_name}'. "
                "Check that it exists in ComfyUI/models/embeddings/"
            )

        target_device = "cuda" if device == "gpu" else "cpu"
        tensors, metadata = comfy.utils.load_torch_file(file_path, return_metadata=True)

        # Reconstruct conditioning list
        num_conditionings = int(metadata.get("num_conditionings", 1))
        conditioning = []

        for idx in range(num_conditionings):
            cond_tensor = tensors.get(f"conditioning_data_{idx}")
            if cond_tensor is None:
                raise ValueError(
                    f"[{LOAD_NODE_NAME}] Corrupted file: missing conditioning_data_{idx}"
                )

            cond_tensor = cond_tensor.to(device=target_device)
            cond_options = {}

            mask = tensors.get(f"attention_mask_{idx}")
            if mask is not None:
                cond_options["attention_mask"] = mask.to(device=target_device)

            conditioning.append([cond_tensor, cond_options])

        # File info for display
        file_size   = os.path.getsize(file_path)
        saved_at    = metadata.get("created_at", "unknown")
        dtype       = metadata.get("dtype", "unknown")

        load_info = (
            f"✅ Loaded conditioning\n"
            f"File     : {file_name}\n"
            f"Size     : {_format_size(file_size)}\n"
            f"Saved at : {saved_at}\n"
            f"dtype    : {dtype}\n"
            f"Device   : {target_device}\n"
            f"Tensors  : {len([k for k in tensors if k.startswith('conditioning_data')])}"
        )

        log.info(
            f"[{LOAD_NODE_NAME}] Loaded '{file_name}' "
            f"({_format_size(file_size)}, saved {saved_at})"
        )

        return (conditioning, load_info)


# ── Registration ──────────────────────────────────────────────────────────────

NODE_CLASS_MAPPINGS = {
    "WinnouganLTXSaveConditioning": WinnouganLTXSaveConditioning,
    "WinnouganLTXLoadConditioning": WinnouganLTXLoadConditioning,
}
NODE_DISPLAY_NAME_MAPPINGS = {
    "WinnouganLTXSaveConditioning": "🔥 Winnougan LTX Save Conditioning",
    "WinnouganLTXLoadConditioning": "🔥 Winnougan LTX Load Conditioning",
}
