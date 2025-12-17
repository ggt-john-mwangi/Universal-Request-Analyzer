# Endpoint Performance Over Time - Implementation Summary

## ✅ Fully Implemented Features

### 1. **Time Range Selector** (How far back to look)

```
✓ Last 30 minutes
✓ Last 1 hour
✓ Last 6 hours
✓ Last 24 hours (default)
✓ Last 7 days
✓ Last 30 days
✓ Last 3 months
```

### 2. **Time Bucket Granularity** (How to group data)

```
✓ Per Minute   - Best for 30m-1h ranges
✓ Hourly       - Best for 6h-7d ranges (default)
✓ Daily        - Best for 30d-3m ranges
```

### 3. **Resource Type Filter**

```
✓ All Types
✓ Fetch
✓ XHR/AJAX
✓ Script
✓ Stylesheet
✓ Image
✓ Font
✓ Document
✓ Other
```

### 4. **Smart API Sorting** (For 100s of endpoints)

```
✓ Most Requests (default) - Shows busiest APIs
✓ Slowest Avg            - Shows performance bottlenecks
✓ Most Errors            - Shows problematic APIs
✓ Largest Size           - Shows data-heavy APIs
```

### 5. **Top N Filter** (Limit initial display)

```
✓ Top 5
✓ Top 10 (default)
✓ Top 15
✓ Top 20
✓ All Endpoints (up to 100)
```

### 6. **Endpoint Search**

```
✓ Text input to filter by URL pattern
✓ Examples: /api/users, /login, /v1/products
✓ Real-time filtering
```

### 7. **Interactive Endpoint Selector** (Main Feature!)

```
✓ Appears after clicking "Load Data"
✓ Shows all available endpoints with metrics:
  - Endpoint URL/pattern
  - Total request count
  - Average response time
✓ Click any endpoint to toggle on/off
✓ Visual highlighting for selected endpoints
✓ Select All / Deselect All buttons
✓ Scrollable list for 100+ endpoints
```

### 8. **Enhanced Chart**

```
✓ Each API gets its own colored line
✓ Dynamic color generation (no limit)
✓ Click legend items to hide/show specific APIs
✓ Hover tooltips show exact timing and values
✓ Chart title shows count of displayed endpoints
✓ Smooth animations
```

## 📋 How To Use

### Step 1: Select Your Filters

1. Choose **Time Range** (e.g., Last 24 hours)
2. Choose **Time Bucket** (e.g., Hourly)
3. Optional: Filter by **Resource Type** (e.g., XHR/AJAX)
4. Optional: **Sort By** (e.g., Slowest Avg to find bottlenecks)
5. Optional: **Show Top** (e.g., Top 10)
6. Optional: **Search** for specific endpoint pattern

### Step 2: Load Data

1. Click **"Load Data"** button
2. Backend fetches and sorts endpoints based on your criteria

### Step 3: Select Endpoints to Plot

1. **Endpoint Selector Panel** appears below controls
2. Shows all available endpoints matching your filters
3. Each endpoint shows:
   - Full URL or pattern (e.g., `/api/users/:id`)
   - Total requests (e.g., "156 req")
   - Average response time (e.g., "234ms avg")
4. **Click any endpoint** to toggle it on/off
5. Selected endpoints are highlighted in blue
6. Use **Select All** / **Deselect All** for quick changes

### Step 4: Analyze the Chart

1. Chart shows selected endpoints over time
2. Each endpoint has a unique colored line
3. Hover over any point to see exact values
4. Click legend items to temporarily hide/show lines
5. Zoom and pan if needed

## 🎯 Real-World Examples

### Example 1: Finding Slow APIs in Last Hour

```
Time Range: Last 1 hour
Time Bucket: Per Minute
Sort By: Slowest Avg
Show Top: Top 10
→ Quickly identifies performance bottlenecks
```

### Example 2: Tracking Error-Prone Endpoints Over Week

