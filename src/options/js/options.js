import "../css/options.css";
import "../css/data-purge.css";

const SECTIONS = [
  { id: "dashboard", label: "Dashboard", icon: "fas fa-chart-line",  group: "Observe" },
  { id: "runners",   label: "Runners",   icon: "fas fa-play-circle", group: "Observe" },
  { id: "alerts",    label: "Alerts",    icon: "fas fa-bell",        group: "Observe" },
  { id: "settings",  label: "Settings",  icon: "fas fa-cog",         group: "Configure" },
  { id: "variables", label: "Variables", icon: "fas fa-code",        group: "Configure" },
  { id: "database",  label: "Database",  icon: "fas fa-database",    group: "Data" },
  { id: "themes",    label: "Themes",    icon: "fas fa-palette",     group: "Appearance" },
];

const sectionLoaders = {
  dashboard: () => import("../sections/dashboard/dashboard.js"),
  runners:   () => import("../sections/runners/runners.js"),
  alerts:    () => import("../sections/alerts/alerts.js"),
  settings:  () => import("../sections/settings/settings.js"),
  variables: () => import("../sections/variables/variables.js"),
  database:  () => import("../sections/database/database.js"),
  themes:    () => import("../sections/themes/themes.js"),
};

const mounted = new Map();
let activeSection = null;

function buildNav() {
  const nav = document.getElementById("sidebarNav");
  if (!nav) return;
  const groups = [...new Set(SECTIONS.map((s) => s.group))];
  for (const group of groups) {
    const label = document.createElement("div");
    label.className = "nav-group-label";
    label.textContent = group;
    nav.appendChild(label);
    for (const section of SECTIONS.filter((s) => s.group === group)) {
      const btn = document.createElement("button");
      btn.className = "nav-item";
      btn.dataset.tab = section.id;
      btn.innerHTML = `<i class="${section.icon}"></i><span>${section.label}</span>`;
      btn.addEventListener("click", () => navigate(section.id));
      nav.appendChild(btn);
    }
  }
}

async function navigate(id) {
  if (!sectionLoaders[id]) return;

  document.querySelectorAll(".nav-item").forEach((b) => b.classList.remove("active"));
  const btn = document.querySelector(`.nav-item[data-tab="${id}"]`);
  if (btn) btn.classList.add("active");

  const section = SECTIONS.find((s) => s.id === id);
  const pageTitle = document.getElementById("pageTitle");
  if (pageTitle && section) pageTitle.textContent = section.label;

  for (const div of mounted.values()) div.classList.remove("active");

  if (!mounted.has(id)) {
    const container = document.getElementById("section-container");
    const div = document.createElement("div");
    div.id = id;
    div.className = "tab-content";
    container.appendChild(div);
    try {
      const mod = await sectionLoaders[id]();
      await mod.init(div);
    } catch (err) {
      console.error(`[nav] Section "${id}" failed to load:`, err);
      div.innerHTML = `<p style="padding:20px;color:var(--error-color,#dc3545)">Failed to load section: ${err.message}</p>`;
    }
    mounted.set(id, div);
  }

  mounted.get(id).classList.add("active");
  activeSection = id;
}

async function updateCaptureStatus() {
  try {
    const resp = await chrome.runtime.sendMessage({ action: "getSettings" });
    const enabled = resp?.settings?.capture?.enabled ?? false;
    const dot = document.querySelector("#sidebarCaptureStatus .status-dot");
    const text = document.getElementById("sidebarCaptureText");
    if (dot) dot.className = `status-dot${enabled ? " active" : ""}`;
    if (text) text.textContent = enabled ? "Capturing" : "Capture off";
  } catch (_) {}
}

document.addEventListener("DOMContentLoaded", async () => {
  buildNav();
  await navigate("dashboard");
  updateCaptureStatus();

  document.getElementById("saveAllBtn")?.addEventListener("click", () => {
    if (activeSection) {
      mounted.get(activeSection)?.dispatchEvent(new CustomEvent("ura:save"));
    }
  });

  chrome.runtime.onMessage.addListener((message) => {
    if (message.action === "settingsUpdated") updateCaptureStatus();
  });
});
