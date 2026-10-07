// Data Pipeline Flow — pure SVG, no deps
// Shows: [SW / webRequest] and [content.js] → Bronze → Silver → Gold
// Live row counts refresh every 5 s via getDatabaseStats

import { runtime } from "../../background/compat/browser-compat.js";

const REFRESH_MS = 5000;

// ── layout constants ─────────────────────────────────────────────────────────
const VB_W = 760, VB_H = 300;

const SRC_SW = { x: 10,  y: 40,  w: 130, h: 70  };
const SRC_CT = { x: 10,  y: 160, w: 130, h: 110 };
const BRONZE  = { x: 210, y: 75,  w: 140, h: 140, accent: "#cd7f32", label: "Bronze", sub: "raw",       alarm: "live",        countId: "pf-bronze" };
const SILVER  = { x: 410, y: 75,  w: 140, h: 140, accent: "#a8a9ad", label: "Silver", sub: "enriched",  alarm: "every 2 min", countId: "pf-silver" };
const GOLD    = { x: 610, y: 75,  w: 140, h: 140, accent: "#ffd700", label: "Gold",   sub: "aggregated", alarm: "daily",       countId: "pf-gold"   };

const NS = "http://www.w3.org/2000/svg";

function el(tag, attrs = {}) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v);
  return e;
}
function txt(content, attrs = {}) {
  const t = el("text", attrs);
  t.textContent = content;
  return t;
}

// ── animated edge (cubic bezier) ─────────────────────────────────────────────
function edge(x1, y1, x2, y2, color, animated = true) {
  const mid = (x1 + x2) / 2;
  const path = el("path", {
    d: `M${x1} ${y1} C${mid} ${y1},${mid} ${y2},${x2} ${y2}`,
    fill: "none",
    stroke: color,
    "stroke-width": animated ? "2.5" : "1.5",
    "marker-end": `url(#arr-${color.replace("#", "")})`,
  });
  if (animated) path.classList.add("pf-animated");
  return path;
}

// ── arrowhead marker ─────────────────────────────────────────────────────────
function arrowMarker(color) {
  const m = el("marker", {
    id: `arr-${color.replace("#", "")}`,
    viewBox: "0 0 10 10", refX: "9", refY: "5",
    markerWidth: "5", markerHeight: "5",
    orient: "auto-start-reverse",
  });
  const p = el("path", { d: "M0 0 L10 5 L0 10z", fill: color });
  m.appendChild(p);
  return m;
}

// ── medallion node (Bronze/Silver/Gold) ───────────────────────────────────────
function medallionNode(n) {
  const g = el("g", { transform: `translate(${n.x},${n.y})` });

  // card background
  g.appendChild(el("rect", {
    width: n.w, height: n.h, rx: "10",
    fill: "#1e2537", stroke: n.accent, "stroke-width": "1.5",
  }));
  // top accent bar
  g.appendChild(el("rect", { width: n.w, height: "4", rx: "10", fill: n.accent }));

  // label
  g.appendChild(txt(n.label, {
    x: n.w / 2, y: "24", "text-anchor": "middle",
    "font-size": "13", "font-weight": "700", fill: n.accent,
  }));

  // live count (updated by refreshCounts)
  const count = txt("—", {
    id: n.countId, x: n.w / 2, y: "66",
    "text-anchor": "middle", "font-size": "26", "font-weight": "700",
    fill: "#ffffff", "font-variant-numeric": "tabular-nums",
  });
  g.appendChild(count);

  // subtitle
  g.appendChild(txt(n.sub, {
    x: n.w / 2, y: "84", "text-anchor": "middle",
    "font-size": "10", fill: "#718096",
  }));

  // alarm badge
  g.appendChild(txt(`⏱ ${n.alarm}`, {
    x: n.w / 2, y: n.h - 12, "text-anchor": "middle",
    "font-size": "9", fill: n.accent,
  }));

  return g;
}

// ── source node ───────────────────────────────────────────────────────────────
function sourceNode(rect, label, lines, accent) {
  const g = el("g", { transform: `translate(${rect.x},${rect.y})` });

  g.appendChild(el("rect", {
    width: rect.w, height: rect.h, rx: "8",
    fill: "#151b27", stroke: accent, "stroke-width": "1.5",
  }));
  g.appendChild(el("rect", { width: rect.w, height: "3", rx: "8", fill: accent }));

  g.appendChild(txt(label, {
    x: rect.w / 2, y: "18", "text-anchor": "middle",
    "font-size": "11", "font-weight": "700", fill: accent,
  }));

  lines.forEach((line, i) => {
    g.appendChild(txt(line, {
      x: "10", y: 32 + i * 16, "font-size": "9", fill: "#718096",
    }));
  });

  return g;
}

