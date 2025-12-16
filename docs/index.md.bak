---
layout: default
title: Home
---

<style>
  /* Extension color scheme */
  :root {
    --ura-primary: #0066cc;
    --ura-success: #28a745;
    --ura-info: #17a2b8;
    --ura-warning: #ffc107;
    --ura-error: #dc3545;
    --ura-surface: #f5f5f5;
    --ura-text: #212529;
    --ura-text-secondary: #6c757d;
    --ura-border: #dee2e6;
  }
  
  .hero {
    text-align: center;
    padding: 48px 20px;
    background: #ffffff;
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    margin: 0 0 48px;
  }
  .hero h1 {
    font-size: 2.5em;
    margin: 0 0 16px;
    font-weight: 700;
    color: var(--ura-text);
  }
  .hero p {
    font-size: 1.15em;
    color: var(--ura-text-secondary);
    max-width: 700px;
    margin: 0 auto 32px;
    line-height: 1.6;
  }
  .hero-screenshots {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 16px;
    margin: 32px 0 40px;
    max-width: 1000px;
    margin-left: auto;
    margin-right: auto;
  }
  .hero-screenshot-card {
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    overflow: hidden;
    transition: transform 0.2s, box-shadow 0.2s;
    background: white;
  }
  .hero-screenshot-card:hover {
    transform: translateY(-4px);
    box-shadow: 0 8px 24px rgba(0, 102, 204, 0.15);
  }
  .hero-screenshot-card img {
    width: 100%;
    height: auto;
    display: block;
  }
  .hero-screenshot-label {
    padding: 12px;
    background: var(--ura-surface);
    font-size: 13px;
    font-weight: 600;
    color: var(--ura-text);
    text-align: center;
  }
  .download-section {
    margin: 32px 0 0;
  }
  .btn-primary {
    display: inline-block;
    padding: 14px 32px;
    background: var(--ura-primary);
    color: white;
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 16px;
    margin: 8px;
    transition: all 0.2s;
    border: 2px solid var(--ura-primary);
  }
  .btn-primary:hover {
    background: #0052a3;
    border-color: #0052a3;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.3);
  }
  .btn-secondary {
    display: inline-block;
    padding: 14px 32px;
    background: white;
    color: var(--ura-primary);
    border: 2px solid var(--ura-primary);
    text-decoration: none;
    border-radius: 6px;
    font-weight: 600;
    font-size: 16px;
    margin: 8px;
    transition: all 0.2s;
  }
  .btn-secondary:hover {
    background: var(--ura-primary);
    color: white;
  }
  .feature-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 24px;
    margin: 40px 0;
  }
  .feature-card {
    padding: 24px;
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    background: white;
    transition: all 0.2s;
  }
  .feature-card:hover {
    border-color: var(--ura-primary);
    box-shadow: 0 4px 12px rgba(0, 102, 204, 0.1);
  }
  .feature-icon {
    font-size: 32px;
    margin-bottom: 12px;
  }
  .feature-card h3 {
    margin: 12px 0 8px;
    font-size: 1.2em;
    color: var(--ura-text);
  }
  .feature-card p {
    color: var(--ura-text-secondary);
    line-height: 1.6;
    margin: 0;
  }
  .tech-stack {
    background: var(--ura-surface);
    padding: 32px;
    border-radius: 8px;
    margin: 40px 0;
    border: 1px solid var(--ura-border);
  }
  .tech-stack h2 {
    text-align: center;
    margin-bottom: 24px;
    color: var(--ura-text);
  }
  .tech-badges {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: center;
  }
  .tech-badge {
    display: inline-block;
    padding: 8px 16px;
    background: white;
    border: 1px solid var(--ura-border);
    border-radius: 20px;
    font-size: 14px;
    font-weight: 500;
    color: var(--ura-text);
  }
  .screenshot-container {
    margin: 40px 0;
    text-align: center;
  }
  .screenshot-container img {
    max-width: 100%;
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  }
  .quick-start {
    background: #fffbf0;
    border: 1px solid var(--ura-warning);
    border-left: 4px solid var(--ura-warning);
    padding: 24px;
    border-radius: 4px;
    margin: 40px 0;
  }
  .quick-start h3 {
    margin-top: 0;
    color: var(--ura-text);
  }
  .quick-start code {
    background: white;
    padding: 2px 6px;
    border-radius: 3px;
    color: var(--ura-primary);
    border: 1px solid var(--ura-border);
  }
  .use-cases {
    background: var(--ura-surface);
    border: 1px solid var(--ura-border);
    border-radius: 8px;
    padding: 24px;
    margin: 40px 0;
  }
  .use-cases h2 {
    margin-top: 0;
    color: var(--ura-text);
  }
  .use-cases ul {
    list-style: none;
    padding: 0;
  }
  .use-cases li {
    padding: 8px 0;
    color: var(--ura-text-secondary);
  }
