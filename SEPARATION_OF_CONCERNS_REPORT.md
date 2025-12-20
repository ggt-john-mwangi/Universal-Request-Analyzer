# Separation of Concerns - Architecture Violations Report

**Date:** December 20, 2025  
**Status:** Critical Issues Found

---

## Executive Summary

The codebase has **significant architectural violations** where UI-related code is tightly coupled with background (service worker) code, causing runtime errors and initialization failures. The root issue is that `settings-manager.js` was designed as a "shared" module but imports UI-specific dependencies that cannot run in a service worker context.

---

## Critical Violation #1: settings-manager.js Imports UI Dependencies

**Location:** `src/lib/shared-components/settings-manager.js`

### The Problem

```javascript
// Lines 8-10
import featureFlags from "../../config/feature-flags.js";
import aclManager from "../../auth/acl-manager.js";
import themeManager from "../../config/theme-manager.js"; // ❌ UI DEPENDENCY
```

**Used by Background:**

- `src/background/messaging/popup-message-handler.js` (line 6)
- `src/background/background-medallion.js` (line 12)

**Why This Is Wrong:**

1. **settings-manager** is needed in service worker for configuration management
2. **theme-manager** requires `window`, `document`, `matchMedia` - none exist in service workers
3. Service worker tries to execute theme-manager constructor → crashes with "window is not defined"

### Why This Architecture Exists

Looking at `src/lib/README.md`, the library structure was designed for:

- **Core:** Data management
- **UI:** UI components
- **Managers:** Feature managers
- **Utils:** Utilities

**settings-manager** was placed in `shared-components/` with the assumption it would be "shared" between UI and background, but it imports UI-specific modules at the top level without conditional loading.

---

## Critical Violation #2: theme-manager.js Uses Browser DOM APIs

**Location:** `src/config/theme-manager.js`

### DOM API Usage

```javascript
// Line 133-145: Constructor runs immediately on import
window.matchMedia("(prefers-color-scheme: dark)")
  .addEventListener('change', ...)  // ❌ Service worker has no window

// Line 267: Direct DOM manipulation
document.documentElement  // ❌ Service worker has no document
document.body.classList.remove(...)  // ❌ Service worker has no document
document.body.setAttribute(...)  // ❌ Service worker has no document

// Line 204, 228: Uses localStorage
localStorage.getItem("themeData")  // ❌ Service worker has no localStorage
localStorage.setItem("themeData", ...)  // ❌ Service worker has no localStorage
```

**Why This Exists:**

- Theme management is inherently a UI concern
- Should **never** have been made available to background scripts
- Was included in settings-manager for convenience of "one manager to rule them all"

---

## Critical Violation #3: feature-flags.js Uses localStorage

**Location:** `src/config/feature-flags.js`

### Browser API Usage

```javascript
// Lines 143-158: Falls back to localStorage when chrome.storage unavailable
localStorage.getItem(keys); // ❌ Service worker has no localStorage
localStorage.setItem(key, JSON.stringify(value)); // ❌ Service worker has no localStorage
```

**Why This Exists:**

- Originally designed to work in "testing mode" outside extension context
- Mock implementation assumes browser environment
- Service worker context has neither `chrome.storage` nor `localStorage` during certain init phases

---

## Critical Violation #4: acl-manager.js Uses localStorage

**Location:** `src/auth/acl-manager.js`

### Browser API Usage

```javascript
// Line 213: Mock data retrieval
localStorage.getItem('aclData')  // ❌ Service worker has no localStorage

// Line 239: Mock data storage
localStorage.setItem(...)  // ❌ Service worker has no localStorage
```

**Why This Exists:**

- Similar to feature-flags, has mock mode for testing
- ACL manager is imported by settings-manager (line 9)
- Assumes browser DOM environment

---

## Why These Violations Exist: Root Cause Analysis

### 1. **Monolithic "Settings Manager" Design**

**Intention:** Create one unified manager for all settings/config
**Reality:** Tried to serve two incompatible masters:

- Background scripts (need data persistence, no UI)
- UI scripts (need theme, display preferences, DOM manipulation)

### 2. **"Shared" Directory Misconception**

The `src/lib/shared-components/` directory name implies code that works everywhere, but:

- Contains UI-dependent modules (theme, ACL with localStorage)
- Mixed browser-only APIs with extension APIs
- No clear contract about what "shared" means

### 3. **Top-Level Imports (No Lazy Loading)**

```javascript
// settings-manager.js line 10
import themeManager from "../../config/theme-manager.js";
```

Imports execute immediately when module loads, even if theme functionality is never used in that context.

**Should be:**

- Lazy import when needed
- Conditional initialization
- Separate managers for different contexts

### 4. **Lack of Context Detection**

No consistent strategy for detecting execution context:

- Some files check `typeof window !== 'undefined'`
- Some check `typeof document !== 'undefined'`
- Some assume browser environment always available
- No centralized context detection utility

---

## Architecture Violations Summary Table

