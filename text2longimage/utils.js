/**
 * Text2LongImage Utilities
 * Pure utility functions with no DOM dependencies or side effects
 */

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
  let rafId = null;
  let pending = false;

  return function (...args) {
    if (!pending) {
      pending = true;
      rafId = requestAnimationFrame(() => {
        func.apply(context || this, args);
        pending = false;
        rafId = null;
      });
    }
  };
}

/**
 * Justifies a given text by inserting line breaks at appropriate positions.
 * Ensures that each line does not exceed a specified maximum number of characters.
 *
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
export function justifyTextCJK(text, maxCharsAllowedPerLine) {
  let curLineCharCount = 0; // Initialize the character count for the current line
  return text.replace(/[\S\s]/g, (char) => {
    // `\s` matches whitespace (spaces, tabs and new lines). `\S` is negated `\s`.
    // Consider all whitespace & non-whitespace characters as potential insertion of line breaks
    if (/[\r\n]/.test(char)) {
      // If the character is a newline, reset the count and return the newline
      curLineCharCount = -2;
      return "\r\n";
    }
    // Increment character count; assume 1 for ASCII, 2 for non-ASCII
    curLineCharCount += /[\x00-\xFF]/.test(char) ? 1 : 2;
    if (curLineCharCount >= maxCharsAllowedPerLine) {
      // If the line exceeds the limit, insert a line break
      curLineCharCount = 0;
      return "\r\n" + char;
    }
    return char; // Return the character if no line break is needed
  });
}

/**
 * Checks if a given string contains any CJK (Chinese, Japanese or Korean) characters.
 * Native test: /[\p{Script=Han}]/u.test(str)
 * @param {string} str - The string to be checked.
 * @returns {boolean} - `true` if the string contains any CJK characters; `false` otherwise.
 */
export function isCJK(str) {
  return /[\p{Script=Han}]/u.test(str);
}

/**
 * Justifies a given text by inserting line breaks at appropriate positions.
 * Ensures that each line does not exceed a specified maximum number of characters.
 * This function is used for text that is known to be non-CJK.
 *
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
export function justifyTextEnglish(text, maxCharsAllowedPerLine) {
  const words = text.split(/\s+/); // Split on any whitespace
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (
      currentLine.length + word.length + (currentLine ? 1 : 0) <=
      maxCharsAllowedPerLine
    ) {
      // Add space before word if not first in line
      currentLine += (currentLine ? " " : "") + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) {
    lines.push(currentLine);
  }

  return lines.join("\r\n");
}

/**
 * Justifies a given text by inserting line breaks at appropriate positions.
 * Ensures that each line does not exceed a specified maximum number of characters.
 * The function splits the text into lines, trims and justifies each line
 * separately. It uses the right justification function based on whether the
 * line contains CJK characters or not.
 *
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
export function justifyText(text, maxCharsAllowedPerLine) {
  return text
    .split(/\r\n|\n|\r/)
    .map((line) => line.trim())
    .map((line) =>
      isCJK(line)
        ? justifyTextCJK(line, maxCharsAllowedPerLine)
        : justifyTextEnglish(line, maxCharsAllowedPerLine)
    )
    .join("\r\n");
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
 * Validate text input before processing
 * @param {string} text - The text to validate
 * @returns {boolean} - True if valid
 * @throws {Error} - If text is invalid
 */
export function validateTextInput(text) {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text input: must be a non-empty string");
  }

  if (text.length > 500000) {
    // 500KB limit
    throw new Error("Text too large: maximum 500,000 characters supported");
  }

  return true;
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
    // Note: reportError would need to be imported or passed as parameter
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
  return navigator.clipboard && navigator.clipboard.readText;
}
