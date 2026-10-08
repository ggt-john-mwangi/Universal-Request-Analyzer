/**
 * Runners section — browse, run, and review saved runners.
 * Delegates to background runner-handlers via chrome.runtime.sendMessage.
 */

const CSS_URL = chrome.runtime.getURL('options/sections/runners/runners.css');
const HTML_URL = chrome.runtime.getURL('options/sections/runners/runners.html');

export async function init(container) {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  const html = await fetch(HTML_URL).then(r => r.text());
  container.innerHTML = html;

  const state = { runners: [], totalCount: 0, offset: 0, limit: 20, search: '', activeTab: 'runners' };
  await loadRunners(container, state);
  wireControls(container, state);
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadRunners(container, state) {
  const [runnersResp, histResp] = await Promise.all([
    chrome.runtime.sendMessage({
      action: 'getAllRunners',
      offset: state.offset,
      limit: state.limit,
      searchQuery: state.search || null,
    }),
    chrome.runtime.sendMessage({ action: 'getRunHistory', limit: 100 }),
  ]);

  state.runners = runnersResp?.runners || [];
  state.totalCount = runnersResp?.totalCount || 0;
  state.recentExecs = histResp?.history || [];

  updateKPIs(container, state);
  renderGrid(container, state);
  renderPagination(container, state);
}

function updateKPIs(container, state) {
  const totalRuns = state.runners.reduce((s, r) => s + (r.run_count || 0), 0);
  const execs = state.recentExecs || [];
  const passRate = execs.length
    ? Math.round((execs.filter(e => e.status === 'completed').length / execs.length) * 100)
    : null;
  const avgDur = execs.length
    ? Math.round(execs.reduce((s, e) => s + (e.duration || 0), 0) / execs.length)
    : null;

  setText(container, '#rn-kpi-total', state.totalCount || state.runners.length);
  setText(container, '#rn-kpi-passrate', passRate !== null ? `${passRate}%` : '—');
  setText(container, '#rn-kpi-avgdur', avgDur ? `${avgDur}ms` : '—');
  setText(container, '#rn-kpi-runs', totalRuns || '—');
}

// ── Render grid ───────────────────────────────────────────────────────────────

function renderGrid(container, state) {
  const grid = container.querySelector('#rn-grid');
  if (!grid) return;

  if (state.runners.length === 0) {
    grid.innerHTML = `
      <div class="rn-empty-state">
        <div class="rn-empty-icon">▶</div>
        <p>No runners yet. Click <strong>+ New Runner</strong> to capture and replay requests.</p>
      </div>`;
    return;
  }

  grid.innerHTML = state.runners.map(r => runnerCard(r)).join('');

  grid.querySelectorAll('.rn-run-btn').forEach(btn =>
    btn.addEventListener('click', () => runRunner(container, state, btn.dataset.id, btn.closest('.rn-card')))
  );
  grid.querySelectorAll('.rn-history-btn').forEach(btn =>
    btn.addEventListener('click', () => showHistory(container, state, btn.dataset.id))
  );
  grid.querySelectorAll('.rn-delete-btn').forEach(btn =>
    btn.addEventListener('click', () => deleteRunner(container, state, btn.dataset.id))
  );
}

function runnerCard(r) {
  const lastRun = r.last_run_at ? new Date(r.last_run_at).toLocaleString() : 'Never';
  const mode = r.execution_mode || 'sequential';
  return `
    <div class="rn-card" data-id="${r.id}">
      <div class="rn-card-header">
        <div class="rn-card-title">${escHtml(r.name)}</div>
        <span class="rn-mode-badge rn-mode-${mode}">${mode}</span>
      </div>
      ${r.description ? `<p class="rn-card-desc">${escHtml(r.description)}</p>` : ''}
      <div class="rn-card-meta">
        <span><i class="fas fa-play"></i> ${r.run_count || 0} runs</span>
        <span><i class="fas fa-clock"></i> ${lastRun}</span>
      </div>
      <div class="rn-card-footer">
        <button class="rn-btn-primary rn-run-btn" data-id="${r.id}">
          <i class="fas fa-play"></i> Run
        </button>
        <button class="rn-btn-ghost rn-history-btn" data-id="${r.id}">
          <i class="fas fa-history"></i> History
        </button>
        <button class="rn-btn-danger rn-delete-btn" data-id="${r.id}">
          <i class="fas fa-trash"></i>
        </button>
      </div>
      <div class="rn-progress" id="rn-progress-${r.id}" hidden>
        <div class="rn-progress-bar"></div>
        <span class="rn-progress-label">Running…</span>
      </div>
    </div>`;
}

function renderPagination(container, state) {
  const pag = container.querySelector('#rn-pagination');
  if (!pag) return;

  const pages = Math.ceil(state.totalCount / state.limit);
  const current = Math.floor(state.offset / state.limit);
  if (pages <= 1) { pag.innerHTML = ''; return; }

  pag.innerHTML = `
    <button class="rn-page-btn" ${current === 0 ? 'disabled' : ''} data-page="${current - 1}">‹</button>
    <span class="rn-page-info">Page ${current + 1} / ${pages}</span>
    <button class="rn-page-btn" ${current >= pages - 1 ? 'disabled' : ''} data-page="${current + 1}">›</button>`;

  pag.querySelectorAll('.rn-page-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      state.offset = parseInt(btn.dataset.page) * state.limit;
      await loadRunners(container, state);
    });
  });
}

