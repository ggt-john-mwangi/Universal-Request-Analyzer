# Logging & Error Management Architecture

**Date:** December 29, 2025  
**Status:** Active - Multiple Systems Working Together

---

## Overview

The extension has THREE complementary logging/error systems:

1. **Logger** (`src/lib/utils/logger.js`) - NEW ✨

   - Console logging with levels
   - Database persistence for errors
   - Configuration via settings

2. **Error Manager** (`src/background/errors/error-manager.js`) - EXISTING ✅

   - Custom error types
   - Error event bus
   - Error handlers

3. **Error Monitor** (`src/background/monitoring/error-monitor.js`) - EXISTING ✅
   - Error tracking and counting
   - Retry strategies
   - Service health monitoring

**These are NOT duplicates** - they serve different purposes!

---

## 1. Logger - Console & Database Logging

### Purpose

- Structured console logging
- Database persistence (`bronze_errors` table)
- Configurable log levels
- Development debugging

### Location

`src/lib/utils/logger.js`

### Usage

```javascript
import { createLogger } from "../../lib/utils/logger.js";
const logger = createLogger("ComponentName");

logger.debug("Details", data);
logger.info("Information");
logger.warn("Warning");
logger.error("Error", error, "context");
logger.success("Success!");
```

### Configuration

Stored in `config_app_settings` → `logging`:

```javascript
{
  logging: {
    level: "INFO",              // DEBUG, INFO, WARN, ERROR
    persistErrors: false,       // OFF by default - enable to save to bronze_errors table
    maxErrorAge: 604800000,     // 7 days
    enableConsoleColors: true,
    enableTimestamps: true,
  }
}
```

### Data Flow

```
Component Code
  ↓
logger.error("msg", error)
  ↓
Logger Class
  ├─→ Console Output (color-coded)
  └─→ chrome.runtime.sendMessage({ action: "logError" })
       ↓
       popup-message-handler.js
       ↓
       handleLogError()
       ↓
       INSERT INTO bronze_errors
```

### Database Schema

```sql
CREATE TABLE bronze_errors (
  id TEXT PRIMARY KEY,
  timestamp INTEGER NOT NULL,
  error_type TEXT DEFAULT 'Error',
  message TEXT NOT NULL,
  stack TEXT,
  context TEXT,              -- Component.method
  url TEXT,                  -- Where error occurred
  user_agent TEXT,
  severity TEXT DEFAULT 'error',
  created_at INTEGER NOT NULL
);
```

### User Journey - Viewing Errors

1. User encounters an error
2. Error logged to console (color-coded)
3. Error saved to `bronze_errors` table
4. User can view errors:
   - DevTools Console (immediate)
   - Options → Advanced → Database Tables → bronze_errors
   - Future: Options → Advanced → View Error Log UI

---

## 2. Error Manager - Custom Error Types & Event Bus

### Purpose

- Define custom error types with codes
- Propagate errors through event bus
- Register error handlers per error type
- Centralized error handling logic

### Location

`src/background/errors/error-manager.js`

### Custom Error Types

```javascript
import {
  RequestAnalyzerError, // Base error
  ValidationError, // Input validation
  DatabaseError, // Database operations
  NetworkError, // Network requests
} from "../background/errors/error-manager.js";

// Usage
throw new ValidationError("Invalid input", { field: "url" });
throw new DatabaseError("Query failed", { query, error });
throw new NetworkError("Fetch failed", { url, status: 500 });
```

### Event Bus Integration

```javascript
// Error published to event bus
eventBus.publish("error", {
  type: "validation",
  error: validationError,
  context: { component: "Settings" },
});

// Error manager listens and handles
errorManager.registerHandler("validation", (error) => {
  // Custom handling for validation errors
  showNotification(error.message, "error");
});
```

### Data Flow

```
Code throws custom error
  ↓
throw new DatabaseError(...)
  ↓
eventBus.publish("error", { error })
  ↓
ErrorManager.handleError()
  ├─→ Log to error history
  ├─→ Call registered handlers
  └─→ Emit to event listeners
```

