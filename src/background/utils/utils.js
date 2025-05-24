// Utility: send message to background and return promise via event-based response
export function sendMessage(message) {
  return new Promise((resolve, reject) => {
    if (typeof chrome !== "undefined" && chrome.runtime) {
      // Generate a unique requestId for this message
      const requestId = `msg_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      message.requestId = requestId;
      // Listen for the event-based response
      function handler(response) {
        if (response && response.requestId === requestId) {
          chrome.runtime.onMessage.removeListener(handler);
          if (response.success === false || response.error) {
            reject(response.error || new Error("Unknown error"));
          } else {
            resolve(response);
          }
        }
      }
      chrome.runtime.onMessage.addListener(handler);
      chrome.runtime.sendMessage(message);
    } else {
      reject(new Error("chrome.runtime not available"));
    }
  });
}

// Default configuration
// Unified default configuration merging both standard and local settings
export const defaultConfig = {
  // General user settings
  general: {
    maxStoredRequests: 10000,
    autoStartCapture: true,
    showNotifications: true,
    confirmClearRequests: true,
    defaultExportFormat: "json", // json, csv, sqlite
    dateFormat: "YYYY-MM-DD HH:mm:ss", // unified to local ISO-style
    timeZone: "local", // local, utc, or specific timezone
  },

  // Database configuration
  database: {
    autoSaveInterval: 60000, // 1 minute
    autoVacuum: true,
    vacuumInterval: 3600000, // 1 hour
    maxSize: 100 * 1024 * 1024, // 100 MB
  },

  // Capture configuration
  capture: {
    enabled: true,
    maxStoredRequests: 10000,
    captureHeaders: true,
    includeTiming: true,
    includeContent: false,
    maxContentSize: 1024 * 1024,
    captureWebSockets: false,
    captureServerSentEvents: false,
    captureFilters: {
      includeDomains: [],
      excludeDomains: [],
      includeTypes: [
        "xmlhttprequest",
        "fetch",
        "script",
        "stylesheet",
        "image",
        "font",
        "other",
      ],
    },
  },

  // Security configuration
  security: {
    encryption: {
      enabled: false,
      algorithm: "aes-256-gcm",
    },
    auth: {
      required: false,
      sessionDuration: 86400000, // 24 hours
    },
  },

  // Sync configuration
  sync: {
    enabled: false,
    serverUrl: "",
    interval: 3600000, // 1 hour
    syncOnLogin: true,
    syncAfterRequests: 100,
    requireAuth: true,
    encryptData: true,
    includeHeaders: true,
    useCsrf: true,
  },

  // Notification configuration
  notifications: {
    enabled: true,
    notifyOnExport: true,
    notifyOnError: true,
    notifyOnAuth: true,
    notifyOnEncryption: true,
    notifyOnSync: true,
    autoClose: true,
    autoCloseTimeout: 5000, // 5 seconds
  },

  // UI / display configuration
  ui: {
    theme: "system", // system, light, dark
    accentColor: "#0066cc",
    fontSize: "medium", // small, medium, large
    defaultTab: "requests", // requests, stats, plots
    requestsPerPage: 50,
    expandedView: false,
    showStatusColors: true,
    showTimingBars: true,
    columnOrder: [
      "method",
      "domain",
      "path",
      "status",
      "type",
      "size",
      "duration",
      "time",
    ],
  },

  // Export configuration
  export: {
    defaultFormat: "json", // json, csv, sqlite
    includeHeaders: true,
    prettyPrint: true,
    autoExport: false,
    autoExportInterval: 86400000, // 24 hours
    autoExportFormat: "json",
    autoExportPath: "",
    enableSqliteExport: true, // Default to enabled
  },

  // Plot/Stats configuration
  plots: {
    enabled: true,
    types: [
      "responseTime",
      "statusCodes",
      "domains",
      "requestTypes",
      "timeDistribution",
    ],
  },

  // API configuration
  api: {
    enabled: false,
    requireAuth: true,
    allowedDomains: ["example.com"],
    rateLimiting: {
      enabled: true,
      maxRequests: 100,
      timeWindow: 3600000, // 1 hour
    },
  },

  // Advanced / debug settings
  advanced: {
    enableDebugMode: false,
    persistFilters: true,
    useCompression: false,
    backgroundMode: "default",
    syncInterval: 60, // seconds
    logErrorsToDatabase: true,
    logErrorsToConsole: true,
  },

  // Tracking
  lastExportTime: null,
};

// Default themes
export const DEFAULT_THEMES = {
  light: {
    id: "light",
    name: "Light",
    description: "Default light theme",
    colors: {
      background: "#ffffff",
      surface: "#f5f5f5",
      primary: "#0066cc",
      secondary: "#6c757d",
      accent: "#ff9800",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#17a2b8",
      success: "#28a745",
      text: {
        primary: "#212529",
        secondary: "#6c757d",
        disabled: "#adb5bd",
      },
      border: "#dee2e6",
      divider: "#e9ecef",
      shadow: "rgba(0, 0, 0, 0.1)",
    },
  },
  dark: {
    id: "dark",
    name: "Dark",
    description: "Default dark theme",
    colors: {
      background: "#212529",
      surface: "#343a40",
      primary: "#0d6efd",
      secondary: "#6c757d",
      accent: "#fd7e14",
      error: "#dc3545",
      warning: "#ffc107",
      info: "#0dcaf0",
      success: "#198754",
      text: {
        primary: "#f8f9fa",
        secondary: "#e9ecef",
        disabled: "#adb5bd",
      },
      border: "#495057",
      divider: "#6c757d",
      shadow: "rgba(0, 0, 0, 0.5)",
    },
  },
  highContrast: {
    id: "highContrast",
    name: "High Contrast",
    description: "High contrast theme for accessibility",
    colors: {
      background: "#000000",
      surface: "#121212",
      primary: "#ffffff",
      secondary: "#cccccc",
      accent: "#ffff00",
      error: "#ff0000",
      warning: "#ffff00",
      info: "#00ffff",
      success: "#00ff00",
      text: {
        primary: "#ffffff",
        secondary: "#eeeeee",
        disabled: "#aaaaaa",
      },
      border: "#ffffff",
      divider: "#ffffff",
      shadow: "rgba(255, 255, 255, 0.5)",
    },
  },
  blue: {
    id: "blue",
    name: "Blue",
    description: "Blue-focused theme",
    colors: {
      background: "#f0f8ff",
      surface: "#e6f2ff",
      primary: "#0066cc",
      secondary: "#4d94ff",
      accent: "#00ccff",
      error: "#cc0000",
      warning: "#ff9900",
      info: "#0099cc",
      success: "#009933",
      text: {
        primary: "#003366",
        secondary: "#0066cc",
        disabled: "#99ccff",
      },
      border: "#99ccff",
      divider: "#cce6ff",
      shadow: "rgba(0, 102, 204, 0.2)",
    },
  },
};

// CSS variables map
export const CSS_VARIABLES = {
  background: "--background-color",
  surface: "--surface-color",
  primary: "--primary-color",
  secondary: "--secondary-color",
  accent: "--accent-color",
  error: "--error-color",
  warning: "--warning-color",
  info: "--info-color",
  success: "--success-color",
  "text.primary": "--text-primary-color",
  "text.secondary": "--text-secondary-color",
  "text.disabled": "--text-disabled-color",
  border: "--border-color",
  divider: "--divider-color",
  shadow: "--shadow-color",
};

// Default feature flags configuration
export const defaultFeatureFlags = {
  // Core features
  captureRequests: true,
  filterRequests: true,
  exportData: true,
  statistics: true,
  visualization: true,

  // Online features (disabled by default for local testing)
  onlineSync: false,
  authentication: false,
  remoteStorage: false,
  cloudExport: false,
  teamSharing: false,

  // Advanced features
  requestModification: false,
  requestMocking: false,
  automatedTesting: false,
  performanceAlerts: false,
  customRules: false,

  // Experimental features
  aiAnalysis: false,
  predictiveAnalytics: false,
  securityScanning: false,

  // Logging features
  logErrorsToDatabase: true, // Toggle logging errors to the internal database
  logErrorsToConsole: true, // Toggle logging errors to the browser console

  enableAdvancedSync: false, // Example: Toggle advanced sync features
  enableExperimentalUI: false, // Example: Toggle experimental UI elements
};

export const FEATURE_FLAGS = {
  logErrorsToDatabase: {
    name: "Log Errors to Database",
    description: "Enable logging of internal extension errors to the database.",
    defaultValue: true,
    category: "debugging",
  },
  logErrorsToConsole: {
    name: "Log Errors to Console",
    description:
      "Enable logging of internal extension errors to the browser console.",
    defaultValue: true,
    category: "debugging",
  },
};

export function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}
