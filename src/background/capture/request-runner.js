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
   * Execute a runner by ID (loads from database)
   * @param {string} runnerId - Runner definition ID
   * @param {Function} progressCallback - Called with progress updates
   */
  async runRunner(runnerId, progressCallback) {
    if (!this.dbManager || !this.dbManager.runner) {
      throw new Error("Database not initialized");
    }

    // Load runner definition and requests from database
    const runner = await this.dbManager.runner.getRunnerDefinition(runnerId);
    if (!runner) {
      throw new Error(`Runner not found: ${runnerId}`);
    }

    const requests = await this.dbManager.runner.getRunnerRequests(runnerId);
    if (!requests || requests.length === 0) {
      throw new Error(`No requests found for runner: ${runnerId}`);
    }

    // Create execution record with unique ID
    const executionId = `exec_${runnerId}_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    const execution = {
      id: executionId,
      runner_id: runnerId,
      runner_name: runner.name,
      status: "running",
      execution_mode: runner.execution_mode,
      start_time: Date.now(),
      total_requests: requests.length,
      created_at: Date.now(),
    };

    await this.dbManager.runner.createRunnerExecution(execution);

    this.activeRun = {
      id: executionId,
      runnerId: runnerId,
      runnerName: runner.name,
      status: "running",
      mode: runner.execution_mode,
      totalRequests: requests.length,
      completedRequests: 0,
      successCount: 0,
      failureCount: 0,
      results: [],
      startTime: execution.start_time,
      useVariables: runner.use_variables,
    };

    // Get variables if needed
    let variables = {};
    if (runner.use_variables) {
      variables = await this.getVariables();
    }

    // Parse header overrides
    let headerOverrides = {};
    if (runner.header_overrides) {
      try {
        headerOverrides = JSON.parse(runner.header_overrides);
      } catch (e) {
        console.warn("[Runner] Invalid header overrides JSON:", e);
      }
    }

    try {
      if (runner.execution_mode === "sequential") {
        await this.runSequentialDB(
          requests,
          runner.delay_ms || 0,
          headerOverrides,
          runner.follow_redirects,
          runner.validate_status,
          variables,
          executionId,
          progressCallback
        );
      } else if (runner.execution_mode === "parallel") {
        await this.runParallelDB(
          requests,
          headerOverrides,
          runner.follow_redirects,
          runner.validate_status,
          variables,
          executionId,
          progressCallback
        );
      } else {
        throw new Error(`Invalid mode: ${runner.execution_mode}`);
      }

      this.activeRun.status = "completed";
      this.activeRun.endTime = Date.now();
      this.activeRun.duration =
        this.activeRun.endTime - this.activeRun.startTime;

      // Update execution record
      await this.dbManager.runner.updateRunnerExecution(executionId, {
        status: "completed",
        end_time: this.activeRun.endTime,
        duration: this.activeRun.duration,
        completed_requests: this.activeRun.completedRequests,
        success_count: this.activeRun.successCount,
        failure_count: this.activeRun.failureCount,
      });

      // Update runner definition
      await this.dbManager.runner.updateRunnerDefinition(runnerId, {
        last_run_at: this.activeRun.endTime,
        run_count: (runner.run_count || 0) + 1,
      });

      console.log(`[Runner] Execution completed: ${executionId}`);
    } catch (error) {
      this.activeRun.status = "failed";
      this.activeRun.error = error.message;

      // Update execution record with error
      await this.dbManager.runner.updateRunnerExecution(executionId, {
        status: "failed",
        end_time: Date.now(),
        error_message: error.message,
      });

      throw error;
    } finally {
      // Store in history
      this.runHistory.push({ ...this.activeRun });
      if (this.runHistory.length > 50) {
        this.runHistory.shift();
      }
    }

    return this.activeRun;
  }

  /**
   * Execute a collection of requests (legacy method - now creates runner first)
   * @param {Object} config - Run configuration
   * @param {Array} config.requests - Requests to replay
   * @param {string} config.mode - 'sequential' or 'parallel'
   * @param {number} config.delay - Delay between requests (ms)
   * @param {boolean} config.followRedirects - Follow HTTP redirects
   * @param {Object} config.headerOverrides - Custom headers to add/override
   * @param {boolean} config.useVariables - Apply variable substitution
   * @param {string} config.name - Runner name (optional, auto-generated if not provided)
   * @param {string} config.description - Runner description (optional)
   * @param {boolean} config.isTemporary - Whether this is a temporary quick run
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
      name = `Quick Run - ${new Date().toLocaleString()}`,
      description = "",
      isTemporary = true,
    } = config;

    if (!requests || requests.length === 0) {
      throw new Error("No requests provided");
    }

    if (!this.dbManager || !this.dbManager.runner) {
      throw new Error("Database not initialized");
    }

    // ✅ Step 1: Create runner definition first
    const now = Date.now();
    const runnerId = `runner_${now}_${Math.random().toString(36).substr(2, 9)}`;
    const runnerDef = {
      id: runnerId,
      name: name,
      description: description,
      collection_id: null, // Temporary runners don't belong to collections
      execution_mode: mode,
      delay_ms: delay,
      follow_redirects: followRedirects,
      validate_status: validateStatus,
      use_variables: useVariables,
      header_overrides: JSON.stringify(headerOverrides),
      is_active: true,
      created_at: now,
      updated_at: now,
    };

    // ✅ Step 2: Create runner requests (with domain/page_url from captured requests)
    const runnerRequests = requests.map((req, idx) => ({
      id: `${runnerId}_req_${idx}_${Math.random().toString(36).substr(2, 6)}`,
      runner_id: runnerId,
      sequence_order: idx + 1,
      url: req.url,
      method: req.method || "GET",
      headers: JSON.stringify(req.request_headers || {}),
      body: req.request_payload || null,
      domain: req.domain || new URL(req.url).hostname,
      page_url: req.page_url || req.pageUrl || req.url,
      captured_request_id: req.id || null,
      assertions: null,
      description: null,
      is_enabled: true,
      created_at: now,
    }));

    // ✅ Step 3: Save to database
    await this.dbManager.runner.createRunner(runnerDef, runnerRequests);

    console.log(
      `[Runner] Created ${
        isTemporary ? "temporary" : "permanent"
      } runner: ${name}`
    );

    // ✅ Step 4: Execute the runner
    return await this.runRunner(runnerId, progressCallback);
  }

  /**
   * Run requests sequentially with delay (database-integrated version)
   */
  async runSequentialDB(
    runnerRequests,
    delay,
    headerOverrides,
    followRedirects,
    validateStatus,
    variables,
    executionId,
    progressCallback
  ) {
    for (let i = 0; i < runnerRequests.length; i++) {
      if (this.activeRun.status === "cancelled") {
        break;
      }

      const runnerRequest = runnerRequests[i];

      // Convert runner request to execution format
      const request = {
        id: runnerRequest.captured_request_id || runnerRequest.id,
        url: runnerRequest.url,
        method: runnerRequest.method,
        request_headers: runnerRequest.headers,
        request_payload: runnerRequest.body,
        domain: runnerRequest.domain,
        page_url: runnerRequest.page_url,
      };

      const result = await this.executeRequestDB(
        request,
        runnerRequest,
        headerOverrides,
        followRedirects,
        validateStatus,
        variables,
        executionId,
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
      if (delay > 0 && i < runnerRequests.length - 1) {
        await this.sleep(delay);
      }
    }
  }

  /**
   * Run all requests in parallel (database-integrated version)
   */
  async runParallelDB(
    runnerRequests,
    headerOverrides,
    followRedirects,
    validateStatus,
    variables,
    executionId,
    progressCallback
  ) {
    const promises = runnerRequests.map((runnerRequest, index) => {
      // Convert runner request to execution format
      const request = {
        id: runnerRequest.captured_request_id || runnerRequest.id,
        url: runnerRequest.url,
        method: runnerRequest.method,
        request_headers: runnerRequest.headers,
        request_payload: runnerRequest.body,
        domain: runnerRequest.domain,
        page_url: runnerRequest.page_url,
      };

      return this.executeRequestDB(
        request,
        runnerRequest,
        headerOverrides,
        followRedirects,
        validateStatus,
        variables,
        executionId,
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
      });
    });

    await Promise.allSettled(promises);
  }

  /**
   * Run requests sequentially with delay (legacy method)
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
   * Run all requests in parallel (legacy method)
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
   * Execute a single request (database-integrated version)
   */
  async executeRequestDB(
    request,
    runnerRequest,
    headerOverrides,
    followRedirects,
    validateStatus,
    variables,
    executionId,
    index
  ) {
    const startTime = performance.now();
    const result = {
      index,
      requestId: request.id,
      runnerRequestId: runnerRequest.id,
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

      // ✅ Log to bronze_requests via event bus (preserving domain/page_url context)
      const logResponse = await chrome.runtime.sendMessage({
        action: "runnerRequestCompleted",
        data: {
          url: request.url,
          method: request.method,
          status: result.status,
          duration: duration,
          timestamp: result.startTime,
          request_headers: request.request_headers,
          response_headers: result.responseHeaders,
          request_payload: request.request_payload,
          originalDomain: request.domain,
          originalPageUrl: request.page_url,
        },
      });

      if (logResponse && logResponse.success && logResponse.requestId) {
        result.loggedRequestId = logResponse.requestId;

        // ✅ Store result in database linking to bronze_requests
        await this.dbManager.runner.createRunnerExecutionResult({
          id: `result_${Date.now()}_${index}`,
          execution_id: executionId,
          runner_request_id: runnerRequest.id,
          logged_request_id: logResponse.requestId,
          status: result.status,
          duration: duration,
          success: result.success,
          error_message: null,
          created_at: Date.now(),
        });
      } else {
        console.warn(
          `[Runner] Failed to log request to bronze: ${request.url}`
        );

        // ✅ Still store result even if logging failed
        await this.dbManager.runner.createRunnerExecutionResult({
          id: `result_${Date.now()}_${index}`,
          execution_id: executionId,
          runner_request_id: runnerRequest.id,
          logged_request_id: null,
          status: result.status,
          duration: duration,
          success: result.success,
          error_message: "Failed to log to bronze_requests",
          created_at: Date.now(),
        });
      }

      // Get response size
      let responseSize = 0;
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        responseSize = parseInt(contentLength);
      } else {
        // Try to get actual size from response
        try {
          const responseText = await response.clone().text();
          responseSize = responseText.length;
        } catch (e) {
          // Ignore size calculation errors
        }
      }
      result.size = responseSize;
    } catch (error) {
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);
      result.endTime = Date.now();
      result.success = false;
      result.error = error.message;
      result.status = 0; // Network error

      // ✅ Store error result in database
      try {
        await this.dbManager.runner.createRunnerExecutionResult({
          id: `result_${Date.now()}_${index}`,
          execution_id: executionId,
          runner_request_id: runnerRequest.id,
          logged_request_id: null,
          status: 0,
          duration: result.duration,
          success: false,
          error_message: error.message,
          created_at: Date.now(),
        });
      } catch (dbError) {
        console.error("[Runner] Failed to store error result:", dbError);
      }
    }

    return result;
  }

  /**
   * Execute a single request (legacy method)
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

      // Get response size
      let responseSize = 0;
      const contentLength = response.headers.get("content-length");
      if (contentLength) {
        responseSize = parseInt(contentLength);
      }
      result.size = responseSize;
    } catch (error) {
      const endTime = performance.now();
      result.duration = Math.round(endTime - startTime);
      result.endTime = Date.now();
      result.success = false;
      result.error = error.message;
      result.status = 0;
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
  // TODO: REMOVE - runner_results table is deprecated and not in use anywhere. Safe to delete this method and related schema.
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
