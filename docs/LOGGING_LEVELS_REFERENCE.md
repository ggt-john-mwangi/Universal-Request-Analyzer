# Logging Levels Reference

## Quick Reference

| Log Level Setting | DEBUG | INFO | WARN | ERROR | SUCCESS |
| ----------------- | ----- | ---- | ---- | ----- | ------- |
| **DEBUG**         | ✅    | ✅   | ✅   | ✅    | ✅      |
| **INFO**          | ❌    | ✅   | ✅   | ✅    | ✅      |
| **WARN**          | ❌    | ❌   | ✅   | ✅    | ✅      |
| **ERROR**         | ❌    | ❌   | ❌   | ✅    | ✅      |

**Note:** SUCCESS always shows (user feedback), regardless of log level setting.

---

## Level Details

### DEBUG (Level 0)

**When to use:** Detailed debugging information for development

**Console:** ✅ Shows when level = DEBUG  
**Database:** ❌ Never persisted

**Example:**

```javascript
logger.debug("Form data", { name: "Collection 1", runners: [1, 2, 3] });
```

**Output:**

```
[2025-12-29T10:30:45.123Z] [Collections] [DEBUG] Form data { name: "Collection 1", ... }
```

---

### INFO (Level 1)

**When to use:** General informational messages, normal operations

**Console:** ✅ Shows when level = DEBUG or INFO  
**Database:** ❌ Never persisted

**Example:**

```javascript
logger.info("Loading collections from database");
```

**Output:**

```
[2025-12-29T10:30:45.123Z] [Collections] [INFO] Loading collections from database
```

---

### WARN (Level 2)

**When to use:** Warnings about potential issues (non-critical)

**Console:** ✅ Shows when level = DEBUG, INFO, or WARN  
**Database:** ❌ Never persisted

**Example:**

```javascript
logger.warn("Collection has no runners assigned");
```

**Output:**

```
[2025-12-29T10:30:45.123Z] [Collections] [WARN] Collection has no runners assigned
```

---

### ERROR (Level 3)

**When to use:** Actual errors, exceptions, failures

**Console:** ✅ Always shows  
**Database:** ✅ Persisted if `persistErrors: true` (OFF by default)

**Example:**

```javascript
try {
  await saveCollection(data);
} catch (error) {
  logger.error("Failed to save collection", error, "saveCollection");
}
```

**Output:**

```
[2025-12-29T10:30:45.123Z] [Collections] [ERROR] Failed to save collection Error: ...
```

**Database Record (when persistErrors: true):**

```sql
INSERT INTO bronze_errors (
  id, timestamp, message, stack, context, severity
) VALUES (
  'uuid-here',
  1735470645123,
  'Failed to save collection',
  'Error: ...\n  at saveCollection ...',
  'Collections.saveCollection',
  'error'
);
```

---

### SUCCESS (No Level)

**When to use:** User feedback for successful operations

**Console:** ✅ Always shows (regardless of log level)  
**Database:** ❌ Never persisted

**Example:**

```javascript
logger.success("Collection saved successfully");
```

**Output:**

```
[2025-12-29T10:30:45.123Z] [Collections] [SUCCESS] Collection saved successfully
```

---

## Database Persistence

### Default Behavior

```javascript
// Default settings
{
  logging: {
    level: "INFO",
    persistErrors: false // ⚠️ OFF by default
  }
}
```

**Result:** Errors show in console but NOT saved to database.

### Enable Database Persistence

**Method 1: Via Settings Manager**

```javascript
await settingsManager.updateSettings({
  logging: { persistErrors: true },
});
```

**Method 2: Via Options UI (Future)**

1. Open Options → Advanced → Logging
2. Check "Persist Errors to Database"
3. Save settings

**Method 3: Via Console**

```javascript
chrome.storage.local.get("settings", (data) => {
  data.settings.settings.logging.persistErrors = true;
  chrome.storage.local.set({ settings: data.settings });
});
```

### Why OFF by Default?

1. **Privacy** - Errors might contain sensitive data
2. **Storage** - Database grows over time
3. **Performance** - Fewer async operations
4. **Development** - Console is sufficient for debugging

**Enable when:**

- Production monitoring needed
- Long-term error analysis
- Tracking error patterns
- Remote debugging

---

## Usage Examples

### Example 1: Component Initialization

```javascript
import { createLogger } from "../../lib/utils/logger.js";
const logger = createLogger("Collections");

async function initCollections() {
  logger.info("Initializing collections component");

  try {
    const collections = await loadCollections();
    logger.debug("Loaded collections", { count: collections.length });
    logger.success("Collections loaded successfully");
    return collections;
  } catch (error) {
    logger.error("Failed to load collections", error, "initCollections");
    throw error;
  }
}
```

**Log Output (level: INFO):**

```
[2025-12-29...] [Collections] [INFO] Initializing collections component
[2025-12-29...] [Collections] [SUCCESS] Collections loaded successfully
```

