// Data Pipeline Flow Visualization
// Pure SVG + CSS animated flow diagram showing Bronze → Silver → Gold pipeline
// No external dependencies.

import { runtime } from "../../background/compat/browser-compat.js";

const REFRESH_MS = 5000;

// Node definitions — positions are relative to the SVG viewBox (0 0 860 320)
const NODES = [
  {
    id: "sources",
    x: 10, y: 80, w: 110, h: 130,
    label: "Sources",
    color: "#4a5568",
    accent: "#718096",
    lines: ["webRequest API", "content.js", "Web Vitals"],
    countId: null,
    subtitle: null,
  },
  {
    id: "bronze",
    x: 190, y: 80, w: 130, h: 130,
    label: "Bronze",
    color: "#7b4f2e",
    accent: "#cd7f32",
    countId: "pf-bronze-count",
    subtitle: "raw captures",
    alarmLabel: "live",
  },
  {
    id: "silver",
    x: 390, y: 80, w: 130, h: 130,
    label: "Silver",
    color: "#4a5568",
    accent: "#a8a9ad",
    countId: "pf-silver-count",
    subtitle: "enriched",
    alarmLabel: "every 2 min",
  },
  {
    id: "gold",
    x: 590, y: 80, w: 130, h: 130,
    label: "Gold",
    color: "#6b4f00",
    accent: "#ffd700",
    countId: "pf-gold-count",
    subtitle: "aggregated",
    alarmLabel: "daily",
  },
  {
    id: "cloud",
    x: 760, y: 105, w: 85, h: 80,
    label: "Cloud",
    color: "#2c5282",
    accent: "#63b3ed",
    countId: null,
    subtitle: "Phase 2",
    dim: true,
  },
];

// Edge definitions — [fromId, toId, animated]
const EDGES = [
  { from: "sources", to: "bronze", animated: true },
  { from: "bronze", to: "silver", animated: true },
  { from: "silver", to: "gold", animated: true },
  { from: "gold", to: "cloud", animated: false, dashed: true },
];

function nodeCenter(node) {
  return { x: node.x + node.w / 2, y: node.y + node.h / 2 };
}

