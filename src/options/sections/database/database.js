/**
 * Database section — pipeline live counts, SQL editor, retention settings, backup/restore.
 */

const CSS_URL = chrome.runtime.getURL('options/sections/database/database.css');
const HTML_URL = chrome.runtime.getURL('options/sections/database/database.html');

export async function init(container) {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  const html = await fetch(HTML_URL).then(r => r.text());
  container.innerHTML = html;

  const state = { sqlHistory: [], importFile: null };
  await loadPipeline(container, state);
  loadRetentionSettings(container);
  wireControls(container, state);
}

// ── Pipeline ──────────────────────────────────────────────────────────────────

async function loadPipeline(container, state) {
  const [statsResp, sizeResp] = await Promise.all([
    chrome.runtime.sendMessage({ action: 'getDatabaseStats' }),
    chrome.runtime.sendMessage({ action: 'getDatabaseSize' }),
  ]);
  const stats = statsResp?.stats || {};

  // Field names from database-handlers.js getDatabaseStats
  setText(container, '#db-bronze-count', fmt(stats.bronze_requests));
  setText(container, '#db-silver-count', fmt(stats.silver_requests));
  setText(container, '#db-gold-count', fmt(stats.gold_daily_analytics));
  setText(container, '#db-node-bronze-count', fmt(stats.bronze_requests));
  setText(container, '#db-node-silver-count', fmt(stats.silver_requests));
  setText(container, '#db-node-gold-count', fmt(stats.gold_daily_analytics));

  const bTp = stats.throughput?.bronze ?? '—';
  const sTp = stats.throughput?.silver ?? '—';
  setText(container, '#db-bronze-tp', `${bTp} / 5 min`);
  setText(container, '#db-silver-tp', `${sTp} / 5 min`);

  // DB size from getDatabaseSize
  if (sizeResp?.success && sizeResp.size) {
    setText(container, '#db-size-val', fmtBytes(sizeResp.size));
  }

  // Last run times — from stats.lastProcessed
  const lastBts = stats.lastProcessed?.bronzeToSilver;
  const lastStg = stats.lastProcessed?.silverToGold;
  setText(container, '#db-last-bts', lastBts ? new Date(lastBts).toLocaleString() : '—');
  setText(container, '#db-last-stg', lastStg ? new Date(lastStg).toLocaleString() : '—');
  setText(container, '#db-bts-timing', lastBts ? `B→S: ${timeAgo(lastBts)}` : 'B→S: —');
  setText(container, '#db-stg-timing', lastStg ? `S→G: ${timeAgo(lastStg)}` : 'S→G: —');
}

// ── SQL Editor ────────────────────────────────────────────────────────────────

async function runQuery(container, state) {
  const sql = (container.querySelector('#db-sql-input')?.value || '').trim();
  if (!sql) return;

  const resultsEl = container.querySelector('#db-sql-results');
  if (!resultsEl) return;
  resultsEl.innerHTML = `<div class="db-sql-placeholder">Running…</div>`;

  const resp = await chrome.runtime.sendMessage({ action: 'executeDirectQuery', query: sql });
  addToSqlHistory(container, state, sql);

  if (!resp?.success) {
    resultsEl.innerHTML = `<div class="db-sql-error">${escHtml(resp?.error || 'Query failed')}</div>`;
    return;
  }

  const rows = resp.data || [];
  if (rows.length === 0) {
    resultsEl.innerHTML = `<div class="db-sql-placeholder">Query returned 0 rows.</div>`;
    return;
  }

  // Table render
  const cols = Object.keys(rows[0]);
  resultsEl.innerHTML = `
    <div class="db-results-meta">${rows.length} row${rows.length !== 1 ? 's' : ''}</div>
    <div class="db-table-wrap">
      <table class="db-results-table">
        <thead><tr>${cols.map(c => `<th>${escHtml(c)}</th>`).join('')}</tr></thead>
        <tbody>${rows.map(r =>
          `<tr>${cols.map(c => `<td>${escHtml(String(r[c] ?? ''))}</td>`).join('')}</tr>`
        ).join('')}</tbody>
      </table>
    </div>`;
}

function addToSqlHistory(container, state, sql) {
  // Keep last 10 unique queries
  state.sqlHistory = [sql, ...state.sqlHistory.filter(q => q !== sql)].slice(0, 10);
  const histEl = container.querySelector('#db-sql-history');
  if (!histEl) return;
  histEl.innerHTML = state.sqlHistory.map(q => `
    <button class="db-hist-btn" title="${escHtml(q)}">${escHtml(q.substring(0, 40))}${q.length > 40 ? '…' : ''}</button>
  `).join('');
  histEl.querySelectorAll('.db-hist-btn').forEach((btn, i) => {
    btn.addEventListener('click', () => {
      const inp = container.querySelector('#db-sql-input');
      if (inp) inp.value = state.sqlHistory[i];
    });
  });
}

// ── Retention ─────────────────────────────────────────────────────────────────

async function loadRetentionSettings(container) {
  const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
  const ret = resp?.settings?.retention || {};
  // bronzeDays/goldDays are URA-specific extensions stored alongside the core retentionDays field
  setVal(container, '#db-ret-bronze', ret.bronzeDays ?? 7);
  setVal(container, '#db-ret-silver', ret.retentionDays ?? 30);
  setVal(container, '#db-ret-gold', ret.goldDays ?? 365);
}