// ── Actions ───────────────────────────────────────────────────────────────────

async function runRunner(container, state, runnerId, cardEl) {
  const progress = cardEl?.querySelector(`#rn-progress-${runnerId}`);
  const bar = progress?.querySelector('.rn-progress-bar');
  if (progress) {
    progress.hidden = false;
    if (bar) { bar.style.width = '0'; setTimeout(() => { bar.style.width = '80%'; }, 50); }
  }

  const resp = await chrome.runtime.sendMessage({ action: 'runRunner', runnerId });

  if (progress) {
    if (bar) bar.style.width = '100%';
    setTimeout(() => { progress.hidden = true; if (bar) bar.style.width = '0'; }, 800);
  }

  if (resp?.success) {
    await loadRunners(container, state); // refresh run_count
  } else {
    notify(container, `Run failed: ${resp?.error || 'Unknown error'}`, 'error');
  }
}

async function showHistory(container, state, runnerId) {
  const modal = container.querySelector('#rn-results-modal');
  const title = container.querySelector('#rn-results-title');
  const body = container.querySelector('#rn-results-body');
  if (!modal || !body) return;

  const runner = state.runners.find(r => r.id === runnerId);
  if (title) title.textContent = `${runner?.name || 'Runner'} — Results`;

  body.innerHTML = `<div class="rn-loading">Loading…</div>`;
  modal.hidden = false;

  const [histResp, perfResp] = await Promise.all([
    chrome.runtime.sendMessage({ action: 'getRunnerHistory', runnerId, limit: 20 }),
    chrome.runtime.sendMessage({ action: 'getRunnerPerformanceStats', runnerId }),
  ]);

  const executions = histResp?.executions || [];
  if (executions.length === 0) {
    body.innerHTML = `<div class="rn-empty-state">No runs yet.</div>`;
  } else {
    body.innerHTML = executions.map(e => `
      <div class="rn-exec-row">
        <span class="rn-exec-status rn-status-${e.status}">${e.status}</span>
        <span>${e.total_requests} req</span>
        <span>${e.duration ? e.duration + 'ms' : '—'}</span>
        <span class="rn-exec-time">${new Date(e.start_time).toLocaleString()}</span>
      </div>`).join('');
  }

  // Perf tab
  const perfBody = container.querySelector('#rn-perf-body');
  if (perfBody && perfResp?.stats?.length) {
    perfBody.innerHTML = `
      <table class="rn-perf-table">
        <thead><tr><th>Endpoint</th><th>P50</th><th>P95</th><th>Avg</th><th>Runs</th></tr></thead>
        <tbody>${perfResp.stats.map(s => `
          <tr>
            <td class="rn-url-cell">${escHtml(s.url || s.endpoint || '—')}</td>
            <td>${s.p50 ? s.p50 + 'ms' : '—'}</td>
            <td>${s.p95 ? s.p95 + 'ms' : '—'}</td>
            <td>${s.avg ? Math.round(s.avg) + 'ms' : '—'}</td>
            <td>${s.count || '—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } else if (perfBody) {
    perfBody.innerHTML = `<div class="rn-empty-state">No performance data yet.</div>`;
  }
}

async function deleteRunner(container, state, runnerId) {
  const runner = state.runners.find(r => r.id === runnerId);
  if (!runner || !confirm(`Delete runner "${runner.name}"?`)) return;
  const resp = await chrome.runtime.sendMessage({ action: 'deleteRunner', runnerId });
  if (resp?.success) await loadRunners(container, state);
  else notify(container, `Delete failed: ${resp?.error || 'Unknown'}`, 'error');
}

// ── Wire ──────────────────────────────────────────────────────────────────────

function wireControls(container, state) {
  container.querySelector('#rn-search')?.addEventListener('input', debounce(async e => {
    state.search = e.target.value;
    state.offset = 0;
    await loadRunners(container, state);
  }, 300));

  container.querySelector('#rn-create-btn')?.addEventListener('click', () => {
    // ponytail: runner creation wizard is in the panel/devtools, not here
    notify(container, 'Open the DevTools panel (F12) to capture and save requests as a new runner.', 'info');
  });

  container.querySelectorAll('.rn-subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.rn-subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.subtab;
      container.querySelector('#rn-pane-runners').hidden = name !== 'runners';
      container.querySelector('#rn-pane-collections').hidden = name !== 'collections';
      state.activeTab = name;
    });
  });

  container.querySelectorAll('[data-close="rn-results-modal"]').forEach(btn =>
    btn.addEventListener('click', () => { container.querySelector('#rn-results-modal').hidden = true; })
  );
  container.querySelector('#rn-results-modal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) e.target.hidden = true;
  });

  container.querySelectorAll('.rn-modal-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.rn-modal-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const t = tab.dataset.modalTab;
      container.querySelector('#rn-results-body').hidden = t !== 'history';
      container.querySelector('#rn-perf-body').hidden = t !== 'perf';
    });
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setText(c, sel, v) { const el = c.querySelector(sel); if (el) el.textContent = v ?? '—'; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function notify(container, msg, type = 'info') {
  const el = container.querySelector('#rn-notify');
  if (!el) return;
  el.textContent = msg;
  el.className = `rn-notify rn-notify-${type}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 4000);
}
