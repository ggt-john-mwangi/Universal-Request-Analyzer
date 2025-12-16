---
layout: default
title: Home
---

# Universal Request Analyzer

> **DevTools-like network inspection with history, analytics, and performance tracking**

Never lose your network debugging data again. Universal Request Analyzer captures every network request and lets you analyze it anytime — like Chrome DevTools, but with data persistence, historical analysis, and powerful analytics.

<div style="text-align: center; margin: 30px 0;">
  <a href="https://chrome.google.com/webstore" class="btn" style="margin: 5px;">Install for Chrome</a>
  <a href="https://addons.mozilla.org" class="btn" style="margin: 5px;">Install for Firefox</a>
  <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer" class="btn" style="margin: 5px;">View on GitHub</a>
</div>

## 📸 Screenshots

### DevTools Panel

![DevTools Overview](../src/assets/images/devtools_overview.png)
_Real-time network monitoring with advanced filtering_

![Request Waterfall](../src/assets/images/devtools_waterfall.png)
_Performance waterfall visualization with timing breakdown_

---

### Dashboard & Analytics

![Dashboard Analytics](../src/assets/images/dashboard_analytics.png)
_Comprehensive performance analytics and trends over time_

![Request Details](../src/assets/images/dashborard_request_details.png)
_Detailed request inspection with complete timing information_

---

### Request Actions

![Copy as Fetch](../src/assets/images/dashboard_requests_fetch_action.png)
_Copy as Fetch API code with integrated Run button to execute requests directly_

![Copy as cURL](../src/assets/images/dashboard_requests_curl_action.png)
_Export requests as cURL commands for terminal reproduction_

---

### Data Management

![Data Management Overview](../src/assets/images/dashboard_data_management.png)
_Complete data management dashboard with cleanup and retention controls_

![Advanced Database](../src/assets/images/dashboard_advanced_db_interaction.png)
_Direct SQL query interface for advanced database operations_

![Export Settings](../src/assets/images/dashboard_export_settings.png)
_Flexible data export options (HAR, JSON, CSV)_

![Import Settings](../src/assets/images/dashboard_import_yous_settings.png)
_Import/export configuration settings for easy sharing_

---

### Error Tracking & Monitoring

![Error Tracking](../src/assets/images/dashboard_error_tracking.png)
_Track and analyze failed requests with detailed error information_

![Alerts](../src/assets/images/Alerts.png)
_Real-time alert notifications for critical events_

---

### Customization

![Theme Settings](../src/assets/images/dashboard_theme.png)
_Light/Dark theme support with CSS variables for full customization_

---

## ✨ Why Use Universal Request Analyzer?

**The Problem:** Chrome DevTools is great for real-time debugging, but your data disappears when you close the tab. You can't track performance over time, compare different sessions, or analyze historical patterns.

**The Solution:** Universal Request Analyzer gives you:

<div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 20px 0;">
  <div style="padding: 15px; border-left: 3px solid #28a745;">
    <h3>🕐 Persistent Data</h3>
    <p>Your request data survives tab/browser closes</p>
  </div>
  <div style="padding: 15px; border-left: 3px solid #007bff;">
    <h3>📊 Historical Analytics</h3>
    <p>Track performance trends over days and weeks</p>
  </div>
  <div style="padding: 15px; border-left: 3px solid #ffc107;">
    <h3>🔍 Advanced Search</h3>
    <p>Find any request across all your browsing history</p>
  </div>
  <div style="padding: 15px; border-left: 3px solid #dc3545;">
    <h3>📈 Performance Insights</h3>
    <p>Identify slow APIs and third-party services</p>
  </div>
  <div style="padding: 15px; border-left: 3px solid #6f42c1;">
    <h3>💾 Export Anywhere</h3>
    <p>HAR, JSON, CSV formats for sharing and analysis</p>
  </div>
  <div style="padding: 15px; border-left: 3px solid #17a2b8;">
    <h3>⚡ Real-time Updates</h3>
    <p>Auto-refresh with instant filter application</p>
  </div>
</div>

### Perfect For:

- 🐛 Debugging intermittent API issues that are hard to reproduce
- ⚡ Performance optimization and regression detection
- 🔍 Analyzing third-party service impact on your site
- 📋 Sharing network evidence for bug reports
- 📊 Tracking API performance over time

