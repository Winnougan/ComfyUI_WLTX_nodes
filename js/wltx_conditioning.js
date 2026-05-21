import { app } from "../../scripts/app.js";

const SAVE_TYPE = "WinnouganLTXSaveConditioning";
const LOAD_TYPE = "WinnouganLTXLoadConditioning";

const FIRE  = { core:"#FF4500", bright:"#FF6A00", hot:"#FF9500", white:"#FFEEAA", deep:"#8B0000" };
const EMBER = { core:"#FFD700", bright:"#FFAA00" };
const GREEN = { core:"#4ade80", bright:"#6aef9a" };
const RED   = { core:"#ff4444", bright:"#ff8888" };

function drawFireBorder(ctx, node) {
    if (node.flags?.collapsed) return;
    const w = node.size[0], h = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT, r = 8;
    const t = Date.now() / 1000;
    const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6) + 1.0);
    app.graph.setDirtyCanvas(true, false);
    ctx.save();
    ctx.shadowColor = FIRE.deep; ctx.shadowBlur = 30+pulse*20; ctx.strokeStyle = FIRE.deep;
    ctx.lineWidth = 1; ctx.globalAlpha = 0.10+pulse*0.10;
    ctx.beginPath(); ctx.roundRect(-3,yOff-3,w+6,h+6,r+3); ctx.stroke();
    ctx.shadowColor = FIRE.core; ctx.shadowBlur = 16+pulse*20; ctx.strokeStyle = FIRE.core;
    ctx.lineWidth = 2.5; ctx.globalAlpha = 0.60+pulse*0.28;
    ctx.beginPath(); ctx.roundRect(0,yOff,w,h,r); ctx.stroke();
    ctx.shadowColor = FIRE.bright; ctx.shadowBlur = 7+pulse2*12; ctx.strokeStyle = FIRE.bright;
    ctx.lineWidth = 1.2; ctx.globalAlpha = 0.30+pulse2*0.45;
    ctx.beginPath(); ctx.roundRect(1.5,yOff+1.5,w-3,h-3,r); ctx.stroke();
    ctx.shadowColor = EMBER.core; ctx.shadowBlur = 8; ctx.globalAlpha = 0.4+pulse*0.5;
    ctx.fillStyle = EMBER.core; const dotR = 1.8+pulse*1.8;
    for (const [cx,cy] of [[0,yOff],[w,yOff],[0,yOff+h],[w,yOff+h]]) {
        ctx.beginPath(); ctx.arc(cx,cy,dotR,0,Math.PI*2); ctx.fill();
    }
    ctx.restore();
}

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

function drawInfoPanel(ctx, node, lines, statusOk) {
    const W = this.size[0] ?? node.size[0];
    const H = node.size[1];
    const panelY = getPanelY(node);
    const panelH = H - panelY - 6;
    if (panelH < 24) return;

    ctx.fillStyle = "rgba(10,2,0,0.96)";
    ctx.beginPath(); ctx.roundRect(10, panelY, W - 20, panelH, 6); ctx.fill();
    ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5;
    ctx.beginPath(); ctx.roundRect(10, panelY, W - 20, panelH, 6); ctx.stroke();
    ctx.globalAlpha = 1;

    ctx.save();
    ctx.beginPath(); ctx.rect(14, panelY + 4, W - 28, panelH - 8); ctx.clip();

    const lineH = 14;
    let y = panelY + 8;

    for (const line of lines) {
        if (y + lineH > panelY + panelH - 2) break;
        ctx.shadowBlur = 0; ctx.shadowColor = "transparent";
        ctx.textBaseline = "top"; ctx.textAlign = "left";

        if (line.startsWith("✅")) {
            ctx.font = "bold 10px monospace";
            ctx.fillStyle = GREEN.bright; ctx.shadowColor = GREEN.core; ctx.shadowBlur = 4;
            ctx.fillText(line, 16, y);
        } else if (line.startsWith("❌") || line.startsWith("⚠")) {
            ctx.font = "bold 10px monospace";
            ctx.fillStyle = RED.bright; ctx.shadowColor = RED.core; ctx.shadowBlur = 4;
            ctx.fillText(line, 16, y);
        } else if (line.includes(":")) {
            const colon = line.indexOf(":");
            const label = line.slice(0, colon + 1);
            const value = line.slice(colon + 1);
            ctx.font = "9px monospace"; ctx.fillStyle = "#553322"; ctx.shadowBlur = 0;
            ctx.fillText(label, 16, y);
            const lw = ctx.measureText(label).width;
            ctx.fillStyle = FIRE.bright; ctx.font = "bold 9px monospace";
            ctx.shadowColor = FIRE.core; ctx.shadowBlur = 3;
            ctx.fillText(value, 16 + lw, y);
        } else if (line.trim()) {
            ctx.font = "9px monospace"; ctx.fillStyle = "#553322"; ctx.shadowBlur = 0;
            ctx.fillText(line, 16, y);
        }
        ctx.shadowBlur = 0;
        y += lineH;
    }
    ctx.restore();
}

