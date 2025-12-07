/**
 * Shared Library - Main Entry Point
 * Exports all shared modules for easy importing
 */

// UI Components
export { BaseComponent } from './ui/BaseComponent.js';
export { ChartManager, createChartManager } from './ui/ChartManager.js';
export { 
  NotificationManager, 
  createNotificationManager,
  getNotificationManager,
  showNotification,
  showSuccess,
  showError,
  showWarning,
  showInfo
} from './ui/NotificationManager.js';

// Core Classes
export { 
  DataManager,
  FilterManager,
  SortManager,
  PaginationManager
} from './core/DataManager.js';

// Managers
export { ExportManager, createExportManager } from './managers/ExportManager.js';

// Utilities
export * from './utils/helpers.js';
