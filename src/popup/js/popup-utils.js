// Popup Utilities - Helper functions

/**
 * Format timestamp as "X ago"
 * @param {number} timestamp - Unix timestamp in milliseconds
 * @returns {string} - Formatted time string
 */
export function formatTimeAgo(timestamp) {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return `${seconds}s ago`;

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

/**
 * Truncate URL to max length
 * @param {string} url - URL to truncate
 * @param {number} maxLength - Maximum length
 * @returns {string} - Truncated URL
 */
export function truncateUrl(url, maxLength) {
  if (!url) return "";
  if (url.length <= maxLength) return url;

  try {
    const urlObj = new URL(url);
    const path = urlObj.pathname + urlObj.search;

    if (path.length > maxLength - 10) {
      return path.substring(0, maxLength - 13) + "...";
    }

    return path;
  } catch {
    // If URL parsing fails, just truncate
    return url.substring(0, maxLength - 3) + "...";
  }
}

/**
 * Show notification (simple implementation)
 * @param {string} message - Notification message
 * @param {boolean} isError - Whether this is an error notification
 */
export function showNotification(message, isError = false) {
  console.log(isError ? "Error:" : "Success:", message);
  // Could add a toast notification here in the future
}

/**
 * Format bytes to human-readable size
 * @param {number} bytes - Number of bytes
 * @returns {string} - Formatted size string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return "0KB";

  const kb = bytes / 1024;
  const mb = kb / 1024;
  const gb = mb / 1024;

  if (gb >= 1) {
    return `${gb.toFixed(2)}GB`;
  } else if (mb >= 1) {
    return `${mb.toFixed(2)}MB`;
  } else {
    return `${kb.toFixed(2)}KB`;
  }
}