</style>

<div class="hero">
  <h1>Universal Request Analyzer</h1>
  <p>DevTools network inspection with persistent history, SQL analytics, and performance tracking. Like Chrome DevTools, but your data never disappears.</p>
  
  <div class="hero-screenshots">
    <div class="hero-screenshot-card">
      <img src="../src/assets/images/dashboard_analytics.png" alt="Analytics Dashboard" />
      <div class="hero-screenshot-label">📊 Analytics Dashboard</div>
    </div>
    <div class="hero-screenshot-card">
      <img src="../src/assets/images/devtools_overview.png" alt="DevTools Panel" />
      <div class="hero-screenshot-label">⚡ DevTools Panel</div>
    </div>
    <div class="hero-screenshot-card">
      <img src="../src/assets/images/dashboard_requests_curl_action.png" alt="Request Actions" />
      <div class="hero-screenshot-label">🔄 Copy as cURL/Fetch</div>
    </div>
  </div>
  
  <div class="download-section">
    <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer/raw/main/release/ura.zip" class="btn-primary" download>
      ⬇️ Download Extension (v1.0.0)
    </a>
    <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer" class="btn-secondary">
      📦 View Source
    </a>
  </div>
</div>

## Core Features

<div class="feature-grid">
  <div class="feature-card">
    <div class="feature-icon">💾</div>
    <h3>Persistent SQLite Database</h3>
    <p>All network requests stored in local SQL.js database. Data survives browser restarts. Query with raw SQL or use the dashboard.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">⚡</div>
    <h3>Real-Time DevTools Panel</h3>
    <p>Integrated Chrome DevTools panel with request capture, filtering, waterfall visualization, and timing breakdown.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">📊</div>
    <h3>Analytics Dashboard</h3>
    <p>Track API performance over time. Plot individual request times, spot latency spikes, analyze endpoint patterns.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🔄</div>
    <h3>Copy as cURL/Fetch</h3>
    <p>Export requests as cURL commands or JavaScript Fetch code. Variable substitution for tokens. Run Fetch directly in browser.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🗄️</div>
    <h3>Medallion Architecture</h3>
    <p>Bronze (raw) → Silver (cleaned) → Gold (aggregated) data layers for efficient analytics. Direct SQL query support.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🚨</div>
    <h3>Error Tracking</h3>
    <p>Automatic detection of failed requests. Track 4xx/5xx errors, analyze patterns, set up custom alerts.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">📤</div>
    <h3>Export & Import</h3>
    <p>Export data as HAR, JSON, or CSV. Import/export settings for team sharing. Data retention policies.</p>
  </div>
  
  <div class="feature-card">
    <div class="feature-icon">🎨</div>
    <h3>Theming</h3>
    <p>Light/Dark mode with CSS variables. Fully customizable colors. Respects system preferences.</p>
  </div>
</div>

<div class="tech-stack">
  <h2>Tech Stack</h2>
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

