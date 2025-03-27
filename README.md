# Universal Request Analyzer

![image](https://github.com/user-attachments/assets/b0ee7434-4cfb-4f3d-a2e8-7411db2c19a1)

## Overview

**Universal Request Analyzer** is a powerful browser extension designed to capture, store, and analyze network request timings across all major browsers. It helps developers monitor API performance, track request details, log performance metrics, and visualize data efficiently.

## Features

### Core Functionality

- **Cross-Browser Compatibility**: Works seamlessly with Chrome, Firefox, Edge, and other major browsers.
- **Continuous Background Capture**: Automatically logs network requests across all visited pages.
- **Detailed Timing Information**: Captures network performance metrics, including DNS lookup, TCP connection, SSL handshake, Time to First Byte (TTFB), and download duration.
- **Domain-Specific Analysis**: Track performance by domain and individual request routes.

### Data Storage & Management

- **SQLite Database Storage**: Stores captured requests persistently for long-term analysis.
- **Excel File Logging**: Each domain has its own Excel file for organized data storage, with new data appended to existing rows when requests match previous entries.
- **Advanced Filtering**: Filter captured requests by domain, status, type, URL, and date range.
- **Multiple Export Formats**: Export request data in JSON, CSV, SQLite, or PDF format.

### Visualization & Reporting

- **Data Visualization**: Generate charts and plots for request performance metrics.
- **Request Headers & Body Analysis**: Capture request headers and payloads for deeper inspection.
- **Configurable UI**: Customize capture settings, filters, auto-export, and visualization preferences.

## Installation

### Manual Installation

1. **Clone the Repository**:
   ```bash
   git clone https://github.com/ggt-john-mwangi/Universal-Request-Analyzer.git
   ```
2. **Load the Extension**:
   - Open Chrome and navigate to `chrome://extensions/`.
   - Enable "Developer mode" in the top right corner.
   - Click "Load unpacked" and select the cloned repository folder.
   - The extension should now be installed and active.

## Usage

### Basic Usage

1. Click the extension icon in the browser toolbar to open the popup.
2. Browse websites as usual; the extension captures network requests automatically.
3. Open **Developer Tools (DevTools)** (`F12`) and navigate to the "Universal Request Analyzer" panel.
4. Analyze captured requests, including timing breakdowns and performance metrics.

### Configuration

1. Open the extension popup and click the **Config** button.
2. Adjust capture settings, filtering options, and export preferences.
3. Save the configuration for future browsing sessions.

### Exporting Data

1. Click the **Export** button in the popup.
2. Select the desired export format (JSON, CSV, SQLite, PDF).
3. Optionally enter a filename.
4. Click "Export" to download the data.

### Filtering Requests

1. Click the **Filter** button in the popup.
2. Define filters based on status, type, domain, URL, and date range.
3. Apply filters to refine the captured request list.

## Architecture

The extension consists of the following key components:

1. **Background Script**: Captures network requests and manages the SQLite database.
2. **Content Script**: Extracts performance metrics using the Performance API.
3. **Popup UI**: Provides an interface for viewing and analyzing captured requests.
4. **Options Page**: Allows users to configure the extension’s behavior.

## Database Schema

The extension utilizes an SQLite database to store captured request data efficiently.

### Requests Table

| Column     | Type    | Description                             |
| ---------- | ------- | --------------------------------------- |
| id         | INTEGER | Unique request ID                       |
| url        | TEXT    | Request URL                             |
| method     | TEXT    | HTTP method (GET, POST, etc.)           |
| type       | TEXT    | Request type (XHR, fetch, script, etc.) |
| status     | INTEGER | HTTP status code                        |
| statusText | TEXT    | HTTP status message                     |
| domain     | TEXT    | Request domain                          |
| path       | TEXT    | URL path                                |
| startTime  | REAL    | Timestamp of request start              |
| endTime    | REAL    | Timestamp of request completion         |
| duration   | REAL    | Request duration in milliseconds        |
| size       | INTEGER | Response size in bytes                  |
| timestamp  | REAL    | Capture timestamp                       |
| tabId      | INTEGER | Browser tab ID                          |
| pageUrl    | TEXT    | URL of the page making the request      |
| error      | TEXT    | Error message (if any)                  |

### Request Timings Table

| Column    | Type    | Description                           |
| --------- | ------- | ------------------------------------- |
| requestId | INTEGER | Foreign key linking to Requests table |
| dns       | REAL    | DNS lookup time in ms                 |
| tcp       | REAL    | TCP connection time in ms             |
| ssl       | REAL    | SSL handshake time in ms              |
| ttfb      | REAL    | Time to first byte in ms              |
| download  | REAL    | Content download time in ms           |

### Request Headers Table

| Column    | Type    | Description                           |
| --------- | ------- | ------------------------------------- |
| id        | INTEGER | Unique header ID                      |
| requestId | INTEGER | Foreign key linking to Requests table |
| name      | TEXT    | Header name                           |
| value     | TEXT    | Header value                          |

## Future Enhancements

- **Enhanced Data Analysis**: Implement more visual analytics for trend monitoring.
- **Automated Reports**: Generate scheduled reports with insights on API performance.
- **Cloud Syncing**: Store request logs in a cloud database for accessibility across devices.
- **Custom Notifications**: Alert users when requests exceed predefined latency thresholds.

## Contributing

We welcome contributions to improve this extension!

### Steps to Contribute

1. **Fork the Repository**:
   - Click the "Fork" button on the repository page.
2. **Create a Feature Branch**:
   ```bash
   git checkout -b feature-branch-name
   ```
3. **Make Changes & Commit**:
   - Implement your feature or bug fix.
   - Run tests to ensure stability.
   - Commit your changes with a meaningful message.
4. **Submit a Pull Request**:
   - Push your changes to your fork.
   - Open a pull request against the `main` branch.

## License

This project is licensed under the **MIT License**.

## Contact

For any questions or suggestions, please contact **John Mwangi**.
