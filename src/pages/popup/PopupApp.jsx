"use client"

import { useState, useEffect } from "react"
import "./PopupApp.css"
import RequestsTab from "../../components/requests/RequestsTab"
import StatsTab from "../../components/stats/StatsTab"
import PlotsTab from "../../components/plots/PlotsTab"
import VisualizationTab from "../../components/visualization/VisualizationTab"
import Header from "../../components/common/Header"
import FilterPanel from "../../components/common/FilterPanel"
import ExportPanel from "../../components/common/ExportPanel"
import ConfigPanel from "../../components/common/ConfigPanel"
import RequestDetails from "../../components/requests/RequestDetails"

function PopupApp() {
  const [activeTab, setActiveTab] = useState("requests")
  const [filterPanelVisible, setFilterPanelVisible] = useState(false)
  const [exportPanelVisible, setExportPanelVisible] = useState(false)
  const [configPanelVisible, setConfigPanelVisible] = useState(false)
  const [requestDetailsVisible, setRequestDetailsVisible] = useState(false)
  const [selectedRequest, setSelectedRequest] = useState(null)
  const [config, setConfig] = useState({})

  // Load configuration on mount
  useEffect(() => {
    // Check if chrome is defined
    if (typeof window !== "undefined" && window.chrome && window.chrome.runtime) {
      window.chrome.runtime.sendMessage({ action: "getConfig" }, (response) => {
        if (response && response.config) {
          setConfig(response.config)
        }
      })
    } else {
      // Handle the case where chrome is not available (e.g., in a regular browser environment)
      console.warn("Chrome extension APIs not available.")
    }
  }, [])

  // Handle tab change
  const handleTabChange = (tabName) => {
    setActiveTab(tabName)
  }

  // Toggle panels
  const toggleFilterPanel = () => {
    setFilterPanelVisible(!filterPanelVisible)
    setExportPanelVisible(false)
    setConfigPanelVisible(false)
  }

  const toggleExportPanel = () => {
    setExportPanelVisible(!exportPanelVisible)
    setFilterPanelVisible(false)
    setConfigPanelVisible(false)
  }

  const toggleConfigPanel = () => {
    setConfigPanelVisible(!configPanelVisible)
    setFilterPanelVisible(false)
    setExportPanelVisible(false)
  }

  // Show request details
  const showRequestDetails = (request) => {
    setSelectedRequest(request)
    setRequestDetailsVisible(true)
  }

  // Hide request details
  const hideRequestDetails = () => {
    setRequestDetailsVisible(false)
  }

  // Update configuration
  const updateConfig = (newConfig) => {
    if (typeof window !== "undefined" && window.chrome && window.chrome.runtime) {
      window.chrome.runtime.sendMessage({ action: "updateConfig", config: newConfig }, (response) => {
        if (response && response.success) {
          setConfig(newConfig)
          setConfigPanelVisible(false)
        }
      })
    } else {
      // Handle the case where chrome is not available
      console.warn("Chrome extension APIs not available.")
    }
  }

  return (
    <div className="popup-container">
      <Header onFilterClick={toggleFilterPanel} onExportClick={toggleExportPanel} onConfigClick={toggleConfigPanel} />

      <div className="tabs">
        <button
          className={`tab-btn ${activeTab === "requests" ? "active" : ""}`}
          onClick={() => handleTabChange("requests")}
        >
          Requests
        </button>
        <button className={`tab-btn ${activeTab === "stats" ? "active" : ""}`} onClick={() => handleTabChange("stats")}>
          Statistics
        </button>
        <button className={`tab-btn ${activeTab === "plots" ? "active" : ""}`} onClick={() => handleTabChange("plots")}>
          Plots
        </button>
        <button
          className={`tab-btn ${activeTab === "visualization" ? "active" : ""}`}
          onClick={() => handleTabChange("visualization")}
        >
          Visualization
        </button>
      </div>

      {filterPanelVisible && <FilterPanel onClose={toggleFilterPanel} />}

      {exportPanelVisible && <ExportPanel onClose={toggleExportPanel} />}

      {configPanelVisible && <ConfigPanel config={config} onSave={updateConfig} onClose={toggleConfigPanel} />}

      <div className="tab-content">
        {activeTab === "requests" && <RequestsTab onRequestClick={showRequestDetails} />}

        {activeTab === "stats" && <StatsTab />}

        {activeTab === "plots" && <PlotsTab />}

        {activeTab === "visualization" && <VisualizationTab />}
      </div>

      {requestDetailsVisible && selectedRequest && (
        <RequestDetails request={selectedRequest} onClose={hideRequestDetails} />
      )}
    </div>
  )
}

export default PopupApp

