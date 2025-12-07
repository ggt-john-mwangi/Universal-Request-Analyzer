/**
 * DataManager - Base class for data management
 * Provides common CRUD operations and caching
 */
export class DataManager {
  constructor(storageKey, options = {}) {
    this.storageKey = storageKey;
    this.cache = new Map();
    this.options = {
      cacheTimeout: options.cacheTimeout || 5 * 60 * 1000, // 5 minutes
      maxCacheSize: options.maxCacheSize || 1000,
      enableCache: options.enableCache !== false
    };
  }

  /**
   * Get data from storage
   */
  async get(id) {
    // Check cache first
    if (this.options.enableCache) {
      const cached = this.getCached(id);
      if (cached) {
        return cached;
      }
    }

    // Fetch from storage
    const data = await this.fetchFromStorage(id);
    
    // Cache the result
    if (this.options.enableCache && data) {
      this.setCached(id, data);
    }

    return data;
  }

  /**
   * Get all data from storage
   */
  async getAll(filter = null) {
    const data = await this.fetchAllFromStorage();
    
    if (filter && typeof filter === 'function') {
      return data.filter(filter);
    }

    return data;
  }

  /**
   * Save data to storage
   */
  async save(id, data) {
    await this.saveToStorage(id, data);
    
    // Update cache
    if (this.options.enableCache) {
      this.setCached(id, data);
    }

    return true;
  }

  /**
   * Update data in storage
   */
  async update(id, updates) {
    const existing = await this.get(id);
    
    if (!existing) {
      throw new Error(`Data with id ${id} not found`);
    }

    const updated = { ...existing, ...updates };
    await this.save(id, updated);

    return updated;
  }

  /**
   * Delete data from storage
   */
  async delete(id) {
    await this.deleteFromStorage(id);
    
    // Remove from cache
    this.cache.delete(id);

    return true;
  }

  /**
   * Clear all data
   */
  async clear() {
    await this.clearStorage();
    this.clearCache();
    return true;
  }

  /**
   * Fetch from storage - override in subclasses
   */
  async fetchFromStorage(id) {
    throw new Error('fetchFromStorage must be implemented');
  }

  /**
   * Fetch all from storage - override in subclasses
   */
  async fetchAllFromStorage() {
    throw new Error('fetchAllFromStorage must be implemented');
  }

  /**
   * Save to storage - override in subclasses
   */
  async saveToStorage(id, data) {
    throw new Error('saveToStorage must be implemented');
  }

  /**
   * Delete from storage - override in subclasses
   */
  async deleteFromStorage(id) {
    throw new Error('deleteFromStorage must be implemented');
  }

  /**
   * Clear storage - override in subclasses
   */
  async clearStorage() {
    throw new Error('clearStorage must be implemented');
  }

  /**
   * Get from cache
   */
  getCached(id) {
    const cached = this.cache.get(id);
    
    if (!cached) {
      return null;
    }

    // Check if expired
    if (cached.expires < Date.now()) {
      this.cache.delete(id);
      return null;
    }

    return cached.data;
  }

