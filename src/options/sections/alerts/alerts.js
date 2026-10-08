/**
 * Alerts section — rule CRUD + history with 7-day bar chart.
 * Rules stored in settings.alerts.rules.
 */
import { runtime } from '../../../background/compat/browser-compat.js';

const CSS_URL = runtime.getURL('options/sections/alerts/alerts.css');
const HTML_URL = runtime.getURL('options/sections/alerts/alerts.html');

export async function init(container) {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  const html = await fetch(HTML_URL).then(r => r.text());
  container.innerHTML = html;

  const state = { rules: [], history: [], editingId: null, activeTab: 'rules' };
  wireControls(container, state);
  loadData(container, state);
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadData(container, state) {
  const [settResp, histResp, statsResp] = await Promise.all([
    runtime.sendMessage({ action: 'getSettings' }).catch(() => null),
    runtime.sendMessage({ action: 'getAlertHistory', limit: 100 }).catch(() => null),
    runtime.sendMessage({ action: 'getDomains', timeRange: 86400 }).catch(() => null),
  ]);

  state.rules = settResp?.settings?.alerts?.rules || [];
  state.history = histResp?.history || [];
  state.domains = extractDomains(statsResp);

  updateKPIs(container, state);
  renderRules(container, state);
  renderHistory(container, state);
  populateDomainSelect(container, state);
}

function extractDomains(domainsResp) {
  // getDomains returns { success, domains: [{ domain, requestCount, ... }] }
  return (domainsResp?.domains || []).map(d => d.domain).filter(Boolean);
}

function updateKPIs(container, state) {
  const today = new Date().toDateString();
  const todayCount = state.history.filter(h => new Date(h.triggeredAt).toDateString() === today).length;
  const weekAgo = Date.now() - 7 * 86400000;
  const weekCount = state.history.filter(h => h.triggeredAt > weekAgo).length;

  setText(container, '#al-kpi-rules', state.rules.length);
  setText(container, '#al-kpi-enabled', state.rules.filter(r => r.enabled !== false).length);
  setText(container, '#al-kpi-today', todayCount);
  setText(container, '#al-kpi-week', weekCount);
}

async function persistRules(container, state) {
  const settResp = await runtime.sendMessage({ action: 'getSettings' });
  const current = settResp?.settings || {};
  const resp = await runtime.sendMessage({
    action: 'updateSettings',
    settings: { ...current, alerts: { ...(current.alerts || {}), rules: state.rules } },
  });
  return resp?.success ?? false;
}

// ── Rules render ──────────────────────────────────────────────────────────────

function renderRules(container, state) {
  const list = container.querySelector('#al-rules-list');
  if (!list) return;

  if (state.rules.length === 0) {
    list.innerHTML = `<div class="al-empty-state">No alert rules yet. Click <strong>+ Add Rule</strong> to create one.</div>`;
    return;
  }

  const METRIC_LABELS = { avgDuration: 'Avg Response Time', maxDuration: 'Max Response Time', errorRate: 'Error Rate %', requestCount: 'Request Count' };
  const COND_LABELS = { gt: '>', lt: '<', eq: '=' };

  list.innerHTML = state.rules.map(r => `
    <div class="al-rule-card ${r.enabled !== false ? '' : 'al-rule-disabled'}" data-id="${r.id}">
      <div class="al-rule-main">
        <div class="al-rule-name">${escHtml(r.name)}</div>
        <div class="al-rule-condition">
          <span class="al-condition-chip">${METRIC_LABELS[r.metric] || r.metric} ${COND_LABELS[r.condition] || r.condition} ${r.threshold}</span>
          ${r.domain ? `<span class="al-domain-chip">${escHtml(r.domain)}</span>` : ''}
        </div>
      </div>
      <div class="al-rule-actions">
        <label class="al-toggle-mini" title="${r.enabled !== false ? 'Disable' : 'Enable'}">
          <input type="checkbox" class="al-rule-enable" data-id="${r.id}" ${r.enabled !== false ? 'checked' : ''}>
          <span class="al-toggle-mini-track"></span>
        </label>
        <button class="al-icon-btn al-btn-edit" data-id="${r.id}" title="Edit"><i class="fas fa-pencil"></i></button>
        <button class="al-icon-btn al-btn-delete" data-id="${r.id}" title="Delete"><i class="fas fa-trash"></i></button>
      </div>
    </div>`).join('');

  list.querySelectorAll('.al-rule-enable').forEach(cb => {
    cb.addEventListener('change', async () => {
      const rule = state.rules.find(r => r.id === cb.dataset.id);
      if (rule) { rule.enabled = cb.checked; await persistRules(container, state); updateKPIs(container, state); }
    });
  });
  list.querySelectorAll('.al-btn-edit').forEach(btn =>
    btn.addEventListener('click', () => openModal(container, state, btn.dataset.id))
  );
  list.querySelectorAll('.al-btn-delete').forEach(btn =>
    btn.addEventListener('click', () => deleteRule(container, state, btn.dataset.id))
  );
}

// ── History render ────────────────────────────────────────────────────────────

function renderHistory(container, state) {
  renderHistoryChart(container, state);

  const list = container.querySelector('#al-history-list');
  if (!list) return;

  if (state.history.length === 0) {
    list.innerHTML = `<div class="al-empty-state">No alert history yet.</div>`;
    return;
  }

  list.innerHTML = state.history.slice(0, 50).map(h => `
    <div class="al-hist-row">
      <span class="al-hist-rule">${escHtml(h.ruleName || 'Unknown rule')}</span>
      <span class="al-hist-val">${h.value !== undefined ? h.value : '—'}</span>
      <span class="al-hist-time">${new Date(h.triggeredAt).toLocaleString()}</span>
    </div>`).join('');
}

function renderHistoryChart(container, state) {
  const chartContainer = container.querySelector('#al-chart-container');
  if (!chartContainer) return;

  // Build last-7-days bucket
  const days = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    days.push({ label: d.toLocaleDateString(undefined, { weekday: 'short' }), date: d.toDateString(), count: 0 });
  }
  for (const h of state.history) {
    const ds = new Date(h.triggeredAt).toDateString();
    const bucket = days.find(d => d.date === ds);
    if (bucket) bucket.count++;
  }

  const max = Math.max(1, ...days.map(d => d.count));
  chartContainer.innerHTML = `
    <div class="al-bar-chart">
      ${days.map(d => `
        <div class="al-bar-col">
          <div class="al-bar-fill" style="--pct:${Math.round((d.count / max) * 100)}%" title="${d.count} alerts">
            ${d.count > 0 ? `<span class="al-bar-val">${d.count}</span>` : ''}
          </div>
          <div class="al-bar-lbl">${d.label}</div>
        </div>`).join('')}
    </div>`;
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(container, state, id = null) {
  state.editingId = id;
  const modal = container.querySelector('#al-rule-modal');
  const r = id ? state.rules.find(x => x.id === id) : null;

  container.querySelector('#al-modal-title').textContent = id ? 'Edit Alert Rule' : 'Add Alert Rule';
  setVal(container, '#al-f-name', r?.name || '');
  setVal(container, '#al-f-metric', r?.metric || 'avgDuration');
  setVal(container, '#al-f-condition', r?.condition || 'gt');
  setVal(container, '#al-f-threshold', r?.threshold ?? '');
  setVal(container, '#al-f-domain', r?.domain || '');
  setCheck(container, '#al-f-enabled', r?.enabled ?? true);

  modal.hidden = false;
  container.querySelector('#al-f-name')?.focus();
}

function closeModal(container) {
  container.querySelector('#al-rule-modal').hidden = true;
}

async function saveRule(container, state) {
  const name = (getVal(container, '#al-f-name') || '').trim();
  const metric = getVal(container, '#al-f-metric');
  const condition = getVal(container, '#al-f-condition');
  const threshold = parseFloat(getVal(container, '#al-f-threshold'));
  const domain = getVal(container, '#al-f-domain');
  const enabled = getCheck(container, '#al-f-enabled');

  if (!name) { alert('Rule name is required'); return; }
  if (isNaN(threshold)) { alert('Threshold must be a number'); return; }

  const now = Date.now();
  if (state.editingId) {
    const idx = state.rules.findIndex(r => r.id === state.editingId);
    if (idx >= 0) state.rules[idx] = { ...state.rules[idx], name, metric, condition, threshold, domain, enabled, updatedAt: now };
  } else {
    state.rules.push({ id: genId(), name, metric, condition, threshold, domain, enabled, createdAt: now, updatedAt: now });
  }

  const ok = await persistRules(container, state);
  if (ok) {
    closeModal(container);
    updateKPIs(container, state);
    renderRules(container, state);
    state.editingId = null;
  }
}

async function deleteRule(container, state, id) {
  const r = state.rules.find(x => x.id === id);
  if (!r || !confirm(`Delete rule "${r.name}"?`)) return;
  state.rules = state.rules.filter(x => x.id !== id);
  await persistRules(container, state);
  updateKPIs(container, state);
  renderRules(container, state);
}

// ── Misc ──────────────────────────────────────────────────────────────────────

function populateDomainSelect(container, state) {
  const sel = container.querySelector('#al-f-domain');
  if (!sel || !state.domains.length) return;
  const existing = new Set([...sel.options].map(o => o.value));
  for (const d of state.domains) {
    if (!existing.has(d)) {
      const opt = document.createElement('option');
      opt.value = d;
      opt.textContent = d;
      sel.appendChild(opt);
    }
  }
}

// ── Wire ──────────────────────────────────────────────────────────────────────

function wireControls(container, state) {
  container.querySelector('#al-add-rule-btn')?.addEventListener('click', () => openModal(container, state));
  container.querySelector('#al-save-rule-btn')?.addEventListener('click', () => saveRule(container, state));

  container.querySelectorAll('[data-close="al-rule-modal"]').forEach(btn =>
    btn.addEventListener('click', () => closeModal(container))
  );
  container.querySelector('#al-rule-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal(container);
  });

  container.querySelectorAll('.al-subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.al-subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.subtab;
      container.querySelector('#al-pane-rules').hidden = name !== 'rules';
      container.querySelector('#al-pane-history').hidden = name !== 'history';
      state.activeTab = name;
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setText(c, sel, v) { const el = c.querySelector(sel); if (el) el.textContent = v ?? '—'; }
function setVal(c, sel, v) { const el = c.querySelector(sel); if (el) el.value = v ?? ''; }
function setCheck(c, sel, v) { const el = c.querySelector(sel); if (el) el.checked = !!v; }
function getVal(c, sel) { return c.querySelector(sel)?.value ?? ''; }
function getCheck(c, sel) { return c.querySelector(sel)?.checked ?? false; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }
