/**
 * Text2LongImage Utilities
 * Pure utility functions with no DOM dependencies or side effects
 * Now with WebAssembly optimizations for performance-critical operations
 */

// Import WASM module (dynamically imported to handle loading)
let wasmModule = null;
let wasmInitialized = false;
let wasmInitPromise = null;

/**
 * Initialize WASM module
 * @returns {Promise<boolean>} - True if WASM loaded successfully
 */
async function initWasm() {
  if (wasmInitialized) {
    return wasmModule !== null;
  }

  if (wasmInitPromise) {
    return wasmInitPromise;
  }

  // Use an async IIFE here to immediately start the WASM initialization process and
  // assign the resulting promise to wasmInitPromise. This ensures that initialization
  // is only triggered once and can be awaited by any caller, while also allowing
  // error handling and state updates to be encapsulated in a single place.
  wasmInitPromise = (async () => {
    try {
      // Dynamic import of WASM module
      const wasmImport = await import("./pkg/text_processor.js");
      await wasmImport.default(); // Initialize WASM
      wasmModule = wasmImport;
      wasmInitialized = true;
      console.log("🚀 WASM text processing module loaded successfully");
      return true;
    } catch (error) {
      console.warn(
        "⚠️ WASM module failed to load, falling back to JavaScript:",
        error
      );
      wasmModule = null;
      wasmInitialized = true;
      return false;
    }
  })();

  return wasmInitPromise;
}

// Auto-initialize WASM (non-blocking)
initWasm().catch(() => {
  // Silent fallback - errors already logged above
});

// Configuration constants
export const DEFAULT_IMG_CONFIG = {
  charsPerLine: 18,
  fontSize: 32,
  lineSpacing: 1.5,
  fontWeight: "400",
  padding: 42,
};

export const STORAGE_KEYS = {
  TEXT_HISTORY: "text2longimage-history",
  CURRENT_TEXT: "user-text",
};

/**
 * Get WASM module status
 * @returns {Object} Status information
 */
export function getWasmStatus() {
  return {
    initialized: wasmInitialized,
    available: wasmModule !== null,
    loading: wasmInitPromise !== null && !wasmInitialized,
  };
}

/**
 * Force WASM initialization (for manual control)
 * @returns {Promise<boolean>}
 */
export async function ensureWasmReady() {
  return await initWasm();
}

/**
 * Throttle utility - limits function calls to once per specified delay
 * @param {Function} func - Function to throttle
 * @param {number} delay - Delay in milliseconds
 * @param {*} context - Context to bind function to
 * @returns {Function} Throttled function
 */
export function throttle(func, delay, context = null) {
  let timeoutId = null;
  let lastExecTime = 0;

  return function (...args) {
    const currentTime = Date.now();

    if (currentTime - lastExecTime > delay) {
      // Execute immediately if enough time has passed
      lastExecTime = currentTime;
      func.apply(context || this, args);
    } else {
      // Schedule for later execution
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        lastExecTime = Date.now();
        func.apply(context || this, args);
        timeoutId = null;
      }, delay - (currentTime - lastExecTime));
    }
  };
}

/**
 * Debounce utility - delays function execution until specified time has passed since last call
 * @param {Function} func - Function to debounce
 * @param {number} delay - Delay in milliseconds
 * @param {*} context - Context to bind function to
 * @returns {Function} Debounced function
 */
export function debounce(func, delay, context = null) {
  let timeoutId = null;

  return function (...args) {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }

    timeoutId = setTimeout(() => {
      func.apply(context || this, args);
      timeoutId = null;
    }, delay);
  };
}

/**
 * RequestAnimationFrame-based throttle for smooth animations
 * @param {Function} func - Function to throttle
 * @param {*} context - Context to bind function to
 * @returns {Function} RAF-throttled function
 */
export function throttleRAF(func, context = null) {
  let pending = false;

  return function (...args) {
    if (!pending) {
      pending = true;
      requestAnimationFrame(() => {
        func.apply(context || this, args);
        pending = false;
      });
    }
    // If already pending, ignore subsequent calls until current frame completes
  };
}

/**
 * JavaScript fallback for CJK text justification
 * Used when WASM is not available
 */
function justifyTextCJKFallback(text, maxCharsAllowedPerLine) {
  let curLineCharCount = 0;
  return text.replace(/[\S\s]/g, (char) => {
    if (/[\r\n]/.test(char)) {
      curLineCharCount = -2;
      return "\r\n";
    }
    curLineCharCount += char.charCodeAt(0) <= 255 ? 1 : 2;
    if (curLineCharCount >= maxCharsAllowedPerLine) {
      curLineCharCount = 0;
      return "\r\n" + char;
    }
    return char;
  });
}

/**
 * JavaScript fallback for English text justification
 * Used when WASM is not available
 */
function justifyTextEnglishFallback(text, maxCharsAllowedPerLine) {
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (
      currentLine.length + word.length + (currentLine ? 1 : 0) <=
      maxCharsAllowedPerLine
    ) {
      currentLine += (currentLine ? " " : "") + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join("\r\n");
}

/**
 * JavaScript fallback for CJK detection
 * Used when WASM is not available
 */
function isCJKFallback(str) {
  return /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(str);
}

/**
 * Checks if a given string contains any CJK (Chinese, Japanese or Korean) characters.
 * Uses WASM optimization when available, falls back to JavaScript regex
 * @param {string} str - The string to be checked.
 * @returns {boolean} - `true` if the string contains any CJK characters; `false` otherwise.
 */
export function isCJK(str) {
  if (wasmModule && wasmModule.is_cjk) {
    try {
      return wasmModule.is_cjk(str);
    } catch (error) {
      console.warn("WASM isCJK failed, using fallback:", error);
    }
  }
  return isCJKFallback(str);
}

/**
 * Justifies a given text by inserting line breaks at appropriate positions (CJK).
 * Uses WASM optimization when available, falls back to JavaScript
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
export function justifyTextCJK(text, maxCharsAllowedPerLine) {
  if (wasmModule && wasmModule.justify_text_cjk) {
    try {
      return wasmModule.justify_text_cjk(text, maxCharsAllowedPerLine);
    } catch (error) {
      console.warn("WASM justifyTextCJK failed, using fallback:", error);
    }
  }
  return justifyTextCJKFallback(text, maxCharsAllowedPerLine);
}

/**
 * Justifies a given text by inserting line breaks at appropriate positions (English).
 * Uses WASM optimization when available, falls back to JavaScript
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
export function justifyTextEnglish(text, maxCharsAllowedPerLine) {
  if (wasmModule && wasmModule.justify_text_english) {
    try {
      return wasmModule.justify_text_english(text, maxCharsAllowedPerLine);
    } catch (error) {
      console.warn("WASM justifyTextEnglish failed, using fallback:", error);
    }
  }
  return justifyTextEnglishFallback(text, maxCharsAllowedPerLine);
}

/**
 * Main text justification function with WASM optimization
 * Uses WASM when available for 2-10x performance improvement
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
export function justifyText(text, maxCharsAllowedPerLine) {
  if (wasmModule && wasmModule.justify_text) {
    try {
      return wasmModule.justify_text(text, maxCharsAllowedPerLine);
    } catch (error) {
      console.warn("WASM justifyText failed, using fallback:", error);
    }
  }

  // JavaScript fallback
  return text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .map((line) =>
      isCJK(line)
        ? justifyTextCJKFallback(line, maxCharsAllowedPerLine)
        : justifyTextEnglishFallback(line, maxCharsAllowedPerLine)
    )
    .join("\r\n");
}

/**
 * Process text in chunks with WASM optimization
 * @param {string} text - The text to process
 * @param {number} maxCharsPerLine - Maximum chars per line
 * @param {number} chunkSize - Size of each chunk
 * @returns {string} - Processed text
 */
export function processTextChunks(text, maxCharsPerLine, chunkSize = 1000) {
  if (wasmModule && wasmModule.process_text_chunks) {
    try {
      return wasmModule.process_text_chunks(text, maxCharsPerLine, chunkSize);
    } catch (error) {
      console.warn("WASM processTextChunks failed, using fallback:", error);
    }
  }

  // JavaScript fallback - simple chunking
  if (text.length <= chunkSize) {
    return justifyText(text, maxCharsPerLine);
  }

  let result = "";
  for (let i = 0; i < text.length; i += chunkSize) {
    const chunk = text.slice(i, i + chunkSize);
    const processed = justifyText(chunk, maxCharsPerLine);
    result += processed;
    if (i + chunkSize < text.length && !processed.endsWith("\r\n")) {
      result += "\r\n";
    }
  }
  return result;
}

/**
 * Get text statistics with WASM optimization
 * @param {string} text - The text to analyze
 * @returns {Object} - Text statistics
 */
export function getTextStats(text) {
  if (wasmModule && wasmModule.get_text_stats) {
    try {
      return JSON.parse(wasmModule.get_text_stats(text));
    } catch (error) {
      console.warn("WASM getTextStats failed, using fallback:", error);
    }
  }

  // JavaScript fallback
  const lines = text.split(/\r?\n/);
  return {
    charCount: text.length,
    byteCount: new Blob([text]).size,
    lineCount: lines.length,
    cjkCount: (
      text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) ||
      []
    ).length,
    asciiCount: [...text].filter((char) => char.charCodeAt(0) <= 255).length,
    displayWidth: text.length, // Simplified fallback
    hasCjk: isCJK(text),
  };
}