```
Time Range: Last 7 days
Time Bucket: Hourly
Sort By: Most Errors
Show Top: Top 15
→ See which APIs fail most frequently
```

### Example 3: Monitoring Specific API Pattern

```
Time Range: Last 24 hours
Search: /api/v1/products
Show Top: All
→ Track all product-related endpoints
```

### Example 4: High-Traffic API Analysis

```
Time Range: Last 30 days
Time Bucket: Daily
Sort By: Most Requests
Show Top: Top 20
→ Understand long-term traffic patterns
```

## 🔧 Backend Implementation

### Time Calculation

- Frontend sends `startTime` and `endTime` in milliseconds
- Backend queries database between these timestamps
- SQL groups by time bucket (minute/hour/day)

### Endpoint Grouping

- URLs are normalized to patterns (e.g., `/users/123` → `/users/:id`)
- IDs replaced with `:id`
- Hashes replaced with `:hash`
- Groups identical patterns together

### Sorting & Limiting

- Backend calculates aggregate metrics per endpoint:
  - Total requests
  - Average duration
  - Total errors
  - Average size
- Sorts based on selected criteria
- Returns only top N endpoints to frontend
- Prevents overwhelming UI with 100+ endpoints

### Data Structure

```javascript
{
  success: true,
  groupedByEndpoint: {
    "/api/users/:id": [
      { timeBucket: "2025-12-16 10:00:00", avgDuration: 234, requestCount: 45, ... },
      { timeBucket: "2025-12-16 11:00:00", avgDuration: 256, requestCount: 52, ... },
      ...
    ],
    "/api/products": [
      { timeBucket: "2025-12-16 10:00:00", avgDuration: 123, requestCount: 89, ... },
      ...
    ]
  },
  timeBucket: "hourly",
  totalEndpoints: 87,
  displayedEndpoints: 10
}
```

## ✨ Key Benefits

1. **Scalability**: Handles 100s of endpoints gracefully
2. **Flexibility**: Multiple time ranges and granularities
3. **User Control**: Choose exactly which APIs to plot
4. **Performance**: Only loads top N endpoints by default
5. **Visual Clarity**: Color-coded lines, interactive legend
6. **Pattern Matching**: URLs normalized to patterns for grouping
7. **Real-time Updates**: Can re-run with different filters

## 📍 Location in Code

### Frontend

- **HTML**: `src/options/options.html` (lines ~590-760)
- **JavaScript**: `src/options/components/dashboard.js` (lines ~1138-1340)
- **CSS**: `src/options/css/options.css` (endpoint selector styles)

### Backend

- **Handler**: `src/background/messaging/popup-message-handler.js`
- **Action**: `getEndpointPerformanceHistory`
- **Features**: Time bucketing, sorting, limiting, pattern normalization

## 🧪 Testing Checklist

- [ ] Load data for different time ranges
- [ ] Try different time buckets (minute/hour/day)
- [ ] Test sorting options (requests/slowest/errors/size)
- [ ] Use top N filter with various limits
- [ ] Search for specific endpoint patterns
- [ ] Toggle individual endpoints on/off
- [ ] Use Select All / Deselect All
- [ ] Verify chart updates correctly
- [ ] Test with 0 results (no data)
- [ ] Test with 1 endpoint
- [ ] Test with 100+ endpoints
- [ ] Check legend click behavior
- [ ] Verify tooltips show correct data

## 🚀 Ready to Use!

The feature is **fully implemented** and ready for testing. All the requirements are met:

✅ Individual API plotting
✅ Flexible time ranges (30m to 3 months)
✅ Handles 100s of endpoints
✅ Best user preference approach (top N + interactive selection)
✅ Domain/page filtering integration
✅ Multiple sorting and filtering options

Simply:

1. Navigate to Options → Dashboard → Performance tab
2. Scroll to "Endpoint Performance Over Time"
3. Configure your filters
4. Click "Load Data"
5. Select endpoints to plot
6. Analyze the chart!