---

## 🚀 Features

- **Unified Filtering System**: Hierarchical filtering by domain → page → request type across all interfaces
- **Time Travel**: View historical performance data and trends over time
- **Real-time Analytics**: Capture and analyze network requests in real-time
- **Detailed Performance Metrics**: Track DNS, TCP, SSL, TTFB, and download times
- **Rich Visualizations**: Interactive charts and graphs for request data
- **Cross-browser Compatibility**: Works on Chrome, Firefox, and Edge
- **Export Capabilities**: Export filtered data in multiple formats
- **Configurable Monitoring**: Flexible filter options and retention settings

---

## 📊 More Than DevTools

| Feature                  | DevTools         | Universal Request Analyzer |
| ------------------------ | ---------------- | -------------------------- |
| Request Inspection       | ✅               | ✅                         |
| Performance Timing       | ✅               | ✅ Enhanced                |
| Filtering & Search       | ✅               | ✅ Advanced                |
| **Data Persistence**     | ❌ Lost on close | ✅ **Saved forever**       |
| **Historical Analysis**  | ❌               | ✅ **Days/weeks of data**  |
| **Cross-Page Analytics** | ❌               | ✅ **All domains**         |
| **Performance Trending** | ❌               | ✅ **Track over time**     |
| **Third-Party Impact**   | ❌               | ✅ **Auto-categorized**    |
| **Export/Share**         | HAR only         | ✅ **Multiple formats**    |

---

## 🎯 Quick Start

### Installation

**From Browser Store:**

- **Chrome/Edge:** [Chrome Web Store](https://chrome.google.com/webstore) - Search for "Universal Request Analyzer"
- **Firefox:** [Firefox Add-ons](https://addons.mozilla.org) - Search for "Universal Request Analyzer"

**Manual Installation (Developers):**

1. Clone the repository
2. Run `npm install` and `npm run build`
3. Load the `dist` folder as an unpacked extension

### First Use (30 seconds)

1. **Install** the extension
2. **Browse** any website normally
3. **Click** the extension icon to see captured requests
4. **That's it!** Your data is automatically saved

No configuration needed. No complex setup. Just install and it works.

---

## 💻 Technical Highlights

For developers and performance engineers:

### Advanced Analytics Architecture

- **Medallion Architecture**: Bronze (raw) → Silver (validated) → Gold (analytics) data layers
- **Star Schema**: Dimensional analytics with fact/dimension tables
- **OHLC Performance**: Financial-style candlestick charts for response times
- **Multi-Timeframe Analysis**: 1min, 5min, 15min, 1h, 4h, 1d, 1w, 1m granularity
- **SCD Type 2**: Historical tracking of domain attributes over time

### Built With

- SQLite (via sql.js) for local data storage
- Chart.js for visualizations
- Webpack for bundling
- Manifest V3 for modern extension architecture

---

## 🌐 Browser Compatibility

Fully compatible with:

- ✅ Google Chrome (v88+)
- ✅ Mozilla Firefox (v109+)
- ✅ Microsoft Edge (v88+)

---

## 📚 Documentation

- **[User Guide](https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/docs/USER_GUIDE.md)** - Comprehensive guide for all features
- **[Development Guide](https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/docs/DEVELOPMENT.md)** - Setup, building, testing, contributing
- **[Architecture](https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/docs/ARCHITECTURE.md)** - Technical architecture and design
- **[Contributing](https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/CONTRIBUTING.md)** - How to contribute

---

## 🤝 Contributing

We welcome contributions! See [CONTRIBUTING.md](https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/CONTRIBUTING.md) for guidelines.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](https://github.com/ModernaCyber/Universal-Request-Analyzer/blob/main/LICENSE) file for details.

---

<div style="text-align: center; margin: 40px 0; padding: 20px; background: #f8f9fa; border-radius: 8px;">
  <h2>Ready to Get Started?</h2>
  <p>Install Universal Request Analyzer today and never lose your network debugging data again!</p>
  <a href="https://chrome.google.com/webstore" class="btn" style="margin: 5px;">Install Now</a>
  <a href="https://github.com/ModernaCyber/Universal-Request-Analyzer" class="btn" style="margin: 5px;">Star on GitHub ⭐</a>
</div>
