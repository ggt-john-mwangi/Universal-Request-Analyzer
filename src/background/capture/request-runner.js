// Request Runner - Replay requests for testing and QA
// Supports sequential/parallel execution with configurable delays

import { runtime, storage } from "../compat/browser-compat.js";
import runnerCollections from "./runner-collections.js";

class RequestRunner {
  constructor() {
    this.activeRun = null;
    this.runHistory = [];
    this.dbManager = null;
  }

  /**
   * Set database manager for storing results
   */
  setDbManager(dbManager) {
    this.dbManager = dbManager;
  }

  /**
   * Execute a collection of requests
   * @param {Object} config - Run configuration
   * @param {Array} config.requests - Requests to replay
   * @param {string} config.mode - 'sequential' or 'parallel'
   * @param {number} config.delay - Delay between requests (ms)
   * @param {boolean} config.followRedirects - Follow HTTP redirects
   * @param {Object} config.headerOverrides - Custom headers to add/override
   * @param {boolean} config.useVariables - Apply variable substitution
   * @param {string} config.collectionId - Collection ID if from saved collection
   * @param {Function} progressCallback - Called with progress updates
   */
  async runRequests(config, progressCallback) {
    const {
      requests,
      mode = "sequential",
      delay = 0,
      followRedirects = true,
      headerOverrides = {},
      validateStatus = false,
      useVariables = true,
      collectionId = null,
    } = config;

    if (!requests || requests.length === 0) {
      throw new Error("No requests provided");
    }

    const runId = `run_${Date.now()}`;
    const startTime = Date.now();

    this.activeRun = {
      id: runId,
      collectionId,
      status: "running",
      mode,
      totalRequests: requests.length,
      completedRequests: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      startTime,
      useVariables,
    };

    // Get variables if needed
    let variables = {};
    if (useVariables) {
      variables = await this.getVariables();
    }

    try {
      if (mode === "sequential") {
        await this.runSequential(
          requests,
          delay,
          headerOverrides,
          followRedirects,
          validateStatus,
          variables,
          progressCallback
        );
      } else if (mode === "parallel") {
        await this.runParallel(
          requests,
          headerOverrides,
          followRedirects,
          validateStatus,
          variables,
          progressCallback
        );
      } else {
        throw new Error(`Invalid mode: ${mode}`);
      }

      this.activeRun.status = "completed";
      this.activeRun.endTime = Date.now();
      this.activeRun.duration = this.activeRun.endTime - startTime;

      // Increment collection run count
      if (collectionId) {
        await runnerCollections.incrementRunCount(collectionId);
      }

      // Store results in database
      await this.storeRunResults(this.activeRun);
    } catch (error) {
      this.activeRun.status = "failed";
      this.activeRun.error = error.message;
      await this.storeRunResults(this.activeRun);
      throw error;
    } finally {
      // Store in history
      this.runHistory.push({ ...this.activeRun });
      if (this.runHistory.length > 50) {
        this.runHistory.shift(); // Keep last 50 runs
      }
    }

    return this.activeRun;
  }

  /**
   * Run requests sequentially with delay
   */
  async runSequential(
    requests,
    delay,
    headerOverrides,
    followRedirects,
    validateStatus,
    variables,
    progressCallback
  ) {
    for (let i = 0; i < requests.length; i++) {
      if (this.activeRun.status === "cancelled") {
        break;
      }

      const request = requests[i];
      const result = await this.executeRequest(
        request,
        headerOverrides,
        followRedirects,
        validateStatus,
        variables,
        i
      );

      this.activeRun.results.push(result);
      this.activeRun.completedRequests++;

      if (result.success) {
        this.activeRun.successCount++;
      } else {
        this.activeRun.failureCount++;
      }

      // Send progress update
      if (progressCallback) {
        progressCallback(this.getProgress());
      }

      // Apply delay before next request (except last one)
      if (delay > 0 && i < requests.length - 1) {
        await this.sleep(delay);
      }
    }
  }

  /**
   * Run all requests in parallel
   */
  async runParallel(
    requests,
    headerOverrides,
    followRedirects,
    validateStatus,
    variables,
    progressCallback
  ) {
    const promises = requests.map((request, index) =>
      this.executeRequest(
        request,
        headerOverrides,
        followRedirects,
        validateStatus,
        variables,
        index
      ).then((result) => {
        this.activeRun.results.push(result);
        this.activeRun.completedRequests++;

        if (result.success) {
          this.activeRun.successCount++;
        } else {
          this.activeRun.failureCount++;
        }

        // Send progress update
        if (progressCallback) {
          progressCallback(this.getProgress());
        }

        return result;
      })
    );

    await Promise.allSettled(promises);
  }

