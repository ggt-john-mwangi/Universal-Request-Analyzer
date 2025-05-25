// --- Universal Request Analyzer: Analytics Section ---
import { generateRequestId } from '../../background/utils/message-handler.js';
import { generateId, generateShortId } from '../../background/utils/id-generator.js';
import { uiLog } from '../../background/utils/log-utils.js';
import { renderRequestAnalytics } from './analytics-request.js';
import { renderPerformanceAnalytics } from './analytics-performance.js';
import { sendMessageWithResponse } from '../../background/utils/message-handler.js';

// --- DOM Utility ---
function createElement(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  Object.entries(props).forEach(([k, v]) => {
    if (k.startsWith('on') && typeof v === 'function') {
      el.addEventListener(k.slice(2).toLowerCase(), v);
    } else if (k === 'className') {
      el.className = v;
    } else {
      el.setAttribute(k, v);
    }
  });
  children.forEach(child => {
    if (typeof child === 'string') el.appendChild(document.createTextNode(child));
    else if (child) el.appendChild(child);
  });
  return el;
}

// --- Analytics Section Entry Point ---
export default function renderAnalyticsSection() {
  uiLog('info', '[Analytics] Rendering analytics section');
  const container = createElement('div', { className: 'analytics-container' });
  container.appendChild(renderControls());
  container.appendChild(renderTabs());
  return container;
}

// --- Controls (Filters) ---
function renderControls() {
  const controls = createElement('div', { className: 'controls-container' },
    createControlGroup('Start Date', createElement('input', { type: 'date', id: 'analytics-start-date' })),
    createControlGroup('End Date', createElement('input', { type: 'date', id: 'analytics-end-date' })),
    createControlGroup('Domain', createElement('select', { id: 'analytics-domain-select', className: 'analytics-select' }, createElement('option', { value: '' }, 'All Domains'))),
    createControlGroup('API/Page', createElement('select', { id: 'analytics-api-select', className: 'analytics-select' }, createElement('option', { value: '' }, 'All APIs/Pages'))),
    createControlGroup('HTTP Method', createElement('select', { id: 'analytics-method-select' }, createElement('option', { value: '' }, 'All Methods'))),
    createControlGroup('Status Code', createElement('select', { id: 'analytics-status-select' }, createElement('option', { value: '' }, 'All Statuses'))),
    createControlGroup('Request Types', renderRequestTypesCheckboxes()),
    createElement('div', { className: 'control-group' }, createElement('button', { id: 'analytics-apply', onClick: applyFilters }, 'Apply Filters'))
  );

  // --- Dynamic domain dropdown population ---
  async function populateDomainDropdown() {
    const domainSelect = controls.querySelector('#analytics-domain-select');
    if (!domainSelect) return;
    domainSelect.innerHTML = '<option value="">All Domains</option>';
    try {
      const response = await sendMessageWithResponse('getDistinctDomains');
      const domains = response && response.length ? response : (response.domains || []);
      domains.forEach(domain => {
        const opt = document.createElement('option');
        opt.value = domain;
        opt.textContent = domain;
        domainSelect.appendChild(opt);
      });
      // Load default domain from local storage (chrome.storage.local or window.localStorage)
      let defaultDomain = '';
      if (window.chrome && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['lastActiveDomain'], (result) => {
          defaultDomain = result.lastActiveDomain || '';
          if (defaultDomain && domains.includes(defaultDomain)) {
            domainSelect.value = defaultDomain;
          }
        });
      } else if (window.localStorage) {
        defaultDomain = window.localStorage.getItem('lastActiveDomain') || '';
        if (defaultDomain && domains.includes(defaultDomain)) {
          domainSelect.value = defaultDomain;
        }
      }
    } catch (e) {
      uiLog('error', '[Analytics] Failed to populate domain dropdown', e);
    }
  }
  setTimeout(populateDomainDropdown, 0);

  // --- Refresh analytics/performance subtabs on domain change ---
  controls.querySelector('#analytics-domain-select').addEventListener('change', () => {
    // Save selected domain to local storage
    const val = controls.querySelector('#analytics-domain-select').value;
    if (window.chrome && chrome.storage && chrome.storage.local) {
      chrome.storage.local.set({ lastActiveDomain: val });
    } else if (window.localStorage) {
      window.localStorage.setItem('lastActiveDomain', val);
    }
    // Re-apply filters (refresh analytics/performance subtabs)
    applyFilters();
  });

  return controls;
}

function createControlGroup(label, input) {
  return createElement('div', { className: 'control-group' }, createElement('label', {}, label), input);
}

function renderRequestTypesCheckboxes() {
  const types = [
    { value: 'xmlhttprequest', label: 'XHR' },
    { value: 'fetch', label: 'Fetch' },
    { value: 'script', label: 'Script' },
    { value: 'stylesheet', label: 'Stylesheet' },
    { value: 'image', label: 'Image' },
    { value: 'font', label: 'Font' },
    { value: 'other', label: 'Other' },
  ];
  const group = createElement('div', { id: 'analytics-types', className: 'checkbox-group' });
  types.forEach(t => {
    group.appendChild(
      createElement('label', { className: 'checkbox-label' },
        createElement('input', { type: 'checkbox', value: t.value, checked: true }),
        t.label
      )
    );
  });
  return group;
}

function applyFilters() {
  uiLog('debug', '[Analytics] Filters applied');
  // Collect filter values and trigger analytics refresh
  // ...existing code for filter collection and refresh...
}

// --- Tabs: Analysis & Performance ---
function renderTabs() {
  const tabs = createElement('div', { className: 'analytics-tabs' });
  const tabBar = createElement('div', { className: 'analytics-tab-bar' });
  const analysisTabBtn = createElement('button', { className: 'analytics-tab-btn active', onClick: () => switchTab('analysis') }, 'Analysis');
  const perfTabBtn = createElement('button', { className: 'analytics-tab-btn', onClick: () => switchTab('performance') }, 'Performance');
  tabBar.appendChild(analysisTabBtn);
  tabBar.appendChild(perfTabBtn);
  tabs.appendChild(tabBar);

  const analysisSection = createElement('div', { id: 'analytics-analysis-section', className: 'analytics-tab-section', style: 'display:block;' });
  const perfSection = createElement('div', { id: 'analytics-performance-section', className: 'analytics-tab-section', style: 'display:none;' });
  tabs.appendChild(analysisSection);
  tabs.appendChild(perfSection);

  // Delegate rendering to split modules
  renderRequestAnalytics(analysisSection);
  renderPerformanceAnalytics(perfSection);

  function switchTab(tab) {
    analysisTabBtn.classList.toggle('active', tab === 'analysis');
    perfTabBtn.classList.toggle('active', tab === 'performance');
    analysisSection.style.display = tab === 'analysis' ? 'block' : 'none';
    perfSection.style.display = tab === 'performance' ? 'block' : 'none';
    uiLog('debug', '[Analytics] Switched tab', tab);
  }

  return tabs;
}

// --- Data Fetching & Reuse ---
function fetchAnalyticsData(filters, cb) {
  uiLog('debug', '[Analytics] Fetching analytics data', filters);
  sendMessageWithResponse('getFilteredStats', { filters })
    .then((response) => {
      uiLog('debug', '[Analytics] Data fetched', response);
      cb(response);
    })
    .catch((err) => {
      uiLog('error', '[Analytics] Data fetch error', err);
      cb({ success: false, error: err });
    });
}

// --- Exported for use in options.js ---
export { fetchAnalyticsData };