// ── SAVE NODE ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.LTXSaveConditioning",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== SAVE_TYPE) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color   = "#2a0500";
            this.bgcolor = "#1a0200";
            this.title   = "🔥 Winnougan LTX Save Conditioning";
            this._saveInfo = null;
        };

        nodeType.prototype.onExecuted = function (data) {
            if (data?.filename) {
                this._saveInfo = {
                    filename:  data.filename[0]  ?? "",
                    file_size: data.file_size[0] ?? "",
                    saved_at:  data.saved_at[0]  ?? "",
                    save_path: data.save_path[0] ?? "",
                };
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
            const t = Date.now() / 1000;
            const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
            const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6));

            ctx.save();
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
            ctx.fillStyle = FIRE.hot; ctx.shadowColor = FIRE.core; ctx.shadowBlur = 8+pulse*6;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.fillStyle = FIRE.white; ctx.shadowColor = FIRE.white;
            ctx.shadowBlur = 4+pulse2*8; ctx.globalAlpha = pulse2*0.3;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            const panelY = getPanelY(this);
            const panelH = this.size[1] - panelY - 6;
            if (panelH < 24) { ctx.restore(); return; }

            ctx.fillStyle = "rgba(10,2,0,0.96)";
            ctx.beginPath(); ctx.roundRect(10, panelY, W-20, panelH, 6); ctx.fill();
            ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.roundRect(10, panelY, W-20, panelH, 6); ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.save();
            ctx.beginPath(); ctx.rect(14, panelY+4, W-28, panelH-8); ctx.clip();

            if (this._saveInfo) {
                const lines = [
                    `✅ Saved successfully`,
                    `File     : ${this._saveInfo.filename}`,
                    `Size     : ${this._saveInfo.file_size}`,
                    `Saved at : ${this._saveInfo.saved_at}`,
                ];
                const lineH = 14; let y = panelY + 8;
                for (const line of lines) {
                    if (y + lineH > panelY + panelH - 2) break;
                    ctx.shadowBlur = 0; ctx.textBaseline = "top"; ctx.textAlign = "left";
                    if (line.startsWith("✅")) {
                        ctx.font = "bold 10px monospace"; ctx.fillStyle = GREEN.bright;
                        ctx.shadowColor = GREEN.core; ctx.shadowBlur = 4;
                    } else if (line.includes(":")) {
                        const colon = line.indexOf(":");
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322"; ctx.shadowBlur = 0;
                        ctx.fillText(line.slice(0, colon+1), 16, y);
                        const lw = ctx.measureText(line.slice(0,colon+1)).width;
                        ctx.fillStyle = FIRE.bright; ctx.font = "bold 9px monospace";
                        ctx.shadowColor = FIRE.core; ctx.shadowBlur = 3;
                        ctx.fillText(line.slice(colon+1), 16+lw, y);
                        ctx.shadowBlur = 0; y += lineH; continue;
                    }
                    ctx.fillText(line, 16, y); ctx.shadowBlur = 0; y += lineH;
                }
            } else {
                ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillStyle = FIRE.deep; ctx.globalAlpha = 0.5;
                ctx.fillText("wire conditioning → queue to save", W/2, panelY + panelH/2);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
            ctx.restore();
        };

        nodeType.prototype.computeSize = function () {
            const panelY = getPanelY(this);
            return [420, panelY + 70];
        };
    },
});

