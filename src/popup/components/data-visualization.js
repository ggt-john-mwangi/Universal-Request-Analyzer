"use client"

import { Chart } from "@/components/ui/chart"

// Data visualization component for displaying filtered data plots

import { useState, useEffect, useRef } from "react"
import { DataFilterPanel } from "./data-filter-panel"

// Main data visualization component
export function DataVisualization() {
  const [filters, setFilters] = useState({})
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [activeChart, setActiveChart] = useState("responseTime")

  // Chart references
  const responseTimeChartRef = useRef(null)
  const statusCodeChartRef = useRef(null)
  const requestTypeChartRef = useRef(null)
  const timeDistributionChartRef = useRef(null)
  const sizeDistributionChartRef = useRef(null)

  // Chart instances
  const chartInstances = useRef({})

  // Load data based on filters
  useEffect(() => {
    loadData()
  }, [filters])

  // Handle filter changes
  const handleFilterChange = (newFilters) => {
    setFilters(newFilters)
  }

  // Load data from background script
  const loadData = async () => {
    setLoading(true)
    setError(null)

    try {
      // Convert filters to database query format
      const queryFilters = {}

      if (filters.domain) {
        queryFilters.domain = filters.domain
      }

      if (filters.page) {
        queryFilters.pageUrl = filters.page
      }

      if (filters.api) {
        queryFilters.path = filters.api
      }

      if (filters.method) {
        queryFilters.method = filters.method
      }

      if (filters.statusCode) {
        // Handle status code ranges (2xx, 3xx, etc.)
        if (filters.statusCode.endsWith("xx")) {
          const statusPrefix = filters.statusCode.charAt(0)
          queryFilters.statusPrefix = statusPrefix
        } else {
          queryFilters.status = filters.statusCode
        }
      }

      if (filters.startDate) {
        queryFilters.startDate = new Date(filters.startDate).getTime()
      }

      if (filters.endDate) {
        // Set end date to end of day
        const endDate = new Date(filters.endDate)
        endDate.setHours(23, 59, 59, 999)
        queryFilters.endDate = endDate.getTime()
      }

      // Request data from background script
      if (typeof chrome !== "undefined" && chrome.runtime) {
        chrome.runtime.sendMessage({ action: "getFilteredStats", filters: queryFilters }, (response) => {
          if (response && !response.error) {
            setData(response)
            renderCharts(response)
          } else {
            setError(response?.error || "Failed to load data")
          }
          setLoading(false)
        })
      } else {
        setError("Chrome runtime is not available.")
        setLoading(false)
      }
    } catch (err) {
      setError("An error occurred while loading data")
      setLoading(false)
      console.error("Error loading data:", err)
    }
  }

  // Render charts based on data
  const renderCharts = (data) => {
    // Destroy existing charts
    Object.values(chartInstances.current).forEach((chart) => {
      if (chart) {
        chart.destroy()
      }
    })

    // Reset chart instances
    chartInstances.current = {}

    // Render response time distribution chart
    if (responseTimeChartRef.current) {
      const ctx = responseTimeChartRef.current.getContext("2d")

      // Define bins for response time (in ms)
      const bins = [
        { label: "0-100ms", min: 0, max: 100 },
        { label: "100-300ms", min: 100, max: 300 },
        { label: "300-500ms", min: 300, max: 500 },
        { label: "500ms-1s", min: 500, max: 1000 },
        { label: "1s-3s", min: 1000, max: 3000 },
        { label: "3s+", min: 3000, max: Number.POSITIVE_INFINITY },
      ]

      // Count requests in each bin
      const responseTimeCounts = bins.map((bin) => {
        return data.responseTimes.filter((time) => time >= bin.min && time < bin.max).length
      })

      chartInstances.current.responseTime = new Chart(ctx, {
        type: "bar",
        data: {
          labels: bins.map((bin) => bin.label),
          datasets: [
            {
              label: "Number of Requests",
              data: responseTimeCounts,
              backgroundColor: "rgba(54, 162, 235, 0.5)",
              borderColor: "rgba(54, 162, 235, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Response Time Distribution",
            },
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Requests",
              },
            },
            x: {
              title: {
                display: true,
                text: "Response Time",
              },
            },
          },
        },
      })
    }

    // Render status code distribution chart
    if (statusCodeChartRef.current) {
      const ctx = statusCodeChartRef.current.getContext("2d")

      // Group status codes by category
      const statusGroups = {
        "2xx": 0,
        "3xx": 0,
        "4xx": 0,
        "5xx": 0,
        Other: 0,
      }

      // Count status codes
      Object.entries(data.statusCodes).forEach(([code, count]) => {
        const codeNum = Number.parseInt(code, 10)
        if (codeNum >= 200 && codeNum < 300) statusGroups["2xx"] += count
        else if (codeNum >= 300 && codeNum < 400) statusGroups["3xx"] += count
        else if (codeNum >= 400 && codeNum < 500) statusGroups["4xx"] += count
        else if (codeNum >= 500 && codeNum < 600) statusGroups["5xx"] += count
        else statusGroups["Other"] += count
      })

      // Define colors for each category
      const colors = {
        "2xx": "rgba(75, 192, 192, 0.5)",
        "3xx": "rgba(255, 206, 86, 0.5)",
        "4xx": "rgba(255, 99, 132, 0.5)",
        "5xx": "rgba(153, 102, 255, 0.5)",
        Other: "rgba(201, 203, 207, 0.5)",
      }

      const borderColors = {
        "2xx": "rgba(75, 192, 192, 1)",
        "3xx": "rgba(255, 206, 86, 1)",
        "4xx": "rgba(255, 99, 132, 1)",
        "5xx": "rgba(153, 102, 255, 1)",
        Other: "rgba(201, 203, 207, 1)",
      }

      chartInstances.current.statusCode = new Chart(ctx, {
        type: "pie",
        data: {
          labels: Object.keys(statusGroups),
          datasets: [
            {
              data: Object.values(statusGroups),
              backgroundColor: Object.keys(statusGroups).map((key) => colors[key]),
              borderColor: Object.keys(statusGroups).map((key) => borderColors[key]),
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Status Code Distribution",
            },
            legend: {
              position: "right",
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || ""
                  const value = context.raw || 0
                  const total = context.dataset.data.reduce((a, b) => a + b, 0)
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0
                  return `${label}: ${value} (${percentage}%)`
                },
              },
            },
          },
        },
      })
    }

    // Render request type distribution chart
    if (requestTypeChartRef.current) {
      const ctx = requestTypeChartRef.current.getContext("2d")

      chartInstances.current.requestType = new Chart(ctx, {
        type: "doughnut",
        data: {
          labels: Object.keys(data.requestTypes),
          datasets: [
            {
              data: Object.values(data.requestTypes),
              backgroundColor: [
                "rgba(255, 99, 132, 0.5)",
                "rgba(54, 162, 235, 0.5)",
                "rgba(255, 206, 86, 0.5)",
                "rgba(75, 192, 192, 0.5)",
                "rgba(153, 102, 255, 0.5)",
                "rgba(255, 159, 64, 0.5)",
                "rgba(201, 203, 207, 0.5)",
              ],
              borderColor: [
                "rgba(255, 99, 132, 1)",
                "rgba(54, 162, 235, 1)",
                "rgba(255, 206, 86, 1)",
                "rgba(75, 192, 192, 1)",
                "rgba(153, 102, 255, 1)",
                "rgba(255, 159, 64, 1)",
                "rgba(201, 203, 207, 1)",
              ],
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Request Type Distribution",
            },
            legend: {
              position: "right",
            },
            tooltip: {
              callbacks: {
                label: (context) => {
                  const label = context.label || ""
                  const value = context.raw || 0
                  const total = context.dataset.data.reduce((a, b) => a + b, 0)
                  const percentage = total > 0 ? Math.round((value / total) * 100) : 0
                  return `${label}: ${value} (${percentage}%)`
                },
              },
            },
          },
        },
      })
    }

    // Render time distribution chart
    if (timeDistributionChartRef.current) {
      const ctx = timeDistributionChartRef.current.getContext("2d")

      // Create labels for each hour
      const labels = []
      for (let i = 0; i < 24; i++) {
        labels.push(`${i}:00`)
      }

      // Create data array
      const timeData = []
      for (let i = 0; i < 24; i++) {
        timeData.push(data.timeDistribution[i] || 0)
      }

      chartInstances.current.timeDistribution = new Chart(ctx, {
        type: "line",
        data: {
          labels: labels,
          datasets: [
            {
              label: "Number of Requests",
              data: timeData,
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              borderColor: "rgba(75, 192, 192, 1)",
              borderWidth: 2,
              fill: true,
              tension: 0.4,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Requests Over Time (Last 24 Hours)",
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Requests",
              },
            },
            x: {
              title: {
                display: true,
                text: "Time",
              },
            },
          },
        },
      })
    }

    // Render size distribution chart
    if (sizeDistributionChartRef.current) {
      const ctx = sizeDistributionChartRef.current.getContext("2d")

      // Define bins for size (in KB)
      const sizeBins = [
        { label: "0-10KB", min: 0, max: 10 * 1024 },
        { label: "10-50KB", min: 10 * 1024, max: 50 * 1024 },
        { label: "50-100KB", min: 50 * 1024, max: 100 * 1024 },
        { label: "100-500KB", min: 100 * 1024, max: 500 * 1024 },
        { label: "500KB-1MB", min: 500 * 1024, max: 1024 * 1024 },
        { label: "1MB+", min: 1024 * 1024, max: Number.POSITIVE_INFINITY },
      ]

      // Count requests in each bin
      const sizeCounts = sizeBins.map((bin) => {
        return data.sizes.filter((size) => size >= bin.min && size < bin.max).length
      })

      chartInstances.current.sizeDistribution = new Chart(ctx, {
        type: "bar",
        data: {
          labels: sizeBins.map((bin) => bin.label),
          datasets: [
            {
              label: "Number of Requests",
              data: sizeCounts,
              backgroundColor: "rgba(153, 102, 255, 0.5)",
              borderColor: "rgba(153, 102, 255, 1)",
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            title: {
              display: true,
              text: "Response Size Distribution",
            },
            legend: {
              display: false,
            },
          },
          scales: {
            y: {
              beginAtZero: true,
              title: {
                display: true,
                text: "Number of Requests",
              },
            },
            x: {
              title: {
                display: true,
                text: "Response Size",
              },
            },
          },
        },
      })
    }
  }

  // Switch between charts
  const switchChart = (chartType) => {
    setActiveChart(chartType)
  }

  return (
    <div className="data-visualization">
      <div className="visualization-container">
        <div className="filter-container">
          <DataFilterPanel onFilterChange={handleFilterChange} />
        </div>

        <div className="charts-container">
          <div className="chart-tabs">
            <button
              className={`chart-tab ${activeChart === "responseTime" ? "active" : ""}`}
              onClick={() => switchChart("responseTime")}
            >
              Response Time
            </button>
            <button
              className={`chart-tab ${activeChart === "statusCode" ? "active" : ""}`}
              onClick={() => switchChart("statusCode")}
            >
              Status Codes
            </button>
            <button
              className={`chart-tab ${activeChart === "requestType" ? "active" : ""}`}
              onClick={() => switchChart("requestType")}
            >
              Request Types
            </button>
            <button
              className={`chart-tab ${activeChart === "timeDistribution" ? "active" : ""}`}
              onClick={() => switchChart("timeDistribution")}
            >
              Time Distribution
            </button>
            <button
              className={`chart-tab ${activeChart === "sizeDistribution" ? "active" : ""}`}
              onClick={() => switchChart("sizeDistribution")}
            >
              Size Distribution
            </button>
          </div>

          <div className="chart-content">
            {loading && (
              <div className="loading-overlay">
                <div className="spinner"></div>
                <p>Loading data...</p>
              </div>
            )}

            {error && (
              <div className="error-message">
                <p>Error: {error}</p>
                <button onClick={loadData}>Retry</button>
              </div>
            )}

            <div className={`chart-panel ${activeChart === "responseTime" ? "active" : ""}`}>
              <canvas ref={responseTimeChartRef}></canvas>
            </div>

            <div className={`chart-panel ${activeChart === "statusCode" ? "active" : ""}`}>
              <canvas ref={statusCodeChartRef}></canvas>
            </div>

            <div className={`chart-panel ${activeChart === "requestType" ? "active" : ""}`}>
              <canvas ref={requestTypeChartRef}></canvas>
            </div>

            <div className={`chart-panel ${activeChart === "timeDistribution" ? "active" : ""}`}>
              <canvas ref={timeDistributionChartRef}></canvas>
            </div>

            <div className={`chart-panel ${activeChart === "sizeDistribution" ? "active" : ""}`}>
              <canvas ref={sizeDistributionChartRef}></canvas>
            </div>
          </div>

          {data && (
            <div className="stats-summary">
              <div className="stat-item">
                <span className="stat-label">Total Requests:</span>
                <span className="stat-value">{data.totalRequests}</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Avg. Response Time:</span>
                <span className="stat-value">{data.avgResponseTime} ms</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Success Rate:</span>
                <span className="stat-value">{data.successRate}%</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">Avg. Size:</span>
                <span className="stat-value">{formatBytes(data.avgSize)}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Format bytes to human-readable format
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes"

  const k = 1024
  const dm = decimals < 0 ? 0 : decimals
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"]

  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i]
}