function buildSVG() {
  const ns = "http://www.w3.org/2000/svg";

  const svg = document.createElementNS(ns, "svg");
  svg.setAttribute("viewBox", "0 0 860 290");
  svg.setAttribute("xmlns", ns);
  svg.style.cssText = "width:100%;max-width:860px;overflow:visible;";

  // Defs: gradient backgrounds + animated marker
  const defs = document.createElementNS(ns, "defs");

  // Animated dash pattern for edges
  const style = document.createElementNS(ns, "style");
  style.textContent = `
    @keyframes flow {
      from { stroke-dashoffset: 24; }
      to   { stroke-dashoffset: 0;  }
    }
    @keyframes flow-reverse {
      from { stroke-dashoffset: 0;  }
      to   { stroke-dashoffset: 24; }
    }
    .pf-edge-animated {
      stroke-dasharray: 8 4;
      animation: flow 0.8s linear infinite;
    }
    .pf-edge-phase2 {
      stroke-dasharray: 5 5;
      opacity: 0.35;
    }
    .pf-count {
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .pf-node-dim rect { opacity: 0.45; }
    .pf-node-dim text { opacity: 0.45; }
  `;
  defs.appendChild(style);

  // Arrowhead marker per edge color
  const markerColors = ["#718096", "#cd7f32", "#a8a9ad", "#63b3ed"];
  markerColors.forEach((color, i) => {
    const marker = document.createElementNS(ns, "marker");
    marker.setAttribute("id", `arrow-${i}`);
    marker.setAttribute("viewBox", "0 0 10 10");
    marker.setAttribute("refX", "9");
    marker.setAttribute("refY", "5");
    marker.setAttribute("markerWidth", "6");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", "M 0 0 L 10 5 L 0 10 z");
    path.setAttribute("fill", color);
    marker.appendChild(path);
    defs.appendChild(marker);
  });

  svg.appendChild(defs);

  // Draw edges first (behind nodes)
  EDGES.forEach((edge, i) => {
    const fromNode = NODES.find((n) => n.id === edge.from);
    const toNode = NODES.find((n) => n.id === edge.to);
    const x1 = fromNode.x + fromNode.w;
    const y1 = fromNode.y + fromNode.h / 2;
    const x2 = toNode.x;
    const y2 = toNode.y + toNode.h / 2;
    const midX = (x1 + x2) / 2;

    const color = edge.dashed ? "#63b3ed" : toNode.accent;

    const path = document.createElementNS(ns, "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${midX} ${y1}, ${midX} ${y2}, ${x2} ${y2}`);
    path.setAttribute("fill", "none");
    path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", edge.dashed ? "1.5" : "2.5");
    path.setAttribute("marker-end", `url(#arrow-${i})`);
    if (edge.animated) {
      path.classList.add("pf-edge-animated");
    } else if (edge.dashed) {
      path.classList.add("pf-edge-phase2");
    }
    svg.appendChild(path);
  });

  // Draw nodes
  NODES.forEach((node) => {
    const g = document.createElementNS(ns, "g");
    g.setAttribute("transform", `translate(${node.x}, ${node.y})`);
    if (node.dim) g.classList.add("pf-node-dim");

    // Background rect
    const rect = document.createElementNS(ns, "rect");
    rect.setAttribute("width", node.w);
    rect.setAttribute("height", node.h);
    rect.setAttribute("rx", "8");
    rect.setAttribute("fill", node.color);
    rect.setAttribute("stroke", node.accent);
    rect.setAttribute("stroke-width", "2");
    g.appendChild(rect);

    // Top accent bar
    const bar = document.createElementNS(ns, "rect");
    bar.setAttribute("width", node.w);
    bar.setAttribute("height", "4");
    bar.setAttribute("rx", "8");
    bar.setAttribute("fill", node.accent);
    g.appendChild(bar);

    // Label
    const label = document.createElementNS(ns, "text");
    label.setAttribute("x", node.w / 2);
    label.setAttribute("y", "22");
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("font-size", "12");
    label.setAttribute("font-weight", "700");
    label.setAttribute("fill", node.accent);
    label.textContent = node.label;
    g.appendChild(label);

    if (node.lines) {
      // Sources node: list of source names
      node.lines.forEach((line, i) => {
        const t = document.createElementNS(ns, "text");
        t.setAttribute("x", node.w / 2);
        t.setAttribute("y", 44 + i * 18);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("font-size", "10");
        t.setAttribute("fill", "#a0aec0");
        t.textContent = line;
        g.appendChild(t);
      });
    } else {
      // Count
      const count = document.createElementNS(ns, "text");
      count.setAttribute("id", node.countId);
      count.setAttribute("x", node.w / 2);
      count.setAttribute("y", node.id === "cloud" ? 48 : 60);
      count.setAttribute("text-anchor", "middle");
      count.setAttribute("font-size", node.id === "cloud" ? "13" : "22");
      count.setAttribute("fill", "#ffffff");
      count.classList.add("pf-count");
      count.textContent = "—";
      g.appendChild(count);

      // Subtitle
      if (node.subtitle) {
        const sub = document.createElementNS(ns, "text");
        sub.setAttribute("x", node.w / 2);
        sub.setAttribute("y", node.id === "cloud" ? 63 : 78);
        sub.setAttribute("text-anchor", "middle");
        sub.setAttribute("font-size", "9");
        sub.setAttribute("fill", "#718096");
        sub.textContent = node.subtitle;
        g.appendChild(sub);
      }

      // Alarm label
      if (node.alarmLabel) {
        const alarm = document.createElementNS(ns, "text");
        alarm.setAttribute("x", node.w / 2);
        alarm.setAttribute("y", node.h - 12);
        alarm.setAttribute("text-anchor", "middle");
        alarm.setAttribute("font-size", "9");
        alarm.setAttribute("fill", node.accent);
        alarm.textContent = `⏱ ${node.alarmLabel}`;
        g.appendChild(alarm);
      }
    }

    svg.appendChild(g);
  });

  // Label below: vitals sub-flow (minor, small text)
  const vitalsLabel = document.createElementNS(ns, "text");
  vitalsLabel.setAttribute("x", "255");
  vitalsLabel.setAttribute("y", "240");
  vitalsLabel.setAttribute("text-anchor", "middle");
  vitalsLabel.setAttribute("font-size", "9");
  vitalsLabel.setAttribute("fill", "#4a5568");
  vitalsLabel.textContent = "bronze_web_vitals (LCP · FID · CLS · FCP · TTFB)";
  svg.appendChild(vitalsLabel);

  const vitalsLine = document.createElementNS(ns, "line");
  vitalsLine.setAttribute("x1", "120");
  vitalsLine.setAttribute("y1", "210");
  vitalsLine.setAttribute("x2", "255");
  vitalsLine.setAttribute("y2", "235");
  vitalsLine.setAttribute("stroke", "#4a5568");
  vitalsLine.setAttribute("stroke-width", "1");
  vitalsLine.setAttribute("stroke-dasharray", "3 3");
  svg.appendChild(vitalsLine);

  return svg;
}

async function refreshCounts() {
  try {
    const response = await runtime.sendMessage({ action: "getDatabaseStats" });
    if (!response?.success) return;
    const s = response.stats;
    const fmt = (n) => (n != null ? Number(n).toLocaleString() : "—");

    const bronzeEl = document.getElementById("pf-bronze-count");
    const silverEl = document.getElementById("pf-silver-count");
    const goldEl = document.getElementById("pf-gold-count");

    if (bronzeEl) bronzeEl.textContent = fmt(s.bronze_requests);
    if (silverEl) silverEl.textContent = fmt(s.silver_requests);
    if (goldEl) goldEl.textContent = fmt(s.gold_daily_analytics);
  } catch (_) {
    // SW not ready yet
  }
}

export function renderPipelineFlow(container) {
  container.innerHTML = "";

  const wrapper = document.createElement("div");
  wrapper.style.cssText =
    "padding:20px 16px;background:var(--surface-color,#1a202c);border-radius:12px;";

  const title = document.createElement("h3");
  title.style.cssText =
    "margin:0 0 16px;font-size:13px;font-weight:600;color:var(--text-secondary-color,#718096);text-transform:uppercase;letter-spacing:.08em;";
  title.textContent = "Data Pipeline";
  wrapper.appendChild(title);

  wrapper.appendChild(buildSVG());

  const legend = document.createElement("p");
  legend.style.cssText =
    "margin:12px 0 0;font-size:10px;color:var(--text-secondary-color,#4a5568);";
  legend.textContent =
    "Bronze→Silver runs every 2 min · Silver→Gold runs daily · Cloud sync is Phase 2";
  wrapper.appendChild(legend);

  container.appendChild(wrapper);

  refreshCounts();
  return setInterval(refreshCounts, REFRESH_MS);
}
