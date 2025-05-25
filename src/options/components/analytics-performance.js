// --- Universal Request Analyzer: Performance Analytics ---
import { uiLog } from '../../background/utils/log-utils.js';
import { fetchAnalyticsData } from './analytics.js';

// Helper: Create DOM element
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

// Subtab definitions
const subtabs = [
  { id: 'perf-score', label: 'Performance Score', render: renderPerfScore },
  { id: 'perf-recommendations', label: 'Recommendations', render: renderPerfRecommendations },
  { id: 'perf-accessibility', label: 'Accessibility', render: renderPerfAccessibility },
  { id: 'perf-audits', label: 'Custom Audits', render: renderPerfAudits },
  { id: 'perf-resource-timings', label: 'Resource Timings', render: renderPerfResourceTimings },
  { id: 'perf-page-load', label: 'Page Load Metrics', render: renderPerfPageLoad },
  { id: 'perf-resource-breakdown', label: 'Resource Breakdown', render: renderPerfResourceBreakdown },
];

// Render performance insights (site analysis, scoring, recommendations, accessibility, audits)
export function renderPerformanceAnalytics(section) {
  uiLog('info', '[Analytics] Rendering performance analytics panel');
  section.innerHTML = '';
  const tabBar = createElement('div', { className: 'perf-subtab-bar' });
  const tabContent = createElement('div', { className: 'perf-subtab-content' });
  // Restore activeTab from localStorage if available
  let activeTab = window.localStorage ? (window.localStorage.getItem('analyticsPerfActiveSubtab') || subtabs[0].id) : subtabs[0].id;

  subtabs.forEach((tab, idx) => {
    const btn = createElement('button', {
      className: 'perf-subtab-btn' + (tab.id === activeTab ? ' active' : ''),
      onClick: () => switchSubtab(tab.id)
    }, tab.label);
    tabBar.appendChild(btn);
  });
  section.appendChild(tabBar);
  section.appendChild(tabContent);

  function switchSubtab(tabId) {
    activeTab = tabId;
    // Persist active subtab
    if (window.localStorage) {
      window.localStorage.setItem('analyticsPerfActiveSubtab', tabId);
    }
    Array.from(tabBar.children).forEach((btn, i) => {
      btn.classList.toggle('active', subtabs[i].id === tabId);
    });
    renderActiveSubtab();
    uiLog('debug', '[Analytics] Switched performance subtab', tabId);
  }

  function renderActiveSubtab() {
    tabContent.innerHTML = '';
    const tab = subtabs.find(t => t.id === activeTab);
    if (tab && typeof tab.render === 'function') {
      // Get current filters from analytics controls
      const filters = getCurrentAnalyticsFilters();
      tab.render(tabContent, filters);
    }
  }

  // Listen for filter changes and re-render active subtab
  const domainSelect = document.getElementById('analytics-domain-select');
  if (domainSelect) {
    domainSelect.addEventListener('change', renderActiveSubtab);
  }
  const applyBtn = document.getElementById('analytics-apply');
  if (applyBtn) {
    applyBtn.addEventListener('click', renderActiveSubtab);
  }
  // Optionally listen for other filter changes as needed

  // Initial render
  renderActiveSubtab();
}

// Helper to get current filters from analytics controls
function getCurrentAnalyticsFilters() {
  const filters = {};
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value : '';
  };
  filters.startDate = getVal('analytics-start-date');
  filters.endDate = getVal('analytics-end-date');
  filters.domain = getVal('analytics-domain-select');
  filters.api = getVal('analytics-api-select');
  filters.method = getVal('analytics-method-select');
  filters.status = getVal('analytics-status-select');
  // Request types (checkboxes)
  const typeChecks = document.querySelectorAll('#analytics-types input[type="checkbox"]');
  filters.types = Array.from(typeChecks).filter(cb => cb.checked).map(cb => cb.value);
  return filters;
}

// --- Subtab Renderers ---
function renderPerfScore(container, filters) {
  uiLog('info', '[Performance] Rendering Performance Score', filters);
  fetchAnalyticsData(filters, (data) => {
    const score = computePerformanceScore(data);
    container.appendChild(createElement('div', { className: 'perf-score-box' }, `Performance Score: ${score}`));
  });
}

