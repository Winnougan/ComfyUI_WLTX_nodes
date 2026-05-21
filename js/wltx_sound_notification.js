import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPE = "WinnouganLTXSoundNotification";

// ── Fire palette (matches family theme) ──────────────────────────────────────
const FIRE = {
    core:   "#FF4500",
    bright: "#FF6A00",
    hot:    "#FF9500",
    white:  "#FFEEAA",
    deep:   "#8B0000",
    plasma: "#FF2200",
};

const EMBER = { core: "#FFD700", bright: "#FFAA00" };

// ── Audio engine ──────────────────────────────────────────────────────────────
// Fetches the sound file from the ComfyUI server via a proxy endpoint,
// decodes it, and plays it through the Web Audio API.
// This works for any format the browser supports.

let _audioCtx = null;

function getAudioCtx() {
    if (!_audioCtx || _audioCtx.state === "closed") {
        _audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    return _audioCtx;
}

async function playSound(filePath, volume) {
    if (!filePath) return;
    try {
        // Resume context if suspended (browser autoplay policy)
        const ctx = getAudioCtx();
        if (ctx.state === "suspended") await ctx.resume();

        // Fetch the file via our server endpoint
        const resp = await fetch("/wltx_sound", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ path: filePath }),
        });

        if (!resp.ok) {
            console.warn(`[WLTX Sound] Failed to fetch: ${filePath} (${resp.status})`);
            return;
        }

        const arrayBuf = await resp.arrayBuffer();
        const audioBuf = await ctx.decodeAudioData(arrayBuf);

        const source = ctx.createBufferSource();
        source.buffer = audioBuf;

        const gainNode = ctx.createGain();
        gainNode.gain.value = Math.max(0, Math.min(1, volume));

        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);

    } catch (err) {
        console.warn(`[WLTX Sound] Playback error for "${filePath}":`, err);
    }
}

// ── Per-node sound config store ───────────────────────────────────────────────
// Keyed by node ID. Updated whenever onExecuted fires.
const _nodeConfigs = {};

// ── Global API event listeners ────────────────────────────────────────────────
// Registered once. Fire for every node in the graph.

let _listenersInstalled = false;

function installListeners() {
    if (_listenersInstalled) return;
    _listenersInstalled = true;

    // Success — fires when a full prompt execution completes cleanly
    api.addEventListener("executed", (event) => {
        const nodeId = String(event.detail?.node ?? "");
        const cfg    = _nodeConfigs[nodeId];
        if (!cfg) return;
        playSound(cfg.success_sound, cfg.volume);
    });

    // Error / OOM / interrupt — fire the error sound from ANY configured node
    const playErrorFromAny = () => {
        for (const cfg of Object.values(_nodeConfigs)) {
            if (cfg.error_sound) {
                playSound(cfg.error_sound, cfg.volume);
                break; // play once even if multiple nodes exist
            }
        }
    };

    api.addEventListener("execution_error",       playErrorFromAny);
    api.addEventListener("execution_interrupted", playErrorFromAny);
}

