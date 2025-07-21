/**
 * Web Worker Manager for Text Processing
 * Handles communication between main thread and text processing worker
 */

class WorkerManager {
  constructor() {
    this.worker = null;
    this.isWorkerReady = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
    this.progressCallbacks = new Map();
    this.workerSupported = typeof Worker !== "undefined";
    this.fallbackMode = false;

    if (this.workerSupported) {
      this.initializeWorker();
    } else {
      console.warn(
        "Web Workers not supported, falling back to main thread processing"
      );
      this.fallbackMode = true;
    }
  }

  /**
   * Initialize the Web Worker
   */
  initializeWorker() {
    try {
      this.worker = new Worker("text-processor-worker.js", { type: "module" });
      this.worker.onmessage = this.handleWorkerMessage.bind(this);
      this.worker.onerror = this.handleWorkerError.bind(this);

      // Set up a timeout for worker initialization
      setTimeout(() => {
        if (!this.isWorkerReady) {
          console.warn(
            "Worker initialization timeout, falling back to main thread"
          );
          this.fallbackMode = true;
        }
      }, 2000);
    } catch (error) {
      console.error("Failed to initialize Web Worker:", error);
      this.fallbackMode = true;
    }
  }

  /**
   * Handle messages from the Web Worker
   */
  handleWorkerMessage(e) {
    const { type, action, result, error, id, progress, processingTime } =
      e.data;

    switch (type) {
      case "ready":
        this.isWorkerReady = true;
        console.log("Text processing worker is ready");
        break;

      case "result":
        if (this.pendingRequests.has(id)) {
          const { resolve, reject } = this.pendingRequests.get(id);
          this.pendingRequests.delete(id);

          // Add processing time to result
          if (result && typeof result === "object") {
            result.workerProcessingTime = processingTime;
          }

          resolve(result);
        }
        break;

      case "error":
        if (this.pendingRequests.has(id)) {
          const { resolve, reject } = this.pendingRequests.get(id);
          this.pendingRequests.delete(id);
          reject(new Error(error.message));
        }
        break;

      case "progress":
      case "batchProgress":
        if (this.progressCallbacks.has(id)) {
          const callback = this.progressCallbacks.get(id);
          callback(e.data);
        }
        break;

      default:
        console.warn("Unknown message type from worker:", type);
    }
  }

  /**
   * Handle Web Worker errors
   */
  handleWorkerError(error) {
    console.error("Web Worker error:", error);
    this.fallbackMode = true;

    // Reject all pending requests
    this.pendingRequests.forEach(({ reject }) => {
      reject(new Error("Worker failed"));
    });
    this.pendingRequests.clear();
  }

