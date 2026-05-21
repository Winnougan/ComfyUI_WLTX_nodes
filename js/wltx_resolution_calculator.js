import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganLTXResolutionCalculator";

// ── Fire palette ──────────────────────────────────────────────────────────────
const FIRE = {
    core:   "#FF4500",   // deep orange-red
    bright: "#FF6A00",   // orange
    hot:    "#FF9500",   // amber
    white:  "#FFEEAA",   // white-hot
    deep:   "#8B0000",   // dark red ember
    plasma: "#FF2200",   // pure red
    smoke:  "#1a0800",   // near-black with red tint
};

const EMBER = {
    core:   "#FFD700",   // gold ember
    bright: "#FFAA00",   // amber
};

// ── Flame particle system ─────────────────────────────────────────────────────
class FlameSystem {
    constructor(max = 20) {
        this.particles = [];
        this.embers    = [];
        this.max       = max;
    }

    _spawnFlame(w, h, yOff) {
        // Flames rise from the bottom edge
        const x = Math.random() * w;
        const y = yOff + h;
        this.particles.push({
            x, y,
            vx: (Math.random() - 0.5) * 1.2,
            vy: -(1.5 + Math.random() * 2.5),  // upward
            life: 1.0,
            decay: 0.02 + Math.random() * 0.025,
            size: 3 + Math.random() * 6,
            flicker: Math.random() * Math.PI * 2,
            hueShift: Math.random(),  // 0=red, 1=yellow
        });
    }

    _spawnEmber(w, h, yOff) {
        // Embers pop off edges
        const edge = Math.random();
        let x, y;
        if (edge < 0.5)       { x = Math.random() * w; y = yOff + h; }
        else if (edge < 0.75) { x = 0;                 y = yOff + Math.random() * h; }
        else                  { x = w;                  y = yOff + Math.random() * h; }

        this.embers.push({
            x, y,
            vx: (Math.random() - 0.5) * 1.5,
            vy: -(0.5 + Math.random() * 2.0),
            life: 1.0,
            decay: 0.01 + Math.random() * 0.02,
            size: 0.8 + Math.random() * 2.0,
            flicker: Math.random() * Math.PI * 2,
        });
    }

    update(w, h, yOff) {
        // Spawn
        while (this.particles.length < this.max)      this._spawnFlame(w, h, yOff);
        while (this.embers.length < this.max * 0.6)   this._spawnEmber(w, h, yOff);

        // Tick flames
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.flicker += 0.2;
            p.x  += p.vx + Math.sin(p.flicker) * 0.4;  // wiggly rise
            p.y  += p.vy;
            p.vx *= 0.97;
            p.vy *= 0.98;
            p.life -= p.decay;
            p.size *= 0.985;  // shrink as they rise
            if (p.life <= 0 || p.size < 0.5) this.particles.splice(i, 1);
        }

