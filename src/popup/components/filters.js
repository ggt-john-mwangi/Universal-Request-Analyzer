// Handle filter-related logic
const filters = {};

// Handle filter changes
export function handleFilterChange(newFilters, loadData) {
  Object.assign(filters, newFilters);
  loadData();
}

// Get query filters for database query
export function getQueryFilters(filters) {
  const queryFilters = {};

  if (filters.domain) {
    queryFilters.domain = filters.domain;
  }

  if (filters.page) {
    queryFilters.pageUrl = filters.page;
  }

  if (filters.api) {
    queryFilters.path = filters.api;
  }

  if (filters.method) {
    queryFilters.method = filters.method;
  }

  if (filters.statusCode) {
    if (filters.statusCode.endsWith("xx")) {
      const statusPrefix = filters.statusCode.charAt(0);
      queryFilters.statusPrefix = statusPrefix;
    } else {
      queryFilters.status = filters.statusCode;
    }
  }

  if (filters.startDate) {
    queryFilters.startDate = new Date(filters.startDate).getTime();
  }

  if (filters.endDate) {
    const endDate = new Date(filters.endDate);
    endDate.setHours(23, 59, 59, 999);
    queryFilters.endDate = endDate.getTime();
  }

  return queryFilters;
}