  /**
   * Set in cache
   */
  setCached(id, data) {
    // Check cache size limit
    if (this.cache.size >= this.options.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    this.cache.set(id, {
      data,
      expires: Date.now() + this.options.cacheTimeout
    });
  }

  /**
   * Clear cache
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats() {
    return {
      size: this.cache.size,
      maxSize: this.options.maxCacheSize,
      utilization: (this.cache.size / this.options.maxCacheSize) * 100
    };
  }
}

/**
 * FilterManager - Manage data filtering
 */
export class FilterManager {
  constructor() {
    this.filters = new Map();
    this.activeFilters = new Set();
  }

  /**
   * Register a filter
   */
  registerFilter(name, filterFn, options = {}) {
    this.filters.set(name, {
      fn: filterFn,
      enabled: options.enabled !== false,
      priority: options.priority || 0
    });
  }

  /**
   * Enable filter
   */
  enableFilter(name) {
    const filter = this.filters.get(name);
    if (filter) {
      filter.enabled = true;
      this.activeFilters.add(name);
    }
  }

  /**
   * Disable filter
   */
  disableFilter(name) {
    const filter = this.filters.get(name);
    if (filter) {
      filter.enabled = false;
      this.activeFilters.delete(name);
    }
  }

  /**
   * Apply filters to data
   */
  applyFilters(data) {
    if (!Array.isArray(data)) {
      return data;
    }

    // Get active filters sorted by priority
    const activeFilters = Array.from(this.filters.entries())
      .filter(([name, filter]) => filter.enabled)
      .sort((a, b) => b[1].priority - a[1].priority);

    // Apply each filter
    let filtered = data;
    for (const [name, filter] of activeFilters) {
      filtered = filtered.filter(filter.fn);
    }

    return filtered;
  }

  /**
   * Clear all filters
   */
  clearFilters() {
    this.filters.forEach(filter => {
      filter.enabled = false;
    });
    this.activeFilters.clear();
  }

  /**
   * Get active filter names
   */
  getActiveFilters() {
    return Array.from(this.activeFilters);
  }
}

/**
 * SortManager - Manage data sorting
 */
export class SortManager {
  constructor() {
    this.sortKey = null;
    this.sortOrder = 'asc';
  }

  /**
   * Set sort configuration
   */
  setSort(key, order = 'asc') {
    this.sortKey = key;
    this.sortOrder = order;
  }

  /**
   * Toggle sort order
   */
  toggleSort(key) {
    if (this.sortKey === key) {
      this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortKey = key;
      this.sortOrder = 'asc';
    }
  }

  /**
   * Apply sort to data
   */
  applySort(data) {
    if (!Array.isArray(data) || !this.sortKey) {
      return data;
    }

    return [...data].sort((a, b) => {
      const aVal = this.getValue(a, this.sortKey);
      const bVal = this.getValue(b, this.sortKey);

      let comparison = 0;

      if (aVal < bVal) {
        comparison = -1;
      } else if (aVal > bVal) {
        comparison = 1;
      }

      return this.sortOrder === 'asc' ? comparison : -comparison;
    });
  }

  /**
   * Get value from object by key path
   */
  getValue(obj, path) {
    return path.split('.').reduce((current, key) => current?.[key], obj);
  }

  /**
   * Clear sort
   */
  clearSort() {
    this.sortKey = null;
    this.sortOrder = 'asc';
  }

  /**
   * Get current sort state
   */
  getSortState() {
    return {
      key: this.sortKey,
      order: this.sortOrder
    };
  }
}

/**
 * PaginationManager - Manage data pagination
 */
export class PaginationManager {
  constructor(pageSize = 50) {
    this.pageSize = pageSize;
    this.currentPage = 1;
    this.totalItems = 0;
  }

  /**
   * Set page size
   */
  setPageSize(size) {
    this.pageSize = size;
    this.currentPage = 1; // Reset to first page
  }

  /**
   * Set current page
   */
  setPage(page) {
    const maxPage = this.getTotalPages();
    this.currentPage = Math.max(1, Math.min(page, maxPage));
  }

  /**
   * Go to next page
   */
  nextPage() {
    this.setPage(this.currentPage + 1);
  }

  /**
   * Go to previous page
   */
  previousPage() {
    this.setPage(this.currentPage - 1);
  }

  /**
   * Get total pages
   */
  getTotalPages() {
    return Math.ceil(this.totalItems / this.pageSize);
  }

  /**
   * Apply pagination to data
   */
  applyPagination(data) {
    if (!Array.isArray(data)) {
      return data;
    }

    this.totalItems = data.length;

    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;

    return data.slice(start, end);
  }

  /**
   * Get pagination state
   */
  getPaginationState() {
    return {
      currentPage: this.currentPage,
      pageSize: this.pageSize,
      totalItems: this.totalItems,
      totalPages: this.getTotalPages(),
      hasNextPage: this.currentPage < this.getTotalPages(),
      hasPreviousPage: this.currentPage > 1
    };
  }

  /**
   * Reset pagination
   */
  reset() {
    this.currentPage = 1;
    this.totalItems = 0;
  }
}