### User Journey - Custom Error Handling

1. Component validates input
2. Validation fails
3. Throws `ValidationError` with details
4. Error propagates through event bus
5. Registered handlers respond:
   - Show user notification
   - Log to analytics
   - Retry operation
   - Update UI state

---

## 3. Error Monitor - Tracking & Retry Logic

### Purpose

- Monitor service health
- Track error frequency
- Implement retry strategies
- Detect error patterns

### Location

`src/background/monitoring/error-monitor.js`

### Features

**Error Tracking:**

```javascript
errorMonitor.logError("database", {
  operation: "INSERT",
  error: error,
  timestamp: Date.now(),
});

// Query error stats
const stats = errorMonitor.getErrorStats("database");
// { count: 5, lastError: {...}, firstSeen: timestamp }
```

**Retry Strategies:**

```javascript
// Register retry strategy
errorMonitor.registerRetryStrategy("network", {
  maxRetries: 3,
  backoff: "exponential", // 1s, 2s, 4s
  shouldRetry: (error) => error.status >= 500,
});

// Use retry
await errorMonitor.retryWithStrategy("network", async () => {
  return await fetch(url);
});
```

**Service Health:**

```javascript
// Monitor service health
errorMonitor.checkServiceHealth("database");
// { healthy: true, errors: 0, lastCheck: timestamp }
```

### Data Flow

```
Service fails
  ↓
eventBus.publish("service:stateChanged", { status: "failed" })
  ↓
ErrorMonitor.handleServiceError()
  ├─→ Log error details
  ├─→ Increment error count
  ├─→ Check retry strategy
  └─→ Attempt recovery if applicable
```

### User Journey - Service Recovery

1. Database connection fails
2. Error logged to error monitor
3. Retry strategy activated
4. 3 retry attempts with backoff
5. If successful: Service restored
6. If failed: User notified with actionable message

---

## How They Work Together

### Scenario 1: Database Query Fails

```javascript
// In a component
try {
  const result = await dbManager.query("SELECT * FROM ...");
} catch (error) {
  // 1. Log to console + database
  logger.error("Query failed", error, "loadData");

  // 2. Throw custom error with details
  throw new DatabaseError("Failed to load data", {
    query: "SELECT * FROM ...",
    error: error.message,
  });
}

// Error Manager catches DatabaseError via event bus
errorManager.registerHandler("database", (error) => {
  // 3. Show user notification
  showNotification("Database error occurred", "error");
});

// Error Monitor tracks for health monitoring
errorMonitor.logError("database", error);
// If too many errors: trigger maintenance mode
```

### Scenario 2: Network Request Fails

```javascript
// In API service
async function fetchData(url) {
  try {
    // Error Monitor provides retry logic
    return await errorMonitor.retryWithStrategy("network", async () => {
      const response = await fetch(url);
      if (!response.ok) {
        throw new NetworkError(`HTTP ${response.status}`, {
          url,
          status: response.status,
        });
      }
      return response.json();
    });
  } catch (error) {
    // Logger persists the failure
    logger.error("Network request failed after retries", error, "fetchData");

    // Error Manager handles the error type
    throw error; // Propagates to event bus
  }
}
```

### Scenario 3: User Input Validation

```javascript
// In form component
function validateRunnerConfig(config) {
  if (!config.url) {
    // Logger for debugging
    logger.warn("URL is required", { config });

    // Error Manager for type-specific handling
    throw new ValidationError("URL is required", {
      field: "url",
      value: config.url,
    });
  }
}

// Error caught in submit handler
try {
  validateRunnerConfig(formData);
} catch (error) {
  if (error instanceof ValidationError) {
    // Show validation error to user
    showFieldError(error.details.field, error.message);

    // No need to log validation errors to database
    // Just console for debugging
    logger.debug("Validation failed", error.details);
  }
}
```

---

## Configuration User Journey

### 1. Initial State (Defaults)

```javascript
// When extension first installed
settings = {
  logging: {
    level: "INFO", // Show INFO, WARN, ERROR
    persistErrors: false, // OFF by default (user must enable)
    maxErrorAge: 604800000, // 7 days retention
  },
};
```