<div class="quick-start">
  <h3>🚀 Quick Start</h3>
  <ol>
    <li>Download <code>ura.zip</code> from above</li>
    <li>Extract the archive</li>
    <li>Open Chrome → <code>chrome://extensions/</code></li>
    <li>Enable "Developer mode" (top right)</li>
    <li>Click "Load unpacked" → select extracted folder</li>
    <li>Browse any website → requests are captured automatically</li>
  </ol>
  <p><strong>Access the extension:</strong></p>
  <ul>
    <li><strong>DevTools Panel:</strong> F12 → "URA" tab</li>
    <li><strong>Dashboard:</strong> Click extension icon → "Dashboard"</li>
    <li><strong>Popup:</strong> Click extension icon for quick stats</li>
  </ul>
</div>

## Screenshots

<div class="screenshot-container">
  <h3>Dashboard Analytics</h3>
  <img src="../src/assets/images/dashboard_analytics.png" alt="Dashboard Analytics" />
</div>

<div class="screenshot-container">
  <h3>DevTools Panel</h3>
  <img src="../src/assets/images/devtools_overview.png" alt="DevTools Overview" />
</div>

<div class="screenshot-container">
  <h3>Request Details & Copy as Fetch</h3>
  <img src="../src/assets/images/dashboard_requests_fetch_action.png" alt="Copy as Fetch" />
</div>
<div class="use-cases">
  <h2>Perfect for developers who need to:</h2>
  <ul>
    <li>🐛 Debug intermittent API issues that are hard to reproduce</li>
    <li>⚡ Track performance regressions over time</li>
    <li>🔍 Analyze third-party service impact on your application</li>
    <li>📊 Monitor production API behavior and patterns</li>
    <li>🧪 Compare request behavior across different sessions</li>
  </ul>
</div>

---

## Documentation

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin: 24px 0;">
  <a href="USER_GUIDE.html" style="padding: 16px; border: 1px solid #e1e4e8; border-radius: 8px; text-decoration: none; color: inherit; display: block;">
    <h4 style="margin: 0 0 8px;">📖 User Guide</h4>
    <p style="margin: 0; color: #586069; font-size: 14px;">Complete feature documentation</p>
  </a>
  <a href="ARCHITECTURE.html" style="padding: 16px; border: 1px solid #e1e4e8; border-radius: 8px; text-decoration: none; color: inherit; display: block;">
    <h4 style="margin: 0 0 8px;">🏗️ Architecture</h4>
    <p style="margin: 0; color: #586069; font-size: 14px;">System design & data flow</p>
  </a>
  <a href="DEVELOPMENT.html" style="padding: 16px; border: 1px solid #e1e4e8; border-radius: 8px; text-decoration: none; color: inherit; display: block;">
    <h4 style="margin: 0 0 8px;">💻 Development</h4>
    <p style="margin: 0; color: #586069; font-size: 14px;">Build, test, contribute</p>
  </a>
  <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/CONTRIBUTING.md" style="padding: 16px; border: 1px solid #e1e4e8; border-radius: 8px; text-decoration: none; color: inherit; display: block;">
    <h4 style="margin: 0 0 8px;">🤝 Contributing</h4>
    <p style="margin: 0; color: #586069; font-size: 14px;">Contribution guidelines</p>
  </a>
</div>

---

## Browser Support

| Browser | Version | Status |
|---------|---------|--------|
| Chrome | 88+ | ✅ Fully Supported |
| Edge | 88+ | ✅ Fully Supported |
| Firefox | 109+ | ✅ Fully Supported |

---

## License

MIT License - Free to use, modify, and distribute.

---

<div style="text-align: center; margin: 60px 0 40px; padding: 40px; background: #f6f8fa; border-radius: 8px;">
  <h2 style="margin: 0 0 16px;">Ready to try it?</h2>
  <p style="color: #586069; margin: 0 0 24px;">Download the extension and start capturing requests in seconds.</p>
  <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer/raw/main/release/ura.zip" class="btn-primary" download style="margin: 8px;">
    ⬇️ Download Now
  </a>
  <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer" style="margin: 8px; display: inline-block; padding: 14px 32px; text-decoration: none; color: #586069; border: 1px solid #d1d5da; border-radius: 6px; font-weight: 600;">
    ⭐ Star on GitHub
  </a>
</div>
