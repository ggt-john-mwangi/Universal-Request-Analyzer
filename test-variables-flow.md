# Variables Flow Test Plan

## Current State After Fixes

### Fixed Components:

1. ✅ `settings-manager.js` - Added `getSettings()` method (line 459-463)
2. ✅ `popup-message-handler.js` - Added `handleGetSettings()` handler (line 1112-1129)
3. ✅ Browser-compat integration in background.js
4. ✅ Singleton pattern to prevent multiple service workers

### Data Flow:

```
UI Click "cURL/Fetch"
  ↓
dashboard.js → generateCurlCommand() / generateFetchCommand()
  ↓
populateVariablesDropdown("curl" | "fetch")
  ↓
chrome.runtime.sendMessage({action: "getSettings"})
  ↓
background.js → handleAllMessages() → case "getSettings"
  ↓
popup-message-handler.js → handleGetSettings()
  ↓
settingsManager.getSettings()
  ↓
Returns: {success: true, settings: {..., variables: {list: [...]}}}
  ↓
UI populates select with options
```

## Testing Steps

### Step 1: Verify Variables Exist

1. Open extension options page
2. Go to Variables tab
3. Check if any variables are listed
4. If empty, create a test variable:
   - Name: `API_TOKEN`
   - Value: `test-123`
   - Description: `Test variable`

### Step 2: Check Browser Console

1. Open Dashboard tab
2. Open DevTools Console
3. Select a request from the table
4. Click "cURL" or "Fetch" button
5. Check console for these logs:

**Expected in Console:**

```
[Variables Dropdown] Populating curl variables dropdown...
[Variables Dropdown] Settings response for curl: {success: true, settings: {...}}
[Variables Dropdown] Found X variables: [...]
[Variables Dropdown] Select element (curlVariableSelect): <select>...
[Variables Dropdown] Added X options to curl dropdown
```

**If you see:**

```
[Variables Dropdown] Select element curlVariableSelect not found!
```

→ The select element doesn't exist in DOM (modal not loaded properly)

**If you see:**

```
Failed to get settings for variables
```

→ The getSettings handler returned an error

### Step 3: Check Background Console

1. Go to `chrome://extensions/`
2. Find "Universal Request Analyzer"
3. Click "service worker" link to open background console
4. Look for logs when opening cURL/Fetch modal:

**Expected:**

```
[Background] handleGetSettings() called
[Background] Settings retrieved: success
[Background] Variables in settings: X
```

### Step 4: Verify Select Element

When modal is open, in DevTools Elements tab:

1. Find `<div id="curlCommandModal">` or `<div id="fetchCommandModal">`
2. Look for `<select id="curlVariableSelect">` or `<select id="fetchVariableSelect">`
3. Check if options exist inside the select

### Step 5: Manual Test

1. Create a variable in Variables tab (if none exist)
2. Go to Dashboard
3. Select a request
4. Click "cURL" button
5. Look for the dropdown at the top-left of the textarea
6. The dropdown should show "Insert Variable..." with your variables listed

## Possible Issues & Solutions

### Issue 1: Select Element Not Found

**Symptom:** `[Variables Dropdown] Select element not found!`
**Cause:** Modal HTML not loaded yet or ID mismatch
**Solution:** Check if modal HTML contains the correct IDs:

- `curlVariableSelect` in options.html line 2736
- `fetchVariableSelect` in options.html line 2854

### Issue 2: Variables Not Created

**Symptom:** `[Variables Dropdown] Found 0 variables`
**Cause:** No variables exist in settings
**Solution:**

1. Go to Variables tab
2. Create at least one variable
3. Save it
4. Check console for: `[Variables] Saving variable: {...}`

### Issue 3: Settings Not Loading

**Symptom:** `Failed to get settings for variables`
**Cause:** getSettings handler not working
**Solution:**

1. Check background console for errors
2. Verify settingsManager is initialized
3. Check if getSettings() method exists in settings-manager.js

### Issue 4: Modal Hidden or Overlay

**Symptom:** Can't see the dropdown
**Cause:** Dropdown container has `display: none` or is hidden
**Solution:** Check CSS for:

- `#curlVariablesDropdown { display: none }` (should only be none when not in use)
- The dropdown should be visible when modal is open

## Debugging Commands

### Check if variables exist in storage:

```javascript
chrome.storage.local.get(["settings"], (data) => {
  console.log("Variables:", data.settings?.variables?.list);
});
```

### Check if getSettings returns data:

```javascript
chrome.runtime.sendMessage({ action: "getSettings" }, (response) => {
  console.log("Response:", response);
  console.log("Variables:", response?.settings?.variables?.list);
});
```

### Test populateVariablesDropdown directly:

```javascript
// In options page console
window.dashboardManager.populateVariablesDropdown("curl");
```

## Success Criteria

✅ Variables tab shows at least 1 variable
✅ Console shows: `Found X variables` (where X > 0)
✅ Select element found in DOM
✅ Dropdown populated with options
✅ Can select a variable from dropdown
✅ Variable inserted into textarea when selected

## Next Steps After Testing

If variables STILL empty after reload:

1. Share all console logs from both options page and background
2. Check chrome.storage.local for settings
3. Verify variables were saved correctly
4. Check if there are any JavaScript errors blocking execution
