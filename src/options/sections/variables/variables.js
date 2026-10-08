/**
 * Variables section — CRUD for reusable request variables.
 * Manages via settings (getSettings / updateSettings actions).
 */

const CSS_URL = chrome.runtime.getURL('options/sections/variables/variables.css');
const HTML_URL = chrome.runtime.getURL('options/sections/variables/variables.html');

export async function init(container) {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  const html = await fetch(HTML_URL).then(r => r.text());
  container.innerHTML = html;

  const state = { variables: [], editingId: null, maskSensitive: true };
  await loadVariables(container, state);
  wireControls(container, state);
}

// ── Data ──────────────────────────────────────────────────────────────────────

async function loadVariables(container, state) {
  const resp = await chrome.runtime.sendMessage({ action: 'getSettings' });
  state.variables = resp?.settings?.variables?.list || [];
  setCheck(container, 'variablesEnabled', resp?.settings?.variables?.enabled ?? true);
  render(container, state);
}

async function persist(container, state) {
  const resp = await chrome.runtime.sendMessage({
    action: 'updateSettings',
    settings: {
      variables: {
        enabled: getCheck(container, 'variablesEnabled'),
        list: state.variables,
      },
    },
  });
  return resp?.success ?? false;
}

// ── Render ────────────────────────────────────────────────────────────────────