### 2. User Changes Log Level

**Via Options Page UI (Future):**

1. User opens Options → Advanced → Logging
2. Selects "DEBUG" from dropdown
3. Clicks "Save"
4. Settings Manager updates `config_app_settings`
5. Settings synced to chrome.storage.local
6. All loggers reload config automatically
7. Debug logs now appear in console

**Via Console (Now):**

```javascript
// Developer console
await chrome.runtime.sendMessage({
  action: "updateSettings",
  settings: {
    logging: { level: "DEBUG" },
  },
});

// Verify
chrome.storage.local.get("settings", (data) => {
  console.log("Log level:", data.settings?.settings?.logging?.level);
});
```

### 3. User Views Logged Errors

**Method 1: Console (Immediate)**

```
Open DevTools → Console tab
See color-coded logs:
  [2025-12-29...] [Options] [ERROR] Failed to load
```

**Method 2: Database Query (Advanced)**

```javascript
// Options → Advanced → Execute Query
const response = await chrome.runtime.sendMessage({
  action: "executeQuery",
  query: `
    SELECT * FROM bronze_errors 
    WHERE timestamp > ${Date.now() - 3600000}
    ORDER BY timestamp DESC
    LIMIT 20
  `,
});
console.table(response.results[0].values);
```

**Method 3: Error Log UI (Future)**

```
Options → Advanced → View Error Log
- Table of recent errors
- Filter by severity/context
- Search by message
- Export to CSV
```

---

## Data Flow Diagrams

### Logging Data Flow

```
┌──────────────────┐
│ Component Code   │
│ logger.error()   │
└────────┬─────────┘
         │
         ├─────────────────────┐
         │                     │
         ▼                     ▼
┌──────────────────┐   ┌─────────────────┐
│ Console Output   │   │ chrome.runtime  │
│ (color-coded)    │   │ .sendMessage()  │
└──────────────────┘   └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ Background      │
                       │ handleLogError()│
                       └────────┬────────┘
                                │
                                ▼
                       ┌─────────────────┐
                       │ INSERT INTO     │
                       │ bronze_errors   │
                       └─────────────────┘
```

### Error Manager Data Flow

```
┌──────────────────┐
│ throw new        │
│ DatabaseError()  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ eventBus.publish │
│ ("error", {...}) │
└────────┬─────────┘
         │
         ├─────────────────────┬─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Error        │    │ Registered   │    │ Error        │
│ History      │    │ Handlers     │    │ Listeners    │
└──────────────┘    └──────────────┘    └──────────────┘
```

### Error Monitor Data Flow

```
┌──────────────────┐
│ Service fails    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ eventBus.publish │
│ ("service:...")  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ ErrorMonitor     │
│ .logError()      │
└────────┬─────────┘
         │
         ├─────────────────────┬─────────────────────┐
         │                     │                     │
         ▼                     ▼                     ▼
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│ Error Log    │    │ Error Counts │    │ Retry Logic  │
│ (Map)        │    │ (Map)        │    │ (Strategies) │
└──────────────┘    └──────────────┘    └──────────────┘
```

---

## Configuration Storage

### Settings Hierarchy

```
chrome.storage.local
  └─ settings
      └─ settings
          └─ logging
              ├─ level: "INFO"
              ├─ persistErrors: false
              ├─ maxErrorAge: 604800000
              ├─ enableConsoleColors: true
              └─ enableTimestamps: true

config_app_settings (database)
  └─ category: "logging"
      ├─ key: "level"
      ├─ key: "persistErrors"
      └─ ...
```

### Sync Process

```
User changes setting
  ↓
SettingsManager.updateSettings()
  ├─→ Update chrome.storage.local (fast access)
  └─→ Update config_app_settings table (persistent)
       ↓
       Broadcast to all components
       ↓
       Logger.loadConfig() (reloads settings)
       ↓
       New log level takes effect immediately
```

---

## When to Use Which System

### Use Logger When:

- ✅ Debugging code flow
- ✅ Logging user actions
- ✅ Tracking performance
- ✅ Persisting errors for later review
- ✅ Development logging

**Example:**

```javascript
logger.info("User created collection");
logger.debug("Form data", formData);
logger.error("Failed to save", error, "saveCollection");
```

### Use Error Manager When:

- ✅ Throwing typed errors
- ✅ Need error-specific handling
- ✅ Error needs to propagate through event bus
- ✅ Multiple handlers for same error type

**Example:**

```javascript
throw new ValidationError("Invalid URL", { field: "url" });
throw new DatabaseError("Query failed", { query });
errorManager.registerHandler("validation", handleValidation);
```

### Use Error Monitor When:

- ✅ Service health tracking
- ✅ Need retry logic
- ✅ Error frequency analysis
- ✅ Implementing backoff strategies

**Example:**

```javascript
errorMonitor.retryWithStrategy("network", fetchData);
errorMonitor.checkServiceHealth("database");
const stats = errorMonitor.getErrorStats("sync");
```

---

## Migration Plan

### Phase 1: Logger Integration ✅

- ✅ Created logger.js
- ✅ Added to options.js
- ✅ Added handleLogError backend
- ✅ Added logging settings

### Phase 2: Component Migration

- [ ] Add logger to collections.js
- [ ] Add logger to runners.js
- [ ] Add logger to dashboard.js
- [ ] Add logger to popup.js

### Phase 3: Integration

- [ ] Logger calls Error Manager for typed errors
- [ ] Error Manager logs to Logger for persistence
- [ ] Error Monitor uses Logger for tracking

### Phase 4: UI

- [ ] Options → Advanced → Logging Settings
- [ ] Options → Advanced → View Error Log
- [ ] Real-time log level changes

---

## Best Practices

### 1. Combine Systems Effectively

```javascript
// Best practice: Use all three together
try {
  const result = await dbManager.query(sql);
  logger.debug("Query succeeded", { rows: result.length });
  return result;
} catch (error) {
  // 1. Log for debugging
  logger.error("Query failed", error, "executeQuery");

  // 2. Throw typed error for handling
  throw new DatabaseError("Query execution failed", {
    query: sql,
    error: error.message,
  });
}

// Handler
errorManager.registerHandler("database", async (error) => {
  // 3. Track for monitoring
  errorMonitor.logError("database", error);

  // 4. Notify user
  showNotification("Database error", "error");

  // 5. Attempt recovery
  if (errorMonitor.shouldRetry("database")) {
    await errorMonitor.retryOperation(() => reconnectDatabase());
  }
});
```

### 2. Don't Duplicate Logging

```javascript
// ❌ Bad - Logs twice
logger.error("Failed", error);
console.error("Failed", error); // Duplicate!

// ✅ Good - Log once with logger
logger.error("Failed", error, "methodName");
```

### 3. Use Appropriate Log Levels

```javascript
logger.debug("Variable value", { data }); // Development only
logger.info("User action performed"); // Normal operations
logger.warn("Deprecated feature used"); // Potential issues
logger.error("Operation failed", error); // Actual errors
logger.success("Data saved successfully"); // User feedback
```

---

## Summary

**Three Systems, Three Purposes:**

| System            | Purpose                 | Output                 | Configuration     |
| ----------------- | ----------------------- | ---------------------- | ----------------- |
| **Logger**        | Console + DB logging    | Console, bronze_errors | settings.logging  |
| **Error Manager** | Typed errors + handlers | Event bus              | None (code-based) |
| **Error Monitor** | Health + retry logic    | Error tracking Map     | Retry strategies  |

**They complement each other:**

- Logger provides visibility (console + database)
- Error Manager provides structure (typed errors + handlers)
- Error Monitor provides resilience (retry + health tracking)

**User sees:**

- Console logs (color-coded, filterable)
- Notifications (from error handlers)
- Error log UI (future feature)
- Service health status (future feature)

**Developers see:**

- Complete error history in database
- Error patterns and frequency
- Service health metrics
- Retry success/failure rates
