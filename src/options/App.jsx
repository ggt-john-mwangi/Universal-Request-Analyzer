"use client"

import { useState, useEffect } from "react"
import "./styles/App.css"

function App() {
  const [settings, setSettings] = useState({
    captureEnabled: true,
    maxStorageSize: 50,
    retentionDays: 30,
    encryptionEnabled: false,
    syncEnabled: false,
    theme: "system",
    notificationsEnabled: true,
  })

  const [status, setStatus] = useState("")
  const [loading, setLoading] = useState(true)

  // Load settings on mount
  useEffect(() => {
    const chrome = window.chrome
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
        if (response && response.config) {
          setSettings({
            captureEnabled: response.config.captureEnabled ?? true,
            maxStorageSize: response.config.maxStorageSize ?? 50,
            retentionDays: response.config.retentionDays ?? 30,
            encryptionEnabled: response.config.encryptionEnabled ?? false,
            syncEnabled: response.config.syncEnabled ?? false,
            theme: response.config.theme ?? "system",
            notificationsEnabled: response.config.notificationsEnabled ?? true,
          })
        }
        setLoading(false)
      })
    } else {
      setLoading(false)
    }
  }, [])

  // Handle settings change
  const handleChange = (e) => {
    const { name, value, type, checked } = e.target
    setSettings({
      ...settings,
      [name]: type === "checkbox" ? checked : value,
    })
  }

  // Save settings
  const saveSettings = () => {
    setStatus("Saving...")
    const chrome = window.chrome
    if (typeof chrome !== "undefined" && chrome.runtime) {
      chrome.runtime.sendMessage({ action: "updateConfig", config: settings }, (response) => {
        if (response && response.success) {
          setStatus("Settings saved successfully!")
          setTimeout(() => setStatus(""), 3000)
        } else {
          setStatus("Error saving settings: " + (response?.error || "Unknown error"))
        }
      })
    } else {
      setStatus("Error: Chrome runtime not available")
    }
  }

  // Reset settings to defaults
  const resetSettings = () => {
    setSettings({
      captureEnabled: true,
      maxStorageSize: 50,
      retentionDays: 30,
      encryptionEnabled: false,
      syncEnabled: false,
      theme: "system",
      notificationsEnabled: true,
    })
    setStatus("Settings reset to defaults. Click Save to apply.")
  }

  if (loading) {
    return (
      <div className="options-container">
        <div className="loading">Loading settings...</div>
      </div>
    )
  }

  return (
    <div className="options-container">
      <h1>Universal Request Analyzer Settings</h1>

      <div className="settings-section">
        <h2>General Settings</h2>

        <div className="setting-item">
          <label>
            <input type="checkbox" name="captureEnabled" checked={settings.captureEnabled} onChange={handleChange} />
            Enable Request Capture
          </label>
          <p className="setting-description">When enabled, the extension will capture and analyze network requests.</p>
        </div>

        <div className="setting-item">
          <label>
            Maximum Storage Size (MB):
            <input
              type="number"
              name="maxStorageSize"
              value={settings.maxStorageSize}
              onChange={handleChange}
              min="10"
              max="500"
            />
          </label>
          <p className="setting-description">
            Maximum amount of storage to use for request data. Older data will be deleted when this limit is reached.
          </p>
        </div>

        <div className="setting-item">
          <label>
            Data Retention (days):
            <input
              type="number"
              name="retentionDays"
              value={settings.retentionDays}
              onChange={handleChange}
              min="1"
              max="365"
            />
          </label>
          <p className="setting-description">Number of days to keep request data before automatically deleting it.</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Security & Privacy</h2>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              name="encryptionEnabled"
              checked={settings.encryptionEnabled}
              onChange={handleChange}
            />
            Enable Database Encryption
          </label>
          <p className="setting-description">When enabled, all stored request data will be encrypted.</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Sync & Backup</h2>

        <div className="setting-item">
          <label>
            <input type="checkbox" name="syncEnabled" checked={settings.syncEnabled} onChange={handleChange} />
            Enable Cloud Sync
          </label>
          <p className="setting-description">When enabled, your settings and data will be synced across devices.</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Appearance</h2>

        <div className="setting-item">
          <label>
            Theme:
            <select name="theme" value={settings.theme} onChange={handleChange}>
              <option value="system">System Default</option>
              <option value="light">Light</option>
              <option value="dark">Dark</option>
            </select>
          </label>
          <p className="setting-description">Choose the theme for the extension interface.</p>
        </div>
      </div>

      <div className="settings-section">
        <h2>Notifications</h2>

        <div className="setting-item">
          <label>
            <input
              type="checkbox"
              name="notificationsEnabled"
              checked={settings.notificationsEnabled}
              onChange={handleChange}
            />
            Enable Notifications
          </label>
          <p className="setting-description">
            When enabled, the extension will show notifications for important events.
          </p>
        </div>
      </div>

      <div className="settings-actions">
        <button onClick={saveSettings} className="save-btn">
          Save Settings
        </button>
        <button onClick={resetSettings} className="reset-btn">
          Reset to Defaults
        </button>
      </div>

      {status && <div className="status-message">{status}</div>}
    </div>
  )
}

export default App