  /**
   * Execute a single request
   */
  async executeRequest(
    request,
    headerOverrides,
    followRedirects,
    validateStatus,
    variables,
    index
  ) {
    const startTime = performance.now();
    const result = {
      index,
      requestId: request.id,
      url: request.url,
      method: request.method,
      startTime: Date.now(),
      success: false,
    };

    try {
      // Parse request headers
      let headers = this.parseHeaders(request.request_headers);

      // Apply variable substitution to headers
      if (variables && Object.keys(variables).length > 0) {
        headers = this.substituteVariables(headers, variables);
      }

      // Apply header overrides
      Object.assign(headers, headerOverrides);

      // Apply variable substitution to overrides
      if (variables && Object.keys(variables).length > 0) {
        headers = this.substituteVariables(headers, variables);
      }

      // Remove problematic headers for fetch
      delete headers["host"];
      delete headers["content-length"];
      delete headers["connection"];

      // Build fetch options
      const fetchOptions = {
        method: request.method,
        headers,
        redirect: followRedirects ? "follow" : "manual",
      };

      // Add body for POST/PUT/PATCH
      if (
        ["POST", "PUT", "PATCH"].includes(request.method) &&
        request.request_payload
      ) {
        fetchOptions.body = request.request_payload;
      }

      // Execute request
      const response = await fetch(request.url, fetchOptions);

      const endTime = performance.now();
      const duration = Math.round(endTime - startTime);

      result.status = response.status;
      result.statusText = response.statusText;
      result.duration = duration;
      result.endTime = Date.now();
      result.success = validateStatus
        ? response.status >= 200 && response.status < 400
        : true;

      // Capture response headers
      result.responseHeaders = {};
      response.headers.forEach((value, key) => {
        result.responseHeaders[key] = value;
      });

      // Get response size if available
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        result.size = parseInt(contentLength);
      }
    } catch (error) {
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);
      result.endTime = Date.now();
      result.success = false;
      result.error = error.message;
      result.status = 0; // Network error
    }

    return result;
  }

  /**
   * Parse request headers from string
   */
  parseHeaders(headersString) {
    const headers = {};
    if (!headersString) return headers;

    try {
      // Try JSON parse first
      if (headersString.trim().startsWith("{")) {
        return JSON.parse(headersString);
      }

      // Parse header lines
      const lines = headersString.split("\n");
      lines.forEach((line) => {
        const colonIndex = line.indexOf(":");
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 1).trim();
          headers[key] = value;
        }
      });
    } catch (error) {
      console.error("Failed to parse headers:", error);
    }

    return headers;
  }

  /**
   * Get current progress
   */
  getProgress() {
    if (!this.activeRun) return null;

    return {
      id: this.activeRun.id,
      status: this.activeRun.status,
      mode: this.activeRun.mode,
      totalRequests: this.activeRun.totalRequests,
      completedRequests: this.activeRun.completedRequests,
      successCount: this.activeRun.successCount,
      failureCount: this.activeRun.failureCount,
      progress: Math.round(
        (this.activeRun.completedRequests / this.activeRun.totalRequests) * 100
      ),
      currentRequest:
        this.activeRun.results[this.activeRun.results.length - 1] || null,
      elapsedTime: Date.now() - this.activeRun.startTime,
    };
  }

  /**
   * Cancel active run
   */
  cancelRun() {
    if (this.activeRun && this.activeRun.status === "running") {
      this.activeRun.status = "cancelled";
      return true;
    }
    return false;
  }

  /**
   * Get run history
   */
  getHistory(limit = 10) {
    return this.runHistory.slice(-limit).reverse();
  }

  /**
   * Get specific run results
   */
  getRunResults(runId) {
    const run = this.runHistory.find((r) => r.id === runId);
    return run || null;
  }

  /**
   * Get variables from settings
   */
  async getVariables() {
    try {
      const data = await storage.get(["settings"]);
      const settings = data.settings || {};
      const variablesList = settings.variables?.list || [];

      // Convert to key-value map
      const variables = {};
      variablesList.forEach((v) => {
        if (v.name && v.value) {
          variables[v.name] = v.value;
        }
      });

      return variables;
    } catch (error) {
      console.error("Failed to get variables:", error);
      return {};
    }
  }

  /**
   * Substitute variables in headers
   */
  substituteVariables(headers, variables) {
    const substituted = {};

    for (const [key, value] of Object.entries(headers)) {
      let substitutedValue = value;

      // Replace ${VAR_NAME} with actual values
      for (const [varName, varValue] of Object.entries(variables)) {
        const placeholder = `\${${varName}}`;
        if (substitutedValue.includes(placeholder)) {
          substitutedValue = substitutedValue.replace(
            new RegExp(this.escapeRegex(placeholder), "g"),
            varValue
          );
        }
      }

      substituted[key] = substitutedValue;
    }

    return substituted;
  }

  /**
   * Escape regex special characters
   */
  escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  /**
   * Store run results in database
   */
  async storeRunResults(run) {
    if (!this.dbManager || !this.dbManager.db) {
      return;
    }

    try {
      const escapeStr = (val) => {
        if (val === undefined || val === null) return "NULL";
        return `'${String(val).replace(/'/g, "''")}'`;
      };

      const query = `
        INSERT OR REPLACE INTO runner_results (
          run_id,
          collection_id,
          status,
          mode,
          total_requests,
          success_count,
          failure_count,
          duration,
          start_time,
          end_time,
          results_json
        ) VALUES (
          ${escapeStr(run.id)},
          ${escapeStr(run.collectionId)},
          ${escapeStr(run.status)},
          ${escapeStr(run.mode)},
          ${run.totalRequests},
          ${run.successCount},
          ${run.failureCount},
          ${run.duration || 0},
          ${run.startTime},
          ${run.endTime || Date.now()},
          ${escapeStr(JSON.stringify(run.results))}
        )
      `;

      this.dbManager.db.exec(query);
      console.log("Runner results stored in database");
    } catch (error) {
      console.error("Failed to store runner results:", error);
    }
  }

  /**
   * Sleep utility
   */
  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Singleton instance
const requestRunner = new RequestRunner();
export default requestRunner;
