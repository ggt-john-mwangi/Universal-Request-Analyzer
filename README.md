# Network Request Analyzer Chrome Extension

## Overview

Network Request Analyzer is a Chrome extension that helps you visualize and analyze webpage network requests in real-time. It captures detailed information about network requests, performance metrics, and potential errors.

## Features

- Capture all network requests across webpages
- Track request details including:
  - Hostname
  - HTTP Method
  - Request Status
  - Request Duration
- Collect performance metrics for resources
- Log detailed resource timing information
- Capture and report network errors

## Installation

### From Chrome Web Store
*[Coming soon - placeholder]*

### Manual Installation
1. Clone this repository
2. Open Chrome and navigate to `chrome://extensions/`
3. Enable "Developer mode" (top right toggle)
4. Click "Load unpacked" and select the extension directory
5. The Network Request Analyzer icon will appear in your Chrome toolbar

## How It Works

The extension uses Chrome's WebRequest API to intercept and analyze network requests across different web pages. It consists of three main scripts:

- `background.js`: Manages network request tracking and message routing
- `content.js`: Captures performance metrics and resource details
- `popup.js`: Renders the network request information in the extension popup

## Permissions

The extension requires the following permissions:
- `webRequest`: To monitor network requests
- `tabs`: To access tab information
- `<all_urls>`: To analyze requests across all websites

## Development

### Prerequisites
- Google Chrome
- Basic understanding of Chrome Extension development

### Local Development
1. Clone the repository
2. Make changes to the source files
3. Load the extension in Chrome using "Load unpacked" in `chrome://extensions/`

## Technical Details

### Captured Metrics
- Resource loading times
- Transfer sizes
- Request/response timings
- Network errors

### Performance Tracking
The extension captures:
- Resource entry details
- Initiator types
- Transfer and body sizes
- Detailed network timing information

## Security

All data collection is done locally within the browser and is not transmitted externally.

## Troubleshooting

- Ensure Chrome is updated to the latest version
- Check extension permissions
- Verify the extension is enabled in `chrome://extensions/`

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

:)
