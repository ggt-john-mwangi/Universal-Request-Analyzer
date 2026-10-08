/**
 * Settings section — loads settings from background, renders form, wires all controls.
 */
import { runtime } from '../../../background/compat/browser-compat.js';

const CSS_URL = runtime.getURL('options/sections/settings/settings.css');
const HTML_URL = runtime.getURL('options/sections/settings/settings.html');

export async function init(container) {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  const html = await fetch(HTML_URL).then(r => r.text());
  container.innerHTML = html;

  const state = { settings: null, pendingImport: null };
  wireControls(container, state);
  loadSettings(container, state);
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadSettings(container, state) {
  const resp = await runtime.sendMessage({ action: 'getSettings' }).catch(() => null);
  if (!resp?.success) return;
  state.settings = resp.settings;
  populateForm(container, resp.settings);
}

function populateForm(container, s) {
  setCheck(container, 'captureEnabled', s?.capture?.enabled ?? true);
  setVal(container, 'maxStoredRequests', s?.general?.maxStoredRequests ?? 10000);
  setCheck(container, 'trackOnlyConfiguredSites', s?.capture?.trackOnlyConfiguredSites === true);
  setCheck(container, 'showCharts', s?.display?.showCharts ?? true);
  setCheck(container, 'autoExport', s?.general?.autoExport ?? false);
  setVal(container, 'exportFormat', s?.general?.defaultExportFormat || 'json');
  setVal(container, 'exportInterval', (s?.general?.autoExportInterval || 3600000) / 60000);
  setVal(container, 'exportPath', s?.general?.exportPath || '');
  setVal(container, 'retentionDays', s?.retention?.retentionDays ?? 30);
  setCheck(container, 'autoCleanup', s?.retention?.autoCleanup ?? true);

  const includeTypes = s?.capture?.captureFilters?.includeTypes || [];
  container.querySelectorAll('#captureTypeCheckboxes input').forEach(cb => {
    cb.checked = includeTypes.length === 0 || includeTypes.includes(cb.value);
  });

  const inc = s?.capture?.captureFilters?.includeDomains || [];
  const exc = s?.capture?.captureFilters?.excludeDomains || ['chrome://*', 'edge://*', 'about:*', 'chrome-extension://*'];
  setVal(container, 'includeDomains', inc.join(', '));
  setVal(container, 'excludeDomains', exc.join(', '));

  const enabledCharts = s?.display?.enabledCharts || [];
  container.querySelectorAll('#plotTypeCheckboxes input').forEach(cb => {
    cb.checked = enabledCharts.length === 0 || enabledCharts.includes(cb.value);
  });

  const badge = container.querySelector('#captureBadge');
  if (badge) badge.textContent = (s?.capture?.enabled ?? true) ? 'ON' : 'OFF';

  toggleExportOptions(container, s?.general?.autoExport ?? false);
}

function collectForm(container) {
  return {
    capture: {
      enabled: getCheck(container, 'captureEnabled'),
      trackOnlyConfiguredSites: getCheck(container, 'trackOnlyConfiguredSites'),
      captureFilters: {
        includeTypes: [...container.querySelectorAll('#captureTypeCheckboxes input:checked')].map(c => c.value),
        includeDomains: splitCsv(getVal(container, 'includeDomains')),
        excludeDomains: splitCsv(getVal(container, 'excludeDomains')),
      },
    },
    general: {
      maxStoredRequests: parseInt(getVal(container, 'maxStoredRequests') || '10000', 10),
      autoExport: getCheck(container, 'autoExport'),
      defaultExportFormat: getVal(container, 'exportFormat'),
      autoExportInterval: parseInt(getVal(container, 'exportInterval') || '60', 10) * 60000,
      exportPath: (getVal(container, 'exportPath') || '').trim(),
    },
    display: {
      showCharts: getCheck(container, 'showCharts'),
      enabledCharts: [...container.querySelectorAll('#plotTypeCheckboxes input:checked')].map(c => c.value),
    },
    retention: {
      retentionDays: parseInt(getVal(container, 'retentionDays') || '30', 10),
      autoCleanup: getCheck(container, 'autoCleanup'),
    },
  };
}

// ── Wire Controls ─────────────────────────────────────────────────────────────

function wireControls(container, state) {
  container.querySelector('#settingsSaveBtn')?.addEventListener('click', () => save(container, state));
  container.querySelector('#settingsResetBtn')?.addEventListener('click', () => reset(container, state));
  container.querySelector('#settingsExportBtn')?.addEventListener('click', () => exportProfile(container));
  container.querySelector('#exportSettingsBtn')?.addEventListener('click', () => exportProfile(container));
  container.querySelector('#settingsImportBtn')?.addEventListener('click', () => {
    container.querySelector('#importFileInput')?.click();
  });

  container.querySelector('#autoExport')?.addEventListener('change', e => {
    toggleExportOptions(container, e.target.checked);
  });

  container.querySelector('#captureEnabled')?.addEventListener('change', e => {
    const badge = container.querySelector('#captureBadge');
    if (badge) badge.textContent = e.target.checked ? 'ON' : 'OFF';
  });

  container.querySelector('#importFileInput')?.addEventListener('change', e => handleImportFile(container, state, e));
  container.querySelector('#cancelImportBtn')?.addEventListener('click', () => {
    state.pendingImport = null;
    container.querySelector('#importDiffPanel').hidden = true;
  });
  container.querySelector('#confirmImportBtn')?.addEventListener('click', () => applyImport(container, state));
}

function toggleExportOptions(container, show) {
  const el = container.querySelector('#autoExportOptions');
  if (el) el.hidden = !show;
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function save(container, state) {
  const newSettings = collectForm(container);
  const resp = await runtime.sendMessage({ action: 'updateSettings', settings: newSettings });
  if (resp?.success) {
    await runtime.sendMessage({ action: 'reloadCaptureSettings' }).catch(() => {});
    state.settings = newSettings;
    notify(container, 'Settings saved', 'success');
  } else {
    notify(container, 'Failed to save settings', 'error');
  }
}

async function reset(container, state) {
  if (!confirm('Reset all settings to defaults?')) return;
  const resp = await runtime.sendMessage({ action: 'resetSettings' });
  if (resp?.success) {
    await loadSettings(container, state);
    notify(container, 'Settings reset to defaults', 'success');
  } else {
    notify(container, 'Failed to reset settings', 'error');
  }
}

async function exportProfile(container) {
  const resp = await runtime.sendMessage({ action: 'getSettings' });
  if (!resp?.success) { notify(container, 'Could not load settings', 'error'); return; }
  const blob = new Blob([JSON.stringify(resp.settings, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ura-settings-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  notify(container, 'Settings exported', 'success');
}

async function handleImportFile(container, state, event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { notify(container, 'Invalid JSON file', 'error'); return; }

  if (!validateImport(data)) {
    notify(container, 'No recognized settings sections found', 'error');
    return;
  }

  const resp = await runtime.sendMessage({ action: 'getSettings' });
  const current = resp?.settings || {};
  const incoming = data.settings || data;
  const changes = diffSettings(current, incoming);

  if (changes.length === 0) { notify(container, 'No changes to apply', 'success'); return; }

  state.pendingImport = incoming;
  renderDiff(container, changes);
}

async function applyImport(container, state) {
  if (!state.pendingImport) return;
  const resp = await runtime.sendMessage({ action: 'updateSettings', settings: state.pendingImport });
  state.pendingImport = null;
  container.querySelector('#importDiffPanel').hidden = true;
  if (resp?.success) {
    await loadSettings(container, state);
    notify(container, 'Settings imported', 'success');
  } else {
    notify(container, 'Import failed', 'error');
  }
}

// ── Diff ──────────────────────────────────────────────────────────────────────

const KNOWN_SECTIONS = ['general', 'capture', 'filters', 'export', 'themes', 'retention', 'monitoring', 'display', 'theme'];

function validateImport(data) {
  const d = data.settings || data;
  return KNOWN_SECTIONS.some(s => d[s]);
}

function diffSettings(current, incoming) {
  const changes = [];
  for (const [section, data] of Object.entries(incoming)) {
    if (!current[section] || typeof data !== 'object') continue;
    for (const [key, newVal] of Object.entries(data)) {
      const oldVal = current[section][key];
      if (JSON.stringify(oldVal) !== JSON.stringify(newVal)) {
        changes.push({ section, key, oldVal: fmtVal(oldVal), newVal: fmtVal(newVal) });
      }
    }
  }
  return changes;
}

function fmtVal(v) {
  if (v === undefined) return '—';
  if (typeof v === 'object') return JSON.stringify(v).substring(0, 60) + '…';
  return String(v).substring(0, 60);
}

function renderDiff(container, changes) {
  const panel = container.querySelector('#importDiffPanel');
  const count = container.querySelector('#diffCount');
  const tbody = container.querySelector('#diffTableBody');
  if (!panel || !tbody) return;
  count.textContent = `${changes.length} change${changes.length !== 1 ? 's' : ''}`;
  tbody.innerHTML = changes.map(c => `
    <tr>
      <td>${c.section}</td><td>${c.key}</td>
      <td class="diff-old">${escHtml(c.oldVal)}</td>
      <td class="diff-new">${escHtml(c.newVal)}</td>
    </tr>`).join('');
  panel.hidden = false;
}

// ── DOM utils ─────────────────────────────────────────────────────────────────

function setCheck(c, id, v) { const el = c.querySelector(`#${id}`); if (el) el.checked = !!v; }
function setVal(c, id, v) { const el = c.querySelector(`#${id}`); if (el) el.value = v ?? ''; }
function getCheck(c, id) { return c.querySelector(`#${id}`)?.checked ?? false; }
function getVal(c, id) { return c.querySelector(`#${id}`)?.value ?? ''; }
function splitCsv(s) { return s.split(',').map(x => x.trim()).filter(Boolean); }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function notify(container, msg, type = 'success') {
  const el = container.querySelector('#settingsNotification');
  if (!el) return;
  el.textContent = msg;
  el.className = `settings-notification ${type}`;
  el.hidden = false;
  clearTimeout(el._timer);
  el._timer = setTimeout(() => { el.hidden = true; }, 3500);
}
