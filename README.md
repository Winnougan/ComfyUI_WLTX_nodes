# 🔥 ComfyUI_WLTX_nodes — Winnougan's LTX-2.3 Utility Nodes

<img width="2400" height="1792" alt="full_body,_she&#39;s_holding_a_202605211159" src="https://github.com/user-attachments/assets/004078f3-ca3b-4156-90f2-51f849ed0685" />

> Custom LTX-2.3 nodes to save you time — by **Lord Winnougan**  
> 🎬 LTX Video · AI Generation · ComfyUI Workflows

---

## 📦 Included Nodes

| Node | Description |
|---|---|
| **⚡ Winnougan LTX Resolution & Frame Calculator** | Solves LTX's strict dimension rules — pick a preset or enter custom dimensions, wire outputs directly to your latent node |
| **🔥 Winnougan LTX Sigma Schedule** | Preset sigma schedules for LTX-2.3 Stage 1 and Stage 2 — no more copy-pasting cryptic number strings |
| **🔥 Winnougan LTX NAG Guidance** | Normalized Attention Guidance for LTX-2.3 distilled models — restores effective negative prompting |
| **🔥 Winnougan LTX Save Conditioning** | Save Gemma text encodings to disk as `.safetensors` — encode once, reuse forever |
| **🔥 Winnougan LTX Load Conditioning** | Load saved conditioning without running the text encoder — faster iterations, no VRAM wasted on Gemma |
| **Winnougan LTX Image Resize** | Resize images to match LTX-valid dimensions (÷32) |
| **Winnougan LTX Latent Preview** | Preview latent frames inline during generation |
| **Winnougan LTX Sound Notification** | Play a sound when generation finishes — never alt-tab check again |

---

## 🚀 Installation

### Option 1 — ComfyUI Manager (Recommended)
Search for **`ComfyUI_WLTX_nodes`** in ComfyUI Manager and install directly.

### Option 2 — Manual Install

```bash
cd ComfyUI/custom_nodes
git clone https://github.com/Winnougan/ComfyUI_WLTX_nodes.git
```

Restart ComfyUI. All nodes will appear under the **Winnougan LTX** category.

---

## 🖥️ Requirements

