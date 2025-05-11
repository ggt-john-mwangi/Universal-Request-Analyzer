// Converted to Vanilla JS

// Data filter panel component for filtering visualization data

function DataFilterPanel({ onFilterChange, initialFilters = {} }) {
  const filters = {
    domain: initialFilters.domain || "",
    page: initialFilters.page || "",
    api: initialFilters.api || "",
    method: initialFilters.method || "",
    startDate: initialFilters.startDate || "",
    endDate: initialFilters.endDate || "",
    statusCode: initialFilters.statusCode || "",
    ...initialFilters,
  };

  const domains = [];
  const pages = [];
  const apis = [];

  // Load available filter options (event-based)
  if (typeof chrome !== "undefined" && chrome.runtime) {
    // Load domains
    const domainRequestId = `domain_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function domainHandler(message) {
      if (message && message.requestId === domainRequestId && message.values) {
        domains.push(...message.values);
        chrome.runtime.onMessage.removeListener(domainHandler);
      }
    }
    chrome.runtime.onMessage.addListener(domainHandler);
    chrome.runtime.sendMessage({ action: "getDistinctValues", field: "domain", requestId: domainRequestId });

    // Load pages
    const pageRequestId = `page_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function pageHandler(message) {
      if (message && message.requestId === pageRequestId && message.values) {
        pages.push(...message.values);
        chrome.runtime.onMessage.removeListener(pageHandler);
      }
    }
    chrome.runtime.onMessage.addListener(pageHandler);
    chrome.runtime.sendMessage({ action: "getDistinctValues", field: "pageUrl", requestId: pageRequestId });

    // Load APIs (paths that look like APIs)
    const apiRequestId = `api_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    function apiHandler(message) {
      if (message && message.requestId === apiRequestId && message.paths) {
        apis.push(...message.paths);
        chrome.runtime.onMessage.removeListener(apiHandler);
      }
    }
    chrome.runtime.onMessage.addListener(apiHandler);
    chrome.runtime.sendMessage({ action: "getApiPaths", requestId: apiRequestId });
  } else {
    console.warn("Chrome runtime is not available. Running outside of extension context?");
  }

  // Handle filter changes
  function handleFilterChange(field, value) {
    filters[field] = value;

    // Notify parent component
    if (onFilterChange) {
      onFilterChange(filters);
    }
  }

  // Reset filters
  function handleReset() {
    const resetFilters = {
      domain: "",
      page: "",
      api: "",
      method: "",
      startDate: "",
      endDate: "",
      statusCode: "",
    };

    Object.assign(filters, resetFilters);

    // Notify parent component
    if (onFilterChange) {
      onFilterChange(resetFilters);
    }
  }

  // Create DOM elements
  const container = document.createElement("div");
  container.className = "data-filter-panel";

  const title = document.createElement("h3");
  title.textContent = "Filter Data";
  container.appendChild(title);

  function createFilterRow(labelText, id, options, onChange) {
    const row = document.createElement("div");
    row.className = "filter-row";

    const label = document.createElement("label");
    label.htmlFor = id;
    label.textContent = labelText;
    row.appendChild(label);

    const select = document.createElement("select");
    select.id = id;
    select.addEventListener("change", (e) => onChange(e.target.value));

    const defaultOption = document.createElement("option");
    defaultOption.value = "";
    defaultOption.textContent = `All ${labelText}`;
    select.appendChild(defaultOption);

    options.forEach((option) => {
      const opt = document.createElement("option");
      opt.value = option;
      opt.textContent = option;
      select.appendChild(opt);
    });

    row.appendChild(select);
    return row;
  }

  container.appendChild(createFilterRow("Domain", "domainFilter", domains, (value) => handleFilterChange("domain", value)));
  container.appendChild(createFilterRow("Page", "pageFilter", pages, (value) => handleFilterChange("page", value)));
  container.appendChild(createFilterRow("API Endpoint", "apiFilter", apis, (value) => handleFilterChange("api", value)));

  // Method filter
  const methodRow = createFilterRow("Method", "methodFilter", ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"], (value) => handleFilterChange("method", value));
  container.appendChild(methodRow);

  // Status Code filter
  const statusCodeRow = createFilterRow("Status Code", "statusCodeFilter", ["2xx", "3xx", "4xx", "5xx"], (value) => handleFilterChange("statusCode", value));
  container.appendChild(statusCodeRow);

  // Date range filter
  const dateRow = document.createElement("div");
  dateRow.className = "filter-row";

  const dateLabel = document.createElement("label");
  dateLabel.htmlFor = "startDateFilter";
  dateLabel.textContent = "Date Range:";
  dateRow.appendChild(dateLabel);

  const startDate = document.createElement("input");
  startDate.type = "date";
  startDate.id = "startDateFilter";
  startDate.addEventListener("change", (e) => handleFilterChange("startDate", e.target.value));
  dateRow.appendChild(startDate);

  const toSpan = document.createElement("span");
  toSpan.textContent = "to";
  dateRow.appendChild(toSpan);

  const endDate = document.createElement("input");
  endDate.type = "date";
  endDate.id = "endDateFilter";
  endDate.addEventListener("change", (e) => handleFilterChange("endDate", e.target.value));
  dateRow.appendChild(endDate);

  container.appendChild(dateRow);

  // Reset button
  const resetButton = document.createElement("button");
  resetButton.className = "reset-btn";
  resetButton.textContent = "Reset Filters";
  resetButton.addEventListener("click", handleReset);
  container.appendChild(resetButton);

  return container;
}

// Export the function
export default DataFilterPanel;