/**
 * Validate text input with WASM optimization
 * @param {string} text - The text to validate
 * @returns {boolean} - True if valid
 * @throws {Error} - If text is invalid
 */
export function validateTextInput(text) {
  if (wasmModule && wasmModule.validate_text_input) {
    try {
      const errorMsg = wasmModule.validate_text_input(text);
      if (errorMsg) {
        throw new Error(errorMsg);
      }
      return true;
    } catch (error) {
      if (error.message) {
        throw error; // Re-throw validation errors
      }
      console.warn("WASM validateTextInput failed, using fallback:", error);
    }
  }

  // JavaScript fallback
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text input: must be a non-empty string");
  }

  if (text.length > 500000) {
    throw new Error("Text too large: maximum 500,000 characters supported");
  }

  return true;
}

/**
 * Retry operation with exponential backoff
 * @param {Function} operation - The async operation to retry
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} baseDelay - Base delay in milliseconds
 * @returns {Promise} - Promise that resolves with the operation result
 */
export async function retryOperation(
  operation,
  maxRetries = 3,
  baseDelay = 1000
) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation();
    } catch (error) {
      console.warn(
        `Operation failed, attempt ${attempt}/${maxRetries}:`,
        error
      );

      if (attempt === maxRetries) {
        throw error;
      }

      // Exponential backoff
      const delay = baseDelay * Math.pow(2, attempt - 1);
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }
}

/**
 * Safe async operation wrapper
 * @param {Function} operation - The async operation to execute
 * @param {Function} fallback - Fallback function if operation fails
 * @param {string} context - Context description for error reporting
 * @returns {Promise} - Promise that resolves with the operation result
 */
export async function safeAsyncOperation(
  operation,
  fallback = null,
  context = "operation"
) {
  try {
    return await operation();
  } catch (error) {
    console.error(`Error in ${context}:`, error);

    if (fallback && typeof fallback === "function") {
      try {
        console.warn(`Falling back for ${context}`);
        return await fallback();
      } catch (fallbackError) {
        console.error(`Fallback error for ${context}:`, fallbackError);
        throw fallbackError;
      }
    }

    throw error;
  }
}

/**
 * Formats timestamp to readable date string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
export function formatDate(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffInHours = (now - date) / (1000 * 60 * 60);

  if (diffInHours < 1) {
    const diffInMinutes = Math.floor((now - date) / (1000 * 60));
    return diffInMinutes <= 1 ? "Just now" : `${diffInMinutes} minutes ago`;
  } else if (diffInHours < 24) {
    return `${Math.floor(diffInHours)} hours ago`;
  } else if (diffInHours < 24 * 7) {
    return `${Math.floor(diffInHours / 24)} days ago`;
  } else {
    return date.toLocaleDateString();
  }
}

/**
 * Gets the first N lines from text
 * @param {string} text - The text to get lines from
 * @param {number} maxLines - Maximum number of lines to return
 * @returns {string} The first maxLines of text
 */
export function getFirstLines(text, maxLines = 10) {
  const lines = text.split(/\r?\n/);
  return lines.slice(0, maxLines).join("\n");
}

/**
 * Checks if clipboard API is available
 * @returns {boolean} True if clipboard API is available
 */
export function isClipboardAPIAvailable() {
  return !!(navigator.clipboard && navigator.clipboard.readText);
}
