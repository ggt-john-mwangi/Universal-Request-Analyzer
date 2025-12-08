# Universal Request Analyzer

A powerful browser extension for analyzing and monitoring network requests with detailed performance metrics and advanced filtering capabilities.

## Features

- **Unified Filtering System**: Hierarchical filtering by domain → page → request type across all interfaces
- **Time Travel**: View historical performance data and trends over time
- **Real-time Analytics**: Capture and analyze network requests in real-time
- **Detailed Performance Metrics**: Track DNS, TCP, SSL, TTFB, and download times
- **Rich Visualizations**: Interactive charts and graphs for request data
- **Cross-browser Compatibility**: Works on Chrome, Firefox, and Edge
- **Export Capabilities**: Export filtered data for further analysis
- **Configurable Monitoring**: Flexible filter options and retention settings

## Unified Filtering

The extension provides consistent filtering across three interfaces:

### Popup
- **Auto-filtered by current domain**: Automatically shows metrics for the current tab's domain
- **Request type filter**: Filter by XHR/API, Fetch, Scripts, Stylesheets, Images, Fonts, Documents
- **Aggregated metrics**: Shows combined statistics across all pages within the domain
- **Quick insights**: View total requests, average response time, errors, and data transferred

### DevTools Panel
- **Domain filter**: Select current domain, all domains, or specific tracked domains
- **Page filter**: Choose specific pages or view aggregated data for the domain
- **Request type filter**: Filter by resource type
- **Time range selection**: View data from last 5 minutes to last 30 days
- **Time Travel**: Access historical data with hourly, daily, or minute-by-minute grouping
- **Multiple tabs**: Overview, Requests Table, Performance, Endpoints, and Errors
- **Real-time updates**: Auto-refresh every 5 seconds with instant filter application

### Dashboard
- **All domains**: View metrics across all tracked domains
- **Domain → Page hierarchy**: Select domain first, then choose specific pages
- **Request type filtering**: Filter by resource type
- **Time range selection**: Analyze data over different time periods
- **Comprehensive charts**: Volume timeline, status distribution, performance trends

## Time Travel Feature

Navigate through historical performance data:

1. Click the "History" button in the DevTools Panel
2. Select grouping: Hourly, Daily, or By Minute
3. View historical trends for:
   - Request volume over time
   - Average response times
   - Error rates and patterns
   - Performance regressions

## Performance Metrics

The extension captures detailed performance monitoring:

- DNS lookup time
- TCP connection time
- SSL/TLS handshake time
- Time to First Byte (TTFB)
- Download time
- Total request duration
- P95, P99 percentiles

*Note: Performance metrics are disabled by default to minimize performance impact. Enable them in extension settings when needed.*

### Performance Monitoring Configuration

- Enable/disable performance monitoring
- Adjust sampling rate (default: 100%)
- Configure metric retention period (default: 7 days)
- Choose specific metrics to capture:
  - Navigation Timing
  - Resource Timing
  - Server Timing
  - Custom Metrics

## Installation

1. Download the extension from your browser's extension store
2. The extension will automatically initialize its database on first install
3. Configure your preferences in the extension settings

## Usage

### Popup Interface
1. Click the extension icon to open the popup
2. View current domain's aggregated metrics
3. Use the request type filter to focus on specific resource types
4. Click "Analytics" to open the DevTools Panel or "Dashboard" for full view

### DevTools Panel
1. Open Chrome DevTools (F12)
2. Navigate to the "Request Analyzer" tab
3. Use filters to narrow down requests:
   - **Domain**: Select which domain to analyze
   - **Page**: Choose specific page or view all pages aggregated
   - **Time Range**: Select how far back to look (5 min to 30 days)
   - **Request Type**: Filter by resource type
   - **Status**: Filter by HTTP status codes
4. Switch between tabs for different views:
   - **Overview**: Real-time charts and key metrics
   - **Requests Table**: Detailed request information with sorting
   - **Performance**: Timing breakdowns and slow request analysis
   - **Endpoints**: API endpoint performance analysis
   - **Errors**: Failed requests categorization
5. Click "History" to access time-travel feature

### Dashboard
1. Open the extension options/settings page
2. Navigate to the Dashboard tab
3. Select domain and optionally a specific page
4. Choose time range and request type filters
5. View comprehensive performance analytics

## Filter Hierarchy

```
Popup:     [Auto: Current Domain] → [All Pages Aggregated] → [Request Type]
Panel:     [Domain] → [Page] → [Request Type] → [Status] → [Time Range]
Dashboard: [Domain] → [Page] → [Request Type] → [Time Range]
```

**Aggregation behavior:**
- When no specific page is selected: Shows aggregated metrics across all pages in the domain
- When a page is selected: Shows metrics only for that specific page

## Configuration

### General Settings

- Request capture (enabled by default)
- Performance metrics (disabled by default)
- Data retention settings (default: 7 days)
- Export options
- Auto-refresh intervals

### Advanced Settings

- Sampling rate adjustment
- Custom metric configuration
- Filter presets
- Database management

## Browser Compatibility

Fully compatible with:

- Google Chrome (v88+)
- Mozilla Firefox (v109+)
- Microsoft Edge (v88+)

## Development

### Prerequisites

- Node.js (v14+)
- npm or yarn

### Setup

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Build the extension:

```bash
npm run build
```

4. Load the extension in your browser:

- Chrome/Edge: Load unpacked extension from the `dist` folder
- Firefox: Load temporary add-on from the `dist` folder

### Development Commands

- `npm run dev` - Watch for changes and rebuild
- `npm run build` - Build for production
- `npm test` - Run tests
- `npm run lint` - Check code style

## Architecture

The extension uses a medallion architecture with three data layers:

- **Bronze Layer**: Raw request data capture
- **Silver Layer**: Cleaned and validated data
- **Gold Layer**: Aggregated analytics-ready data

All filtering and aggregation happens at query time, ensuring fresh data and flexible analysis.

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