async function saveRetention(container) {
  const bronze = parseInt(getVal(container, '#db-ret-bronze') || '7', 10);
  const silver = parseInt(getVal(container, '#db-ret-silver') || '30', 10);
  const gold = parseInt(getVal(container, '#db-ret-gold') || '365', 10);

  const resp = await chrome.runtime.sendMessage({
    action: 'updateSettings',
    settings: { retention: { bronzeDays: bronze, retentionDays: silver, goldDays: gold, autoCleanup: true } },
  });

  const status = container.querySelector('#db-ret-status');
  if (status) {
    status.textContent = resp?.success ? 'Saved' : 'Failed';
    status.className = `db-save-status ${resp?.success ? 'ok' : 'err'}`;
    setTimeout(() => { status.textContent = ''; }, 3000);
  }
}

async function runCleanup(container) {
  if (!confirm('Run data cleanup now? Records older than retention thresholds will be deleted.')) return;
  const status = container.querySelector('#db-cleanup-status');
  if (status) status.textContent = 'Running…';
  const days = parseInt(getVal(container, '#db-ret-silver') || '30', 10);
  const resp = await chrome.runtime.sendMessage({ action: 'cleanupOldRecords', days });
  if (status) {
    status.textContent = resp?.success ? 'Cleanup complete' : `Failed: ${resp?.error || ''}`;
    status.className = `db-save-status ${resp?.success ? 'ok' : 'err'}`;
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
  if (resp?.success) await loadPipeline(container, {});
}

// ── Backup / Restore ──────────────────────────────────────────────────────────

async function exportDb(container) {
  const status = container.querySelector('#db-export-status');
  if (status) status.textContent = 'Exporting…';
  // createBackup triggers chrome.downloads directly from the background
  const resp = await chrome.runtime.sendMessage({ action: 'createBackup' });
  if (status) {
    status.textContent = resp?.success ? `Saved: ${resp.filename}` : (resp?.error || 'Export failed');
    status.className = `db-save-status ${resp?.success ? 'ok' : 'err'}`;
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
}

async function vacuumDb(container) {
  const status = container.querySelector('#db-vacuum-status');
  if (status) status.textContent = 'Running VACUUM…';
  const resp = await chrome.runtime.sendMessage({ action: 'vacuumDatabase' });
  if (status) {
    status.textContent = resp?.success ? 'VACUUM complete' : `Failed: ${resp?.error || ''}`;
    status.className = `db-save-status ${resp?.success ? 'ok' : 'err'}`;
    setTimeout(() => { status.textContent = ''; }, 4000);
  }
}

// ── Wire ──────────────────────────────────────────────────────────────────────

function wireControls(container, state) {
  // Sub-tab switching
  container.querySelectorAll('.db-subtab').forEach(tab => {
    tab.addEventListener('click', () => {
      container.querySelectorAll('.db-subtab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      const name = tab.dataset.subtab;
      ['pipeline', 'sql', 'retention', 'backup'].forEach(p => {
        const pane = container.querySelector(`#db-pane-${p}`);
        if (pane) pane.hidden = p !== name;
      });
      if (name === 'pipeline') loadPipeline(container, state);
    });
  });

  // SQL editor
  container.querySelector('#db-sql-run-btn')?.addEventListener('click', () => runQuery(container, state));
  container.querySelector('#db-sql-clear-btn')?.addEventListener('click', () => {
    const inp = container.querySelector('#db-sql-input');
    if (inp) inp.value = '';
    const res = container.querySelector('#db-sql-results');
    if (res) res.innerHTML = `<div class="db-sql-placeholder">Run a query to see results.</div>`;
  });
  container.querySelector('#db-sql-input')?.addEventListener('keydown', e => {
    if (e.ctrlKey && e.key === 'Enter') runQuery(container, state);
  });

  // Retention
  container.querySelector('#db-ret-save-btn')?.addEventListener('click', () => saveRetention(container));
  container.querySelector('#db-cleanup-btn')?.addEventListener('click', () => runCleanup(container));

  // Backup
  container.querySelector('#db-export-btn')?.addEventListener('click', () => exportDb(container));
  container.querySelector('#db-vacuum-btn')?.addEventListener('click', () => vacuumDb(container));

  const importFile = container.querySelector('#db-import-file');
  const importBtn = container.querySelector('#db-import-btn');
  importFile?.addEventListener('change', e => {
    state.importFile = e.target.files?.[0] || null;
    if (importBtn) importBtn.disabled = !state.importFile;
  });
  importBtn?.addEventListener('click', async () => {
    if (!state.importFile) return;
    if (!confirm('Import will replace the current database. Continue?')) return;
    const status = container.querySelector('#db-import-status');
    if (status) status.textContent = 'Importing…';
    const buf = await state.importFile.arrayBuffer();
    const data = Array.from(new Uint8Array(buf));
    const resp = await chrome.runtime.sendMessage({ action: 'importDatabase', data });
    if (status) {
      status.textContent = resp?.success ? 'Import complete' : `Failed: ${resp?.error || ''}`;
      status.className = `db-save-status ${resp?.success ? 'ok' : 'err'}`;
    }
    if (resp?.success) await loadPipeline(container, state);
    setTimeout(() => { if (status) status.textContent = ''; }, 5000);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setText(c, sel, v) { const el = c.querySelector(sel); if (el) el.textContent = v ?? '—'; }
function setVal(c, sel, v) { const el = c.querySelector(sel); if (el) el.value = v ?? ''; }
function getVal(c, sel) { return c.querySelector(sel)?.value ?? ''; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
function fmt(n) { return n != null ? n.toLocaleString() : '—'; }
function fmtBytes(b) {
  if (!b) return '0 B';
  const u = ['B','KB','MB','GB'];
  let i = 0;
  while (b >= 1024 && i < u.length - 1) { b /= 1024; i++; }
  return `${b.toFixed(1)} ${u[i]}`;
}
function timeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}
