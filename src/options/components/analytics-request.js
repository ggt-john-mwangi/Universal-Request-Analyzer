// --- Universal Request Analyzer: Request Analytics ---
import { fetchAnalyticsData } from './analytics.js';
import { uiLog } from '../../background/utils/log-utils.js';

// Render request analytics charts (request/response/type/status/size)
export function renderRequestAnalytics(section) {
  uiLog('info', '[Analytics] Rendering request analytics charts');
  section.innerHTML = '';
  // Chart configs
  const charts = [
    { id: 'apiOverTime', label: 'API Requests Over Time' },
    { id: 'status', label: 'Status Codes' },
    { id: 'type', label: 'Request Types' },
    { id: 'timeDist', label: 'Time Distribution' },
    { id: 'sizeDist', label: 'Size Distribution' },
  ];
  const chartTabs = document.createElement('div');
  chartTabs.className = 'chart-tabs';
  charts.forEach((chart, idx) => {
    const btn = document.createElement('button');
    btn.className = 'chart-tab-btn' + (idx === 0 ? ' active' : '');
    btn.textContent = chart.label;
    btn.onclick = () => switchChart(chart.id);
    chartTabs.appendChild(btn);
  });
  section.appendChild(chartTabs);
  charts.forEach((chart, idx) => {
    const chartDiv = document.createElement('div');
    chartDiv.id = `chart-container-${chart.id}`;
    chartDiv.className = 'chart-container';
    chartDiv.style.display = idx === 0 ? '' : 'none';
    chartDiv.appendChild(document.createElement('canvas'));
    section.appendChild(chartDiv);
  });
  function switchChart(id) {
    charts.forEach(chart => {
      document.getElementById(`chart-container-${chart.id}`).style.display = chart.id === id ? '' : 'none';
      chartTabs.querySelectorAll('.chart-tab-btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent === charts.find(c => c.id === id).label);
      });
    });
    uiLog('debug', '[Analytics] Switched to chart', id);
  }
  uiLog('info', '[Analytics] Request analytics charts rendered');
}
