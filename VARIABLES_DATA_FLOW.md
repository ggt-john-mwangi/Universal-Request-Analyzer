# Variables Data Flow - Complete Architecture

## Storage Architecture: DUAL PERSISTENCE (Storage + Database)

### Primary Storage Locations:

1. **chrome.storage.local** (Fast access, synced to content scripts)

   - Key: `settings.settings.variables.list`
   - Format: Array of variable objects
   - Purpose: Content script access, fast reads

2. **SQL.js Database** (Source of truth, persistence)
   - Table: `config_app_settings`
   - Key format: `variables.list` (serialized as JSON)
   - Purpose: Persistent storage, survives extension reloads

---

## Data Flow: CREATE Variable

### Step 1: User Creates Variable in UI

**File:** `src/options/js/variables-manager.js`
**Line:** ~259-277

```javascript
// User fills form and clicks Save
// saveVariable() is called
const variable = {
  name: nameInput.value,
  value: valueInput.value,
  description: descInput.value,
};

const result = await settingsManager.addVariable(variable);
```

### Step 2: Settings Manager Processes

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** 737-790

```javascript
async addVariable(variable) {
  // 1. Validate name
  if (!this.isValidVariableName(variable.name)) {
    throw new Error("Invalid variable name");
  }

  // 2. Check duplicates
  const existingIndex = this.settings.variables.list.findIndex(
    (v) => v.name === variable.name
  );

  // 3. Create variable object
  const newVariable = {
    id: `var_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
    name: variable.name,
    value: variable.value || "",
    description: variable.description || "",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };

  // 4. Add to in-memory settings
  this.settings.variables.list.push(newVariable);

  // 5. PERSIST TO STORAGE + DATABASE
  await this.saveToStorage();

  // 6. Notify other components
  await this.broadcastSettingsUpdate(this.settings);

  return true;
}
```

### Step 3: Save to Storage (Chrome Storage)

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** 295-315

```javascript
async saveToStorage() {
  // Save to chrome.storage.local
  await new Promise((resolve) => {
    browserAPI.storage.local.set(
      {
        settings: {
          settings: this.settings, // Contains variables.list
          timestamp: Date.now(),
        },
      },
      resolve
    );
  });

  // ALSO save to database (source of truth)
  await this.saveToDatabase();
}
```

### Step 4: Save to Database (SQL.js)

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** 320-347

```javascript
async saveToDatabase() {
  // Loop through settings categories
  for (const [category, values] of Object.entries(this.settings)) {
    if (typeof values === "object" && values !== null) {
      for (const [key, value] of Object.entries(values)) {
        const fullKey = `${category}.${key}`; // e.g., "variables.list"

        // Save to config_app_settings table
        await configSchemaManager.setAppSetting(fullKey, value, {
          category,
          description: `${category} setting: ${key}`,
        });
      }
    }
  }
}
```

### Step 5: Config Schema Manager Inserts into DB

**File:** `src/background/database/config-schema-manager.js`
**Line:** 83-110

```javascript
async setAppSetting(key, value, options = {}) {
  const dataType = this.getDataType(value); // "array"
  const serializedValue = this.serializeValue(value, dataType); // JSON.stringify

  // INSERT INTO config_app_settings table
  this.db.exec(`
    INSERT OR REPLACE INTO config_app_settings (
      key, value, data_type, category, description, is_encrypted,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [key, serializedValue, dataType, category, description, ...]);
}
```

**Database Record:**

```
key: "variables.list"
value: '[{"id":"var_123","name":"API_TOKEN","value":"abc"}]'
data_type: "array"
category: "variables"
```

---

## Data Flow: READ Variables in UI Modal

### Step 1: User Opens cURL/Fetch Modal

**File:** `src/options/components/dashboard.js`
**Line:** 1920-1950

```javascript
async generateCurlCommand(request) {
  // ... generate cURL command ...

  // Populate variables dropdown BEFORE showing modal
  await this.populateVariablesDropdown("curl");

  // Show modal
  const modal = document.getElementById("curlCommandModal");
  modal.style.display = "block";
}
```

### Step 2: Populate Variables Dropdown

**File:** `src/options/components/dashboard.js`
**Line:** 4910-4970

```javascript
async populateVariablesDropdown(type) {
  console.log(`[Variables Dropdown] Populating ${type} variables dropdown...`);

  // REQUEST variables from background
  const response = await chrome.runtime.sendMessage({
    action: "getSettings"
  });

  console.log(`[Variables Dropdown] Settings response:`, response);

  if (!response || !response.success) {
    console.warn("Failed to get settings for variables");
    return;
  }

  // Extract variables array
  const variables = response.settings?.variables?.list || [];
  console.log(`[Variables Dropdown] Found ${variables.length} variables`);

  // Get select element
  const selectId = type === "curl" ? "curlVariableSelect" : "fetchVariableSelect";
  const select = document.getElementById(selectId);

  if (!select) {
    console.warn(`Select element ${selectId} not found!`);
    return;
  }

  // Populate dropdown options
  select.innerHTML = '<option value="">Insert Variable...</option>';

  variables.forEach((variable) => {
    const option = document.createElement("option");
    option.value = variable.name;
    option.textContent = `\${${variable.name}}`;
    option.title = variable.description || variable.name;
    select.appendChild(option);
  });

  console.log(`[Variables Dropdown] Added ${variables.length} options`);
}
```

### Step 3: Background Handles getSettings Message

**File:** `src/background/messaging/popup-message-handler.js`
**Line:** 70 (case), 1112-1129 (handler)

```javascript
// Message router
case "getSettings":
  return await handleGetSettings();

// Handler function
async function handleGetSettings() {
  console.log("[Background] handleGetSettings() called");

  const settings = await settingsManager.getSettings();

  console.log("[Background] Settings retrieved:", settings ? "success" : "failed");
  console.log("[Background] Variables in settings:",
    settings?.variables?.list?.length || 0);

  return { success: true, settings };
}
```

### Step 4: Settings Manager Returns In-Memory Settings

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** 459-463

```javascript
getSettings() {
  return this.settings; // Returns the in-memory settings object
}
```

**Response Structure:**

```javascript
{
  success: true,
  settings: {
    capture: { ... },
    general: { ... },
    display: { ... },
    advanced: { ... },
    variables: {
      list: [
        {
          id: "var_1234567890_abc",
          name: "API_TOKEN",
          value: "my-secret-token",
          description: "Auth token for API",
          createdAt: 1703001234567,
          updatedAt: 1703001234567
        }
      ]
    }
  }
}
```

### Step 5: UI Populates Dropdown

**Back to:** `src/options/components/dashboard.js` (populateVariablesDropdown)

```javascript
// Receives response with variables
const variables = response.settings?.variables?.list || [];

// Creates <option> elements
variables.forEach((variable) => {
  const option = document.createElement("option");
  option.value = variable.name; // "API_TOKEN"
  option.textContent = `\${${variable.name}}`; // "${API_TOKEN}"
  select.appendChild(option);
});
```

**Rendered HTML:**

```html
<select id="curlVariableSelect">
  <option value="">Insert Variable...</option>
  <option value="API_TOKEN" title="Auth token for API">${API_TOKEN}</option>
  <option value="BASE_URL" title="API base URL">${BASE_URL}</option>
</select>
```

---

## Data Flow: LOAD Variables on Extension Startup

### Step 1: Background Initialization

**File:** `src/background/background.js`
**Line:** ~688-758 (safeInitialize)

```javascript
async function safeInitialize() {
  // ... other initialization ...

  // Settings manager automatically loads on construction
  const extensionInitializer = new ExtensionInitializer();
  await extensionInitializer.initialize();
}
```

### Step 2: Settings Manager Constructor

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** ~130-160

```javascript
constructor(options = {}) {
  this.settings = this.getDefaultSettings();

  // Initialize from storage
  this.initialize();
}

async initialize() {
  // 1. Try load from chrome.storage.local (fast)
  const data = await this.loadFromStorage();

  if (data) {
    this.settings = this.mergeSettings(this.settings, data.settings);
  } else {
    // 2. Fallback to database (persistent)
    const dbSettings = await this.loadFromDatabase();
    if (dbSettings) {
      this.settings = this.mergeSettings(this.settings, dbSettings);

      // Sync to storage for next time
      await this.saveToStorage();
    }
  }
}
```

### Step 3: Load from Storage

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** 223-233

```javascript
async loadFromStorage() {
  return new Promise((resolve) => {
    browserAPI.storage.local.get("settings", (data) => {
      resolve(data.settings || null);
      // Returns: { settings: {..., variables: {list: [...]}}, timestamp: ... }
    });
  });
}
```

### Step 4: Load from Database (if storage empty)

**File:** `src/lib/shared-components/settings-manager.js`
**Line:** 238-290

```javascript
async loadFromDatabase() {
  const settings = {
    capture: {},
    general: {},
    variables: { list: [] }, // Default structure
    // ... other categories
  };

  // Load each category from config_app_settings table
  const variablesSettings = await configSchemaManager.getSettingsByCategory("variables");

  if (variablesSettings && Object.keys(variablesSettings).length > 0) {
    settings.variables = variablesSettings; // Contains "list" key
  }

  return settings;
}
```

---

## Key Storage Points

### Variables are Stored In:

1. ✅ **Chrome Storage** (`chrome.storage.local`):

   - Path: `settings.settings.variables.list`
   - Array of variable objects
   - Fast access, survives browser restart
   - Synced to content scripts automatically

2. ✅ **SQL.js Database** (`config_app_settings` table):
   - Key: `variables.list`
   - Value: Serialized JSON array
   - Source of truth, persists across extension updates
   - Survives extension reload/disable

### Variables are NOT Stored In:

- ❌ Gold/Silver/Bronze tables (those are for request data)
- ❌ Browser sync storage (too large for sync)
- ❌ IndexedDB (we use SQL.js + OPFS)

---

## Why Variables Might Be Empty

### Possible Issues:

1. **No variables created yet**

   - Go to Options → Variables tab → Add variable
   - Check: `chrome.storage.local.get('settings', console.log)`

2. **getSettings() method didn't exist (FIXED)**

   - Was causing "Unknown action" error
   - Now exists in settings-manager.js line 459-463

3. **handleGetSettings() handler missing (FIXED)**

   - Was not registered in message handler
   - Now registered at popup-message-handler.js line 70

4. **Select element not found**

   - Check HTML has `id="curlVariableSelect"` (line 2736)
   - Check HTML has `id="fetchVariableSelect"` (line 2854)

5. **Modal not shown yet**
   - populateVariablesDropdown is called BEFORE modal.style.display = "block"
   - So timing is correct

---

## Testing Variables Flow

### 1. Create a Variable:

```javascript
// In options page console
await window.settingsManager.addVariable({
  name: "TEST_VAR",
  value: "test-value",
  description: "Test variable",
});
```

### 2. Check Storage:

```javascript
chrome.storage.local.get("settings", (data) => {
  console.log(
    "Variables in storage:",
    data.settings?.settings?.variables?.list
  );
});
```

### 3. Check Background:

```javascript
// In service worker console
chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
  console.log(
    "Variables from getSettings:",
    response?.settings?.variables?.list
  );
});
```

### 4. Check UI:

```javascript
// In options page console, after opening cURL modal
const select = document.getElementById("curlVariableSelect");
console.log(
  "Dropdown options:",
  Array.from(select.options).map((o) => o.textContent)
);
```

---

## Summary

**Storage:** Dual persistence (Chrome Storage + SQL.js Database)
**Write:** addVariable → saveToStorage → chrome.storage.local.set + saveToDatabase
**Read:** getSettings → returns in-memory settings.variables.list
**Display:** chrome.runtime.sendMessage("getSettings") → populate select options
**HTML:** Select elements exist at curlVariableSelect / fetchVariableSelect

**All components are now properly connected and logging is in place to debug any remaining issues.**
