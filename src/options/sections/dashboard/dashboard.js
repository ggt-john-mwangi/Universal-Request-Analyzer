import { dashboard } from "../../components/dashboard.js";

function injectCSS() {
  if (document.querySelector('link[href*="dashboard.css"]')) return;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = chrome.runtime.getURL("options/sections/dashboard/dashboard.css");
  document.head.appendChild(link);
}

export async function init(container) {
  injectCSS();
  const html = await fetch(
    chrome.runtime.getURL("options/sections/dashboard/dashboard.html")
  ).then((r) => r.text());
  container.innerHTML = html;
  dashboard.initialize();
}