**Log Output (level: DEBUG):**

```
[2025-12-29...] [Collections] [INFO] Initializing collections component
[2025-12-29...] [Collections] [DEBUG] Loaded collections { count: 5 }
[2025-12-29...] [Collections] [SUCCESS] Collections loaded successfully
```

### Example 2: Form Validation

```javascript
function validateCollection(data) {
  logger.debug("Validating collection", data);

  if (!data.name) {
    logger.warn("Collection name is empty");
    throw new ValidationError("Name is required");
  }

  if (!data.runners || data.runners.length === 0) {
    logger.warn("Collection has no runners", { name: data.name });
  }

  logger.info("Collection validated", { name: data.name });
}
```

### Example 3: Error Recovery

```javascript
async function saveWithRetry(data) {
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      attempts++;
      logger.debug(`Save attempt ${attempts}/${maxAttempts}`);

      const result = await save(data);
      logger.success("Saved successfully");
      return result;
    } catch (error) {
      if (attempts === maxAttempts) {
        logger.error("All save attempts failed", error, "saveWithRetry");
        throw error;
      }
      logger.warn(`Attempt ${attempts} failed, retrying...`);
      await sleep(1000 * attempts); // Exponential backoff
    }
  }
}
```

---

## Best Practices

### 1. Use Appropriate Levels

✅ **Good:**

```javascript
logger.debug("Request payload", payload); // Details
logger.info("Sending API request"); // Normal operation
logger.warn("API rate limit approaching"); // Potential issue
logger.error("API request failed", error); // Actual error
logger.success("Data synced successfully"); // User feedback
```

❌ **Bad:**

```javascript
logger.info("Request payload", payload); // Too verbose for INFO
logger.error("API rate limit approaching"); // Not an error yet
logger.debug("Data synced successfully"); // User should see this
```

### 2. Production vs Development

**Development:**

```javascript
// Show everything
await settingsManager.updateSettings({
  logging: {
    level: "DEBUG",
    persistErrors: true,
  },
});
```

**Production:**

```javascript
// Show only important logs
await settingsManager.updateSettings({
  logging: {
    level: "INFO",
    persistErrors: false, // Or true for monitoring
  },
});
```

### 3. Context in Errors

✅ **Good:**

```javascript
logger.error("Failed to save collection", error, "saveCollection");
// Context: "Collections.saveCollection"
```

❌ **Bad:**

```javascript
logger.error("Failed to save collection", error);
// Context: "Collections.unknown" - less helpful
```

### 4. Don't Log Sensitive Data

❌ **Bad:**

```javascript
logger.debug("User credentials", { username, password }); // Never!
logger.info("API key", apiKey); // Never!
```

✅ **Good:**

```javascript
logger.debug("User authenticated", { username });
logger.info("API key configured", { keyLength: apiKey.length });
```

---

## Troubleshooting

### Logs Not Appearing

**Check log level:**

```javascript
chrome.storage.local.get("settings", (data) => {
  const level = data.settings?.settings?.logging?.level;
  console.log("Current log level:", level);
});
```

**Expected behavior:**

- DEBUG shows everything
- INFO shows info, warn, error, success
- WARN shows warn, error, success
- ERROR shows error, success only

### Errors Not Persisting

**Check persistErrors setting:**

```javascript
chrome.storage.local.get("settings", (data) => {
  const persist = data.settings?.settings?.logging?.persistErrors;
  console.log("Persist errors:", persist); // Should be true
});
```

**Enable if false:**

```javascript
await settingsManager.updateSettings({
  logging: { persistErrors: true },
});
```

**Verify bronze_errors table:**

```javascript
const response = await chrome.runtime.sendMessage({
  action: "executeQuery",
  query: "SELECT * FROM bronze_errors ORDER BY timestamp DESC LIMIT 5",
});
console.table(response.results[0].values);
```

### Console Output Missing Colors

**Check colors enabled:**

```javascript
chrome.storage.local.get("settings", (data) => {
  const colors = data.settings?.settings?.logging?.enableConsoleColors;
  console.log("Colors enabled:", colors);
});
```

---

## Summary

| Feature            | Default     | Purpose                               |
| ------------------ | ----------- | ------------------------------------- |
| **Log Level**      | INFO        | Balance between verbosity and clarity |
| **Persist Errors** | false (OFF) | Privacy, storage, performance         |
| **Console Colors** | true        | Visual clarity in DevTools            |
| **Timestamps**     | true        | Track when logs occurred              |
| **Max Error Age**  | 7 days      | Auto-cleanup old errors               |

**Remember:**

- Only ERROR level persists to database (when enabled)
- SUCCESS always shows (user feedback)
- DEBUG for development details
- INFO for normal operations
- WARN for potential issues
- ERROR for actual failures

**Enable DB persistence only when needed:**

- Production monitoring
- Error pattern analysis
- Long-term tracking
- Remote debugging

For most development, console output is sufficient!
