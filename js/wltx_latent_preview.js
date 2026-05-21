import { app } from "../../scripts/app.js";
import { api } from "../../scripts/api.js";

const NODE_TYPE = "WinnouganLTXLatentPreview";

// ── Palette ──────────────────────────────────────────────────────────────────
const FIRE  = { core:"#FF4500", bright:"#FF6A00", hot:"#FF9500", white:"#FFEEAA", deep:"#8B0000" };
const EMBER = { core:"#FFD700", bright:"#FFAA00" };
const GREEN = { core:"#4ade80", bright:"#6aef9a" };

// ── Animated fire border ─────────────────────────────────────────────────────
function drawFireBorder(ctx, node) {
    if (node.flags?.collapsed) return;
    const w = node.size[0];
    const h = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT;
    const r = 8;
    const t = Date.now() / 1000;
    const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6) + 1.0);
    app.graph.setDirtyCanvas(true, false);
    ctx.save();

    // Deep outer glow
    ctx.shadowColor = FIRE.deep; ctx.shadowBlur = 30 + pulse * 20;
    ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 1; ctx.globalAlpha = 0.10 + pulse * 0.10;
    ctx.beginPath(); ctx.roundRect(-3, yOff - 3, w + 6, h + 6, r + 3); ctx.stroke();

    // Core fire ring
    ctx.shadowColor = FIRE.core; ctx.shadowBlur = 16 + pulse * 20;
    ctx.strokeStyle = FIRE.core; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.60 + pulse * 0.28;
    ctx.beginPath(); ctx.roundRect(0, yOff, w, h, r); ctx.stroke();

    // Bright inner flicker
    ctx.shadowColor = FIRE.bright; ctx.shadowBlur = 7 + pulse2 * 12;
    ctx.strokeStyle = FIRE.bright; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.30 + pulse2 * 0.45;
    ctx.beginPath(); ctx.roundRect(1.5, yOff + 1.5, w - 3, h - 3, r); ctx.stroke();

    // Corner embers
    ctx.shadowColor = EMBER.core; ctx.shadowBlur = 8; ctx.globalAlpha = 0.4 + pulse * 0.5;
    ctx.fillStyle = EMBER.core;
    const dotR = 1.8 + pulse * 1.8;
    for (const [cx, cy] of [[0, yOff], [w, yOff], [0, yOff + h], [w, yOff + h]]) {
        ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
}

// ── Widget layout helper ─────────────────────────────────────────────────────
function getPanelY(node) {
    const widgets = (node.widgets ?? []).filter(w => !w.hidden && w.type !== "hidden");
    if (!widgets.length) return LiteGraph.NODE_TITLE_HEIGHT + 6;
    let maxY = 0;
    for (const w of widgets) {
        const y = (w.last_y ?? 0) + (LiteGraph.NODE_WIDGET_HEIGHT ?? 20);
        if (y > maxY) maxY = y;
    }
    if (maxY < LiteGraph.NODE_TITLE_HEIGHT) {
        const TH = LiteGraph.NODE_TITLE_HEIGHT, wH = LiteGraph.NODE_WIDGET_HEIGHT ?? 20;
        return TH + 6 + widgets.length * (wH + 4) + 4;
    }
    return maxY + 6;
}

// ── Time formatter ───────────────────────────────────────────────────────────
function formatTime(secs) {
    if (secs < 60) return `${secs.toFixed(0)}s`;
    const m = Math.floor(secs / 60), s = Math.round(secs % 60);
    return `${m}m ${s.toString().padStart(2, "0")}s`;
}

// ── Extension ────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.LTXLatentPreview",

    async setup() {
        // Step/ETA HUD stats from our custom Python event
        api.addEventListener("winnougan_ltx_preview", (event) => {
            const data = event.detail;
            for (const node of app.graph._nodes) {
                if (node.type === NODE_TYPE) {
                    node._previewStep    = data.step;
                    node._previewTotal   = data.total;
                    node._previewElapsed = data.elapsed;
                    node._previewEta     = data.eta;
                    node._isRunning      = true;
                    node.setDirtyCanvas(true);
                }
            }
        });

        // Clear running state when done
        api.addEventListener("executed", () => {
            for (const node of app.graph._nodes) {
                if (node.type === NODE_TYPE) {
                    node._isRunning = false;
                    node.setDirtyCanvas(true);
                }
            }
        });

        api.addEventListener("execution_interrupted", () => {
            for (const node of app.graph._nodes) {
                if (node.type === NODE_TYPE) {
                    node._isRunning = false;
                    node.setDirtyCanvas(true);
                }
            }
        });
    },

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        // ── onCreate ────────────────────────────────────────────────────────
        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color   = "#2a0500";
            this.bgcolor = "#1a0200";
            this.title   = "🔥 Winnougan LTX Latent Preview";
            this._previewStep    = 0;
            this._previewTotal   = 0;
            this._previewElapsed = 0;
            this._previewEta     = 0;
            this._isRunning      = false;
            this._lastCompleted  = null;
        };

        // ── onExecuted ──────────────────────────────────────────────────────
        nodeType.prototype.onExecuted = function () {
            this._isRunning     = false;
            this._lastCompleted = Date.now();
            this.setDirtyCanvas(true);
        };

        // ── onDrawBackground — fire border ──────────────────────────────────
        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            drawFireBorder(ctx, this);
        };

        // ── onDrawForeground — badge only, ComfyUI handles preview display ──
        const origFg = nodeType.prototype.onDrawForeground;
        nodeType.prototype.onDrawForeground = function (ctx) {
            origFg?.call(this, ctx);
            if (this.flags?.collapsed) return;

            const W = this.size[0];
            const t = Date.now() / 1000;
            const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
            const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6));

            ctx.save();
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
            ctx.fillStyle = FIRE.hot; ctx.shadowColor = FIRE.core; ctx.shadowBlur = 8 + pulse * 6;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.fillStyle = FIRE.white; ctx.shadowColor = FIRE.white;
            ctx.shadowBlur = 4 + pulse2 * 8; ctx.globalAlpha = pulse2 * 0.3;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;
            ctx.restore();
        };
    },
});
