/**
 * Themes section — theme picker with live mini-previews + custom theme editor.
 * Applies theme via body class (same as theme-manager.js).
 */

import { storage, runtime } from '../../../background/compat/browser-compat.js';

const CSS_URL = runtime.getURL('options/sections/themes/themes.css');
const HTML_URL = runtime.getURL('options/sections/themes/themes.html');

const BUILTIN_THEMES = [
  {
    id: 'light',
    name: 'Light',
    colors: {
      background: '#ffffff',
      surface: '#f5f5f5',
      sidebar: '#2d3748',
      sidebarText: '#ffffff',
      primary: '#0066cc',
      text: '#212529',
      border: '#dee2e6',
      accent: '#ff9800',
    },
  },
  {
    id: 'dark',
    name: 'Dark',
    colors: {
      background: '#212529',
      surface: '#343a40',
      sidebar: '#1a1d23',
      sidebarText: '#e9ecef',
      primary: '#0d6efd',
      text: '#f8f9fa',
      border: '#495057',
      accent: '#fd7e14',
    },
  },
  {
    id: 'highContrast',
    name: 'High Contrast',
    colors: {
      background: '#000000',
      surface: '#121212',
      sidebar: '#000000',
      sidebarText: '#ffffff',
      primary: '#ffffff',
      text: '#ffffff',
      border: '#ffffff',
      accent: '#ffff00',
    },
  },
  {
    id: 'blue',
    name: 'Blue',
    colors: {
      background: '#f0f8ff',
      surface: '#e6f2ff',
      sidebar: '#003366',
      sidebarText: '#ffffff',
      primary: '#0066cc',
      text: '#003366',
      border: '#99ccff',
      accent: '#00ccff',
    },
  },
];

// Editable CSS vars shown in the custom editor
const CUSTOM_VARS = [
  { label: 'Background',       var: '--background-color',    key: 'background' },
  { label: 'Surface',          var: '--surface-color',       key: 'surface'    },
  { label: 'Primary',          var: '--primary-color',       key: 'primary'    },
  { label: 'Accent',           var: '--accent-color',        key: 'accent'     },
  { label: 'Text',             var: '--text-primary-color',  key: 'text'       },
  { label: 'Sidebar bg',       var: '--sidebar-bg',          key: 'sidebar'    },
  { label: 'Sidebar text',     var: '--sidebar-text',        key: 'sidebarText'},
  { label: 'Border',           var: '--border-color',        key: 'border'     },
];

export async function init(container) {
  if (!document.querySelector(`link[href="${CSS_URL}"]`)) {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = CSS_URL;
    document.head.appendChild(link);
  }

  const html = await fetch(HTML_URL).then(r => r.text());
  container.innerHTML = html;

  const state = {
    activeTheme: getActiveTheme(),
    customColors: defaultCustomColors(),
  };

  renderBuiltinGrid(container, state);
  renderColorPickers(container, state);
  updateCustomPreview(container, state);
  wireControls(container, state);

  // Restore persisted theme asynchronously so HTML shows immediately
  storage.get(['activeTheme', 'customTheme']).then(stored => {
    if (stored.activeTheme === 'custom' && stored.customTheme?.colors) {
      state.customColors = { ...state.customColors, ...stored.customTheme.colors };
      state.activeTheme = 'custom';
      applyCustomVars(state.customColors);
      renderBuiltinGrid(container, state);
      renderColorPickers(container, state);
      updateCustomPreview(container, state);
    } else if (stored.activeTheme && stored.activeTheme !== state.activeTheme) {
      applyTheme(stored.activeTheme);
      state.activeTheme = stored.activeTheme;
      renderBuiltinGrid(container, state);
    }
  });
}

// ── Render builtin grid ───────────────────────────────────────────────────────

function renderBuiltinGrid(container, state) {
  const grid = container.querySelector('#builtinThemesGrid');
  if (!grid) return;

  grid.innerHTML = BUILTIN_THEMES.map(t => themeCard(t, state.activeTheme)).join('');

  grid.querySelectorAll('.theme-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = card.dataset.theme;
      applyTheme(id);
      state.activeTheme = id;
      renderBuiltinGrid(container, state);
      notify(container, `Theme "${BUILTIN_THEMES.find(t => t.id === id)?.name}" applied`, 'success');
    });
  });
}

function themeCard(theme, activeId) {
  const c = theme.colors;
  const isActive = theme.id === activeId;

  return `
    <div class="theme-card ${isActive ? 'active' : ''}" data-theme="${theme.id}">
      <div class="theme-mini-preview">
        <div class="mini-sidebar" style="background:${c.sidebar}">
          <div class="mini-nav-item active" style="background:${c.sidebarText}"></div>
          <div class="mini-nav-item" style="background:${c.sidebarText}"></div>
          <div class="mini-nav-item" style="background:${c.sidebarText}"></div>
        </div>
        <div class="mini-main" style="background:${c.background}">
          <div class="mini-card" style="background:${c.surface};border:1px solid ${c.border}">
            <div class="mini-heading" style="background:${c.primary}"></div>
            <div class="mini-text" style="background:${c.text}"></div>
            <div class="mini-badge" style="background:${c.accent}"></div>
          </div>
        </div>
      </div>
      <div class="theme-card-footer">
        <span class="theme-card-name">${theme.name}</span>
        ${isActive ? '<span class="active-badge">Active</span>' : ''}
      </div>
    </div>`;
}

// ── Custom editor ─────────────────────────────────────────────────────────────

