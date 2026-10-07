// Data Pipeline Flow — pure SVG, no deps
// Shows: [SW Capture] and [content.js] → Bronze → Silver → Gold
// Live refresh every 5s: row counts, 5-min throughput, last-ran timestamps

import { runtime } from "../../background/compat/browser-compat.js";

const REFRESH_MS = 5000;
const NS = "http://www.w3.org/2000/svg";

// ── layout ───────────────────────────────────────────────────────────────────
// viewBox: 760 × 255
// Source nodes (left column), Medallion nodes (center+right), edge labels below nodes
const SRC_SW  = { x: 10,  y: 30,  w: 130, h: 65  };
const SRC_CT  = { x: 10,  y: 145, w: 130, h: 105 };
const BRONZE  = { x: 205, y: 30, w: 145, h: 150, accent: "#cd7f32", label: "Bronze", sub: "raw",        alarm: "live",        countId: "pf-bronze",  tpId: "pf-tp-bronze" };
const SILVER  = { x: 405, y: 30, w: 145, h: 150, accent: "#a8a9ad", label: "Silver", sub: "enriched",   alarm: "every 2 min", countId: "pf-silver",  tpId: "pf-tp-silver" };
const GOLD    = { x: 605, y: 30, w: 145, h: 150, accent: "#ffd700", label: "Gold",   sub: "aggregated", alarm: "daily",       countId: "pf-gold",    tpId: null           };

// Midpoint X for edge labels (between right of A and left of B)
const LBL_BTS_X = (BRONZE.x + BRONZE.w + SILVER.x) / 2;  // Bronze→Silver
const LBL_STG_X = (SILVER.x + SILVER.w + GOLD.x)   / 2;  // Silver→Gold
const LBL_Y     = BRONZE.y + BRONZE.h + 18;               // just below nodes

// ── helpers ───────────────────────────────────────────────────────────────────
const el  = (tag, a={}) => { const e=document.createElementNS(NS,tag); for(const[k,v] of Object.entries(a)) e.setAttribute(k,v); return e; };
const txt = (s, a={}) => { const t=el("text",a); t.textContent=s; return t; };

function arrowMarker(color) {
  const m = el("marker", { id:`arr-${color.replace("#","")}`, viewBox:"0 0 10 10",
    refX:"9", refY:"5", markerWidth:"5", markerHeight:"5", orient:"auto-start-reverse" });
  m.appendChild(el("path", { d:"M0 0 L10 5 L0 10z", fill:color }));
  return m;
}

function animatedEdge(x1,y1,x2,y2,color) {
  const mid=(x1+x2)/2;
  const p=el("path",{ d:`M${x1} ${y1} C${mid} ${y1},${mid} ${y2},${x2} ${y2}`,
    fill:"none", stroke:color, "stroke-width":"2.5", "marker-end":`url(#arr-${color.replace("#","")})` });
  p.classList.add("pf-animated");
  return p;
}

function sourceEdge(x1,y1,x2,y2) {
  const mid=(x1+x2)/2;
  return el("path",{ d:`M${x1} ${y1} C${mid} ${y1},${mid} ${y2},${x2} ${y2}`,
    fill:"none", stroke:"#718096", "stroke-width":"1.5", "marker-end":`url(#arr-718096)` });
}

// ── medallion node ────────────────────────────────────────────────────────────
function medallionNode(n) {
  const g=el("g",{transform:`translate(${n.x},${n.y})`});

  g.appendChild(el("rect",{ width:n.w, height:n.h, rx:"10",
    fill:"#1e2537", stroke:n.accent, "stroke-width":"1.5" }));
  g.appendChild(el("rect",{ width:n.w, height:"4", rx:"10", fill:n.accent }));

  g.appendChild(txt(n.label, { x:n.w/2, y:"23", "text-anchor":"middle",
    "font-size":"12", "font-weight":"700", fill:n.accent }));

  // row count — large, live
  g.appendChild(txt("—", { id:n.countId, x:n.w/2, y:"60",
    "text-anchor":"middle", "font-size":"26", "font-weight":"700",
    fill:"#ffffff", "font-variant-numeric":"tabular-nums" }));

  g.appendChild(txt(n.sub, { x:n.w/2, y:"76", "text-anchor":"middle",
    "font-size":"9", fill:"#718096" }));

  // throughput — live, shown only for Bronze and Silver
  if (n.tpId) {
    g.appendChild(txt("— / 5 min", { id:n.tpId, x:n.w/2, y:"97",
      "text-anchor":"middle", "font-size":"9", fill:n.accent }));
  }

  g.appendChild(txt(`⏱ ${n.alarm}`, { x:n.w/2, y:n.h-10, "text-anchor":"middle",
    "font-size":"9", fill:n.accent }));

  return g;
}

