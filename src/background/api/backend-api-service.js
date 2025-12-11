// Backend API Service
// Provides REST API integration for login, data sync, team collaboration

/**
 * BackendApiService - Handles all backend REST API communications
 */
export class BackendApiService {
  constructor(config, eventBus) {
    this.config = config;
    this.eventBus = eventBus;
    this.baseUrl = config?.baseUrl || '';
    this.apiKey = config?.apiKey || '';
    this.token = null;
    this.refreshToken = null;
    this.isAuthenticated = false;
    this.userId = null;
    this.teamId = null;
  }

  /**
   * Initialize the service
   */
  async initialize() {
    // Load saved token from storage
    await this.loadAuthToken();
    
    // Setup request interceptor
    this.setupInterceptor();
    
    console.log('Backend API service initialized');
  }

  /**
   * Load authentication token from storage
   */
  async loadAuthToken() {
    try {
      const stored = await chrome.storage.local.get(['authToken', 'refreshToken', 'userId', 'teamId']);
      
      if (stored.authToken) {
        this.token = stored.authToken;
        this.refreshToken = stored.refreshToken;
        this.userId = stored.userId;
        this.teamId = stored.teamId;
        this.isAuthenticated = true;
        
        // Verify token is still valid
        await this.verifyToken();
      }
    } catch (error) {
      console.error('Failed to load auth token:', error);
    }
  }

  /**
   * Save authentication token to storage
   */
  async saveAuthToken() {
    try {
      await chrome.storage.local.set({
        authToken: this.token,
        refreshToken: this.refreshToken,
        userId: this.userId,
        teamId: this.teamId
      });
    } catch (error) {
      console.error('Failed to save auth token:', error);
    }
  }

  /**
   * Clear authentication token
   */
  async clearAuthToken() {
    this.token = null;
    this.refreshToken = null;
    this.userId = null;
    this.teamId = null;
    this.isAuthenticated = false;
    
    try {
      await chrome.storage.local.remove(['authToken', 'refreshToken', 'userId', 'teamId']);
    } catch (error) {
      console.error('Failed to clear auth token:', error);
    }
  }

  /**
   * Setup request interceptor for automatic token refresh
   */
  setupInterceptor() {
    // Intercept 401 responses and refresh token
    this.eventBus?.subscribe('api:unauthorized', async () => {
      await this.refreshAuthToken();
    });
  }

