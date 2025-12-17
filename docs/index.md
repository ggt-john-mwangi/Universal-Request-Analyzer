---
layout: default
title: Home
---

<style>
  /* Modern Developer Tool UI - Inspired by Postman, Linear, GitHub */
  * {
    box-sizing: border-box;
  }
  
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Helvetica, Arial, sans-serif;
  }
  
  /* Extension color scheme */
  :root {
    --ura-primary: #0066cc;
    --ura-primary-hover: #0052a3;
    --ura-success: #28a745;
    --ura-info: #17a2b8;
    --ura-warning: #ffc107;
    --ura-error: #dc3545;
    --ura-surface: #f6f8fa;
    --ura-text: #24292e;
    --ura-text-secondary: #586069;
    --ura-border: #e1e4e8;
    --ura-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
    --ura-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.12);
  }
  
  /* Hero Section - Clean, focused, no gradients */
  .hero {
    max-width: 1200px;
    margin: 0 auto 80px;
    padding: 60px 20px 40px;
  }
  
  .hero-content {
    text-align: center;
    margin-bottom: 48px;
  }
  
  .hero h1 {
    font-size: 48px;
    font-weight: 700;
    color: var(--ura-text);
    margin: 0 0 16px;
    letter-spacing: -0.5px;
  }
  
  .hero-tagline {
    font-size: 20px;
    color: var(--ura-text-secondary);
    max-width: 680px;
    margin: 0 auto 40px;
    line-height: 1.6;
  }
  
  /* CTA Buttons */
  .hero-cta {
    display: flex;
    gap: 16px;
    justify-content: center;
    align-items: center;
    flex-wrap: wrap;
    margin-bottom: 48px;
  }
  
  .btn-download {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    background: var(--ura-primary);
    color: white;
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    transition: all 0.2s;
    border: none;
    box-shadow: var(--ura-shadow);
  }
  
  .btn-download:hover {
    background: var(--ura-primary-hover);
    transform: translateY(-2px);
    box-shadow: var(--ura-shadow-lg);
  }
  
  .btn-github {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 16px 32px;
    background: white;
    color: var(--ura-text);
    text-decoration: none;
    border-radius: 8px;
    font-weight: 600;
    font-size: 16px;
    transition: all 0.2s;
    border: 1px solid var(--ura-border);
  }
  
  .btn-github:hover {
    border-color: var(--ura-text);
    transform: translateY(-2px);
    box-shadow: var(--ura-shadow-lg);
  }
  
  /* Visual Showcase - 3 key screenshots */
  .visual-showcase {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 24px;
    margin: 0 auto;
    max-width: 1200px;
  }
  
  .showcase-item {
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 12px;
    overflow: hidden;
    transition: all 0.3s;
  }
  
  .showcase-item:hover {
    transform: translateY(-4px);
    box-shadow: var(--ura-shadow-lg);
    border-color: var(--ura-primary);
  }
  
  .showcase-image {
    width: 100%;
    height: auto;
    display: block;
    border-bottom: 1px solid var(--ura-border);
  }
  
  .showcase-label {
    padding: 16px 20px;
    text-align: center;
  }
  
  .showcase-label h3 {
    margin: 0 0 4px;
    font-size: 16px;
    font-weight: 600;
    color: var(--ura-text);
  }
  
  .showcase-label p {
    margin: 0;
    font-size: 14px;
    color: var(--ura-text-secondary);
  }
  
  /* Features Section */
  .section {
    max-width: 1200px;
    margin: 80px auto;
    padding: 0 20px;
  }
  
  .section-header {
    text-align: center;
    margin-bottom: 48px;
  }
  
  .section-header h2 {
    font-size: 36px;
    font-weight: 700;
    color: var(--ura-text);
    margin: 0 0 12px;
  }
  
  .section-header p {
    font-size: 18px;
    color: var(--ura-text-secondary);
    margin: 0;
  }
  
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
  }
  
  .feature-card {
    padding: 28px;
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 12px;
    transition: all 0.2s;
  }
  
  .feature-card:hover {
    border-color: var(--ura-primary);
    box-shadow: var(--ura-shadow);
  }
  
  .feature-icon {
    font-size: 36px;
    margin-bottom: 16px;
    display: block;
  }
  
  .feature-card h3 {
    margin: 0 0 12px;
    font-size: 18px;
    font-weight: 600;
    color: var(--ura-text);
  }
  
  .feature-card p {
    margin: 0;
    color: var(--ura-text-secondary);
    line-height: 1.6;
    font-size: 15px;
  }
  
  /* Tech Stack Pills */
  .tech-stack {
    text-align: center;
    padding: 40px 20px;
    background: var(--ura-surface);
    border-radius: 12px;
    border: 1px solid var(--ura-border);
  }
  
  .tech-stack h3 {
    font-size: 18px;
    font-weight: 600;
    color: var(--ura-text);
    margin: 0 0 24px;
  }
  
  .tech-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
  
  .tech-badge {
    padding: 8px 16px;
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--ura-text);
  }
  
  /* Use Cases */
  .use-cases-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 20px;
  }
  
  .use-case-item {
    padding: 20px;
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    display: flex;
    gap: 12px;
  }
  
  .use-case-icon {
    font-size: 24px;
    flex-shrink: 0;
  }
  
  .use-case-text {
    font-size: 15px;
    color: var(--ura-text);
    line-height: 1.5;
  }
  
  /* Quick Start Box */
  .quick-start-box {
    background: #fffbf0;
    border: 1px solid #ffd966;
    border-left: 4px solid var(--ura-warning);
    border-radius: 8px;
    padding: 32px;
    margin: 40px 0;
  }
  
  .quick-start-box h3 {
    margin: 0 0 20px;
    font-size: 20px;
    color: var(--ura-text);
  }
  
  .quick-start-box ol {
    margin: 0 0 24px;
    padding-left: 20px;
  }
  
  .quick-start-box li {
    margin-bottom: 12px;
    color: var(--ura-text);
    line-height: 1.6;
  }
  
  .quick-start-box code {
    background: white;
    padding: 2px 8px;
    border-radius: 4px;
    color: var(--ura-primary);
    border: 1px solid var(--ura-border);
    font-size: 14px;
  }
  
  /* Documentation Links */
  .doc-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 16px;
  }
  
  .doc-card {
    padding: 20px;
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    text-decoration: none;
    color: inherit;
    transition: all 0.2s;
    display: block;
  }
  
  .doc-card:hover {
    border-color: var(--ura-primary);
    transform: translateY(-2px);
    box-shadow: var(--ura-shadow);
  }
  
  .doc-card h4 {
    margin: 0 0 8px;
    font-size: 16px;
    font-weight: 600;
    color: var(--ura-text);
  }
  
  .doc-card p {
    margin: 0;
    font-size: 14px;
    color: var(--ura-text-secondary);
  }
  
  /* Browser Support Table */
  .browser-table {
    width: 100%;
    border-collapse: collapse;
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    overflow: hidden;
  }
  
  .browser-table th,
  .browser-table td {
    padding: 16px;
    text-align: left;
    border-bottom: 1px solid var(--ura-border);
  }
  
  .browser-table th {
    background: var(--ura-surface);
    font-weight: 600;
    color: var(--ura-text);
  }
  
  .browser-table tr:last-child td {
    border-bottom: none;
  }
  
  /* Footer CTA */
  .footer-cta {
    text-align: center;
    padding: 60px 20px;
    background: var(--ura-surface);
    border: 1px solid var(--ura-border);
    border-radius: 12px;
    margin: 80px 0 40px;
  }
  
  .footer-cta h2 {
    font-size: 32px;
    font-weight: 700;
    color: var(--ura-text);
    margin: 0 0 12px;
  }
  
  .footer-cta p {
    font-size: 18px;
    color: var(--ura-text-secondary);
    margin: 0 0 32px;
  }
  
  /* Responsive */
  @media (max-width: 768px) {
    .hero h1 {
      font-size: 36px;
    }
    .hero-tagline {
      font-size: 18px;
    }
    .section-header h2 {
      font-size: 28px;
    }
  }
