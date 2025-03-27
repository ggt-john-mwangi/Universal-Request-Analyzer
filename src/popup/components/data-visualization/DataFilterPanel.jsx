"use client"

import { useState, useEffect } from "react"

// Filter panel for data visualization
export function DataFilterPanel({ onFilterChange, initialFilters = {} }) {
  const [filters, setFilters] = useState({
    domain: initialFilters.domain || "",
    page: initialFilters.page || "",
    api: initialFilters.api || "",
    method: initialFilters.method || "",
    startDate: initialFilters.startDate || "",
    endDate: initialFilters.endDate || "",
    statusCode: initialFilters.statusCode || "",
    ...initialFilters,
  })

  const [domains, setDomains] = useState([])
  const [pages, setPages] = useState([])
  const [apis, setApis] = useState([])

  // Load available filter options
  useEffect(() => {
    // Check if chrome is available (running in a browser extension context)
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Load domains
      chrome.runtime.sendMessage({ action: "getDistinctValues", field: "domain" }, (response) => {
        if (response && response.values) {
          setDomains(response.values)
        }
      })

      // Load pages
      chrome.runtime.sendMessage({ action: "getDistinctValues", field: "pageUrl" }, (response) => {
        if (response && response.values) {
          setPages(response.values)
        }
      })

      // Load APIs (paths that look like APIs)
      chrome.runtime.sendMessage({ action: "getApiPaths" }, (response) => {
        if (response && response.paths) {
          setApis(response.paths)
        }
      })
    } else {
      console.warn("Chrome runtime is not available. Running outside of extension context?")
    }
  }, [])

  // Handle filter changes
  const handleFilterChange = (field, value) => {
    const newFilters = { ...filters, [field]: value }
    setFilters(newFilters)

    // Notify parent component
    if (onFilterChange) {
      onFilterChange(newFilters)
    }
  }

  // Reset filters
  const handleReset = () => {
    const resetFilters = {
      domain: "",
      page: "",
      api: "",
      method: "",
      startDate: "",
      endDate: "",
      statusCode: "",
    }

    setFilters(resetFilters)

    // Notify parent component
    if (onFilterChange) {
      onFilterChange(resetFilters)
    }
  }

  return (
    <div className="data-filter-panel">
      <h3>Filter Data</h3>

      <div className="filter-row">
        <label htmlFor="domainFilter">Domain:</label>
        <select id="domainFilter" value={filters.domain} onChange={(e) => handleFilterChange("domain", e.target.value)}>
          <option value="">All Domains</option>
          {domains.map((domain, index) => (
            <option key={index} value={domain}>
              {domain}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-row">
        <label htmlFor="pageFilter">Page:</label>
        <select id="pageFilter" value={filters.page} onChange={(e) => handleFilterChange("page", e.target.value)}>
          <option value="">All Pages</option>
          {pages.map((page, index) => (
            <option key={index} value={page}>
              {page}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-row">
        <label htmlFor="apiFilter">API Endpoint:</label>
        <select id="apiFilter" value={filters.api} onChange={(e) => handleFilterChange("api", e.target.value)}>
          <option value="">All APIs</option>
          {apis.map((api, index) => (
            <option key={index} value={api}>
              {api}
            </option>
          ))}
        </select>
      </div>

      <div className="filter-row">
        <label htmlFor="methodFilter">Method:</label>
        <select id="methodFilter" value={filters.method} onChange={(e) => handleFilterChange("method", e.target.value)}>
          <option value="">All Methods</option>
          <option value="GET">GET</option>
          <option value="POST">POST</option>
          <option value="PUT">PUT</option>
          <option value="DELETE">DELETE</option>
          <option value="PATCH">PATCH</option>
          <option value="OPTIONS">OPTIONS</option>
          <option value="HEAD">HEAD</option>
        </select>
      </div>

      <div className="filter-row">
        <label htmlFor="statusCodeFilter">Status Code:</label>
        <select
          id="statusCodeFilter"
          value={filters.statusCode}
          onChange={(e) => handleFilterChange("statusCode", e.target.value)}
        >
          <option value="">All Status Codes</option>
          <option value="2xx">2xx (Success)</option>
          <option value="3xx">3xx (Redirection)</option>
          <option value="4xx">4xx (Client Error)</option>
          <option value="5xx">5xx (Server Error)</option>
        </select>
      </div>

      <div className="filter-row">
        <label htmlFor="startDateFilter">Date Range:</label>
        <div className="date-range">
          <input
            type="date"
            id="startDateFilter"
            value={filters.startDate}
            onChange={(e) => handleFilterChange("startDate", e.target.value)}
          />
          <span>to</span>
          <input
            type="date"
            id="endDateFilter"
            value={filters.endDate}
            onChange={(e) => handleFilterChange("endDate", e.target.value)}
          />
        </div>
      </div>

      <div className="filter-actions">
        <button onClick={handleReset} className="reset-btn">
          Reset Filters
        </button>
      </div>
    </div>
  )
}