        // Tick embers
        for (let i = this.embers.length - 1; i >= 0; i--) {
            const p = this.embers[i];
            p.flicker += 0.15;
            p.x += p.vx;
            p.y += p.vy;
            p.vx *= 0.98;
            p.vy -= 0.02;  // gravity
            p.life -= p.decay;
            if (p.life <= 0) this.embers.splice(i, 1);
        }
    }

    drawFlames(ctx) {
        for (const p of this.particles) {
            const flicker = 0.7 + 0.3 * Math.sin(p.flicker);
            const a = p.life * flicker;

            // Colour: transitions red → orange → yellow as life decreases
            const lifeRatio = p.life;
            let color;
            if (lifeRatio > 0.6) {
                color = FIRE.plasma;   // young = deep red
            } else if (lifeRatio > 0.3) {
                color = FIRE.core;     // mid = orange-red
            } else {
                color = FIRE.hot;      // old = amber/yellow tip
            }

            ctx.save();
            ctx.globalAlpha = a * 0.8;
            ctx.shadowColor = color;
            ctx.shadowBlur  = p.size * 2.5;

            // Teardrop flame shape
            ctx.beginPath();
            ctx.moveTo(p.x, p.y + p.size);          // base
            ctx.quadraticCurveTo(
                p.x + p.size * 0.7, p.y,             // right bulge
                p.x, p.y - p.size * 1.6              // tip
            );
            ctx.quadraticCurveTo(
                p.x - p.size * 0.7, p.y,             // left bulge
                p.x, p.y + p.size                    // base
            );

            const grad = ctx.createRadialGradient(
                p.x, p.y, 0,
                p.x, p.y, p.size * 2
            );
            grad.addColorStop(0, FIRE.white);
            grad.addColorStop(0.3, FIRE.hot);
            grad.addColorStop(0.7, color);
            grad.addColorStop(1, "rgba(139,0,0,0)");
            ctx.fillStyle = grad;
            ctx.fill();
            ctx.restore();
        }
    }

    drawEmbers(ctx) {
        for (const p of this.embers) {
            const flicker = 0.6 + 0.4 * Math.sin(p.flicker);
            ctx.save();
            ctx.globalAlpha = p.life * flicker;
            ctx.shadowColor = EMBER.core;
            ctx.shadowBlur  = 6 + p.size * 3;

            const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size * 2);
            grad.addColorStop(0, FIRE.white);
            grad.addColorStop(0.4, EMBER.bright);
            grad.addColorStop(1, "rgba(255,69,0,0)");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size * 1.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
    }

    draw(ctx) {
        this.drawFlames(ctx);
        this.drawEmbers(ctx);
    }
}

// ── Fire border ───────────────────────────────────────────────────────────────
function drawFireBorder(ctx, node, flames) {
    if (node.flags?.collapsed) return;
    const w = node.size[0], h = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT, r = 8;
    const t = Date.now() / 1000;

    const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6) + 1.0);
    const breathe = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 3.5));

    app.graph.setDirtyCanvas(true, false);
    ctx.save();

    // Outer deep red aura
    ctx.shadowColor = FIRE.deep; ctx.shadowBlur = 40 + breathe * 25;
    ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 1;
    ctx.globalAlpha = 0.10 + breathe * 0.12;
    ctx.beginPath(); ctx.roundRect(-4, yOff - 4, w + 8, h + 8, r + 4); ctx.stroke();

    // Main fire border
    ctx.shadowColor = FIRE.core; ctx.shadowBlur = 18 + pulse * 22;
    ctx.strokeStyle = FIRE.core; ctx.lineWidth = 2.5;
    ctx.globalAlpha = 0.60 + pulse * 0.30;
    ctx.beginPath(); ctx.roundRect(0, yOff, w, h, r); ctx.stroke();

    // Inner bright rim — flickers faster
    ctx.shadowColor = FIRE.bright; ctx.shadowBlur = 8 + pulse2 * 14;
    ctx.strokeStyle = FIRE.bright; ctx.lineWidth = 1.2;
    ctx.globalAlpha = 0.30 + pulse2 * 0.50;
    ctx.beginPath(); ctx.roundRect(1.5, yOff + 1.5, w - 3, h - 3, r); ctx.stroke();

    // Hot white inner flicker
    ctx.shadowColor = FIRE.white; ctx.shadowBlur = 4 + pulse2 * 8;
    ctx.strokeStyle = FIRE.white; ctx.lineWidth = 0.6;
    ctx.globalAlpha = 0.08 + pulse2 * 0.18;
    ctx.beginPath(); ctx.roundRect(2.5, yOff + 2.5, w - 5, h - 5, r); ctx.stroke();

    // Corner ember dots
    ctx.shadowColor = EMBER.core; ctx.shadowBlur = 10;
    ctx.globalAlpha = 0.4 + pulse * 0.5;
    ctx.fillStyle = EMBER.core;
    const dotR = 2 + pulse * 2;
    for (const [cx, cy] of [[0, yOff], [w, yOff], [0, yOff + h], [w, yOff + h]]) {
        ctx.beginPath(); ctx.arc(cx, cy, dotR, 0, Math.PI * 2); ctx.fill();
    }

    ctx.restore();

    // Flames and embers
    flames.update(w, h, yOff);
    flames.draw(ctx);
}