  /**
   * Login to backend
   */
  async login(email, password) {
    try {
      const response = await this.post('/auth/login', {
        email,
        password
      }, { skipAuth: true });

      if (response.success) {
        this.token = response.data.token;
        this.refreshToken = response.data.refreshToken;
        this.userId = response.data.user.id;
        this.teamId = response.data.user.teamId;
        this.isAuthenticated = true;

        await this.saveAuthToken();

        this.eventBus?.publish('auth:login:success', {
          userId: this.userId,
          teamId: this.teamId
        });

        return {
          success: true,
          user: response.data.user
        };
      }

      return {
        success: false,
        error: response.error || 'Login failed'
      };
    } catch (error) {
      console.error('Login failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Logout from backend
   */
  async logout() {
    try {
      await this.post('/auth/logout');
      await this.clearAuthToken();

      this.eventBus?.publish('auth:logout:success', {});

      return { success: true };
    } catch (error) {
      console.error('Logout failed:', error);
      // Clear local auth even if API call fails
      await this.clearAuthToken();
      return { success: false, error: error.message };
    }
  }

  /**
   * Register new user
   */
  async register(userData) {
    try {
      const response = await this.post('/auth/register', userData, { skipAuth: true });

      if (response.success) {
        return {
          success: true,
          user: response.data.user
        };
      }

      return {
        success: false,
        error: response.error || 'Registration failed'
      };
    } catch (error) {
      console.error('Registration failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Verify token validity
   */
  async verifyToken() {
    try {
      const response = await this.get('/auth/verify');
      
      if (!response.success) {
        await this.clearAuthToken();
        return false;
      }

      return true;
    } catch (error) {
      console.error('Token verification failed:', error);
      await this.clearAuthToken();
      return false;
    }
  }

  /**
   * Refresh authentication token
   */
  async refreshAuthToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('No refresh token available');
      }

      const response = await this.post('/auth/refresh', {
        refreshToken: this.refreshToken
      }, { skipAuth: true });

      if (response.success) {
        this.token = response.data.token;
        this.refreshToken = response.data.refreshToken;
        await this.saveAuthToken();

        this.eventBus?.publish('auth:token:refreshed', {});
        return true;
      }

      throw new Error('Token refresh failed');
    } catch (error) {
      console.error('Failed to refresh token:', error);
      await this.clearAuthToken();
      this.eventBus?.publish('auth:session:expired', {});
      return false;
    }
  }

  /**
   * Sync local data to backend
   */
  async syncData(dataType, data, options = {}) {
    try {
      const {
        teamId = this.teamId,
        merge = true,
        lastSyncTimestamp = null
      } = options;

      const response = await this.post('/sync/upload', {
        dataType,
        teamId,
        data,
        merge,
        lastSyncTimestamp,
        timestamp: Date.now()
      });

      if (response.success) {
        this.eventBus?.publish('sync:upload:success', {
          dataType,
          count: data.length
        });

        return {
          success: true,
          syncId: response.data.syncId,
          timestamp: response.data.timestamp
        };
      }

      return {
        success: false,
        error: response.error || 'Sync failed'
      };
    } catch (error) {
      console.error('Data sync failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Download data from backend
   */
  async downloadData(dataType, options = {}) {
    try {
      const {
        teamId = this.teamId,
        since = null,
        limit = 1000
      } = options;

      const params = new URLSearchParams({
        dataType,
        teamId,
        limit: limit.toString()
      });

      if (since) {
        params.append('since', since.toString());
      }

      const response = await this.get(`/sync/download?${params}`);

      if (response.success) {
        this.eventBus?.publish('sync:download:success', {
          dataType,
          count: response.data.items?.length || 0
        });

        return {
          success: true,
          data: response.data.items,
          lastSyncTimestamp: response.data.timestamp
        };
      }

      return {
        success: false,
        error: response.error || 'Download failed'
      };
    } catch (error) {
      console.error('Data download failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get team members
   */
  async getTeamMembers() {
    try {
      const response = await this.get(`/teams/${this.teamId}/members`);

      if (response.success) {
        return {
          success: true,
          members: response.data.members
        };
      }

      return {
        success: false,
        error: response.error || 'Failed to get team members'
      };
    } catch (error) {
      console.error('Failed to get team members:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Share data with team
   */
  async shareWithTeam(dataType, dataId, permissions = []) {
    try {
      const response = await this.post(`/teams/${this.teamId}/share`, {
        dataType,
        dataId,
        permissions
      });

      if (response.success) {
        this.eventBus?.publish('team:share:success', {
          dataType,
          dataId
        });

        return { success: true };
      }

      return {
        success: false,
        error: response.error || 'Sharing failed'
      };
    } catch (error) {
      console.error('Failed to share with team:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Generic GET request
   */
  async get(endpoint, options = {}) {
    return this.request('GET', endpoint, null, options);
  }

  /**
   * Generic POST request
   */
  async post(endpoint, data = null, options = {}) {
    return this.request('POST', endpoint, data, options);
  }

  /**
   * Generic PUT request
   */
  async put(endpoint, data = null, options = {}) {
    return this.request('PUT', endpoint, data, options);
  }

  /**
   * Generic DELETE request
   */
  async delete(endpoint, options = {}) {
    return this.request('DELETE', endpoint, null, options);
  }

  /**
   * Make HTTP request
   */
  async request(method, endpoint, data = null, options = {}) {
    try {
      const {
        skipAuth = false,
        headers = {},
        timeout = 30000
      } = options;

      const url = `${this.baseUrl}${endpoint}`;
      
      const requestHeaders = {
        'Content-Type': 'application/json',
        ...headers
      };

      // Add authorization header if authenticated
      if (!skipAuth && this.isAuthenticated && this.token) {
        requestHeaders['Authorization'] = `Bearer ${this.token}`;
      }

      // Add API key if configured
      if (this.apiKey) {
        requestHeaders['X-API-Key'] = this.apiKey;
      }

      const requestOptions = {
        method,
        headers: requestHeaders
      };

      if (data && (method === 'POST' || method === 'PUT')) {
        requestOptions.body = JSON.stringify(data);
      }

      // Create timeout promise
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), timeout)
      );

      // Make request with timeout
      const response = await Promise.race([
        fetch(url, requestOptions),
        timeoutPromise
      ]);

      const result = await response.json();

      // Handle unauthorized
      if (response.status === 401 && !skipAuth) {
        this.eventBus?.publish('api:unauthorized', {});
        throw new Error('Unauthorized');
      }

      // Handle errors
      if (!response.ok) {
        throw new Error(result.message || `HTTP ${response.status}`);
      }

      return {
        success: true,
        data: result.data || result,
        status: response.status
      };
    } catch (error) {
      console.error(`API request failed [${method} ${endpoint}]:`, error);
      return {
        success: false,
        error: error.message,
        status: error.status
      };
    }
  }

  /**
   * Check if service is online
   */
  async checkHealth() {
    try {
      const response = await this.get('/health', { 
        skipAuth: true,
        timeout: 5000 
      });
      
      return response.success;
    } catch (error) {
      return false;
    }
  }

  /**
   * Get service status
   */
  getStatus() {
    return {
      isAuthenticated: this.isAuthenticated,
      userId: this.userId,
      teamId: this.teamId,
      hasToken: !!this.token
    };
  }
}

/**
 * Factory function to create backend API service
 */
export function setupBackendApiService(config, eventBus) {
  const service = new BackendApiService(config, eventBus);
  return service;
}