</style>

<!-- Hero Section -->
<div class="hero">
  <div class="hero-content">
    <h1>Universal Request Analyzer</h1>
    <p class="hero-tagline">DevTools network inspection with persistent SQLite storage, historical analytics, and performance tracking. Never lose your debugging data again.</p>
    
    <div class="hero-cta">
      <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer/raw/main/release/ura.zip" class="btn-download" download>
        <span>⬇️</span>
        <span>Download Extension</span>
      </a>
      <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer" class="btn-github">
        <span>⭐</span>
        <span>Star on GitHub</span>
      </a>
    </div>
  </div>
  
  <div class="visual-showcase">
    <div class="showcase-item">
      <img src="assets/images/dashboard_analytics.png" alt="Analytics Dashboard" class="showcase-image" />
      <div class="showcase-label">
        <h3>📊 Analytics Dashboard</h3>
        <p>Track API performance over time</p>
      </div>
    </div>
    
    <div class="showcase-item">
      <img src="assets/images/devtools_overview.png" alt="DevTools Panel" class="showcase-image" />
      <div class="showcase-label">
        <h3>⚡ DevTools Panel</h3>
        <p>Real-time request monitoring</p>
      </div>
    </div>
    
    <div class="showcase-item">
      <img src="assets/images/dashboard_requests_curl_action.png" alt="Copy as cURL" class="showcase-image" />
      <div class="showcase-label">
        <h3>🔄 Export Actions</h3>
        <p>Copy as cURL or Fetch code</p>
      </div>
    </div>
  </div>