function computePerformanceScore(data) {
  // Example: combine avg response time, error rate, resource count, etc.
  if (!data || !data.requestCount) return 'N/A';
  let score = 100;
  if (data.avgResponseTime > 1000) score -= 20;
  if (data.errorCount > 0) score -= Math.min(30, data.errorCount * 2);
  if (data.successRate < 90) score -= 20;
  // Clamp
  return Math.max(0, Math.round(score));
}

function renderPerfRecommendations(container, filters) {
  uiLog('info', '[Performance] Rendering Recommendations', filters);
  fetchAnalyticsData(filters, (data) => {
    const recs = [];
    if (data.avgResponseTime > 1000) recs.push('Reduce API response times (optimize backend, cache, or CDN).');
    if (data.errorCount > 0) recs.push('Investigate failed requests and fix errors.');
    if (data.successRate < 90) recs.push('Improve reliability to increase success rate.');
    if (recs.length === 0) recs.push('No major issues detected.');
    const ul = createElement('ul', { className: 'perf-recommendations-list' }, ...recs.map(r => createElement('li', {}, r)));
    container.appendChild(ul);
  });
}

function renderPerfAccessibility(container, filters) {
  uiLog('info', '[Performance] Rendering Accessibility', filters);
  fetchAnalyticsData(filters, (data) => {
    // Simulate accessibility checks on requests/pages
    // In a real extension, this would analyze page/request metadata for accessibility issues
    let issues = [];
    let summary = [];
    if (data && data.requestTypes) {
      // Example: flag missing alt attributes for images
      const imageReqs = data.requestTypes.filter(t => t.type === 'image');
      if (imageReqs.length > 0) {
        summary.push(`${imageReqs.length} image requests detected.`);
        // Simulate: 10% missing alt
        issues.push(`${Math.ceil(imageReqs.length * 0.1)} images may be missing alt attributes.`);
      }
      // Example: flag missing ARIA roles for scripts
      const scriptReqs = data.requestTypes.filter(t => t.type === 'script');
      if (scriptReqs.length > 0) {
        summary.push(`${scriptReqs.length} script requests detected.`);
        issues.push(`Some scripts may not provide ARIA roles for dynamic content.`);
      }
    }
    // Example: color contrast (simulate)
    if (data && data.pageLoadMetrics && data.pageLoadMetrics.length > 0) {
      summary.push(`${data.pageLoadMetrics.length} pages analyzed.`);
      issues.push(`Potential color contrast issues detected on 1 page.`);
    }
    if (summary.length === 0) summary.push('No accessibility-relevant requests detected.');
    if (issues.length === 0) issues.push('No major accessibility issues detected.');
    container.appendChild(createElement('div', { className: 'perf-accessibility-summary' }, ...summary.map(s => createElement('div', {}, s))));
    container.appendChild(createElement('ul', { className: 'perf-accessibility-issues' }, ...issues.map(i => createElement('li', {}, i))));
    // Add a note for future extensibility
    container.appendChild(createElement('div', { className: 'perf-accessibility-note' }, 'Accessibility checks are simulated. Future versions will analyze real page content and ARIA/contrast issues.'));
  });
}

function renderPerfAudits(container, filters) {
  uiLog('info', '[Performance] Rendering Custom Audits', filters);
  fetchAnalyticsData(filters, (data) => {
    // Simulate custom audits: failed requests, slow endpoints, large payloads
    let failed = [];
    let slow = [];
    let large = [];
    if (data && data.requestTypes) {
      // Example: failed requests
      if (data.errorCount > 0) {
        failed.push(`${data.errorCount} failed requests detected.`);
      }
      // Example: slow endpoints
      if (data.avgResponseTime > 2000) {
        slow.push(`Average response time is high: ${Math.round(data.avgResponseTime)} ms.`);
      }
      // Example: large payloads
      if (data.sizeDistribution && data.sizeDistribution.bins) {
        const largeBin = data.sizeDistribution.bins.findIndex(b => b > 1024 * 1024);
        if (largeBin !== -1 && data.sizeDistribution.counts[largeBin] > 0) {
          large.push(`${data.sizeDistribution.counts[largeBin]} requests > 1MB.`);
        }
      }
    }
    if (failed.length === 0) failed.push('No failed requests detected.');
    if (slow.length === 0) slow.push('No slow endpoints detected.');
    if (large.length === 0) large.push('No large payloads detected.');
    // Render as a table
    const table = createElement('table', { className: 'perf-audits-table' },
      createElement('thead', {},
        createElement('tr', {},
          createElement('th', {}, 'Audit'),
          createElement('th', {}, 'Result')
        )
      ),
      createElement('tbody', {},
        createElement('tr', {}, createElement('td', {}, 'Failed Requests'), createElement('td', {}, failed.join(' '))),
        createElement('tr', {}, createElement('td', {}, 'Slow Endpoints'), createElement('td', {}, slow.join(' '))),
        createElement('tr', {}, createElement('td', {}, 'Large Payloads'), createElement('td', {}, large.join(' ')))
      )
    );
    container.appendChild(table);
    container.appendChild(createElement('div', { className: 'perf-audits-note' }, 'Custom audits are simulated. Future versions will support real security, best practices, and extensible audits.'));
  });
}

