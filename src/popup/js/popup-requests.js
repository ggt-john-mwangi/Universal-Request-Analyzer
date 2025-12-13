// Recent Requests List Functions
// Handle displaying and interacting with recent requests

import { runtime } from '../../background/compat/browser-compat.js';
import { truncateUrl, showNotification } from './popup-utils.js';

/**
 * Load and display recent requests
 */
export async function loadRecentRequests() {
  try {
    const response = await runtime.sendMessage({
      action: 'getRecentRequests',
      data: { limit: 10 }
    });

    if (response && response.success && response.requests) {
      displayRequestsList(response.requests);
    } else {
      showEmptyRequestsState();
    }
  } catch (error) {
    console.error('Error loading recent requests:', error);
    showEmptyRequestsState();
  }
}

/**
 * Display list of requests
 * @param {Array} requests - Array of request objects
 */
function displayRequestsList(requests) {
  const listContainer = document.getElementById('recentRequestsList');
  
  if (!listContainer) return;

  if (!requests || requests.length === 0) {
    showEmptyRequestsState();
    return;
  }

  // Clear placeholder
  listContainer.innerHTML = '';

  requests.forEach(request => {
    const requestItem = createRequestItem(request);
    listContainer.appendChild(requestItem);
  });
}

/**
 * Create a request item element
 * @param {Object} request - Request object
 * @returns {HTMLElement} Request item element
 */
function createRequestItem(request) {
  const item = document.createElement('div');
  item.className = 'request-item';
  item.dataset.requestId = request.id;

  // Status badge
  const status = document.createElement('span');
  status.className = `request-status ${getStatusClass(request.status)}`;
  status.textContent = request.status || '---';

  // Method badge
  const method = document.createElement('span');
  method.className = `request-method ${request.method?.toLowerCase() || 'get'}`;
  method.textContent = request.method || 'GET';

  // URL
  const url = document.createElement('span');
  url.className = 'request-url';
  url.textContent = truncateUrl(request.url, 40);
  url.title = request.url;

  // Duration
  const time = document.createElement('span');
  time.className = 'request-time';
  time.textContent = request.duration ? `${Math.round(request.duration)}ms` : '---';

  // Actions
  const actions = document.createElement('div');
  actions.className = 'request-actions';

  // Copy as cURL button
  const curlBtn = document.createElement('button');
  curlBtn.className = 'request-action-btn';
  curlBtn.innerHTML = '<i class="fas fa-terminal"></i>';
  curlBtn.title = 'Copy as cURL';
  curlBtn.onclick = (e) => {
    e.stopPropagation();
    copyAsCurl(request);
    curlBtn.classList.add('copied');
    setTimeout(() => curlBtn.classList.remove('copied'), 1500);
  };

  // Copy as Fetch button
  const fetchBtn = document.createElement('button');
  fetchBtn.className = 'request-action-btn';
  fetchBtn.innerHTML = '<i class="fas fa-code"></i>';
  fetchBtn.title = 'Copy as Fetch';
  fetchBtn.onclick = (e) => {
    e.stopPropagation();
    copyAsFetch(request);
    fetchBtn.classList.add('copied');
    setTimeout(() => fetchBtn.classList.remove('copied'), 1500);
  };

  // View details button
  const detailsBtn = document.createElement('button');
  detailsBtn.className = 'request-action-btn';
  detailsBtn.innerHTML = '<i class="fas fa-eye"></i>';
  detailsBtn.title = 'View details';
  detailsBtn.onclick = (e) => {
    e.stopPropagation();
    openDevToolsForRequest(request);
  };

  actions.appendChild(curlBtn);
  actions.appendChild(fetchBtn);
  actions.appendChild(detailsBtn);

  // Assemble item
  item.appendChild(status);
  item.appendChild(method);
  item.appendChild(url);
  item.appendChild(time);
  item.appendChild(actions);

  return item;
}