// ── build full SVG ────────────────────────────────────────────────────────────
function buildSVG() {
  const svg = el("svg", {
    viewBox: `0 0 ${VB_W} ${VB_H}`,
    xmlns: NS,
  });
  svg.style.cssText = "width:100%;max-width:800px;display:block;";

  // Defs
  const defs = el("defs");
  const style = el("style");
  style.textContent = `
    @keyframes pf-flow { from{stroke-dashoffset:24} to{stroke-dashoffset:0} }
    .pf-animated { stroke-dasharray:8 4; animation:pf-flow .9s linear infinite; }
  `;
  defs.appendChild(style);
  [BRONZE.accent, SILVER.accent, GOLD.accent, "#718096"].forEach(c => defs.appendChild(arrowMarker(c)));
  svg.appendChild(defs);

  // Edges: SW → Bronze (entering at mid-top of bronze)
  const swEdgeY  = SRC_SW.y + SRC_SW.h / 2;
  const ctEdgeY  = SRC_CT.y + SRC_CT.h / 2;
  const bronzeIn = BRONZE.x;
  const bronzeMidY = BRONZE.y + BRONZE.h / 2;
  svg.appendChild(edge(SRC_SW.x + SRC_SW.w, swEdgeY, bronzeIn, bronzeMidY - 24, "#718096"));
  svg.appendChild(edge(SRC_CT.x + SRC_CT.w, ctEdgeY, bronzeIn, bronzeMidY + 24, "#718096"));

  // Edges: Bronze → Silver → Gold
  const link = (a, b) =>
    edge(a.x + a.w, a.y + a.h / 2, b.x, b.y + b.h / 2, b.accent);
  svg.appendChild(link(BRONZE, SILVER));
  svg.appendChild(link(SILVER, GOLD));

  // Source nodes
  svg.appendChild(sourceNode(SRC_SW, "SW Capture", [
    "chrome.webRequest API",
    "request-capture.js",
  ], "#718096"));

  svg.appendChild(sourceNode(SRC_CT, "content.js", [
    "batchResourceTiming",
    "Web Vitals (LCP·FID·CLS)",
    "FCP · TTFB",
    "XHR / fetch intercept",
  ], "#667eea"));

  // Medallion nodes
  svg.appendChild(medallionNode(BRONZE));
  svg.appendChild(medallionNode(SILVER));
  svg.appendChild(medallionNode(GOLD));

  return svg;
}

// ── live count refresh ────────────────────────────────────────────────────────
async function refreshCounts() {
  try {
    const res = await runtime.sendMessage({ action: "getDatabaseStats" });
    if (!res?.success) return;
    const s = res.stats;
    const fmt = n => (n != null ? Number(n).toLocaleString() : "—");
    const b = document.getElementById("pf-bronze");
    const sv = document.getElementById("pf-silver");
    const g = document.getElementById("pf-gold");
    if (b)  b.textContent  = fmt(s.bronze_requests);
    if (sv) sv.textContent = fmt(s.silver_requests);
    if (g)  g.textContent  = fmt(s.gold_daily_analytics);
  } catch (_) { /* SW not ready */ }
}

// ── public entry point ────────────────────────────────────────────────────────
export function renderPipelineFlow(container) {
  container.innerHTML = "";

  const wrap = document.createElement("div");
  wrap.style.cssText = "padding:20px 16px;background:var(--surface-color,#1a202c);border-radius:12px;";

  const hdr = document.createElement("p");
  hdr.style.cssText = "margin:0 0 14px;font-size:11px;font-weight:600;color:#718096;text-transform:uppercase;letter-spacing:.08em;";
  hdr.textContent = "Live Data Pipeline";
  wrap.appendChild(hdr);

  wrap.appendChild(buildSVG());

  const leg = document.createElement("p");
  leg.style.cssText = "margin:10px 0 0;font-size:10px;color:#4a5568;";
  leg.textContent = "Bronze→Silver: bronzeToSilver alarm (2 min) · Silver→Gold: dailyGoldProcessing alarm";
  wrap.appendChild(leg);

  container.appendChild(wrap);

  refreshCounts();
  return setInterval(refreshCounts, REFRESH_MS);
}