function renderPerfResourceTimings(container, filters) {
  uiLog('info', '[Performance] Rendering Resource Timings', filters);
  fetchAnalyticsData(filters, (data) => {
    // Show a table of avg DNS, TCP, SSL, TTFB, Download
    const timings = data && data.timeSeries && data.timeSeries.length ? data.timeSeries : [];
    if (!timings.length) {
      container.appendChild(createElement('div', {}, 'No timing data available.'));
      return;
    }
    const table = createElement('table', { className: 'perf-timings-table' },
      createElement('thead', {},
        createElement('tr', {},
          createElement('th', {}, 'Time'),
          createElement('th', {}, 'Avg Duration (ms)')
        )
      ),
      createElement('tbody', {},
        ...timings.map(row => createElement('tr', {},
          createElement('td', {}, row.time),
          createElement('td', {}, Math.round(row.avgDuration))
        ))
      )
    );
    container.appendChild(table);
  });
}

function renderPerfPageLoad(container, filters) {
  uiLog('info', '[Performance] Rendering Page Load Metrics', filters);
  fetchAnalyticsData(filters, (data) => {
    const metrics = data && data.pageLoadMetrics ? data.pageLoadMetrics : [];
    if (!metrics.length) {
      container.appendChild(createElement('div', {}, 'No page load metrics available.'));
      return;
    }
    const table = createElement('table', { className: 'perf-page-load-table' },
      createElement('thead', {},
        createElement('tr', {},
          createElement('th', {}, 'Page URL'),
          createElement('th', {}, 'Load Time (ms)'),
          createElement('th', {}, 'Size (bytes)'),
          createElement('th', {}, 'Resources'),
          createElement('th', {}, 'TTFB (ms)'),
          createElement('th', {}, 'DOM Content Loaded (ms)'),
          createElement('th', {}, 'DOM Complete (ms)')
        )
      ),
      createElement('tbody', {},
        ...metrics.map(row => createElement('tr', {},
          createElement('td', {}, row.pageUrl),
          createElement('td', {}, Math.round(row.loadTime)),
          createElement('td', {}, row.size),
          createElement('td', {}, row.resources),
          createElement('td', {}, Math.round(row.ttfb)),
          createElement('td', {}, Math.round(row.domContentLoaded)),
          createElement('td', {}, Math.round(row.domComplete))
        ))
      )
    );
    container.appendChild(table);
  });
}

function renderPerfResourceBreakdown(container, filters) {
  uiLog('info', '[Performance] Rendering Resource Breakdown', filters);
  fetchAnalyticsData(filters, (data) => {
    const breakdown = data && data.resourceBreakdown ? data.resourceBreakdown : [];
    if (!breakdown.length) {
      container.appendChild(createElement('div', {}, 'No resource breakdown data available.'));
      return;
    }
    const table = createElement('table', { className: 'perf-resource-breakdown-table' },
      createElement('thead', {},
        createElement('tr', {},
          createElement('th', {}, 'Domain'),
          createElement('th', {}, 'Page URL'),
          createElement('th', {}, 'Type'),
          createElement('th', {}, 'Count'),
          createElement('th', {}, 'Total Size (bytes)'),
          createElement('th', {}, 'Timestamp')
        )
      ),
      createElement('tbody', {},
        ...breakdown.map(row => createElement('tr', {},
          createElement('td', {}, row.domain),
          createElement('td', {}, row.pageUrl),
          createElement('td', {}, row.type),
          createElement('td', {}, row.count),
          createElement('td', {}, row.totalSize),
          createElement('td', {}, new Date(row.timestamp).toLocaleString())
        ))
      )
    );
    container.appendChild(table);
  });
}