function renderColorPickers(container, state) {
  const grid = container.querySelector('#colorPickersGrid');
  if (!grid) return;

  grid.innerHTML = CUSTOM_VARS.map(v => `
    <div class="color-picker-row">
      <label for="cp_${v.key}">${v.label}</label>
      <input type="color" id="cp_${v.key}" value="${state.customColors[v.key] || '#ffffff'}"
        data-key="${v.key}" data-var="${v.var}">
    </div>`).join('');

  grid.querySelectorAll('input[type="color"]').forEach(inp => {
    inp.addEventListener('input', () => {
      state.customColors[inp.dataset.key] = inp.value;
      updateCustomPreview(container, state);
    });
  });
}

function updateCustomPreview(container, state) {
  const c = state.customColors;
  const preview = container.querySelector('#customPreview');
  if (!preview) return;

  const sidebar = preview.querySelector('.preview-sidebar');
  const main = preview.querySelector('.preview-main');
  const card = preview.querySelector('.preview-card');
  const heading = preview.querySelector('.preview-heading');
  const text = preview.querySelector('.preview-text');
  const badge = preview.querySelector('.preview-badge');

  if (sidebar) sidebar.style.background = c.sidebar || '#2d3748';
  preview.querySelectorAll('.preview-nav-item').forEach(el => {
    el.style.background = c.sidebarText || '#ffffff';
  });
  if (main) main.style.background = c.background || '#ffffff';
  if (card) { card.style.background = c.surface || '#f5f5f5'; card.style.border = `1px solid ${c.border || '#dee2e6'}`; }
  if (heading) heading.style.background = c.primary || '#0066cc';
  if (text) text.style.background = c.text || '#212529';
  if (badge) badge.style.background = c.accent || '#ff9800';
}

// Apply custom CSS vars to body inline style — strips any previous custom vars first
function applyCustomVars(colors) {
  document.body.classList.remove('dark', 'theme-dark', 'theme-light', 'theme-highContrast', 'theme-blue');
  const base = (document.body.getAttribute('style') || '')
    .split(';')
    .filter(s => !CUSTOM_VARS.some(v => s.trim().startsWith(v.var)))
    .join(';')
    .trim();
  const customVars = CUSTOM_VARS.map(v => `${v.var}: ${colors[v.key]}`).join('; ');
  document.body.setAttribute('style', base ? `${base}; ${customVars}` : customVars);
}

function applyCustomTheme(container, state) {
  const name = container.querySelector('#customThemeName')?.value.trim() || 'Custom';

  applyCustomVars(state.customColors);

  // Persist to storage so it survives reload
  storage.set({
    customTheme: { name, colors: { ...state.customColors } },
    activeTheme: 'custom',
  });

  state.activeTheme = 'custom';
  renderBuiltinGrid(container, state); // deactivates builtin cards
  notify(container, `Custom theme "${name}" applied`, 'success');
}

function resetCustomColors(container, state) {
  state.customColors = defaultCustomColors();
  renderColorPickers(container, state);
  updateCustomPreview(container, state);
}

// ── Theme apply (builtin) ─────────────────────────────────────────────────────

function getActiveTheme() {
  const body = document.body;
  if (body.classList.contains('theme-dark') || body.classList.contains('dark')) return 'dark';
  if (body.classList.contains('theme-highContrast')) return 'highContrast';
  if (body.classList.contains('theme-blue')) return 'blue';
  return 'light';
}

function applyTheme(themeId) {
  const body = document.body;
  // Remove all known theme classes
  body.classList.remove('dark', 'theme-dark', 'theme-light', 'theme-highContrast', 'theme-blue');
  // Remove custom vars (clear inline style overrides from custom theme)
  const style = body.getAttribute('style') || '';
  const cleaned = style.split(';').filter(s => !CUSTOM_VARS.some(v => s.trim().startsWith(v.var))).join(';');
  if (cleaned.trim()) body.setAttribute('style', cleaned); else body.removeAttribute('style');

  if (themeId === 'dark') body.classList.add('theme-dark');
  else if (themeId === 'highContrast') body.classList.add('theme-highContrast');
  else if (themeId === 'blue') body.classList.add('theme-blue');
  // 'light' = default, no class needed

  // Persist
  storage.set({ activeTheme: themeId });
  runtime.sendMessage({
    action: 'updateSettings',
    settings: { theme: { current: themeId } },
  }).catch(() => {});
}

// ── Wire ──────────────────────────────────────────────────────────────────────

function wireControls(container, state) {
  container.querySelector('#applyCustomBtn')?.addEventListener('click', () => applyCustomTheme(container, state));
  container.querySelector('#resetCustomBtn')?.addEventListener('click', () => resetCustomColors(container, state));
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function defaultCustomColors() {
  // Seed from current computed CSS vars
  const style = getComputedStyle(document.documentElement);
  const get = varName => style.getPropertyValue(varName).trim() || undefined;
  return {
    background:   get('--background-color')   || '#ffffff',
    surface:      get('--surface-color')      || '#f5f5f5',
    primary:      get('--primary-color')      || '#0066cc',
    accent:       get('--accent-color')       || '#ff9800',
    text:         get('--text-primary-color') || '#212529',
    sidebar:      get('--sidebar-bg')         || '#2d3748',
    sidebarText:  get('--sidebar-text')       || '#ffffff',
    border:       get('--border-color')       || '#dee2e6',
  };
}

function notify(container, msg, type = 'success') {
  const el = container.querySelector('#themeNotification');
  if (!el) return;
  el.textContent = msg;
  el.className = `theme-notification ${type}`;
  el.hidden = false;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.hidden = true; }, 3000);
}