// ── source node ───────────────────────────────────────────────────────────────
function sourceNode(rect, label, lines, accent) {
  const g=el("g",{transform:`translate(${rect.x},${rect.y})`});
  g.appendChild(el("rect",{ width:rect.w, height:rect.h, rx:"8",
    fill:"#151b27", stroke:accent, "stroke-width":"1.5" }));
  g.appendChild(el("rect",{ width:rect.w, height:"3", rx:"8", fill:accent }));
  g.appendChild(txt(label, { x:rect.w/2, y:"17", "text-anchor":"middle",
    "font-size":"11", "font-weight":"700", fill:accent }));
  lines.forEach((line,i) => g.appendChild(txt(line,{ x:"8", y:30+i*15,
    "font-size":"9", fill:"#718096" })));
  return g;
}

// ── edge label (last-ran) ─────────────────────────────────────────────────────
function edgeLabel(id, x, y) {
  const g=el("g");
  g.appendChild(el("rect",{ x:x-36, y:y-11, width:72, height:14, rx:"4",
    fill:"#151b27", stroke:"#2d3748", "stroke-width":"1" }));
  g.appendChild(txt("—", { id, x, y:y+1, "text-anchor":"middle",
    "font-size":"8.5", fill:"#718096" }));
  return g;
}

// ── full SVG ──────────────────────────────────────────────────────────────────
function buildSVG() {
  const svg=el("svg",{ viewBox:`0 0 760 ${LBL_Y+14}`, xmlns:NS });
  svg.style.cssText="width:100%;max-width:800px;display:block;";

  const defs=el("defs");
  const style=el("style");
  style.textContent=`
    @keyframes pf-flow{from{stroke-dashoffset:24}to{stroke-dashoffset:0}}
    .pf-animated{stroke-dasharray:8 4;animation:pf-flow .9s linear infinite;}
  `;
  defs.appendChild(style);
  ["#718096",BRONZE.accent,SILVER.accent,GOLD.accent].forEach(c=>defs.appendChild(arrowMarker(c)));
  svg.appendChild(defs);

  // Source → Bronze edges
  const swY    = SRC_SW.y + SRC_SW.h/2;
  const ctY    = SRC_CT.y + SRC_CT.h/2;
  const bMidY  = BRONZE.y + BRONZE.h/2;
  svg.appendChild(sourceEdge(SRC_SW.x+SRC_SW.w, swY,  BRONZE.x, bMidY-22));
  svg.appendChild(sourceEdge(SRC_CT.x+SRC_CT.w, ctY,  BRONZE.x, bMidY+22));

  // Medallion → Medallion edges
  svg.appendChild(animatedEdge(BRONZE.x+BRONZE.w, BRONZE.y+BRONZE.h/2, SILVER.x, SILVER.y+SILVER.h/2, SILVER.accent));
  svg.appendChild(animatedEdge(SILVER.x+SILVER.w, SILVER.y+SILVER.h/2, GOLD.x,   GOLD.y+GOLD.h/2,     GOLD.accent));

  // Edge labels (last-ran timestamps)
  svg.appendChild(edgeLabel("pf-lbl-bts", LBL_BTS_X, LBL_Y));
  svg.appendChild(edgeLabel("pf-lbl-stg", LBL_STG_X, LBL_Y));

  // Source nodes
  svg.appendChild(sourceNode(SRC_SW,"SW Capture",["chrome.webRequest API","request-capture.js"],"#718096"));
  svg.appendChild(sourceNode(SRC_CT,"content.js",["batchResourceTiming","Web Vitals (LCP·FID·CLS)","FCP · TTFB","XHR / fetch intercept"],"#667eea"));

  // Medallion nodes (drawn last so they sit above edges)
  svg.appendChild(medallionNode(BRONZE));
  svg.appendChild(medallionNode(SILVER));
  svg.appendChild(medallionNode(GOLD));

  return svg;
}

// ── time-ago formatter ────────────────────────────────────────────────────────
function timeAgo(ts) {
  if (!ts) return "never";
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 5)   return "just now";
  if (s < 60)  return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s/60)}m ago`;
  return `${Math.floor(s/3600)}h ago`;
}

// ── live refresh ──────────────────────────────────────────────────────────────
async function refreshCounts() {
  try {
    const res = await runtime.sendMessage({ action: "getDatabaseStats" });
    if (!res?.success) return;
    const s   = res.stats;
    const fmt = n => (n != null ? Number(n).toLocaleString() : "—");

    // Row counts
    setTxt("pf-bronze", fmt(s.bronze_requests));
    setTxt("pf-silver", fmt(s.silver_requests));
    setTxt("pf-gold",   fmt(s.gold_daily_analytics));

    // Throughput (5-min window)
    if (s.throughput) {
      setTxt("pf-tp-bronze", `+${s.throughput.bronze} / 5 min`);
      setTxt("pf-tp-silver", `+${s.throughput.silver} / 5 min`);
    }

    // Last-ran edge labels
    if (s.lastProcessed) {
      setTxt("pf-lbl-bts", `B→S: ${timeAgo(s.lastProcessed.bronzeToSilver)}`);
      setTxt("pf-lbl-stg", `S→G: ${timeAgo(s.lastProcessed.silverToGold)}`);
    }
  } catch (_) { /* SW not ready */ }
}

function setTxt(id, val) {
  const el = document.getElementById(id);
  if (el) el.textContent = val;
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

  container.appendChild(wrap);

  refreshCounts();
  return setInterval(refreshCounts, REFRESH_MS);
}