- [ComfyUI](https://github.com/comfyanonymous/ComfyUI)
- LTX-2.3 model (distilled recommended)
- Python 3.10+

---

## ⚠️ LTX-2.3 Rules You Need to Know

Before diving into the nodes, these are the constraints LTX enforces:

- **Width and height must be divisible by 32.** Standard resolutions like 1080 and 720 are NOT valid — LTX uses 1088 and 736 instead.
- **Frame count must follow the formula `8n+1`** (valid counts: 9, 17, 25, 33, 41, 49 … 97 …). Any other frame count will fail or produce garbage.
- **The distilled model doesn't respond to standard CFG negative prompting.** Use the NAG Guidance node instead.

The WLTX nodes solve all three of these automatically.

---

## 📖 Node Reference & Tutorial

All nodes live under **Winnougan LTX** in the ComfyUI node menu.

---

### ⚡ Resolution & Frame Calculator

**The first node to add to any LTX workflow.** It handles all the math so you don't have to.

**Inputs:**

| Input | Description |
|---|---|
| `preset` | Resolution presets — all pre-snapped to ÷32. Includes landscape, portrait, and square. Use `Custom` to enter your own. |
| `target_width` / `target_height` | Only used when preset is `Custom` |
| `fps` | Playback framerate. LTX native is 24fps. Use 30fps for social media exports. |
| `duration_seconds` | Video length in seconds — automatically rounded UP to nearest valid LTX frame count (8n+1) |

**Outputs:**

| Output | Wire to |
|---|---|
| `width` | `EmptyLTXVLatentVideo` width |
| `height` | `EmptyLTXVLatentVideo` height |
| `draft_width` / `draft_height` | Half-resolution inputs for Stage 1 draft pass |
| `frames` | `EmptyLTXVLatentVideo` length (LTX 8n+1 snapped) |
| `raw_frames` | PromptRelay `max_frames` or frame counters (plain seconds × fps) |
| `fps` / `fps_int` | Pass to your sampler or video save node |
| `actual_seconds` | Real duration after frame snapping |
| `info` | Show Text node — displays a full wiring summary |

**Available Presets:**
- LTX 512p (768×512) — fast draft
- LTX 720p (1280×736) — standard quality
- LTX 1080p (1920×1088) — high quality
- LTX 1440p (2560×1440), LTX 4K (3840×2160)
- Portrait variants for all sizes
- Square 512 and Square 1024

> **Tip:** Wire the `info` output into a Show Text node to see a full summary of what to connect where. It also warns you if any values were snapped.

---

### 🔥 Sigma Schedule

Replaces the ManualSigmas node with a human-readable preset dropdown. No more hunting for the right sigma values.

**Inputs:**

| Input | Description |
|---|---|
| `preset` | Select from the preset list or use `Custom` |
| `custom_sigmas` | Comma-separated values. Only used when preset is `Custom`. |

**Presets:**

| Preset | Sigmas | Use for |
|---|---|---|
| Stage 1 — Distilled 4-step (fast) | 0.85, 0.725, 0.421875, 0.0 | Main generation, fast |
| Stage 1 — Distilled 8-step (quality) | 1.0, 0.99375 … 0.421875, 0.0 | Main generation, more detail |
| Stage 2 — Upscaler 3-step | 0.421875, 0.2109375, 0.0 | Refinement after spatial upscaler |
| Stage 2 — Upscaler 4-step | 0.525, 0.421875, 0.2109375, 0.0 | Stronger upscaler refinement |

**Outputs:** `sigmas` → wire to `SamplerCustomAdvanced`, `steps` → wire to your sampler step count, `schedule_info` → Show Text

> **Tip:** Use Stage 1 for your main generation pass and Stage 2 after your spatial upscaler node for the refinement pass.

---

### 🔥 NAG Guidance

Normalized Attention Guidance for LTX-2.3 distilled models. The distilled model doesn't work with standard CFG negative prompting — NAG fixes that by patching the attention mechanism instead.

**Inputs:**

| Input | Description |
|---|---|
| `model` | Your loaded LTX model |
| `preset` | Strength preset. **Balanced is the right choice for most generations.** |
| `nag_scale` | How hard NAG pushes away from the negative prompt. Only used when preset is `Custom`. |
| `nag_alpha` | Blend between guided and original attention (0–1). Only used when preset is `Custom`. |
| `nag_tau` | Clipping threshold — lower = more aggressive. Only used when preset is `Custom`. |
| `negative_conditioning` | Wire your negative CONDITIONING here |
| `inplace` | In-place tensor ops to save a tiny bit of VRAM. Leave off unless extremely tight on VRAM. |

**Presets:**

| Preset | Scale | Alpha | Tau | When to use |
|---|---|---|---|---|
| Subtle | 6.0 | 0.15 | 3.5 | Gentle steering |
| Balanced (recommended) | 11.0 | 0.25 | 2.5 | Most generations |
| Strong | 16.0 | 0.35 | 2.0 | Aggressive negative prompting |
| Maximum | 25.0 | 0.50 | 1.5 | Very strong avoidance |

**Outputs:** `model` (patched — wire to sampler), `nag_info` → Show Text

**How to wire it:**
```
[LTX Model] → NAG Guidance (model in)
[Negative Conditioning] → NAG Guidance (negative_conditioning)
NAG Guidance (model out) → Sampler
```

> **Note:** NAG patches video AND audio cross-attention blocks when using LTX-2.3 with audio support. The `nag_info` output confirms whether audio was patched.

---

### 🔥 Save & Load Conditioning

Two nodes that work together to cache Gemma text encodings to disk. Encoding a prompt with Gemma takes time and VRAM on every run. If you're iterating on seeds, resolution, or samplers while keeping the same prompt — you're paying that cost unnecessarily.

**Save once. Load in milliseconds on every subsequent run. No Gemma loaded, no VRAM used.**

#### Save Conditioning

| Input | Description |
|---|---|
| `conditioning` | Wire your CONDITIONING here — it passes through unchanged |
| `filename` | Name for the saved file (no extension needed) |
| `dtype` | `bfloat16` recommended. `float16` for slightly smaller files. |

Saves to: `ComfyUI/models/embeddings/<filename>.safetensors`

The node UI shows the save path, file size, and timestamp after saving.

#### Load Conditioning

| Input | Description |
|---|---|
| `file_name` | Dropdown of all `.safetensors` files in your embeddings folder |
| `device` | `cpu` = load to RAM (safe), `gpu` = load direct to VRAM (faster) |

> **Tip:** Save your positive and negative conditioning separately (e.g. `my_scene_positive.safetensors` and `my_scene_negative.safetensors`). You can then skip the text encoder entirely on all subsequent runs and just use the Load nodes.

---

### 🔔 Sound Notification

Plays a sound file when your generation finishes. Drop it at the end of your workflow and never stare at the progress bar again.

Connect any audio file path (`.mp3`, `.wav`, `.ogg`, `.flac`, `.aac`, `.m4a`) to the node. The file is served through ComfyUI's server and plays in your browser tab when execution reaches the node.

---

## 🔗 Minimal LTX-2.3 Workflow

```
⚡ Resolution & Frame Calculator
     ↓ width, height, frames
EmptyLTXVLatentVideo
     ↓ LATENT

🔥 Sigma Schedule (Stage 1 — 4-step)
     ↓ sigmas, steps

[LTX Model] → 🔥 NAG Guidance → patched model
                ↑ negative conditioning

[Text Encoder] → positive conditioning
              → negative conditioning → NAG Guidance

SamplerCustomAdvanced
     ← patched model
     ← positive conditioning
     ← LATENT
     ← sigmas
     ↓ LATENT

VAE Decode → Video Combine → Save Video

🔔 Sound Notification (wire at the end)
```

**With conditioning cache (faster iterations):**
```
First run:
[Text Encoder] → 🔥 Save Conditioning → conditioning → sampler

Subsequent runs:
🔥 Load Conditioning → conditioning → sampler   ← no Gemma needed
```

---

## ❤️ Support

If these nodes save you time, consider supporting on Patreon — exclusive workflows, nodes, and LLM setups drop there first.

[![Support on Patreon](https://img.shields.io/badge/Patreon-Support%20Winnougan-F96854?style=for-the-badge&logo=patreon&logoColor=white)](https://www.patreon.com/c/u5867556)
[![Support on Ko-fi](https://img.shields.io/badge/Ko--fi-Support%20Winnougan-FF5E5B?style=for-the-badge&logo=kofi&logoColor=white)](https://ko-fi.com/Winnougan)
---

## 📄 License

MIT