</div>

<!-- Features Section -->
<div class="section">
  <div class="section-header">
    <h2>Everything you need for network debugging</h2>
    <p>Powerful features built for developers who debug APIs daily</p>
  </div>
  
  <div class="feature-grid">
    <div class="feature-card">
      <span class="feature-icon">💾</span>
      <h3>Persistent SQLite Database</h3>
      <p>All requests stored locally. Data survives browser restarts. Query with raw SQL or use the dashboard.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">⚡</span>
      <h3>Real-Time DevTools Panel</h3>
      <p>Integrated Chrome DevTools panel with filtering, waterfall visualization, and timing breakdown.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">📊</span>
      <h3>Performance Analytics</h3>
      <p>Plot individual request times at actual timestamps. Spot latency spikes and analyze patterns.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">🔄</span>
      <h3>Export as cURL/Fetch</h3>
      <p>Copy requests as cURL commands or JavaScript Fetch. Variable substitution for API tokens.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">🗄️</span>
      <h3>Medallion Architecture</h3>
      <p>Bronze → Silver → Gold data layers for efficient analytics. Direct SQL query support.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">🚨</span>
      <h3>Error Tracking</h3>
      <p>Automatic 4xx/5xx detection. Analyze error patterns and set up custom alerts.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">📤</span>
      <h3>Multiple Export Formats</h3>
      <p>Export as HAR, JSON, or CSV. Share data with your team or import into other tools.</p>
    </div>
    
    <div class="feature-card">
      <span class="feature-icon">🎨</span>
      <h3>Light & Dark Themes</h3>
      <p>Fully customizable with CSS variables. Respects your system preferences.</p>
    </div>
  </div>
</div>

<!-- Use Cases -->
<div class="section">
  <div class="section-header">
    <h2>Built for real debugging scenarios</h2>
  </div>
  
  <div class="use-cases-grid">
    <div class="use-case-item">
      <span class="use-case-icon">🐛</span>
      <span class="use-case-text">Debug intermittent API issues that are hard to reproduce</span>
    </div>
    
    <div class="use-case-item">
      <span class="use-case-icon">⚡</span>
      <span class="use-case-text">Track performance regressions across deployments</span>
    </div>
    
    <div class="use-case-item">
      <span class="use-case-icon">🔍</span>
      <span class="use-case-text">Analyze third-party service impact on your app</span>
    </div>
    
    <div class="use-case-item">
      <span class="use-case-icon">📊</span>
      <span class="use-case-text">Monitor production API behavior and patterns</span>
    </div>
    
    <div class="use-case-item">
      <span class="use-case-icon">🧪</span>
      <span class="use-case-text">Compare request behavior across sessions</span>
    </div>
  </div>