| Module               | Location                 | UI Dependencies                                                         | Used in Background                                   | Impact                                 |
| -------------------- | ------------------------ | ----------------------------------------------------------------------- | ---------------------------------------------------- | -------------------------------------- |
| **settings-manager** | `lib/shared-components/` | theme-manager, acl-manager (localStorage), feature-flags (localStorage) | ✅ Yes (popup-message-handler, background-medallion) | 🔴 Critical - Service worker crash     |
| **theme-manager**    | `config/`                | window.matchMedia, document.\*, localStorage                            | ❌ No (imported by settings-manager)                 | 🔴 Critical - Crashes on import        |
| **feature-flags**    | `config/`                | localStorage (fallback)                                                 | ❌ No (imported by settings-manager)                 | 🟡 Medium - May fail in certain states |
| **acl-manager**      | `auth/`                  | localStorage (mock mode)                                                | ❌ No (imported by settings-manager)                 | 🟡 Medium - May fail in mock mode      |

---

## Proper Architecture: What It Should Be

### Background Layer (Service Worker)

**Should contain:**

- Database operations
- Network request capture
- Data processing
- Message routing
- Core business logic

**Should NOT contain:**

- DOM manipulation
- Theme management
- UI state
- localStorage access

### UI Layer (Options/Popup/DevTools)

**Should contain:**

- Visual components
- Theme application
- User interactions
- Display logic

**Should NOT contain:**

- Database direct access
- Complex business logic
- Service worker concerns

### Shared Layer (True Shared)

**Should contain:**

- Data structures
- Pure utility functions
- Serialization/deserialization
- Constants
- Type definitions

**Should NOT contain:**

- Context-specific APIs (window, chrome.storage, etc.)
- Managers that need both UI and background features

---

## Why Settings Manager Needs Theme Manager

### Current Usage in settings-manager.js

1. **Line 198:** Initialize theme-manager during settings initialization
2. **Line 400:** Get current theme info for getAllSettings()
3. **Line 509:** setTheme() method to change theme
4. **Line 605:** Reset theme to defaults
5. **Line 641:** Export theme data
6. **Line 677:** Import/restore theme data

### The Real Question: Should It?

**NO.** Theme is a UI concern. Settings manager should:

- Store theme preference (string: "light", "dark", etc.)
- NOT apply themes
- NOT manage CSS
- NOT interact with DOM

**Correct Design:**

```
settings-manager (background)
  ↓ stores theme preference
chrome.storage.local { currentTheme: "dark" }
  ↓ UI reads preference
theme-manager (UI only)
  ↓ applies to DOM
document.body.classList.add('theme-dark')
```

---

## Why This Wasn't Caught Earlier

1. **Development in Browser Context:** During development, background.js may have been tested in environments where window/document were available

2. **Manifest V2 Legacy:** Background pages in MV2 had access to DOM. MV3 service workers do not.

3. **Gradual Feature Addition:** Theme manager was likely added later to settings-manager without considering service worker constraints

4. **No Context Isolation Tests:** No tests that verify modules work in isolated service worker environment

5. **"It Works On My Machine":** Worked in some browsers/conditions, failed in others (hence the intermittent Status Code 15 errors)

---

## Recommendations (No Code Changes - Planning Only)

### Immediate Fixes Needed

1. **Split settings-manager into two modules:**

   - `settings-manager-core.js` - Background-safe (no UI deps)
   - `settings-ui-coordinator.js` - UI-specific wrapper

2. **Remove theme-manager from settings-manager:**

   - Settings manager stores preference only
   - Theme manager is UI-layer only
   - UI calls theme-manager directly, not through settings

3. **Create context detection utility:**

   - `src/lib/utils/context-detector.js`
   - Export: `isServiceWorker()`, `isBrowserContext()`, `hasDOM()`
   - Use consistently across all modules

4. **Audit all `src/lib/` modules:**
   - Identify true "shared" (no context deps)
   - Move UI-specific to `src/lib/ui/`
   - Move background-specific to `src/background/utils/`

### Long-term Architecture

1. **Establish clear layers:**

   ```
   src/
   ├── background/       # Service worker only
   ├── ui/               # Browser context only
   │   ├── options/
   │   ├── popup/
   │   └── devtools/
   ├── lib/
   │   ├── shared/       # True shared (pure functions)
   │   ├── ui/           # UI utilities (document/window)
   │   └── background/   # Background utilities
   └── config/           # Configuration (no context deps)
   ```

2. **Message-based communication only:**

   - UI never imports background modules
   - Background never imports UI modules
   - All communication via chrome.runtime.sendMessage

3. **Dependency injection:**
   - Managers receive dependencies, don't import them
   - Makes testing easier
   - Makes context requirements explicit

---

## Current Workarounds Applied

The current code has these band-aid fixes:

1. **settings-manager.js:** Conditional theme initialization

   ```javascript
   if (typeof document !== "undefined") {
     await themeManager.initialize();
   }
   ```

2. **theme-manager.js:** Guard all DOM access

   ```javascript
   if (typeof window !== "undefined" && window.matchMedia) {
     // Use matchMedia
   }
   ```

3. **browser-compat.js:** Throw error if no browser API
   ```javascript
   if (!browserAPI) {
     throw new Error("No browser extension API available");
   }
   ```

**Why These Are Insufficient:**

- Increases code complexity
- Hard to test all paths
- Still executes unnecessary code in wrong contexts
- Doesn't fix fundamental architecture issue
- Creates technical debt

---

## Conclusion

**The separation of concerns is violated because settings-manager tried to be everything to everyone.** It's used in background scripts for data management, but imports theme-manager which is purely a UI concern. This creates a transitive dependency chain that pulls in DOM APIs into service worker context.

**The fix isn't more guards and checks - it's architectural refactoring to separate concerns properly at the module boundary level.**

The current "add typeof checks everywhere" approach is a temporary workaround, not a solution.
