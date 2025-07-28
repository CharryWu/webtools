/**
 * Text Processing Web Worker
 * Handles computationally intensive text operations in background thread
 * Now with WebAssembly optimizations for maximum performance
 */

// Import WASM-optimized text processing functions from utils.js
import {
  justifyText,
  processTextChunks,
  getTextStats,
  validateTextInput,
  ensureWasmReady,
  getWasmStatus,
} from "./utils.js";

// Initialize WASM in worker context
let wasmReady = false;

// Try to initialize WASM when worker starts
ensureWasmReady()
  .then((ready) => {
    wasmReady = ready;
    if (ready) {
      console.log("🚀 Worker: WASM text processing initialized");
    } else {
      console.warn("⚠️ Worker: Using JavaScript fallback mode");
    }
  })
  .catch((error) => {
    console.warn("Worker: WASM initialization failed:", error);
    wasmReady = false;
  });

/**
 * Process text in chunks with WASM optimization
 * Uses the optimized processTextChunks function from utils.js
 * @param {string} text - The text to process
 * @param {number} maxChars - Maximum characters per line
 * @param {number} chunkSize - Size of each chunk
 * @returns {string} - Processed result
 */
function processTextInChunksOptimized(text, maxChars, chunkSize = 1000) {
  // Use the WASM-optimized version from utils.js
  if (wasmReady) {
    try {
      return processTextChunks(text, maxChars, chunkSize);
    } catch (error) {
      console.warn(
        "Worker: WASM chunk processing failed, using fallback:",
        error
      );
    }
  }

  // JavaScript fallback with progress tracking
  const chunks = [];
  const textLength = text.length;

  // Split text into chunks
  for (let i = 0; i < textLength; i += chunkSize) {
    chunks.push(text.slice(i, i + chunkSize));
  }

  let processedChunks = [];
  let progress = 0;

  chunks.forEach((chunk, index) => {
    const processedChunk = justifyText(chunk, maxChars);
    processedChunks.push(processedChunk);
    progress = ((index + 1) / chunks.length) * 100;

    // Send progress update
    self.postMessage({
      type: "progress",
      progress: progress,
      chunk: index + 1,
      total: chunks.length,
    });
  });

  return processedChunks.join("\r\n");
}

/**
 * Calculate line positions for annotation system
 * @param {Array} lines - Array of text lines
 * @param {Object} config - Configuration object
 * @returns {Array} - Array of line position objects
 */
function calculateLinePositions(lines, config) {
  const { fontSize, padding } = config;

  return lines.map((line, index) => ({
    text: line,
    x: padding,
    y: fontSize * 1.5 * index + padding,
    lineIndex: index,
  }));
}

/**
 * Batch process multiple text operations with WASM optimization
 * @param {Array} operations - Array of text operations to process
 * @returns {Array} - Array of processed results
 */
function batchProcessText(operations) {
  const results = [];

  operations.forEach((operation, index) => {
    const { text, maxChars, config } = operation;

    const startTime = performance.now();

    // Use WASM-optimized text justification
    const justifiedText = justifyText(text, maxChars);
    const lines = justifiedText.split("\n");
    const linePositions = calculateLinePositions(lines, config);
    const processingTime = performance.now() - startTime;

    // Get additional stats if WASM is available
    let stats = {};
    if (wasmReady) {
      try {
        stats = getTextStats(text);
      } catch (error) {
        console.warn("Worker: WASM stats failed:", error);
        stats = { characterCount: text.length };
      }
    } else {
      stats = { characterCount: text.length };
    }

    results.push({
      index: index,
      justifiedText: justifiedText,
      lines: lines,
      linePositions: linePositions,
      processingTime: processingTime,
      ...stats, // Include WASM stats if available
      wasmUsed: wasmReady,
    });

    // Send progress update
    self.postMessage({
      type: "batchProgress",
      completed: index + 1,
      total: operations.length,
      progress: ((index + 1) / operations.length) * 100,
    });
  });

  return results;
}

