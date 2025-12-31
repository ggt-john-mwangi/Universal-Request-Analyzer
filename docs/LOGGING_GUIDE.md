# Logging Utility Guide

## Overview

Centralized logging system with:

- ✅ Configurable log levels (DEBUG, INFO, WARN, ERROR)
- ✅ Color-coded console output
- ✅ Automatic error persistence to `bronze_errors` table
- ✅ Context-aware logging (identifies which component is logging)
- ✅ Performance timing
- ✅ Log grouping

## Quick Start

### Import and Use

```javascript
import { createLogger } from "../../lib/utils/logger.js";

// Create logger for your component
const logger = createLogger("MyComponent");

// Use it
logger.info("Component initialized");
logger.warn("Deprecation warning");
logger.error("Something went wrong", error, "additionalContext");
logger.success("Operation completed");
logger.debug("Verbose debugging info", { data: "details" });
```

### Log Levels

```javascript
logger.debug("Verbose details"); // Only shown when level = DEBUG
logger.info("General information"); // Shown when level = INFO or DEBUG
logger.warn("Warning message"); // Shown when level = WARN, INFO, or DEBUG
logger.error("Error message", error); // Always shown + saved to database
logger.success("Success message"); // Always shown (for user feedback)
```

## Configuration

### Settings Location

Log settings are in `config_app_settings` table under `logging` category:

```javascript
{
  logging: {
    level: "INFO",              // DEBUG, INFO, WARN, ERROR
    persistErrors: false,       // OFF by default - enable to save to bronze_errors table
    maxErrorAge: 604800000,     // 7 days in ms
    enableConsoleColors: true,  // Color-coded output
    enableTimestamps: true,     // Timestamp in logs
  }
}
```

### Change Log Level

**Via Options Page:**

1. Go to Options → Advanced → Logging
2. Select level: DEBUG, INFO, WARN, ERROR
3. Save settings

**Via Code:**

```javascript
await settingsManager.updateSettings({
  logging: { level: "DEBUG" },
});
```

**Via Console:**

```javascript
chrome.storage.local.get("settings", (data) => {
  data.settings.settings.logging.level = "DEBUG";
  chrome.storage.local.set({ settings: data.settings });
});
```

## Usage Examples

### Basic Logging

```javascript
import { createLogger } from "../../lib/utils/logger.js";
const logger = createLogger("Runners");

// Initialization
logger.info("Initializing runners manager");

// Success
logger.success("Runner executed successfully");

// Warning
logger.warn("No runners found, showing empty state");

// Error with stack trace
try {
  await runRunner();
} catch (error) {
  logger.error("Failed to run runner", error, "runRunner");
  // Error is automatically saved to bronze_errors table
}
```

### Performance Timing

```javascript
// Time an operation
const result = await logger.time("Load collections", async () => {
  return await chrome.runtime.sendMessage({ action: "getCollections" });
});

// Output: "⏱️ Starting: Load collections"
// Output: "✅ Completed: Load collections (234.56ms)"
```

### Grouped Logs

```javascript
logger.group("Processing runners", () => {
  logger.debug("Found 5 runners");
  logger.debug("Validating runner 1");
  logger.debug("Validating runner 2");
  // ... more logs
});

// Creates collapsible group in console
```

### Child Loggers

```javascript
const logger = createLogger("Options");

// Create child logger with extended context
const collectionsLogger = logger.child("Collections");
collectionsLogger.info("Loading collections");
// Output: "[Options.Collections] [INFO] Loading collections"

const runnersLogger = logger.child("Runners");
runnersLogger.info("Loading runners");
// Output: "[Options.Runners] [INFO] Loading runners"
```

## Database Error Logging

**Note:** Error persistence to database is **OFF by default**. Enable it in settings:

```javascript
await settingsManager.updateSettings({
  logging: { persistErrors: true },
});
```

When `persistErrors: true`, errors are automatically saved to `bronze_errors` table:

```sql
SELECT * FROM bronze_errors
ORDER BY timestamp DESC
LIMIT 10;
```

**Schema:**

```sql
CREATE TABLE bronze_errors (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  error_type TEXT DEFAULT 'Error',
  message TEXT NOT NULL,
  stack TEXT,
  context TEXT,
  url TEXT,
  user_agent TEXT,
  severity TEXT DEFAULT 'error',
  created_at INTEGER NOT NULL
);
```

**Query recent errors:**

```javascript
const response = await chrome.runtime.sendMessage({
  action: "executeQuery",
  query: `
    SELECT * FROM bronze_errors 
    WHERE timestamp > ${Date.now() - 3600000}
    ORDER BY timestamp DESC
  `,
});
console.table(response.results[0].values);
```

