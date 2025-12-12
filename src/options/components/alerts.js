// Alerts Component
// Manages alert rules and notification system

class Alerts {
  constructor() {
    this.rules = [];
    this.history = [];
  }

  async initialize() {
    console.log('Initializing Alerts...');
    
    this.setupEventListeners();
    await this.loadAlertRules();
    await this.loadAlertHistory();
    await this.loadDomainsForAlerts();
    
    console.log('✓ Alerts initialized');
  }

  setupEventListeners() {
    // Remove any existing listeners by cloning and replacing elements
    // This prevents duplicate event listeners if setupEventListeners is called multiple times
    
    // Add alert rule button
    const addAlertRuleBtn = document.getElementById('addAlertRuleBtn');
    if (addAlertRuleBtn) {
      const newAddBtn = addAlertRuleBtn.cloneNode(true);
      addAlertRuleBtn.parentNode.replaceChild(newAddBtn, addAlertRuleBtn);
      newAddBtn.addEventListener('click', () => this.showAlertRuleModal());
    }

    // Refresh alert history
    const refreshAlertHistoryBtn = document.getElementById('refreshAlertHistoryBtn');
    if (refreshAlertHistoryBtn) {
      const newRefreshBtn = refreshAlertHistoryBtn.cloneNode(true);
      refreshAlertHistoryBtn.parentNode.replaceChild(newRefreshBtn, refreshAlertHistoryBtn);
      newRefreshBtn.addEventListener('click', () => this.loadAlertHistory());
    }

    // Modal controls
    const modalClose = document.querySelector('#alertRuleModal .modal-close');
    if (modalClose) {
      const newModalClose = modalClose.cloneNode(true);
      modalClose.parentNode.replaceChild(newModalClose, modalClose);
      newModalClose.addEventListener('click', () => this.hideAlertRuleModal());
    }

    const saveAlertRuleBtn = document.getElementById('saveAlertRuleBtn');
    if (saveAlertRuleBtn) {
      const newSaveBtn = saveAlertRuleBtn.cloneNode(true);
      saveAlertRuleBtn.parentNode.replaceChild(newSaveBtn, saveAlertRuleBtn);
      newSaveBtn.addEventListener('click', () => this.saveAlertRule());
    }

    const cancelAlertRuleBtn = document.getElementById('cancelAlertRuleBtn');
    if (cancelAlertRuleBtn) {
      const newCancelBtn = cancelAlertRuleBtn.cloneNode(true);
      cancelAlertRuleBtn.parentNode.replaceChild(newCancelBtn, cancelAlertRuleBtn);
      newCancelBtn.addEventListener('click', () => this.hideAlertRuleModal());
    }

    // Close modal on background click
    const modal = document.getElementById('alertRuleModal');
    if (modal && !this._modalClickHandlerAdded) {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          this.hideAlertRuleModal();
        }
      });
      this._modalClickHandlerAdded = true;
    }
  }

  async loadAlertRules() {
    const loadingEl = document.getElementById('alertRulesLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAlertRules'
      });

      if (response?.success) {
        this.rules = response.rules || [];
        this.displayAlertRules();
      }
    } catch (error) {
      console.error('Failed to load alert rules:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  displayAlertRules() {
    const listEl = document.getElementById('alertRulesList');
    if (!listEl) return;

    if (this.rules.length === 0) {
      listEl.innerHTML = '<p class="placeholder">No alert rules configured. Click "Add Rule" to create your first alert.</p>';
      return;
    }

    const html = this.rules.map(rule => `
      <div class="alert-rule-card ${rule.enabled ? 'enabled' : 'disabled'}">
        <div class="rule-header">
          <div class="rule-name">
            <i class="fas fa-bell"></i> ${rule.name}
          </div>
          <div class="rule-actions">
            <button class="toggle-rule-btn" data-id="${rule.id}">
              <i class="fas fa-${rule.enabled ? 'pause' : 'play'}"></i>
            </button>
            <button class="delete-rule-btn" data-id="${rule.id}">
              <i class="fas fa-trash"></i>
            </button>
          </div>
        </div>
        <div class="rule-details">
          <div class="rule-condition">
            ${this.formatRuleCondition(rule)}
          </div>
          ${rule.domain ? `<div class="rule-domain">Domain: ${rule.domain}</div>` : ''}
        </div>
      </div>
    `).join('');

    listEl.innerHTML = html;

    // Attach event listeners to buttons
    listEl.querySelectorAll('.delete-rule-btn').forEach(btn => {
      btn.addEventListener('click', () => this.deleteAlertRule(btn.dataset.id));
    });

    listEl.querySelectorAll('.toggle-rule-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleAlertRule(btn.dataset.id));
    });
  }

  formatRuleCondition(rule) {
    const metrics = {
      avgDuration: 'Average Response Time',
      errorRate: 'Error Rate',
      requestCount: 'Request Count',
      maxDuration: 'Max Response Time'
    };

    const conditions = {
      gt: '>',
      lt: '<',
      eq: '='
    };

    const metric = metrics[rule.metric] || rule.metric;
    const condition = conditions[rule.condition] || rule.condition;

    return `${metric} ${condition} ${rule.threshold}${rule.metric.includes('Duration') ? 'ms' : rule.metric === 'errorRate' ? '%' : ''}`;
  }

  async loadAlertHistory() {
    const loadingEl = document.getElementById('alertHistoryLoading');
    if (loadingEl) loadingEl.style.display = 'block';

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getAlertHistory',
        limit: 50
      });

      if (response?.success) {
        this.history = response.history || [];
        this.displayAlertHistory();
      }
    } catch (error) {
      console.error('Failed to load alert history:', error);
    } finally {
      if (loadingEl) loadingEl.style.display = 'none';
    }
  }

  displayAlertHistory() {
    const listEl = document.getElementById('alertHistoryList');
    if (!listEl) return;

    if (this.history.length === 0) {
      listEl.innerHTML = '<p class="placeholder">No alerts have been triggered</p>';
      return;
    }

    const html = this.history.map(alert => `
      <div class="alert-history-card">
        <div class="alert-time">
          ${new Date(alert.triggered_at).toLocaleString()}
        </div>
        <div class="alert-info">
          <strong>${alert.rule_name}</strong>
        </div>
        <div class="alert-details">
          ${alert.message}
        </div>
        <div class="alert-values">
          Value: ${alert.value} | Threshold: ${alert.threshold}
        </div>
      </div>
    `).join('');

    listEl.innerHTML = html;
  }

  showAlertRuleModal() {
    const modal = document.getElementById('alertRuleModal');
    if (modal) {
      // Reset form
      document.getElementById('alertName').value = '';
      document.getElementById('alertMetric').value = 'avgDuration';
      document.getElementById('alertCondition').value = 'gt';
      document.getElementById('alertThreshold').value = '';
      document.getElementById('alertDomain').value = '';
      document.getElementById('alertEnabled').checked = true;

      modal.style.display = 'flex';
    }
  }

  hideAlertRuleModal() {
    const modal = document.getElementById('alertRuleModal');
    if (modal) {
      modal.style.display = 'none';
    }
  }

  async saveAlertRule() {
    const name = document.getElementById('alertName')?.value;
    const metric = document.getElementById('alertMetric')?.value;
    const condition = document.getElementById('alertCondition')?.value;
    const threshold = parseFloat(document.getElementById('alertThreshold')?.value);
    const domain = document.getElementById('alertDomain')?.value;
    const enabled = document.getElementById('alertEnabled')?.checked;

    if (!name || !metric || !condition || isNaN(threshold)) {
      this.showToast('Please fill in all required fields', 'error');
      return;
    }

    const rule = {
      name,
      metric,
      condition,
      threshold,
      domain: domain || null,
      enabled
    };

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'saveAlertRule',
        rule
      });

      if (response?.success) {
        this.showToast('Alert rule saved successfully', 'success');
        this.hideAlertRuleModal();
        await this.loadAlertRules();
      } else {
        this.showToast('Failed to save alert rule: ' + (response?.error || 'Unknown error'), 'error');
      }
    } catch (error) {
      console.error('Failed to save alert rule:', error);
      this.showToast('Failed to save alert rule', 'error');
    }
  }

  async deleteAlertRule(ruleId) {
    if (!confirm('Are you sure you want to delete this alert rule?')) {
      return;
    }

    try {
      const response = await chrome.runtime.sendMessage({
        action: 'deleteAlertRule',
        ruleId: parseInt(ruleId)
      });

      if (response?.success) {
        this.showToast('Alert rule deleted successfully', 'success');
        await this.loadAlertRules();
      } else {
        this.showToast('Failed to delete alert rule', 'error');
      }
    } catch (error) {
      console.error('Failed to delete alert rule:', error);
      this.showToast('Failed to delete alert rule', 'error');
    }
  }

  async toggleAlertRule(ruleId) {
    // TODO: Implement toggle functionality
    this.showToast('Toggle functionality coming soon', 'info');
  }

  async loadDomainsForAlerts() {
    try {
      const response = await chrome.runtime.sendMessage({
        action: 'getDomains',
        timeRange: 604800
      });

      if (response?.success && response.domains) {
        const select = document.getElementById('alertDomain');
        if (select) {
          select.innerHTML = '<option value="">All Domains</option>' +
            response.domains.map(d => `<option value="${d.domain}">${d.domain}</option>`).join('');
        }
      }
    } catch (error) {
      console.error('Failed to load domains:', error);
    }
  }

  showToast(message, type = 'info') {
    const notification = document.getElementById('notification');
    if (notification) {
      notification.textContent = message;
      notification.className = `notification ${type} show`;
      setTimeout(() => {
        notification.classList.remove('show');
      }, 3000);
    }
  }
}

export default Alerts;