  /**
   * Send a request to the worker
   * @param {string} action - The action to perform
   * @param {Object} data - The data to send
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise} - Promise that resolves with the result
   */
  async sendRequest(action, data, progressCallback = null) {
    if (this.fallbackMode || !this.isWorkerReady) {
      return this.fallbackProcessing(action, data, progressCallback);
    }

    const id = ++this.requestId;

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      if (progressCallback) {
        this.progressCallbacks.set(id, progressCallback);
      }

      this.worker.postMessage({
        action: action,
        data: data,
        id: id,
      });

      // Set up timeout for the request
      setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id);
          this.progressCallbacks.delete(id);
          reject(new Error("Worker request timeout"));
        }
      }, 30000); // 30 second timeout
    });
  }

  /**
   * Fallback processing when Web Worker is not available
   * @param {string} action - The action to perform
   * @param {Object} data - The data to process
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise} - Promise that resolves with the result
   */
  async fallbackProcessing(action, data, progressCallback = null) {
    return new Promise((resolve, reject) => {
      // Simulate async processing to avoid blocking UI
      setTimeout(() => {
        try {
          let result;

          switch (action) {
            case "justifyText":
              result = this.fallbackJustifyText(data, progressCallback);
              break;

            case "clipboardOptimize":
              result = this.fallbackOptimizeClipboard(data);
              break;

            case "calculatePositions":
              result = this.fallbackCalculatePositions(data);
              break;

            default:
              throw new Error(`Unknown fallback action: ${action}`);
          }

          resolve(result);
        } catch (error) {
          reject(error);
        }
      }, 10);
    });
  }

  /**
   * Fallback text justification
   */
  fallbackJustifyText(data, progressCallback) {
    const { text, maxChars, config } = data;

    if (progressCallback) {
      progressCallback({ type: "progress", progress: 25 });
    }

    // Use the existing justifyText function from the main thread
    const justifiedText = window.justifyText
      ? window.justifyText(text, maxChars)
      : text;

    if (progressCallback) {
      progressCallback({ type: "progress", progress: 75 });
    }

    const lines = justifiedText.split("\n");
    const linePositions = this.fallbackCalculatePositions({ lines, config });

    if (progressCallback) {
      progressCallback({ type: "progress", progress: 100 });
    }

    return {
      justifiedText: justifiedText,
      lines: lines,
      linePositions: linePositions,
      chunked: false,
      fallback: true,
    };
  }

  /**
   * Fallback clipboard optimization
   */
  fallbackOptimizeClipboard(data) {
    const { text, maxChars } = data;
    const lines = text.split(/\r?\n/);
    const preview = lines.slice(0, 10).join("\n");

    return {
      originalText: text,
      preview: preview,
      isLong: lines.length > 10,
      lineCount: lines.length,
      characterCount: text.length,
      processed: false,
      fallback: true,
    };
  }

  /**
   * Fallback line position calculation
   */
  fallbackCalculatePositions(data) {
    const { lines, config } = data;
    const { fontSize, padding } = config;

    return lines.map((line, index) => ({
      text: line,
      x: padding,
      y: fontSize * 1.5 * index + padding,
      lineIndex: index,
    }));
  }

  /**
   * Process text with Web Worker (main public method)
   * @param {string} text - Text to process
   * @param {number} maxChars - Maximum characters per line
   * @param {Object} config - Configuration object
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise} - Promise that resolves with processed text data
   */
  async processText(text, maxChars, config, progressCallback = null) {
    const startTime = performance.now();

    try {
      const result = await this.sendRequest(
        "justifyText",
        {
          text: text,
          maxChars: maxChars,
          config: config,
        },
        progressCallback
      );

      // Add timing information
      result.totalProcessingTime = performance.now() - startTime;
      result.workerUsed = !this.fallbackMode;

      return result;
    } catch (error) {
      console.error("Text processing failed:", error);
      throw error;
    }
  }

  /**
   * Optimize clipboard text
   * @param {string} text - Clipboard text
   * @param {number} maxChars - Maximum characters per line
   * @returns {Promise} - Promise that resolves with optimized data
   */
  async optimizeClipboardText(text, maxChars) {
    try {
      const result = await this.sendRequest("clipboardOptimize", {
        text: text,
        maxChars: maxChars,
      });

      result.workerUsed = !this.fallbackMode;
      return result;
    } catch (error) {
      console.error("Clipboard optimization failed:", error);
      throw error;
    }
  }

  /**
   * Calculate line positions
   * @param {Array} lines - Array of text lines
   * @param {Object} config - Configuration object
   * @returns {Promise} - Promise that resolves with line positions
   */
  async calculateLinePositions(lines, config) {
    try {
      const result = await this.sendRequest("calculatePositions", {
        lines: lines,
        config: config,
      });

      return result;
    } catch (error) {
      console.error("Line position calculation failed:", error);
      throw error;
    }
  }

  /**
   * Batch process multiple text operations
   * @param {Array} operations - Array of operations to process
   * @param {Function} progressCallback - Optional progress callback
   * @returns {Promise} - Promise that resolves with batch results
   */
  async batchProcess(operations, progressCallback = null) {
    try {
      const result = await this.sendRequest(
        "batchProcess",
        {
          operations: operations,
        },
        progressCallback
      );

      return result;
    } catch (error) {
      console.error("Batch processing failed:", error);
      throw error;
    }
  }

  /**
   * Terminate the worker
   */
  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
    this.isWorkerReady = false;
    this.pendingRequests.clear();
    this.progressCallbacks.clear();
  }

  /**
   * Get worker status
   * @returns {Object} - Worker status information
   */
  getStatus() {
    return {
      supported: this.workerSupported,
      ready: this.isWorkerReady,
      fallbackMode: this.fallbackMode,
      pendingRequests: this.pendingRequests.size,
      hasWorker: !!this.worker,
    };
  }
}

// Export for use in main application
window.WorkerManager = WorkerManager;
