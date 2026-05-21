import { app } from "../../scripts/app.js";

const NODE_TYPE = "WinnouganLTXNAGGuidance";

const FIRE  = { core:"#FF4500", bright:"#FF6A00", hot:"#FF9500", white:"#FFEEAA", deep:"#8B0000" };
const EMBER = { core:"#FFD700", bright:"#FFAA00" };
const GREEN = { core:"#4ade80", bright:"#6aef9a" };

function drawFireBorder(ctx, node) {
    if (node.flags?.collapsed) return;
    const w = node.size[0], h = node.size[1] + LiteGraph.NODE_TITLE_HEIGHT;
    const yOff = -LiteGraph.NODE_TITLE_HEIGHT, r = 8;
    const t = Date.now() / 1000;
    const pulse  = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 1.8));
    const pulse2 = 0.5 + 0.5 * Math.sin(t * (2 * Math.PI / 0.6) + 1.0);
    app.graph.setDirtyCanvas(true, false);
    ctx.save();
    ctx.shadowColor = FIRE.deep; ctx.shadowBlur = 30+pulse*20;
    ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 1; ctx.globalAlpha = 0.10+pulse*0.10;
    ctx.beginPath(); ctx.roundRect(-3,yOff-3,w+6,h+6,r+3); ctx.stroke();
    ctx.shadowColor = FIRE.core; ctx.shadowBlur = 16+pulse*20;
    ctx.strokeStyle = FIRE.core; ctx.lineWidth = 2.5; ctx.globalAlpha = 0.60+pulse*0.28;
    ctx.beginPath(); ctx.roundRect(0,yOff,w,h,r); ctx.stroke();
    ctx.shadowColor = FIRE.bright; ctx.shadowBlur = 7+pulse2*12;
    ctx.strokeStyle = FIRE.bright; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.30+pulse2*0.45;
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

app.registerExtension({
    name: "Winnougan.LTXNAGGuidance",

    async beforeRegisterNodeDef(nodeType, nodeData) {
        if (nodeData.name !== NODE_TYPE) return;

        const origCreated = nodeType.prototype.onNodeCreated;
        nodeType.prototype.onNodeCreated = function () {
            origCreated?.call(this);
            this.color   = "#2a0500";
            this.bgcolor = "#1a0200";
            this.title   = "🔥 Winnougan LTX NAG Guidance";
            this._nagInfo  = null;
            this._hasAudio = null;
        };

        nodeType.prototype.onExecuted = function (data) {
            if (data?.nag_info) {
                this._nagInfo = data.nag_info[0] ?? null;
                this._hasAudio = this._nagInfo?.includes("✅") ?? null;
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
            ctx.fillStyle = FIRE.hot; ctx.shadowColor = FIRE.core; ctx.shadowBlur = 8+pulse*6;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.fillStyle = FIRE.white; ctx.shadowColor = FIRE.white;
            ctx.shadowBlur = 4+pulse2*8; ctx.globalAlpha = pulse2*0.3;
            ctx.fillText("🔥 WINNOUGAN LTX", W - 28, 14);
            ctx.globalAlpha = 1; ctx.shadowBlur = 0;

            // Panel
            const panelY = getPanelY(this);
            const panelH = H - panelY - 6;
            if (panelH < 24) { ctx.restore(); return; }

            ctx.fillStyle = "rgba(10,2,0,0.96)";
            ctx.beginPath(); ctx.roundRect(10, panelY, W-20, panelH, 6); ctx.fill();
            ctx.strokeStyle = FIRE.deep; ctx.lineWidth = 0.8; ctx.globalAlpha = 0.5;
            ctx.beginPath(); ctx.roundRect(10, panelY, W-20, panelH, 6); ctx.stroke();
            ctx.globalAlpha = 1;

            ctx.save();
            ctx.beginPath(); ctx.rect(14, panelY+4, W-28, panelH-8); ctx.clip();

            if (this._nagInfo) {
                const lines = this._nagInfo.split("\n");
                const lineH = 13;
                let y = panelY + 8;
                for (const line of lines) {
                    if (y + lineH > panelY + panelH - 2) break;
                    ctx.shadowBlur = 0; ctx.textBaseline = "top"; ctx.textAlign = "left";
                    if (line.includes("✅")) {
                        ctx.font = "9px monospace"; ctx.fillStyle = GREEN.bright;
                    } else if (line.includes("❌")) {
                        ctx.font = "9px monospace"; ctx.fillStyle = FIRE.bright;
                    } else if (line.includes(":")) {
                        const colon = line.indexOf(":");
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322";
                        ctx.fillText(line.slice(0, colon+1), 16, y);
                        const lw = ctx.measureText(line.slice(0,colon+1)).width;
                        ctx.fillStyle = EMBER.bright; ctx.font = "bold 9px monospace";
                        ctx.shadowColor = EMBER.core; ctx.shadowBlur = 2;
                        ctx.fillText(line.slice(colon+1), 16+lw, y);
                        ctx.shadowBlur = 0; y += lineH; continue;
                    } else {
                        ctx.font = "9px monospace"; ctx.fillStyle = "#553322";
                    }
                    ctx.fillText(line, 16, y);
                    y += lineH;
                }
            } else {
                ctx.font = "9px monospace"; ctx.textAlign = "center";
                ctx.textBaseline = "middle"; ctx.fillStyle = FIRE.deep; ctx.globalAlpha = 0.5;
                ctx.fillText("wire negative conditioning → queue to activate", W/2, panelY + panelH/2);
                ctx.globalAlpha = 1;
            }

            ctx.restore();
            ctx.restore();
        };

        nodeType.prototype.computeSize = function () {
            const panelY = getPanelY(this);
            return [420, panelY + 100];
        };
    },
});