// ── LOAD NODE ─────────────────────────────────────────────────────────────────
app.registerExtension({
    name: "Winnougan.LTXLoadConditioning",
    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== LOAD_TYPE) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color   = "#2a0500";
            this.bgcolor = "#1a0200";
            this.title   = "🔥 Winnougan LTX Load Conditioning";
            this._loadInfo = null;
            this._loadOk   = false;
            this._reloadBtnArea = null;
        };

        nodeType.prototype.onExecuted = function (data) {
            if (data?.load_info) {
                this._loadInfo = data.load_info[0] ?? null;
                this._loadOk   = this._loadInfo?.startsWith("✅") ?? false;
            }
            this.setDirtyCanvas(true);
        };

        // Reload button click
        const origMouseDown = nodeType.prototype.onMouseDown;
        nodeType.prototype.onMouseDown = function (event, pos) {
            if (this._reloadBtnArea) {
                const [mx, my] = pos;
                const r = this._reloadBtnArea;
                if (mx >= r.x && mx <= r.x+r.w && my >= r.y && my <= r.y+r.h) {
                    // Force re-execution by clearing IS_CHANGED cache
                    this._loadInfo = null;
                    this._loadOk   = false;
                    app.graph.setDirtyCanvas(true);
                    app.queuePrompt(0, 1);
                    return true;
                }
            }
            return origMouseDown?.call(this, event, pos) ?? false;
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
            const t = Date.now() / 1000;
            const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
            const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6));

            ctx.save();
            ctx.font = "bold 10px sans-serif"; ctx.textAlign = "right";
            ctx.fillStyle = FIRE.hot; ctx.shadowColor = FIRE.core; ctx.shadowBlur = 8+pulse*6;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.fillStyle = FIRE.white; ctx.shadowColor = FIRE.white;
            ctx.shadowBlur = 4+pulse2*8; ctx.globalAlpha = pulse2*0.3;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            const panelY = getPanelY(this);
            const panelH = this.size[1] - panelY - 6;
            if (panelH < 40) { ctx.restore(); return; }

            // Panel background
            ctx.fillStyle = "rgba(10,2,0,0.96)";
            ctx.beginPath(); ctx.roundRect(10, panelY, W-20, panelH, 6); ctx.fill();
            ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.roundRect(10, panelY, W-20, panelH, 6); ctx.stroke();
            ctx.globalAlpha = 1;

            // Reload button — top of panel
            const rbY = panelY + 6, rbH = 20, rbX = 16, rbW = W - 32;
            ctx.beginPath(); ctx.roundRect(rbX, rbY, rbW, rbH, 4);
            ctx.fillStyle = "#2a1800"; ctx.fill();
            ctx.strokeStyle = FIRE.hot; ctx.lineWidth = 1; ctx.shadowColor = FIRE.core; ctx.shadowBlur = 3;
            ctx.stroke(); ctx.shadowBlur = 0;
            ctx.font = "bold 9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
            ctx.fillStyle = FIRE.hot;
            ctx.fillText("↺  Reload from disk", rbX + rbW/2, rbY + rbH/2);
            this._reloadBtnArea = { x: rbX, y: rbY, w: rbW, h: rbH };

            // Info lines
            ctx.save();
            ctx.beginPath(); ctx.rect(14, rbY+rbH+4, W-28, panelH - rbH - 12); ctx.clip();

            const infoY = rbY + rbH + 8;
            if (this._loadInfo) {
                const lines = this._loadInfo.split("\n");
                const lineH = 13; let y = infoY;
                for (const line of lines) {
                    if (y + lineH > panelY + panelH - 2) break;
                    ctx.shadowBlur = 0; ctx.textBaseline = "top"; ctx.textAlign = "left";
                    if (line.startsWith("✅")) {
                        ctx.font = "bold 10px monospace"; ctx.fillStyle = GREEN.bright;
                        ctx.shadowColor = GREEN.core; ctx.shadowBlur = 4;
                        ctx.fillText(line, 16, y);
                    } else if (line.startsWith("❌") || line.startsWith("⚠")) {
                        ctx.font = "bold 10px monospace"; ctx.fillStyle = RED.bright;
                        ctx.shadowColor = RED.core; ctx.shadowBlur = 4;
                        ctx.fillText(line, 16, y);
                    } else if (line.includes(":")) {
                        const colon = line.indexOf(":");
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322"; ctx.shadowBlur = 0;
                        ctx.fillText(line.slice(0,colon+1), 16, y);
                        const lw = ctx.measureText(line.slice(0,colon+1)).width;
                        ctx.fillStyle = FIRE.bright; ctx.font = "bold 9px monospace";
                        ctx.shadowColor = FIRE.core; ctx.shadowBlur = 3;
                        ctx.fillText(line.slice(colon+1), 16+lw, y);
                    } else if (line.trim()) {
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322"; ctx.shadowBlur = 0;
                        ctx.fillText(line, 16, y);
                    }
                    ctx.shadowBlur = 0; y += lineH;
                }
            } else {
                ctx.font = "9px monospace"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
                ctx.fillStyle = FIRE.deep; ctx.globalAlpha = 0.5;
                ctx.fillText("select a file → queue to load", W/2, infoY + 10);
                ctx.globalAlpha = 1;
            }
            ctx.restore();
            ctx.restore();
        };

        nodeType.prototype.computeSize = function () {
            const panelY = getPanelY(this);
            return [420, panelY + 110];
        };
    },
});
