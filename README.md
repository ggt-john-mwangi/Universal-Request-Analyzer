# Universal Request Analyzer

A powerful browser extension for analyzing and monitoring network requests with detailed performance metrics.

## Features

- Capture and analyze network requests in real-time
- Track detailed performance metrics (disabled by default)
- Cross-browser compatibility (Chrome, Firefox, Edge)
- Rich visualization of request data
- Export capabilities
- Configurable filters and monitoring options

## Performance Metrics

The extension now includes detailed performance monitoring capabilities:

- DNS lookup time
- TCP connection time
- SSL/TLS handshake time
- Time to First Byte (TTFB)
- Download time
- Total request duration

These metrics are disabled by default to minimize performance impact. Enable them in the extension settings when needed.

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

1. Click the extension icon to open the popup interface
2. Navigate through tabs:
   - Requests: View captured network requests
   - Stats: See request statistics
   - Performance: Monitor performance metrics

### Performance Monitoring

1. Go to the Performance tab
2. Toggle the "Enable Performance Metrics" switch
3. View real-time performance data
4. Use filters to analyze specific requests
5. Export performance data for further analysis

## Configuration

### General Settings

- Request capture (enabled by default)
- Performance metrics (disabled by default)
- Data retention settings
- Export options

### Advanced Settings

- Sampling rate adjustment
- Custom metric configuration
- Filter settings
- Database management

## Browser Compatibility

The extension is fully compatible with:

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

## Contributing

Please read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