</div>

<!-- Tech Stack -->
<div class="section">
  <div class="tech-stack">
    <h3>Built with modern web technologies</h3>
    <div class="tech-badges">
      <span class="tech-badge">Chrome Manifest V3</span>
      <span class="tech-badge">SQL.js (SQLite)</span>
      <span class="tech-badge">Chart.js</span>
      <span class="tech-badge">Vanilla JavaScript</span>
      <span class="tech-badge">Webpack</span>
      <span class="tech-badge">Jest Testing</span>
      <span class="tech-badge">Cross-Browser</span>
    </div>
  </div>
</div>

<!-- Quick Start -->
<div class="section">
  <div class="quick-start-box">
    <h3>🚀 Get started in 30 seconds</h3>
    <ol>
      <li>Download <code>ura.zip</code> from the button above</li>
      <li>Extract the archive to a folder</li>
      <li>Open Chrome → <code>chrome://extensions/</code></li>
      <li>Enable <strong>"Developer mode"</strong> (top right toggle)</li>
      <li>Click <strong>"Load unpacked"</strong> → select the extracted folder</li>
      <li>Browse any website → requests are captured automatically ✨</li>
    </ol>
    <p><strong>Access the extension:</strong></p>
    <ul style="list-style: none; padding-left: 0;">
      <li><strong>DevTools Panel:</strong> Press F12 → click "URA" tab</li>
      <li><strong>Dashboard:</strong> Click extension icon → "Dashboard"</li>
      <li><strong>Popup:</strong> Click extension icon for quick stats</li>
    </ul>
  </div>
</div>

<!-- Browser Support -->
<div class="section">
  <div class="section-header">
    <h2>Cross-browser compatibility</h2>
  </div>
  
  <table class="browser-table">
    <thead>
      <tr>
        <th>Browser</th>
        <th>Version</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>Chrome</td>
        <td>88+</td>
        <td>✅ Fully Supported</td>
      </tr>
      <tr>
        <td>Edge</td>
        <td>88+</td>
        <td>✅ Fully Supported</td>
      </tr>
      <tr>
        <td>Firefox</td>
        <td>109+</td>
        <td>✅ Fully Supported</td>
      </tr>
    </tbody>
  </table>
</div>

<!-- Documentation -->
<div class="section">
  <div class="section-header">
    <h2>Documentation</h2>
  </div>
  
  <div class="doc-grid">
    <a href="USER_GUIDE.html" class="doc-card">
      <h4>📖 User Guide</h4>
      <p>Complete feature walkthrough</p>
    </a>
    
    <a href="ARCHITECTURE.html" class="doc-card">
      <h4>🏗️ Architecture</h4>
      <p>System design & data flow</p>
    </a>
    
    <a href="DEVELOPMENT.html" class="doc-card">
      <h4>💻 Development</h4>
      <p>Build, test, contribute</p>
    </a>
    
    <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/CONTRIBUTING.md" class="doc-card">
      <h4>🤝 Contributing</h4>
      <p>Contribution guidelines</p>
    </a>
  </div>
</div>

<!-- Footer CTA -->
<div class="footer-cta">
  <h2>Ready to upgrade your debugging workflow?</h2>
  <p>Download the extension and never lose network data again</p>
  <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer/raw/main/release/ura.zip" class="btn-download" download>
    <span>⬇️</span>
    <span>Download Now (v1.0.0)</span>
  </a>
</div>

---

<p style="text-align: center; color: var(--ura-text-secondary); font-size: 14px; margin-top: 60px;">
  MIT License · Open Source · Built for Developers
</p>
