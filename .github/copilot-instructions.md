# GitHub Copilot Instructions for Universal Request Analyzer

## Project Context

This is a cross-browser extension (Chrome/Firefox/Edge) for capturing and analyzing HTTP requests using a medallion architecture (Bronze/Silver/Gold data layers) with SQL.js database.

## Required Reading

**ALWAYS consult these documents before suggesting code:**

1. **`/docs/COPILOT_ARCHITECTURE_GUIDE.md`** - Complete architecture reference (REQUIRED)
2. **`/docs/ARCHITECTURE.md`** - Overall system design
3. **`/docs/IMPLEMENTATION_PROGRESS.md`** - Current implementation status

## Critical Rules

### 1. Browser Compatibility

**ALWAYS use the browser-compat layer. Never use `chrome.*` directly.**

```javascript
// ✅ CORRECT
import { storage, runtime } from "../background/compat/browser-compat.js";
const data = await storage.get("key");

// ❌ WRONG
chrome.storage.local.get("key", callback);
```

### 2. Database Operations

**ALWAYS use inline SQL values with escaping. SQL.js does NOT support `?` placeholders.**

```javascript
// ✅ CORRECT
const escapeStr = (val) => {
  if (val === undefined || val === null) return "NULL";
  return `'${String(val).replace(/'/g, "''")}'`;
};
const query = `SELECT * FROM requests WHERE domain = ${escapeStr(domain)}`;

// ❌ WRONG
const query = `SELECT * FROM requests WHERE domain = ?`;
db.exec(query, [domain]); // params are IGNORED in SQL.js
```

### 3. Configuration Management

**ALWAYS use settings-manager for config. It syncs to both database and storage.**

```javascript
// ✅ CORRECT
import settingsManager from "../lib/shared-components/settings-manager.js";
await settingsManager.updateSettings({ capture: { enabled: true } });

// ❌ WRONG
chrome.storage.local.set({ capture: { enabled: true } });
```

### 4. Data Hierarchy

**Domain is extracted from PAGE URL, not request URL.**

```javascript
// ✅ CORRECT - Domain from page that made the request
domain = pageUrl.hostname; // e.g., 'github.com'
url = requestUrl; // e.g., 'https://api.github.com/user/repos'

// ❌ WRONG - Would group by API domain
domain = requestUrl.hostname; // Don't do this!
```

### 5. Theming

**ALWAYS use CSS variables. Never hardcode colors.**

```css
/* ✅ CORRECT */
.button {
  background: var(--primary-color);
  color: var(--text-primary);
  border: 1px solid var(--border-color);
}

/* ❌ WRONG */
.button {
  background: #007bff;
  color: #212529;
  border: 1px solid #dee2e6;
}
```

### 6. Message Passing

**Use chrome.runtime.sendMessage for UI ↔ Background communication.**

```javascript
// ✅ CORRECT
const response = await chrome.runtime.sendMessage({
  action: "getFilteredStats",
  filters: { domain: "github.com", timeRange: 300 },
});

if (response && response.success) {
  // Handle data
}
```

### 7. Content Scripts

**Content scripts read config from chrome.storage.local, set by settings-manager.**

```javascript
// ✅ CORRECT
const browserAPI = globalThis.browser || globalThis.chrome;
browserAPI.storage.local.get(["settings"], (data) => {
  const config = data.settings?.settings || {};
  const enabled = config.capture?.enabled;
});

// ❌ WRONG
import settingsManager from "..."; // Can't import background code in content script
```

## Project Structure

```
src/
├── background/           # Service worker (MV3)
│   ├── compat/          # Browser compatibility layer (USE THIS!)
│   ├── database/        # Medallion architecture (Bronze/Silver/Gold)
│   ├── capture/         # Request capture via webRequest API
│   ├── messaging/       # Event bus + message handlers
│   └── background-medallion.js  # Main entry point
├── content/             # Content scripts (injected into pages)
├── devtools/            # DevTools panel
├── popup/               # Extension popup
├── options/             # Settings page
├── lib/                 # Shared libraries
│   └── shared-components/  # settings-manager.js
└── config/              # theme-manager.js, feature-flags.js
```

## Medallion Architecture

**Bronze (Raw)** → **Silver (Cleaned)** → **Gold (Analytics)**

- `bronze_requests`: Raw captures with domain from PAGE URL
- `silver_requests`: Validated, deduplicated data
- `gold_domain_stats`: Pre-aggregated analytics
- `config_app_settings`: Application configuration (synced to storage)

## Common Patterns

### Query requests with hierarchy

```javascript
// Get all requests for a domain (domain = page's domain)
const response = await chrome.runtime.sendMessage({
  action: "getFilteredStats",
  filters: {
    domain: "github.com", // Page domain
    pageUrl: "github.com/repo", // Specific page (optional)
    timeRange: 300, // Last 5 minutes
  },
});
```

### Save settings

```javascript
import settingsManager from "../../lib/shared-components/settings-manager.js";

const newSettings = {
  capture: {
    enabled: true,
    captureFilters: {
      includeDomains: ["github.com", "api.github.com"],
      excludeDomains: ["chrome://*", "edge://*"],
    },
  },
};

const success = await settingsManager.updateSettings(newSettings);
```

### Database insert (Bronze layer)

```javascript
const requestData = {
  id: generateId(),
  url: "https://api.github.com/user/repos",
  method: "GET",
  domain: "github.com", // From page URL
  page_url: "https://github.com/user/repo",
  status: 200,
  duration: 234,
  timestamp: Date.now(),
};

await dbManager.medallion.insertBronzeRequest(requestData);
```

## File Naming Conventions

- **Components**: `kebab-case.js` (e.g., `request-capture.js`)
- **Classes**: `PascalCase` in code (e.g., `class RequestCapture`)
- **Managers**: `*-manager.js` (e.g., `settings-manager.js`)
- **Handlers**: `*-handler.js` (e.g., `message-handler.js`)

## Import Guidelines

1. Use relative paths: `'../background/compat/browser-compat.js'`
2. Import compat layer in background scripts
3. Use `globalThis.browser || globalThis.chrome` in content scripts
4. Never import background code in content scripts
5. Shared components go in `lib/shared-components/`

## Testing Requirements

Before suggesting code, verify it will work in:

- ✅ Chrome (Manifest V3)
- ✅ Firefox (Manifest V3)
- ✅ Edge (Chromium-based)

## When Suggesting Code

1. **Check** `/docs/COPILOT_ARCHITECTURE_GUIDE.md` for patterns
2. **Use** browser-compat layer for all browser APIs
3. **Escape** SQL values manually (no `?` placeholders)
4. **Extract** domain from PAGE URL, not request URL
5. **Use** CSS variables for all colors
6. **Import** from correct paths
7. **Test** mentally across browsers

## Error Patterns to Avoid

❌ Direct chrome API calls
❌ Parameterized SQL queries (`?` placeholders)
❌ Domain from request URL instead of page URL
❌ Hardcoded colors in CSS
❌ Importing background code in content scripts
❌ Direct storage manipulation (bypassing settings-manager)
❌ Missing browser-compat imports

## Reference Links

- Architecture: `/docs/COPILOT_ARCHITECTURE_GUIDE.md`
- Browser Compat: `/src/background/compat/browser-compat.js`
- Settings Manager: `/src/lib/shared-components/settings-manager.js`
- Theme Manager: `/src/config/theme-manager.js`
- Medallion Schema: `/src/background/database/medallion-schema.js`

---

**When in doubt, consult `/docs/COPILOT_ARCHITECTURE_GUIDE.md` first!**