## Replacing Old Logging

### Before (Old)

```javascript
console.log("Options page: Initializing...");
console.error("Failed to load:", error);
console.warn("Deprecated feature");
```

### After (New)

```javascript
import { createLogger } from "../../lib/utils/logger.js";
const logger = createLogger("Options");

logger.info("Initializing...");
logger.error("Failed to load", error);
logger.warn("Deprecated feature");
```

### Benefits

1. **Consistent format** - All logs have same structure
2. **Filterable** - Easy to filter by component in console
3. **Configurable** - Change log level without code changes
4. **Persistent errors** - Errors saved to database
5. **Context** - Know which component logged what
6. **Color-coded** - Easy to spot errors/warnings

## Best Practices

### 1. Create Logger Per Component

```javascript
// ✅ Good - Each component has its own logger
const logger = createLogger("Collections");

// ❌ Bad - Reusing global logger
import logger from "../../lib/utils/logger.js";
```

### 2. Use Appropriate Levels

```javascript
// ✅ Good - Using correct levels
logger.debug("Detailed state", { collections, runners });
logger.info("User created collection");
logger.warn("Collection has no runners");
logger.error("Failed to save collection", error);

// ❌ Bad - Everything as info
logger.info("User created collection");
logger.info("Failed to save collection"); // Should be error!
```

### 3. Include Context in Errors

```javascript
// ✅ Good - Context helps debugging
logger.error("Failed to save collection", error, "saveCollection");

// ❌ Bad - No context
logger.error("Failed", error);
```

### 4. Clean Up Old Console Logs

```javascript
// ❌ Remove these
console.log("[Collections] Loading...");
console.error("Error:", error);

// ✅ Replace with
logger.info("Loading...");
logger.error("Error occurred", error);
```

## Migration Strategy

### Phase 1: Options Page (Completed ✅)

- ✅ Created logger utility
- ✅ Added to options.js
- ✅ Replaced initialization logs

### Phase 2: Collections Component

```javascript
// src/options/components/collections.js
import { createLogger } from "../../lib/utils/logger.js";
const logger = createLogger("Collections");

// Replace all console.log/error with logger
```

### Phase 3: Other Components

- Runners
- Dashboard
- Popup
- Background scripts

### Phase 4: Cleanup

- Remove all remaining console.log/error
- Add `no-console` ESLint rule

## Log Level Guide

**DEBUG** - Development only

- Variable values
- Function entry/exit
- Detailed state changes

**INFO** - Normal operations

- Initialization complete
- User actions
- Data loaded

**WARN** - Potential issues

- Deprecated features
- Missing optional data
- Fallback behavior

**ERROR** - Failures

- Exceptions
- Failed operations
- Data corruption

**SUCCESS** - User feedback

- Operation completed
- Data saved
- Action successful

## Console Output Examples

```
[2025-12-29T10:30:45.123Z] [Options] [INFO] DOM loaded, initializing...
[2025-12-29T10:30:45.234Z] [Options] [DEBUG] DOM elements initialized
[2025-12-29T10:30:45.456Z] [Options] [SUCCESS] Settings manager initialized
[2025-12-29T10:30:45.567Z] [Options.Collections] [INFO] Loading collections
[2025-12-29T10:30:45.890Z] [Options.Collections] [ERROR] Failed to load
```

## Troubleshooting

### Logs Not Appearing

1. Check log level:

```javascript
chrome.storage.local.get("settings", (data) => {
  console.log("Current level:", data.settings?.settings?.logging?.level);
});
```

2. Ensure logger initialized:

```javascript
logger.loadConfig(); // Force reload config
```

### Errors Not Persisting

1. Check persistErrors setting:

```javascript
chrome.storage.local.get("settings", (data) => {
  console.log(
    "Persist errors:",
    data.settings?.settings?.logging?.persistErrors
  );
});
```

2. Verify bronze_errors table exists:

```javascript
const response = await chrome.runtime.sendMessage({
  action: "executeQuery",
  query:
    "SELECT name FROM sqlite_master WHERE type='table' AND name='bronze_errors'",
});
console.log("Table exists:", response.results[0].values.length > 0);
```

## Next Steps

1. ✅ **Completed:** Logger utility created
2. ✅ **Completed:** Added to options.js
3. ⏳ **TODO:** Add to collections.js
4. ⏳ **TODO:** Add to runners.js
5. ⏳ **TODO:** Add to dashboard.js
6. ⏳ **TODO:** Add logging settings UI in Options → Advanced
7. ⏳ **TODO:** Create error viewer in Options → Advanced → View Errors
