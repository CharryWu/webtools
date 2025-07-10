/**
 * Text Processing Web Worker
 * Handles computationally intensive text operations in background thread
 */

// Import text processing functions (we'll copy the core functions here)
/**
 * Justifies a given text by inserting line breaks at appropriate positions.
 * Ensures that each line does not exceed a specified maximum number of characters.
 *
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
function justifyTextCJK(text, maxCharsAllowedPerLine) {
  let curLineCharCount = 0;
  return text.replace(/[\S\s]/g, (char) => {
    if (/[\r\n]/.test(char)) {
      curLineCharCount = -2;
      return "\r\n";
    }
    curLineCharCount += /[\x00-\xFF]/.test(char) ? 1 : 2;
    if (curLineCharCount >= maxCharsAllowedPerLine) {
      curLineCharCount = 0;
      return "\r\n" + char;
    }
    return char;
  });
}

/**
 * Checks if a given string contains any CJK characters.
 * @param {string} str - The string to be checked.
 * @returns {boolean} - `true` if the string contains CJK characters; `false` otherwise.
 */
function isCJK(str) {
  return /[\p{Script=Han}]/u.test(str);
}

/**
 * Justifies English text by word wrapping.
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
function justifyTextEnglish(text, maxCharsAllowedPerLine) {
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
 * Main text justification function
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
function justifyText(text, maxCharsAllowedPerLine) {
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
 * Process text in chunks for better performance and progress tracking
 * @param {string} text - The text to process
 * @param {number} maxChars - Maximum characters per line
 * @param {number} chunkSize - Size of each chunk
 * @returns {Object} - Processed result with progress tracking
 */
function processTextInChunks(text, maxChars, chunkSize = 1000) {
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
 * Batch process multiple text operations
 * @param {Array} operations - Array of text operations to process
 * @returns {Array} - Array of processed results
 */
function batchProcessText(operations) {
  const results = [];

  operations.forEach((operation, index) => {
    const { text, maxChars, config } = operation;

    const startTime = performance.now();
    const justifiedText = justifyText(text, maxChars);
    const lines = justifiedText.split("\n");
    const linePositions = calculateLinePositions(lines, config);
    const processingTime = performance.now() - startTime;

    results.push({
      index: index,
      justifiedText: justifiedText,
      lines: lines,
      linePositions: linePositions,
      processingTime: processingTime,
      characterCount: text.length,
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
 * Optimize text for clipboard processing
 * @param {string} text - Clipboard text
 * @param {number} maxChars - Maximum characters per line
 * @returns {Object} - Optimized text data
 */
function optimizeClipboardText(text, maxChars) {
  const lines = text.split(/\r?\n/);
  const preview = lines.slice(0, 10).join("\n");
  const isLong = lines.length > 10;

  // Only process if it's worth the worker overhead
  if (text.length > 500) {
    const justified = justifyText(text, maxChars);
    return {
      originalText: text,
      justifiedText: justified,
      preview: preview,
      isLong: isLong,
      lineCount: lines.length,
      characterCount: text.length,
      processed: true,
    };
  } else {
    return {
      originalText: text,
      preview: preview,
      isLong: isLong,
      lineCount: lines.length,
      characterCount: text.length,
      processed: false,
    };
  }
}

// Main message handler
self.onmessage = function (e) {
  const { action, data, id } = e.data;
  const startTime = performance.now();

  try {
    let result;

    switch (action) {
      case "justifyText":
        const { text, maxChars, config } = data;

        if (text.length > 2000) {
          // Use chunked processing for large texts
          result = {
            justifiedText: processTextInChunks(text, maxChars),
            lines: null, // Will be calculated in main thread
            linePositions: null, // Will be calculated in main thread
            chunked: true,
          };
        } else {
          // Direct processing for smaller texts
          const justifiedText = justifyText(text, maxChars);
          const lines = justifiedText.split("\n");
          const linePositions = calculateLinePositions(lines, config);

          result = {
            justifiedText: justifiedText,
            lines: lines,
            linePositions: linePositions,
            chunked: false,
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

// Handle worker initialization
self.postMessage({
  type: "ready",
  timestamp: Date.now(),
});