function render(container, state) {
  const listEl = container.querySelector('#variablesListContainer');
  if (!listEl) return;

  if (state.variables.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-dollar-sign"></i>
        <p>No variables yet</p>
        <p class="empty-hint">Click "Add variable" to define your first reusable value</p>
      </div>`;
    return;
  }

  listEl.innerHTML = state.variables.map(v => varCard(v, state.maskSensitive)).join('');
  listEl.querySelectorAll('[data-action="edit"]').forEach(btn =>
    btn.addEventListener('click', () => openModal(container, state, btn.dataset.id))
  );
  listEl.querySelectorAll('[data-action="delete"]').forEach(btn =>
    btn.addEventListener('click', () => deleteVar(container, state, btn.dataset.id))
  );
  listEl.querySelectorAll('.reveal-inline').forEach(btn =>
    btn.addEventListener('click', () => toggleCardReveal(btn))
  );
}

function varCard(v, maskSensitive) {
  const created = v.createdAt ? new Date(v.createdAt).toLocaleDateString() : '—';
  const updated = v.updatedAt ? new Date(v.updatedAt).toLocaleDateString() : '—';
  const isSensitive = v.sensitive === true;
  const showMasked = isSensitive && maskSensitive;
  const displayVal = showMasked ? '•'.repeat(12) : escHtml(v.value || '');

  return `
    <div class="variable-card" data-id="${v.id}">
      <div class="var-icon"><i class="fas fa-dollar-sign"></i></div>
      <div class="var-body">
        <div class="var-header">
          <span class="var-name">\${${v.name}}</span>
          ${isSensitive ? '<span class="var-badge-sensitive">sensitive</span>' : ''}
        </div>
        <div class="var-value-row">
          <span class="var-value ${showMasked ? 'masked' : ''}" data-revealed="${!showMasked}"
            data-raw="${escHtml(v.value || '')}">${displayVal}</span>
          <button class="reveal-inline" title="${showMasked ? 'Reveal' : 'Mask'}">
            <i class="fas ${showMasked ? 'fa-eye' : 'fa-eye-slash'}"></i>
          </button>
        </div>
        ${v.description ? `<p class="var-desc">${escHtml(v.description)}</p>` : ''}
        <div class="var-meta">
          <span><i class="fas fa-calendar-plus"></i> ${created}</span>
          <span><i class="fas fa-calendar-check"></i> Updated ${updated}</span>
        </div>
      </div>
      <div class="var-actions">
        <button class="btn btn-ghost btn-icon" data-action="edit" data-id="${v.id}" title="Edit">
          <i class="fas fa-pencil"></i>
        </button>
        <button class="btn btn-danger btn-icon" data-action="delete" data-id="${v.id}" title="Delete">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>`;
}

function toggleCardReveal(btn) {
  const valueEl = btn.previousElementSibling;
  if (!valueEl) return;
  const revealed = valueEl.dataset.revealed === 'true';
  if (revealed) {
    valueEl.textContent = '•'.repeat(12);
    valueEl.classList.add('masked');
    valueEl.dataset.revealed = 'false';
    btn.innerHTML = '<i class="fas fa-eye"></i>';
    btn.title = 'Reveal';
  } else {
    valueEl.textContent = valueEl.dataset.raw;
    valueEl.classList.remove('masked');
    valueEl.dataset.revealed = 'true';
    btn.innerHTML = '<i class="fas fa-eye-slash"></i>';
    btn.title = 'Mask';
  }
}

// ── Modal ─────────────────────────────────────────────────────────────────────

function openModal(container, state, id = null) {
  state.editingId = id;
  const modal = container.querySelector('#variableModal');
  const nameInput = container.querySelector('#varName');
  const v = id ? state.variables.find(x => x.id === id) : null;

  container.querySelector('#modalTitle').textContent = id ? 'Edit variable' : 'Add variable';
  setVal(container, 'varName', v?.name || '');
  setVal(container, 'varValue', v?.value || '');
  setVal(container, 'varDescription', v?.description || '');
  setCheck(container, 'varSensitive', v?.sensitive ?? false);
  if (nameInput) nameInput.disabled = !!id;

  const valInput = container.querySelector('#varValue');
  if (valInput) valInput.type = v?.sensitive ? 'password' : 'text';

  modal.hidden = false;
  (nameInput || container.querySelector('#varValue'))?.focus();
}

function closeModal(container) {
  container.querySelector('#variableModal').hidden = true;
}

async function saveFromModal(container, state) {
  const name = getVal(container, 'varName').trim();
  const value = getVal(container, 'varValue').trim();
  const description = getVal(container, 'varDescription').trim();
  const sensitive = getCheck(container, 'varSensitive');

  if (!name) { notify(container, 'Name is required', 'error'); return; }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) { notify(container, 'Name: letters, digits, underscores only', 'error'); return; }
  if (!value) { notify(container, 'Value is required', 'error'); return; }

  const now = Date.now();
  if (state.editingId) {
    const idx = state.variables.findIndex(v => v.id === state.editingId);
    if (idx >= 0) state.variables[idx] = { ...state.variables[idx], value, description, sensitive, updatedAt: now };
  } else {
    if (state.variables.find(v => v.name === name)) {
      notify(container, `Variable "${name}" already exists`, 'error');
      return;
    }
    state.variables.push({ id: genId(), name, value, description, sensitive, createdAt: now, updatedAt: now });
  }

  const ok = await persist(container, state);
  if (ok) {
    closeModal(container);
    render(container, state);
    notify(container, state.editingId ? 'Variable updated' : 'Variable added', 'success');
    state.editingId = null;
  } else {
    notify(container, 'Failed to save', 'error');
  }
}

async function deleteVar(container, state, id) {
  const v = state.variables.find(x => x.id === id);
  if (!v || !confirm(`Delete variable "${v.name}"? This cannot be undone.`)) return;
  state.variables = state.variables.filter(x => x.id !== id);
  const ok = await persist(container, state);
  if (ok) {
    render(container, state);
    notify(container, 'Variable deleted', 'success');
  } else {
    notify(container, 'Failed to delete', 'error');
  }
}

// ── Import / Export ───────────────────────────────────────────────────────────

async function exportVariables(container, state) {
  const blob = new Blob([JSON.stringify({ variables: state.variables }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `ura-variables-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  notify(container, 'Variables exported', 'success');
}

async function handleImportFile(container, state, event) {
  const file = event.target.files?.[0];
  if (!file) return;
  event.target.value = '';
  let data;
  try { data = JSON.parse(await file.text()); }
  catch { notify(container, 'Invalid JSON file', 'error'); return; }

  const incoming = Array.isArray(data) ? data : (data.variables || []);
  if (!Array.isArray(incoming) || incoming.length === 0) {
    notify(container, 'No variables found in file', 'error');
    return;
  }

  let added = 0;
  const now = Date.now();
  for (const v of incoming) {
    if (!v.name || !v.value) continue;
    if (!state.variables.find(x => x.name === v.name)) {
      state.variables.push({ id: genId(), name: v.name, value: v.value, description: v.description || '', sensitive: v.sensitive ?? false, createdAt: now, updatedAt: now });
      added++;
    }
  }

  if (added === 0) { notify(container, 'No new variables to import', 'success'); return; }
  const ok = await persist(container, state);
  if (ok) {
    render(container, state);
    notify(container, `Imported ${added} variable${added !== 1 ? 's' : ''}`, 'success');
  } else {
    notify(container, 'Import failed', 'error');
  }
}

// ── Wire ──────────────────────────────────────────────────────────────────────

function wireControls(container, state) {
  container.querySelector('#addVariableBtn')?.addEventListener('click', () => openModal(container, state));
  container.querySelector('#modalSaveBtn')?.addEventListener('click', () => saveFromModal(container, state));
  container.querySelector('#modalCancelBtn')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#modalCloseBtn')?.addEventListener('click', () => closeModal(container));
  container.querySelector('#exportVariablesBtn')?.addEventListener('click', () => exportVariables(container, state));
  container.querySelector('#importVariablesInput')?.addEventListener('change', e => handleImportFile(container, state, e));

  const revealBtn = container.querySelector('#toggleReveal');
  const valInput = container.querySelector('#varValue');
  revealBtn?.addEventListener('click', () => {
    const isPass = valInput?.type === 'password';
    if (valInput) valInput.type = isPass ? 'text' : 'password';
    revealBtn.innerHTML = `<i class="fas ${isPass ? 'fa-eye-slash' : 'fa-eye'}"></i>`;
  });

  container.querySelector('#varSensitive')?.addEventListener('change', e => {
    if (valInput) valInput.type = e.target.checked ? 'password' : 'text';
  });

  container.querySelector('#maskSensitive')?.addEventListener('change', e => {
    state.maskSensitive = e.target.checked;
    render(container, state);
  });

  container.querySelector('#variablesEnabled')?.addEventListener('change', () => persist(container, state));

  container.querySelector('#variableModal')?.addEventListener('click', e => {
    if (e.target === e.currentTarget) closeModal(container);
  });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function setCheck(c, id, v) { const el = c.querySelector(`#${id}`); if (el) el.checked = !!v; }
function setVal(c, id, v) { const el = c.querySelector(`#${id}`); if (el) el.value = v ?? ''; }
function getCheck(c, id) { return c.querySelector(`#${id}`)?.checked ?? false; }
function getVal(c, id) { return c.querySelector(`#${id}`)?.value ?? ''; }
function escHtml(s) { return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2); }

function notify(container, msg, type = 'success') {
  const el = container.querySelector('#varNotification');
  if (!el) return;
  el.textContent = msg;
  el.className = `var-notification ${type}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 3000);
}