// ── Sparkle-free fire border (lightweight for a utility node) ────────────────
function drawFireBorder(ctx, node) {
    if (node.flags?.collapsed) return;
    const w = node.size[0], h = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT, r = 8;
    const t = Date.now() / 1000;
    const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6) + 1.0);

    app.graph.setDirtyCanvas(true, false);
    ctx.save();

    ctx.shadowColor = FIRE.deep;  ctx.shadowBlur = 30 + pulse * 20;
    ctx.strokeStyle = FIRE.deep;  ctx.lineWidth = 1; ctx.globalAlpha = 0.10 + pulse * 0.10;
    ctx.beginPath(); ctx.roundRect(-3, yOff - 3, w + 6, h + 6, r + 3); ctx.stroke();

    ctx.shadowColor = FIRE.core;  ctx.shadowBlur = 16 + pulse * 20;
    ctx.strokeStyle = FIRE.core;  ctx.lineWidth = 2.5; ctx.globalAlpha = 0.60 + pulse * 0.28;
    ctx.beginPath(); ctx.roundRect(0, yOff, w, h, r); ctx.stroke();

    ctx.shadowColor = FIRE.bright; ctx.shadowBlur = 7 + pulse2 * 12;
    ctx.strokeStyle = FIRE.bright; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.30 + pulse2 * 0.45;
    ctx.beginPath(); ctx.roundRect(1.5, yOff + 1.5, w - 3, h - 3, r); ctx.stroke();

    // Corner ember dots
    ctx.shadowColor = EMBER.core; ctx.shadowBlur = 8;
    ctx.globalAlpha = 0.4 + pulse * 0.5; ctx.fillStyle = EMBER.core;
    const dotR = 1.8 + pulse * 1.8;
    for (const [cx, cy] of [[0, yOff], [w, yOff], [0, yOff + h], [w, yOff + h]]) {
        ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// ── Extension ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.LTXSoundNotification",

    async setup() {
        installListeners();
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color   = "#2a0500";
            this.bgcolor = "#1a0200";
            this.title   = "🔥 Winnougan LTX Sound Notification";
            this._statusText = null;
            this._statusIsError = false;
        };

        // When the node executes, store its config and show status
        nodeType.prototype.onExecuted = function (data) {
            const cfg = {
                success_sound: data?.success_sound?.[0] ?? "",
                error_sound:   data?.error_sound?.[0]   ?? "",
                volume:        data?.volume?.[0]         ?? 0.8,
            };
            _nodeConfigs[String(this.id)] = cfg;

            // Show what's loaded
            const hasSuc = !!cfg.success_sound;
            const hasErr = !!cfg.error_sound;
            if (hasSuc || hasErr) {
                const parts = [];
                if (hasSuc) parts.push("✓ success sound loaded");
                if (hasErr) parts.push("✓ error sound loaded");
                this._statusText = parts.join("  ");
                this._statusIsError = false;
            } else {
                this._statusText = "⚠ no sound files set";
                this._statusIsError = true;
            }
            this.setDirtyCanvas(true);
        };

        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            drawFireBorder(ctx, this);
        };

        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];
            const H = this.size[1];
            const t = Date.now() / 1000;
            const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
            const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6));

            ctx.save();

            // Badge
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
            ctx.fillStyle = FIRE.hot; ctx.shadowColor = FIRE.core; ctx.shadowBlur = 8 + pulse * 6;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.fillStyle = FIRE.white; ctx.shadowColor = FIRE.white;
            ctx.shadowBlur = 4 + pulse2 * 8; ctx.globalAlpha = pulse2 * 0.3;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            // Status text at bottom of node
            if (this._statusText) {
                const TH = LiteGraph.NODE_TITLE_HEIGHT;
                const wH = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
                const nW = (this.widgets ?? []).filter(w => !w.hidden).length;
                const statusY = TH + 6 + nW * (wH + 4) + 10;

                if (statusY < H - 4) {
                    ctx.font = "bold 9px monospace";
                    ctx.textAlign = "center"; ctx.textBaseline = "middle";
                    ctx.fillStyle = this._statusIsError ? FIRE.bright : EMBER.bright;
                    ctx.shadowColor = this._statusIsError ? FIRE.core : EMBER.core;
                    ctx.shadowBlur = 4;
                    ctx.fillText(this._statusText, W / 2, statusY);
                    ctx.shadowBlur = 0;
                }
            }

            ctx.restore();
        };

        nodeType.prototype.computeSize = function () {
            const TH = LiteGraph.NODE_TITLE_HEIGHT;
            const wH = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
            const nW = (this.widgets ?? []).filter(w => !w.hidden).length;
            return [400, TH + 6 + nW * (wH + 4) + (this._statusText ? 28 : 10)];
        };
    },
});