/**
 * Optimize text for clipboard processing with WASM acceleration
 * @param {string} text - Clipboard text
 * @param {number} maxChars - Maximum characters per line
 * @returns {Object} - Optimized text data
 */
function optimizeClipboardText(text, maxChars) {
  const lines = text.split(/\r?\n/);
  const preview = lines.slice(0, 10).join("\n");
  const isLong = lines.length > 10;

  // Get detailed stats if WASM is available
  let stats = {};
  if (wasmReady) {
    try {
      stats = getTextStats(text);
    } catch (error) {
      console.warn("Worker: WASM clipboard stats failed:", error);
      stats = {
        lineCount: lines.length,
        characterCount: text.length,
      };
    }
  } else {
    stats = {
      lineCount: lines.length,
      characterCount: text.length,
    };
  }

  // Only process if it's worth the overhead (reduced threshold with WASM)
  const shouldProcess = wasmReady ? text.length > 200 : text.length > 500;

  if (shouldProcess) {
    const justified = justifyText(text, maxChars);
    return {
      originalText: text,
      justifiedText: justified,
      preview: preview,
      isLong: isLong,
      ...stats,
      processed: true,
      wasmUsed: wasmReady,
    };
  } else {
    return {
      originalText: text,
      preview: preview,
      isLong: isLong,
      ...stats,
      processed: false,
      wasmUsed: wasmReady,
    };
  }
}

// Main message handler with WASM optimization
self.onmessage = function (e) {
  const { action, data, id } = e.data;
  const startTime = performance.now();

  try {
    let result;

    switch (action) {
      case "justifyText":
        const { text, maxChars, config } = data;

        // Validate input using WASM if available
        if (wasmReady) {
          try {
            validateTextInput(text);
          } catch (error) {
            throw new Error(`Text validation failed: ${error.message}`);
          }
        }

        if (text.length > 2000) {
          // Use WASM-optimized chunked processing for large texts
          result = {
            justifiedText: processTextInChunksOptimized(text, maxChars),
            lines: null, // Will be calculated in main thread
            linePositions: null, // Will be calculated in main thread
            chunked: true,
            wasmUsed: wasmReady,
          };
        } else {
          // Direct processing for smaller texts with WASM optimization
          const justifiedText = justifyText(text, maxChars);
          const lines = justifiedText.split("\n");
          const linePositions = calculateLinePositions(lines, config);

          // Get text stats if WASM is available
          let stats = {};
          if (wasmReady) {
            try {
              stats = getTextStats(text);
            } catch (error) {
              console.warn("Worker: WASM stats failed in justifyText:", error);
            }
          }

          result = {
            justifiedText: justifiedText,
            lines: lines,
            linePositions: linePositions,
            chunked: false,
            wasmUsed: wasmReady,
            ...stats,
          };
        }
        break;

      case "batchProcess":
        result = batchProcessText(data.operations);
        break;

      case "clipboardOptimize":
        result = optimizeClipboardText(data.text, data.maxChars);
        break;

      case "calculatePositions":
        result = calculateLinePositions(data.lines, data.config);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    const processingTime = performance.now() - startTime;

    // Send successful result
    self.postMessage({
      type: "result",
      action: action,
      result: result,
      processingTime: processingTime,
      id: id,
    });
  } catch (error) {
    // Send error result
    self.postMessage({
      type: "error",
      action: action,
      error: {
        message: error.message,
        stack: error.stack,
      },
      id: id,
    });
  }
};

// Handle worker initialization with WASM status
// Wait a bit for WASM initialization, then send ready message
setTimeout(() => {
  self.postMessage({
    type: "ready",
    timestamp: Date.now(),
    wasmReady: wasmReady,
    wasmStatus: wasmReady ? "initialized" : "fallback",
  });
}, 100); // Small delay to allow WASM initialization to complete