/**
 * Get status class based on status code
 * @param {number} statusCode - HTTP status code
 * @returns {string} CSS class name
 */
function getStatusClass(statusCode) {
  if (!statusCode) return '';
  if (statusCode >= 200 && statusCode < 300) return 'success';
  if (statusCode >= 300 && statusCode < 400) return 'redirect';
  if (statusCode >= 400 && statusCode < 500) return 'client-error';
  if (statusCode >= 500) return 'server-error';
  return '';
}

/**
 * Copy request as cURL command
 * @param {Object} request - Request object
 */
async function copyAsCurl(request) {
  const curlCommand = generateCurlCommand(request);
  
  try {
    await navigator.clipboard.writeText(curlCommand);
    showNotification('Copied as cURL!', false);
  } catch (error) {
    console.error('Failed to copy:', error);
    showNotification('Failed to copy to clipboard', true);
  }
}

/**
 * Generate cURL command from request
 * @param {Object} request - Request object
 * @returns {string} cURL command
 */
function generateCurlCommand(request) {
  let curl = `curl '${request.url}'`;

  // Add method if not GET
  if (request.method && request.method !== 'GET') {
    curl += ` -X ${request.method}`;
  }

  // Add headers
  if (request.headers) {
    for (const [name, value] of Object.entries(request.headers)) {
      // Skip some common headers
      if (!['host', 'connection', 'content-length'].includes(name.toLowerCase())) {
        curl += ` \\\n  -H '${name}: ${value}'`;
      }
    }
  }

  // Add request body
  if (request.body) {
    const body = typeof request.body === 'string' 
      ? request.body 
      : JSON.stringify(request.body);
    curl += ` \\\n  --data '${body}'`;
  }

  return curl;
}

/**
 * Copy request as Fetch API call
 * @param {Object} request - Request object
 */
async function copyAsFetch(request) {
  const fetchCode = generateFetchCode(request);
  
  try {
    await navigator.clipboard.writeText(fetchCode);
    showNotification('Copied as Fetch!', false);
  } catch (error) {
    console.error('Failed to copy:', error);
    showNotification('Failed to copy to clipboard', true);
  }
}

/**
 * Generate Fetch API code from request
 * @param {Object} request - Request object
 * @returns {string} Fetch code
 */
function generateFetchCode(request) {
  const options = {
    method: request.method || 'GET'
  };

  // Add headers
  if (request.headers) {
    options.headers = {};
    for (const [name, value] of Object.entries(request.headers)) {
      // Skip some headers that fetch sets automatically
      if (!['host', 'connection', 'content-length', 'user-agent'].includes(name.toLowerCase())) {
        options.headers[name] = value;
      }
    }
  }

  // Add body
  if (request.body && request.method !== 'GET' && request.method !== 'HEAD') {
    options.body = typeof request.body === 'string' 
      ? request.body 
      : JSON.stringify(request.body);
  }

  return `fetch('${request.url}', ${JSON.stringify(options, null, 2)})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));`;
}

/**
 * Open DevTools panel focused on specific request
 * @param {Object} request - Request object
 */
function openDevToolsForRequest(request) {
  // Send message to open DevTools panel
  // Note: chrome.devtools API is only available in DevTools context, not popup
  runtime.sendMessage({
    action: 'openDevTools',
    data: { requestId: request.id }
  });
  
  showNotification('Opening in DevTools panel...', false);
}

/**
 * Show empty state when no requests
 */
function showEmptyRequestsState() {
  const listContainer = document.getElementById('recentRequestsList');
  if (listContainer) {
    listContainer.innerHTML = '<p class="placeholder">No requests captured yet. Browse a website to see requests here.</p>';
  }
}

/**
 * Clear the requests list
 */
export function clearRequestsList() {
  const listContainer = document.getElementById('recentRequestsList');
  if (listContainer) {
    listContainer.innerHTML = '<p class="placeholder">List cleared. New requests will appear here.</p>';
  }
  showNotification('Request list cleared', false);
}