app.registerExtension({
    name: "Winnougan.LTXResolutionCalculator",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color   = "#2a0500";   // deep charred red
            this.bgcolor = "#1a0200";   // near-black with red tint
            this._flames = new FlameSystem(22);
            this.title   = "⚡ Winnougan LTX Resolution & Frame Calculator";
            this._lastInfo          = null;
            this._lastFrames        = null;
            this._lastRawFrames     = null;
            this._previewFrames     = null;
            this._previewRawFrames  = null;
            this._previewActual     = null;

            // Sync preset → width/height widgets
            const presetW = this.widgets?.find(w => w.name === "preset");
            const widthW  = this.widgets?.find(w => w.name === "target_width");
            const heightW = this.widgets?.find(w => w.name === "target_height");

            const PRESETS = {
                "LTX 512p  (768x512)":       [ 768,  512],
                "LTX 720p  (1280x736)":      [1280,  736],
                "LTX 1080p (1920x1088)":     [1920, 1088],
                "LTX 1440p (2560x1440)":     [2560, 1440],
                "LTX 4K    (3840x2160)":     [3840, 2160],
                "Portrait 512p  (512x768)":  [ 512,  768],
                "Portrait 720p  (736x1280)": [ 736, 1280],
                "Portrait 1080p (1088x1920)":[1088, 1920],
                "Square 512  (512x512)":     [ 512,  512],
                "Square 1024 (1024x1024)":   [1024, 1024],
            };

            if (presetW && widthW && heightW) {
                const syncPreset = (val) => {
                    if (val !== "Custom" && PRESETS[val]) {
                        widthW.value  = PRESETS[val][0];
                        heightW.value = PRESETS[val][1];
                        app.graph.setDirtyCanvas(true);
                    }
                };
                setTimeout(() => { syncPreset(presetW.value); this._updateFramePreview?.(); this._pushToDownstream?.(); }, 0);
                const origCb = presetW.callback;
                presetW.callback = (val) => { syncPreset(val); origCb?.call(presetW, val); };
            }
        };

        nodeType.prototype.onExecuted = function (data) {
            // Output names map directly to keys in data — grab what we need
            if (data?.info)              this._lastInfo         = data.info[0]           ?? null;
            if (data?.frames != null)    this._lastFrames       = data.frames[0]         ?? null;
            if (data?.raw_frames != null) this._lastRawFrames   = data.raw_frames[0]     ?? null;
            if (data?.actual_seconds != null) this._lastActualSeconds = data.actual_seconds[0] ?? null;
            this.setDirtyCanvas(true);
        };

        // Live frame preview — recompute whenever a widget changes, before execution
        nodeType.prototype.onWidgetChanged = function (name, value) {
            this._updateFramePreview();
            this._pushToDownstream();
            this.setDirtyCanvas(true);
        };

        nodeType.prototype._updateFramePreview = function () {
            const durW = this.widgets?.find(w => w.name === "duration_seconds");
            const fpsW = this.widgets?.find(w => w.name === "fps");
            if (!durW || !fpsW) return;
            const seconds = parseFloat(durW.value) || 4.0;
            const fps     = parseFloat(fpsW.value) || 24.0;
            // raw_frames: plain round(seconds × fps) — no LTX snapping
            this._previewRawFrames = Math.max(1, Math.round(seconds * fps));
            // frames: LTX 8n+1 snap (for EmptyLTXVLatentVideo)
            const raw = Math.max(9, Math.ceil(seconds * fps));
            const n   = Math.ceil((raw - 1) / 8);
            this._previewFrames = 8 * n + 1;
            this._previewActual = (this._previewFrames / fps).toFixed(2);
        };

        // Mirror what PrimitiveNode does: write computed values directly into
        // the widget of any connected downstream node, so the update is instant
        // without needing a queue/execute cycle.
        nodeType.prototype._pushToDownstream = function () {
            if (!app.graph) return;

            // Slot indices matching RETURN_NAMES order:
            // 0=width, 1=height, 2=draft_width, 3=draft_height,
            // 4=frames, 5=raw_frames, 6=fps, 7=fps_int, 8=actual_seconds, 9=info
            const slotValues = {
                4: this._previewFrames,
                5: this._previewRawFrames,
            };

            for (const [slotIdx, value] of Object.entries(slotValues)) {
                if (value == null) continue;
                const slot = this.outputs?.[slotIdx];
                if (!slot?.links?.length) continue;

                for (const linkId of slot.links) {
                    const link = app.graph.links[linkId];
                    if (!link) continue;
                    const targetNode = app.graph.getNodeById(link.target_id);
                    if (!targetNode) continue;

                    // Find the widget that owns this input slot
                    const inputDef = targetNode.inputs?.[link.target_slot];
                    const widgetName = inputDef?.widget?.name;
                    if (!widgetName) continue;

                    const targetWidget = targetNode.widgets?.find(w => w.name === widgetName);
                    if (targetWidget && targetWidget.value !== value) {
                        targetWidget.value = value;
                        targetWidget.callback?.(value, app.canvas, targetNode);
                        app.graph.setDirtyCanvas(true);
                    }
                }
            }
        };

        const origBg = nodeType.prototype.onDrawBackground;
        nodeType.prototype.onDrawBackground = function (ctx) {
            origBg?.call(this, ctx);
            if (!this._flames) this._flames = new FlameSystem(22);
            drawFireBorder(ctx, this, this._flames);
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

            // Badge — fire coloured
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
            ctx.fillStyle = FIRE.hot; ctx.shadowColor = FIRE.core;
            ctx.shadowBlur = 8 + pulse * 6;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            // Hot white flicker on badge
            ctx.fillStyle = FIRE.white; ctx.shadowColor = FIRE.white;
            ctx.shadowBlur = 4 + pulse2 * 8; ctx.globalAlpha = pulse2 * 0.35;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            // Live frames pills — shows before and after execution
            {
                const rawFrames = this._lastRawFrames  ?? this._previewRawFrames;
                const ltxFrames = this._lastFrames     ?? this._previewFrames;
                const actual    = this._lastActualSeconds != null
                    ? this._lastActualSeconds.toFixed(2)
                    : (this._previewActual ?? null);
                const isLive = this._lastRawFrames != null;

                if (rawFrames != null) {
                    // Pill 1: raw_frames → PromptRelay
                    const pill1 = `⬡ ${rawFrames} raw frames  →  PromptRelay`;
                    ctx.font      = "bold 9px monospace";
                    ctx.textAlign = "left";
                    const tw1 = ctx.measureText(pill1).width;
                    const px = 10, py = 18, ph = 16, pw1 = tw1 + 16;
                    ctx.fillStyle   = isLive ? "rgba(255,150,0,0.22)" : "rgba(255,100,0,0.10)";
                    ctx.strokeStyle = isLive ? FIRE.hot : FIRE.deep;
                    ctx.lineWidth   = isLive ? 1.2 : 0.7;
                    ctx.globalAlpha = 1;
                    ctx.shadowBlur  = isLive ? 6 + pulse * 8 : 3;
                    ctx.shadowColor = FIRE.hot;
                    ctx.beginPath(); ctx.roundRect(px, py, pw1, ph, 4); ctx.fill(); ctx.stroke();
                    ctx.shadowBlur  = isLive ? 4 + pulse * 6 : 2;
                    ctx.fillStyle   = isLive ? FIRE.white : "#887755";
                    ctx.fillText(pill1, px + 8, py + 11);
                    ctx.shadowBlur  = 0; ctx.globalAlpha = 1;

                    // Pill 2: ltx frames → EmptyLTXV
                    if (ltxFrames != null) {
                        const pill2 = `⬡ ${ltxFrames} LTX frames  →  EmptyLTXV`;
                        const tw2   = ctx.measureText(pill2).width;
                        const py2   = py + ph + 4;
                        const pw2   = tw2 + 16;
                        ctx.fillStyle   = isLive ? "rgba(255,69,0,0.18)" : "rgba(255,40,0,0.08)";
                        ctx.strokeStyle = isLive ? FIRE.core : FIRE.deep;
                        ctx.lineWidth   = isLive ? 1.2 : 0.7;
                        ctx.shadowBlur  = isLive ? 6 + pulse * 8 : 3;
                        ctx.shadowColor = FIRE.core;
                        ctx.beginPath(); ctx.roundRect(px, py2, pw2, ph, 4); ctx.fill(); ctx.stroke();
                        ctx.shadowBlur  = isLive ? 4 + pulse * 6 : 2;
                        ctx.fillStyle   = isLive ? FIRE.bright : "#775533";
                        ctx.fillText(pill2, px + 8, py2 + 11);
                        ctx.shadowBlur  = 0; ctx.globalAlpha = 1;
                    }
                }
            }

            // Info panel
            if (this._lastInfo) {
                const panelY = getPanelY(this);
                const panelH = H - panelY - 6;
                if (panelH < 20) { ctx.restore(); return; }

                // Panel background — dark smoky red
                ctx.fillStyle = "rgba(10,2,0,0.96)";
                ctx.beginPath(); ctx.roundRect(10, panelY, W - 20, panelH, 6); ctx.fill();
                ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.6;
                ctx.beginPath(); ctx.roundRect(10, panelY, W - 20, panelH, 6); ctx.stroke();
                ctx.globalAlpha = 1;

                ctx.save();
                ctx.beginPath(); ctx.rect(14, panelY + 4, W - 28, panelH - 8); ctx.clip();

                const lines = this._lastInfo.split("\n");
                const lineH = 14;
                let y = panelY + 8;

                for (const line of lines) {
                    if (y + lineH > panelY + panelH - 4) break;
                    ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
                    ctx.textBaseline = "top"; ctx.textAlign = "left";

                    if (line.startsWith("═")) {
                        ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 0.5; ctx.globalAlpha = 0.5;
                        ctx.beginPath(); ctx.moveTo(14, y + 6); ctx.lineTo(W - 14, y + 6); ctx.stroke();
                        ctx.globalAlpha = 1;
                    } else if (line.startsWith("Wire to")) {
                        ctx.font = "bold 9px monospace"; ctx.fillStyle = FIRE.hot;
                        ctx.shadowColor = FIRE.core; ctx.shadowBlur = 3;
                        ctx.fillText(line, 16, y); ctx.shadowBlur = 0;
                    } else if (line.includes("⚠")) {
                        ctx.font = "bold 9px monospace"; ctx.fillStyle = EMBER.bright;
                        ctx.shadowColor = FIRE.bright; ctx.shadowBlur = 3;
                        ctx.fillText(line, 16, y); ctx.shadowBlur = 0;
                    } else if (line.includes(":")) {
                        const colon = line.indexOf(":");
                        const label = line.slice(0, colon + 1);
                        const value = line.slice(colon + 1);
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322";
                        ctx.fillText(label, 16, y);
                        const lw = ctx.measureText(label).width;
                        ctx.fillStyle = FIRE.bright; ctx.font = "bold 9px monospace";
                        ctx.shadowColor = FIRE.core; ctx.shadowBlur = 3;
                        ctx.fillText(value, 16 + lw, y); ctx.shadowBlur = 0;
                    } else if (line.trim()) {
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322";
                        ctx.fillText(line, 16, y);
                    }
                    y += lineH;
                }
                ctx.restore();
            }

            ctx.restore();
        };

        nodeType.prototype.computeSize = function () {
            const panelY = getPanelY(this);
            const panelH = this._lastInfo ? 160 : 10;
            return [420, panelY + panelH + 6];
        };
    },
});

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
