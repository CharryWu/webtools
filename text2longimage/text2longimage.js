// Import utilities from utils.js
import {
  DEFAULT_IMG_CONFIG,
  STORAGE_KEYS,
  debounce,
  throttleRAF,
  justifyText,
  validateTextInput,
  retryOperation,
  safeAsyncOperation,
  formatDate,
  getFirstLines,
  isClipboardAPIAvailable,
} from "./utils.js";

// Web Worker Manager
let workerManager = null;
let isProcessing = false;

// Annotation state
let annotationMode = false;
let textLines = [];
let linePositions = [];
let highlights = [];
let isSelecting = false;
let selectionStart = null;
let selectionEnd = null;
let currentCanvas = null;
let currentConfig = null;
let currentDarkMode = false;
let zoomLevel = 1;
let tempHighlight = null;

const $$ = (id) => document.getElementById(id);

/**
 * Initialize Web Worker Manager
 */
function initializeWorkerManager() {
  if (typeof WorkerManager !== "undefined") {
    workerManager = new WorkerManager();
    updateWorkerStatus();

    // Check worker status periodically
    setInterval(updateWorkerStatus, 5000);
  } else {
    console.warn("WorkerManager not available, using fallback mode");
    showWorkerStatus("Web Worker not supported", "worker-fallback");
  }
}

/**
 * Update worker status indicator
 */
function updateWorkerStatus() {
  if (!workerManager) return;

  const status = workerManager.getStatus();
  const statusElement = $$("worker-status");
  const statusText = $$("worker-status-text");

  if (!statusElement || !statusText) return;

  if (status.ready && !status.fallbackMode) {
    statusText.textContent = "🚀 Web Worker Ready";
    statusElement.className = "worker-status worker-ready show";
  } else if (status.fallbackMode) {
    statusText.textContent = "⚠️ Fallback Mode";
    statusElement.className = "worker-status worker-fallback show";
  } else if (status.supported) {
    statusText.textContent = "⏳ Initializing Worker...";
    statusElement.className = "worker-status show";
  } else {
    statusText.textContent = "❌ Worker Not Supported";
    statusElement.className = "worker-status worker-error show";
  }

  // Hide status after 3 seconds if worker is ready
  if (status.ready && !status.fallbackMode) {
    setTimeout(() => {
      statusElement.classList.remove("show");
    }, 3000);
  }
}

/**
 * Show worker status message
 */
function showWorkerStatus(message, className = "") {
  const statusElement = $$("worker-status");
  const statusText = $$("worker-status-text");

  if (statusElement && statusText) {
    statusText.textContent = message;
    statusElement.className = `worker-status ${className} show`;

    setTimeout(() => {
      statusElement.classList.remove("show");
    }, 3000);
  }
}

/**
 * Show processing panel with progress
 */
function _showProcessingPanel() {
  const panel = $$("processing-panel");
  const status = $$("processing-status");
  const progress = $$("processing-progress");
  const details = $$("processing-details");

  if (panel) {
    panel.style.display = "block";
    isProcessing = true;

    // Disable convert buttons
    $$("submit-btn").disabled = true;
    $$("submit-btn-dark").disabled = true;

    // Reset progress
    if (progress) {
      progress.style.width = "0%";
      progress.setAttribute("aria-valuenow", "0");
    }

    if (status) status.textContent = "Processing text...";
    if (details) details.textContent = "Preparing text processing...";
  }
}

/**
 * Hide processing panel
 */
function hideProcessingPanel() {
  const panel = $$("processing-panel");

  if (panel) {
    panel.style.display = "none";
    isProcessing = false;

    // Re-enable convert buttons if text exists
    const textarea = $$("txt");
    if (textarea && textarea.value.trim()) {
      $$("submit-btn").disabled = false;
      $$("submit-btn-dark").disabled = false;
    }
  }
}

/**
 * Update processing progress
 */
function updateProcessingProgress(data) {
  const status = $$("processing-status");
  const progress = $$("processing-progress");
  const details = $$("processing-details");

  if (data.type === "progress") {
    if (progress) {
      progress.style.width = `${data.progress}%`;
      progress.setAttribute("aria-valuenow", data.progress);
    }

    if (data.chunk && data.total) {
      if (status)
        status.textContent = `Processing chunk ${data.chunk} of ${data.total}...`;
      if (details)
        details.textContent = `Processing large text in chunks for better performance`;
    } else {
      if (status)
        status.textContent = `Processing... ${Math.round(data.progress)}%`;
      if (details) details.textContent = `Text justification in progress`;
    }
  } else if (data.type === "batchProgress") {
    if (progress) {
      progress.style.width = `${data.progress}%`;
      progress.setAttribute("aria-valuenow", data.progress);
    }

    if (status)
      status.textContent = `Processing batch ${data.completed} of ${data.total}...`;
    if (details) details.textContent = `Batch processing text operations`;
  }
}

/**
 * Show performance metrics
 */
function showPerformanceMetrics(
  processingTime,
  workerTime,
  textLength,
  workerUsed
) {
  const details = $$("processing-details");

  if (details) {
    const metrics = [];

    if (processingTime) {
      metrics.push(
        `<span class="metric">Total: <span class="metric-value">${processingTime.toFixed(
          1
        )}ms</span></span>`
      );
    }

    if (workerTime) {
      metrics.push(
        `<span class="metric">Worker: <span class="metric-value">${workerTime.toFixed(
          1
        )}ms</span></span>`
      );
    }

    if (textLength) {
      metrics.push(
        `<span class="metric">Length: <span class="metric-value">${textLength}</span></span>`
      );
    }

    if (workerUsed !== undefined) {
      metrics.push(
        `<span class="metric">Mode: <span class="metric-value">${
          workerUsed ? "Worker" : "Fallback"
        }</span></span>`
      );
    }

    details.innerHTML = `<div class="performance-metrics">${metrics.join(
      ""
    )}</div>`;
  }
}

// Expose justifyText to window for fallback processing
window.justifyText = justifyText;

/**
 * Saves text to history in localStorage
 * @param {string} textAreaId - The ID of the text area element which contains the user input.
 */
function saveTextToHistory(textAreaId) {
  const text = $$(textAreaId).value;
  if (!text.trim()) return;

  if (window.localStorage) {
    let history = getTextHistory();

    // Don't save recent duplicate consecutive entries
    // Historical duplicate entries are fine, as they are not recent
    if (history.length > 0 && history[0].text === text) return;

    const entry = {
      text: text,
      timestamp: Date.now(),
      id: String(Date.now() + Math.random()), // Unique ID
    };

    // Add to beginning of array (most recent first)
    history.unshift(entry);

    // Keep only the most recent 50 entries
    if (history.length > 50) {
      history = history.slice(0, 50);
    }

    window.localStorage.setItem(
      STORAGE_KEYS.TEXT_HISTORY,
      JSON.stringify(history)
    );
    displayTextHistory();
  }
}

/**
 * Retrieves text history from localStorage
 * @returns {Array} Array of text history entries
 */
function getTextHistory() {
  if (window.localStorage) {
    const historyJson = window.localStorage.getItem(STORAGE_KEYS.TEXT_HISTORY);
    return historyJson ? JSON.parse(historyJson) : [];
  }
  return [];
}

/**
 * Deletes a text entry from history
 * @param {string|number} entryId - The ID of the entry to delete
 */
function deleteTextEntry(entryId) {
  if (!window.localStorage) return;

  // if (confirm("Are you sure you want to delete this text?")) {
  let history = getTextHistory();
  history = history.filter((entry) => entry.id !== entryId);
  window.localStorage.setItem(
    STORAGE_KEYS.TEXT_HISTORY,
    JSON.stringify(history)
  );
  displayTextHistory();
  // }
}

/**
 * Clears all text history
 */
function deleteAllTexts() {
  if (!window.localStorage) return;

  if (
    confirm(
      "Are you sure you want to delete ALL saved texts? This action cannot be undone."
    )
  ) {
    window.localStorage.removeItem(STORAGE_KEYS.TEXT_HISTORY);
    displayTextHistory();
  }
}

/**
 * Uses the selected text in the editor textarea
 * @param {string} text - The text to use in the editor
 */
function useTextInEditor(text) {
  const textarea = $$("txt");
  if (textarea) {
    textarea.value = text;
    // Trigger the keyup event to enable the convert buttons
    textarea.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    // Focus the textarea for better UX
    textarea.focus();
    // Scroll to the textarea
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
  }
}

/**
 * Displays text history as tiles
 */
function displayTextHistory() {
  const historyContainer = $$("text-history");
  const noHistoryMsg = $$("no-history");
  const deleteAllBtn = $$("delete-all-btn");
  const history = getTextHistory();

  // Always clear existing tiles first
  const existingTiles = historyContainer.querySelectorAll(".text-tile");
  existingTiles.forEach((tile) => tile.remove());

  if (history.length === 0) {
    noHistoryMsg.style.display = "block";
    deleteAllBtn.style.display = "none";
    return;
  }

  noHistoryMsg.style.display = "none";
  deleteAllBtn.style.display = "inline-block";

  history.forEach((entry) => {
    const tile = createTextTile(entry);
    historyContainer.appendChild(tile);
  });
}

/**
 * Creates a text tile element
 * @param {Object} entry - Text history entry
 * @returns {HTMLElement} The tile element
 */
function createTextTile(entry) {
  const tile = document.createElement("div");
  tile.className = "text-tile";

  // Create header with view and delete buttons
  const header = document.createElement("div");
  header.className = "text-tile-header";

  const dateContainer = document.createElement("div");
  dateContainer.style.display = "flex";
  dateContainer.style.alignItems = "center";

  const date = document.createElement("span");
  date.className = "text-tile-date";
  date.textContent = formatDate(entry.timestamp);

  const viewBtn = document.createElement("button");
  viewBtn.className = "view-btn";
  viewBtn.innerHTML = "view";
  viewBtn.title = "View full text";
  viewBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent tile click
    showTextModal(entry);
  };

  const useBtn = document.createElement("button");
  useBtn.className = "use-btn";
  useBtn.innerHTML = "use this";
  useBtn.title = "Use this text in the editor";
  useBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent tile click
    useTextInEditor(entry.text);
  };

  const deleteBtn = document.createElement("button");
  deleteBtn.className = "delete-btn";
  deleteBtn.innerHTML = "×";
  deleteBtn.title = "Delete this text";
  deleteBtn.onclick = (e) => {
    e.stopPropagation(); // Prevent tile click
    deleteTextEntry(entry.id);
  };

  dateContainer.appendChild(date);
  dateContainer.appendChild(viewBtn);
  dateContainer.appendChild(useBtn);
  header.appendChild(dateContainer);
  header.appendChild(deleteBtn);

  const preview = document.createElement("div");
  preview.className = "text-tile-preview";
  preview.textContent = entry.text; // Remove manual truncation, let CSS handle it
  preview.title = entry.text; // Show full text on hover

  // Make the preview clickable (not the whole tile)
  preview.onclick = () => showTextModal(entry);

  tile.appendChild(header);
  tile.appendChild(preview);

  return tile;
}

/**
 * Shows the text view modal with full text content
 * @param {Object} entry - Text history entry
 */
function showTextModal(entry) {
  $$("saved-text-content").textContent = entry.text;
  $$("saved-text-date").textContent = `Saved on ${new Date(
    entry.timestamp
  ).toLocaleString()}`;

  // Store current entry for copy and delete functionality
  $$("copy-text-btn").dataset.textToCopy = entry.text;
  $$("modal-delete-btn").dataset.entryId = entry.id;

  // Show the modal
  const modal = new bootstrap.Modal($$("textViewModal"));
  modal.show();
}

/**
 * Copies text to clipboard
 * @param {string} text - Text to copy
 */
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      // Fallback for older browsers
      const textArea = document.createElement("textarea");
      textArea.value = text;
      textArea.style.position = "fixed";
      textArea.style.left = "-999999px";
      textArea.style.top = "-999999px";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      document.execCommand("copy");
      textArea.remove();
    }

    // Show success feedback
    const btn = $$("copy-text-btn");
    const originalText = btn.textContent;
    btn.textContent = "Copied!";
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = originalText;
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error("Failed to copy text: ", err);
    alert("Failed to copy text to clipboard");
  }
}

/**
 * Handle Web Worker errors gracefully
 */
function handleWorkerError(error, operation = "processing") {
  console.error(`Worker error during ${operation}:`, error);

  // Hide processing panel if shown
  hideProcessingPanel();

  // Show error status
  showWorkerStatus(`${operation} failed`, "worker-error");

  // Try to gracefully degrade to fallback mode
  if (workerManager && !workerManager.fallbackMode) {
    console.warn("Switching to fallback mode due to worker error");
    workerManager.fallbackMode = true;
  }
}

/**
 * Enhanced error reporting
 */
function reportError(error, context = "") {
  const errorInfo = {
    message: error.message,
    stack: error.stack,
    context: context,
    timestamp: new Date().toISOString(),
    workerStatus: workerManager ? workerManager.getStatus() : null,
    userAgent: navigator.userAgent,
    url: window.location.href,
  };

  console.error("Text2LongImage Error Report:", errorInfo);

  // In production, you might want to send this to an error tracking service
  // sendErrorReport(errorInfo);

  return errorInfo;
}

/**
 * Local safe async operation wrapper with error reporting
 */
async function safeAsyncOperationLocal(
  operation,
  fallback = null,
  context = "operation"
) {
  return await safeAsyncOperation(operation, fallback, context).catch(
    (error) => {
      reportError(error, context);
      throw error;
    }
  );
}

/**
 * Accept textAreaId instead of userText, so if userText is too large, it will
 * not be passed as fn parameter resulting in way smaller stack overhead.
 * @param {string} textAreaId - The ID of the text area element which contains the user input.
 * @param {string} canvasId - The ID of the canvas element which will render the image.
 * @param {boolean} darkMode - Whether to use dark mode for the image.
 * @param {object} config - Configuration for the image generation.
 * @returns {void}
 */
async function textToImg(
  textAreaId,
  canvasId,
  darkMode,
  config = DEFAULT_IMG_CONFIG
) {
  const userText = $$(textAreaId).value;
  try {
    validateTextInput(userText);

    return await retryOperation(
      async () => {
        let result;

        if (workerManager) {
          // Use Web Worker for text processing
          result = await workerManager.processText(
            userText,
            config.charsPerLine * 2,
            config,
            updateProcessingProgress
          );

          // Handle chunked processing result
          if (result.chunked) {
            // For chunked processing, we need to split the result
            textLines = result.justifiedText.split("\n");

            // Calculate line positions in main thread since worker didn't
            linePositions = [];
            for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
              linePositions.push({
                text: textLines[lineIdx],
                x: config.padding,
                y: config.fontSize * 1.5 * lineIdx + config.padding,
                lineIndex: lineIdx,
              });
            }
          } else {
            // Direct result from worker
            textLines = result.lines;
            linePositions = result.linePositions;
          }

          // Show performance metrics
          showPerformanceMetrics(
            result.totalProcessingTime,
            result.workerProcessingTime,
            userText.length,
            result.workerUsed
          );
        } else {
          // Fallback to main thread processing
          updateProcessingProgress({ type: "progress", progress: 25 });

          const txtWithLineBreaks = justifyText(
            userText,
            config.charsPerLine * 2
          );
          textLines = txtWithLineBreaks.split("\n");

          updateProcessingProgress({ type: "progress", progress: 75 });

          // Calculate line positions for annotation
          linePositions = [];
          for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
            linePositions.push({
              text: textLines[lineIdx],
              x: config.padding,
              y: config.fontSize * 1.5 * lineIdx + config.padding,
              lineIndex: lineIdx,
            });
          }

          updateProcessingProgress({ type: "progress", progress: 100 });

          // Show fallback metrics
          showPerformanceMetrics(null, null, userText.length, false);
        }

        // Clear text measurement cache for new configuration
        clearTextMeasurementCache();

        // Render canvas
        renderCanvas($$(canvasId), darkMode, config);
        setupCanvasEvents($$(canvasId));

        // Store canvas and config for annotation mode
        currentCanvas = $$(canvasId);
        currentConfig = config;
        currentDarkMode = darkMode;

        $$("img").src = $$(canvasId).toDataURL("image/png");
        $$("download-btn").onclick = function () {
          const date = new Date().valueOf();
          const outputImgName = "changweibo" + date + ".png";
          download($$(canvasId), outputImgName);
        };

        // Hide processing panel after a short delay to show completion
        setTimeout(() => {
          hideProcessingPanel();
        }, 1000);
      },
      2,
      500
    );
  } catch (error) {
    handleWorkerError(error, "text conversion");
    reportError(error, "textToImg");
    throw error;
  }
}

/**
 * Renders the canvas with text and highlights
 */
function renderCanvas($canvas, darkMode, config, skipZoom = false) {
  const { charsPerLine, fontSize, fontWeight, padding, lineSpacing } = config;
  const bgColor = darkMode ? "#222" : "#fff";
  const fgColor = darkMode ? "#fff" : "#222";

  $canvas.width = fontSize * charsPerLine + padding * 2;
  $canvas.height = fontSize * lineSpacing * textLines.length + padding * 2;
  $canvas.style.background = bgColor;

  const canvasContext = $canvas.getContext("2d");
  canvasContext.clearRect(0, 0, $canvas.width, $canvas.height);

  // Fill background
  canvasContext.fillStyle = bgColor;
  canvasContext.fillRect(0, 0, $canvas.width, $canvas.height);

  // Draw highlights first (behind text)
  canvasContext.fillStyle = "#FFFF00"; // Bright yellow
  highlights.forEach((highlight) => {
    canvasContext.fillRect(
      highlight.x,
      highlight.y,
      highlight.width,
      highlight.height
    );
  });

  // Draw temporary highlight during selection
  if (tempHighlight) {
    canvasContext.fillStyle = "rgba(255, 255, 0, 0.5)"; // Semi-transparent yellow
    if (Array.isArray(tempHighlight)) {
      // Handle multiple temporary highlights for multi-line selection
      tempHighlight.forEach((highlight) => {
        canvasContext.fillRect(
          highlight.x,
          highlight.y,
          highlight.width,
          highlight.height
        );
      });
    } else {
      // Handle single temporary highlight (backward compatibility)
      canvasContext.fillRect(
        tempHighlight.x,
        tempHighlight.y,
        tempHighlight.width,
        tempHighlight.height
      );
    }
  }

  // Draw text
  canvasContext.fillStyle = fgColor;
  canvasContext.font = fontWeight + " " + fontSize + "px sans-serif";
  canvasContext.textBaseline = "top";

  for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
    canvasContext.fillText(
      textLines[lineIdx],
      padding,
      fontSize * 1.5 * lineIdx + padding,
      $canvas.width
    );
  }

  // Apply zoom and show/hide canvas
  if (!skipZoom) {
    applyZoom($canvas);
  }
  $canvas.style.display = annotationMode ? "block" : "none";
}

/**
 * Applies zoom to canvas
 */
function applyZoom($canvas) {
  const scaledWidth = Math.floor($canvas.width * zoomLevel);
  const scaledHeight = Math.floor($canvas.height * zoomLevel);
  $canvas.style.width = scaledWidth + "px";
  $canvas.style.height = scaledHeight + "px";
}

/**
 * Raw zoom in function (immediate execution)
 */
function zoomInRaw() {
  zoomLevel = Math.min(zoomLevel * 1.2, 3); // Max 3x zoom
  if (currentCanvas && currentConfig) {
    applyZoom(currentCanvas);
  }
}

/**
 * Raw zoom out function (immediate execution)
 */
function zoomOutRaw() {
  zoomLevel = Math.max(zoomLevel * 0.8, 0.5); // Min 0.5x zoom
  if (currentCanvas && currentConfig) {
    applyZoom(currentCanvas);
  }
}

/**
 * Raw reset zoom function (immediate execution)
 */
function resetZoomRaw() {
  zoomLevel = 1;
  if (currentCanvas && currentConfig) {
    applyZoom(currentCanvas);
  }
}

/**
 * Debounced zoom functions to prevent rapid clicking
 * 150ms debounce provides smooth user experience without lag
 */
const zoomIn = debounce(zoomInRaw, 150);
const zoomOut = debounce(zoomOutRaw, 150);
const resetZoom = debounce(resetZoomRaw, 150);

/**
 * Creates temporary highlight during selection
 */
function createTempHighlight(start, current) {
  if (!start || !current || !currentConfig) return null;

  // Ensure start comes before current
  if (
    start.lineIndex > current.lineIndex ||
    (start.lineIndex === current.lineIndex &&
      start.charIndex > current.charIndex)
  ) {
    [start, current] = [current, start];
  }

  const fontSize = currentConfig.fontSize;
  const padding = currentConfig.padding;
  const canvas = currentCanvas;
  const ctx = canvas.getContext("2d");
  ctx.font = currentConfig.fontWeight + " " + fontSize + "px sans-serif";

  const tempHighlights = [];

  // Handle single line selection
  if (start.lineIndex === current.lineIndex) {
    const linePos = linePositions[start.lineIndex];
    const lineText = linePos.text;
    const selectedText = lineText.substring(start.charIndex, current.charIndex);

    if (selectedText.trim()) {
      const startX =
        padding + ctx.measureText(lineText.substring(0, start.charIndex)).width;
      const width = ctx.measureText(selectedText).width;

      tempHighlights.push({
        x: startX,
        y: linePos.y,
        width: width,
        height: fontSize,
      });
    }
  } else {
    // Handle multi-line selection
    for (
      let lineIdx = start.lineIndex;
      lineIdx <= current.lineIndex;
      lineIdx++
    ) {
      const linePos = linePositions[lineIdx];
      const lineText = linePos.text;

      const startChar = lineIdx === start.lineIndex ? start.charIndex : 0;
      const endChar =
        lineIdx === current.lineIndex ? current.charIndex : lineText.length;

      const selectedText = lineText.substring(startChar, endChar);
      if (selectedText.trim()) {
        const startX =
          padding + ctx.measureText(lineText.substring(0, startChar)).width;
        const width = ctx.measureText(selectedText).width;

        tempHighlights.push({
          x: startX,
          y: linePos.y,
          width: width,
          height: fontSize,
        });
      }
    }
  }

  return tempHighlights.length > 0 ? tempHighlights : null;
}

/**
 * Gets accurate canvas coordinates accounting for zoom and scroll
 */
function getCanvasCoordinates(e) {
  if (!currentCanvas) return null;

  const rect = currentCanvas.getBoundingClientRect();

  // Get mouse position relative to canvas display area
  const displayX = e.clientX - rect.left;
  const displayY = e.clientY - rect.top;

  // Convert from display coordinates to actual canvas coordinates
  // Display size = actual size * zoom level, so:
  // actual coordinate = display coordinate / zoom level
  const canvasX = displayX / zoomLevel;
  const canvasY = displayY / zoomLevel;

  return { x: canvasX, y: canvasY };
}

/**
 * Sets up canvas event handlers for annotation
 */
function setupCanvasEvents($canvas) {
  $canvas.addEventListener("mousedown", handleCanvasMouseDown);
  $canvas.addEventListener("mousemove", handleCanvasMouseMove);
  $canvas.addEventListener("mouseup", handleCanvasMouseUp);
  $canvas.style.cursor = "default";
}

/**
 * Handles canvas mouse down for text selection
 */
function handleCanvasMouseDown(e) {
  if (!annotationMode) return;

  const coords = getCanvasCoordinates(e);
  if (!coords) return;

  const clickedPosition = getTextPositionFromCoords(coords.x, coords.y);
  if (clickedPosition) {
    isSelecting = true;
    selectionStart = clickedPosition;
    selectionEnd = clickedPosition;
    tempHighlight = null;
    currentCanvas.style.cursor = "text";
  }
}

/**
 * Raw canvas mouse move handler (heavy operations)
 */
function handleCanvasMouseMoveRaw(e) {
  if (!annotationMode || !isSelecting) return;

  const coords = getCanvasCoordinates(e);
  if (!coords) return;

  const currentPosition = getTextPositionFromCoords(coords.x, coords.y);
  if (currentPosition) {
    selectionEnd = currentPosition;

    // Create and show temporary highlight in real-time
    tempHighlight = createTempHighlight(selectionStart, currentPosition);
    renderCanvas(currentCanvas, currentDarkMode, currentConfig, true);
  }
}

/**
 * Throttled canvas mouse move handler for smooth performance
 * Limits canvas updates to ~60 FPS (16ms) for responsive but efficient selection
 */
const handleCanvasMouseMove = throttleRAF(handleCanvasMouseMoveRaw);

/**
 * Handles canvas mouse up for text selection
 */
function handleCanvasMouseUp(_e) {
  if (!annotationMode || !isSelecting) return;

  isSelecting = false;
  currentCanvas.style.cursor = "crosshair";
  tempHighlight = null; // Clear temporary highlight

  if (selectionStart && selectionEnd) {
    addHighlight(selectionStart, selectionEnd);
    selectionStart = null;
    selectionEnd = null;
  }
}

// Cache for text measurements to avoid repeated canvas.measureText calls
const textMeasurementCache = new Map();

/**
 * Gets cached text measurement or calculates and caches it
 */
function getCachedTextMeasurement(ctx, text, fontKey) {
  const cacheKey = `${fontKey}:${text}`;

  if (textMeasurementCache.has(cacheKey)) {
    return textMeasurementCache.get(cacheKey);
  }

  const width = ctx.measureText(text).width;
  textMeasurementCache.set(cacheKey, width);

  // Limit cache size to prevent memory leaks
  if (textMeasurementCache.size > 1000) {
    // Remove oldest entries
    const keysToDelete = Array.from(textMeasurementCache.keys()).slice(0, 200);
    keysToDelete.forEach((key) => textMeasurementCache.delete(key));
  }

  return width;
}

/**
 * Gets text position from canvas coordinates with optimized measurements
 */
function getTextPositionFromCoords(x, y) {
  const fontSize = currentConfig.fontSize;
  const padding = currentConfig.padding;

  // Find which line was clicked using binary search for better performance
  let lineIndex = -1;
  for (let i = 0; i < linePositions.length; i++) {
    const linePos = linePositions[i];
    const lineTop = linePos.y;
    const lineBottom = linePos.y + fontSize;

    if (y >= lineTop && y <= lineBottom) {
      lineIndex = i;
      break;
    }
  }

  if (lineIndex === -1) return null;

  // Find character position within the line using optimized text measurement
  const canvas = currentCanvas;
  const ctx = canvas.getContext("2d");
  const fontKey = `${currentConfig.fontWeight}_${fontSize}`;
  ctx.font = `${currentConfig.fontWeight} ${fontSize}px sans-serif`;

  const lineText = linePositions[lineIndex].text;
  let charIndex = 0;

  // Use binary search for faster character position finding in long lines
  if (lineText.length > 20) {
    let left = 0;
    let right = lineText.length;

    while (left < right) {
      const mid = Math.floor((left + right) / 2);
      const textWidth = getCachedTextMeasurement(
        ctx,
        lineText.substring(0, mid),
        fontKey
      );
      const charX = padding + textWidth;

      if (x <= charX) {
        right = mid;
      } else {
        left = mid + 1;
      }
    }
    charIndex = left;
  } else {
    // Use linear search for short lines (faster for small text)
    for (let j = 0; j <= lineText.length; j++) {
      const textWidth = getCachedTextMeasurement(
        ctx,
        lineText.substring(0, j),
        fontKey
      );
      const charX = padding + textWidth;

      if (x <= charX) {
        charIndex = j;
        break;
      }
      charIndex = j + 1;
    }
  }

  return {
    lineIndex: lineIndex,
    charIndex: Math.min(charIndex, lineText.length),
    x: x,
    y: y,
  };
}

/**
 * Clear text measurement cache when canvas/config changes
 */
function clearTextMeasurementCache() {
  textMeasurementCache.clear();
}

/**
 * Adds a highlight between two text positions
 */
function addHighlight(start, end) {
  // Ensure start comes before end
  if (
    start.lineIndex > end.lineIndex ||
    (start.lineIndex === end.lineIndex && start.charIndex > end.charIndex)
  ) {
    [start, end] = [end, start];
  }

  const fontSize = currentConfig.fontSize;
  const padding = currentConfig.padding;
  const canvas = currentCanvas;
  const ctx = canvas.getContext("2d");
  ctx.font = currentConfig.fontWeight + " " + fontSize + "px sans-serif";

  // Handle single line selection
  if (start.lineIndex === end.lineIndex) {
    const linePos = linePositions[start.lineIndex];
    const lineText = linePos.text;
    const selectedText = lineText.substring(start.charIndex, end.charIndex);

    if (selectedText.trim()) {
      const startX =
        padding + ctx.measureText(lineText.substring(0, start.charIndex)).width;
      const width = ctx.measureText(selectedText).width;

      highlights.push({
        x: startX,
        y: linePos.y,
        width: width,
        height: fontSize,
        startLine: start.lineIndex,
        endLine: end.lineIndex,
        startChar: start.charIndex,
        endChar: end.charIndex,
      });
    }
  } else {
    // Handle multi-line selection
    for (let lineIdx = start.lineIndex; lineIdx <= end.lineIndex; lineIdx++) {
      const linePos = linePositions[lineIdx];
      const lineText = linePos.text;

      const startChar = lineIdx === start.lineIndex ? start.charIndex : 0;
      const endChar =
        lineIdx === end.lineIndex ? end.charIndex : lineText.length;

      const selectedText = lineText.substring(startChar, endChar);
      if (selectedText.trim()) {
        const startX =
          padding + ctx.measureText(lineText.substring(0, startChar)).width;
        const width = ctx.measureText(selectedText).width;

        highlights.push({
          x: startX,
          y: linePos.y,
          width: width,
          height: fontSize,
          startLine: lineIdx,
          endLine: lineIdx,
          startChar: startChar,
          endChar: endChar,
        });
      }
    }
  }

  // Clear temp highlight and re-render canvas with new highlights
  tempHighlight = null;
  renderCanvas(currentCanvas, currentDarkMode, currentConfig);
  $$("img").src = currentCanvas.toDataURL("image/png");

  // Show clear annotations button
  $$("clear-annotations-btn").style.display = "inline-block";
}

/**
 * Toggles annotation mode
 */
function toggleAnnotationMode() {
  annotationMode = !annotationMode;
  const btn = $$("annotate-btn");
  const img = $$("img");
  const zoomControls = $$("zoom-controls");

  if (annotationMode) {
    btn.textContent = "Exit Annotate";
    btn.classList.remove("btn-warning");
    btn.classList.add("btn-success");

    // Hide original image and show zoom controls
    if (img) img.style.display = "none";
    if (zoomControls) zoomControls.style.display = "flex";

    if (currentCanvas) {
      currentCanvas.style.cursor = "crosshair";
      currentCanvas.style.display = "block";
      applyZoom(currentCanvas); // Apply current zoom
    }
  } else {
    btn.textContent = "Annotate";
    btn.classList.remove("btn-success");
    btn.classList.add("btn-warning");

    // Show original image and hide zoom controls
    if (img) img.style.display = "block";
    if (zoomControls) zoomControls.style.display = "none";

    if (currentCanvas) {
      currentCanvas.style.cursor = "default";
      currentCanvas.style.display = "none";
    }

    // Clear any temporary selections
    tempHighlight = null;
    isSelecting = false;
    selectionStart = null;
    selectionEnd = null;
  }
}

/**
 * Clears all annotations
 */
function clearAllAnnotations() {
  highlights = [];
  tempHighlight = null;
  if (currentCanvas && currentConfig) {
    renderCanvas(currentCanvas, currentDarkMode, currentConfig);
    $$("img").src = currentCanvas.toDataURL("image/png");
  }
  $$("clear-annotations-btn").style.display = "none";
}

/**
 * Downloads the image from the given canvas element to the user's device.
 * @param {$canvas} $canvas - The canvas element to download.
 * @param {string} outputImgName - The desired filename of the downloaded image.
 * @returns {void}
 */
function download($canvas, outputImgName) {
  const $downloadLinkHidden = document.createElement("a");
  let _event;
  $downloadLinkHidden.download = outputImgName;
  $downloadLinkHidden.href = $canvas.toDataURL("image/png;base64");

  if (document.createEvent) {
    // Create a mouse event and dispatch it to the anchor element,
    // which will download the image.
    _event = document.createEvent("MouseEvents");
    _event = new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
      detail: 0,
      screenX: 0,
      screenY: 0,
      clientX: 0,
      clientY: 0,
      ctrlKey: false,
      altKey: false,
      shiftKey: false,
      metaKey: false,
      button: 0,
      relatedTarget: null,
    });
    $downloadLinkHidden.dispatchEvent(_event);
  } else if ($downloadLinkHidden["fireEvent"]) {
    // Use the fireEvent method to simulate a click event on the anchor element.
    $downloadLinkHidden["fireEvent"]("onclick");
  }
}

/**
 * Raw generate button handlers
 */
function onGenerateButtonClickRaw() {
  saveTextToHistory("txt"); // Save text to history when generating image
  textToImg("txt", "canvas", false, DEFAULT_IMG_CONFIG);
}

function onGenerateDarkButtonClickRaw() {
  saveTextToHistory("txt"); // Save text to history when generating image
  textToImg("txt", "canvas", true, DEFAULT_IMG_CONFIG);
}

/**
 * Debounced generate button handlers to prevent rapid clicking
 * 500ms debounce prevents multiple simultaneous processing operations
 */
const onGenerateButtonClick = debounce(onGenerateButtonClickRaw, 500);
const onGenerateDarkButtonClick = debounce(onGenerateDarkButtonClickRaw, 500);

/**
 * Raw text area keyup handler
 * @param {KeyboardEvent} e - The keyup event object.
 */
function onTextAreaKeyUpRaw(e) {
  if (!e.target.value) {
    $$("submit-btn").disabled = true;
    $$("submit-btn-dark").disabled = true;
  } else {
    $$("submit-btn").disabled = false;
    $$("submit-btn-dark").disabled = false;
  }
}

/**
 * Debounced text area keyup handler to prevent excessive processing during rapid typing
 * 200ms debounce provides responsive feedback without overwhelming the browser
 */
const onTextAreaKeyUp = debounce(onTextAreaKeyUpRaw, 200);

// Clipboard detection functionality
let lastCheckedClipboard = "";
let clipboardCheckTimeout = null;

/**
 * Reads clipboard content and checks if it's different from textarea
 * @returns {Promise<string|null>} The clipboard content or null if not available/same
 */
async function readClipboardContent() {
  if (!isClipboardAPIAvailable()) {
    console.warn("Clipboard API not available");
    return null;
  }

  try {
    const clipboardText = await navigator.clipboard.readText();
    const trimmedClipboard = clipboardText.trim();
    const currentTextArea = $$("txt").value.trim();

    // Don't show if clipboard is empty, same as textarea, or same as last checked
    if (
      !trimmedClipboard ||
      trimmedClipboard === currentTextArea ||
      trimmedClipboard === lastCheckedClipboard
    ) {
      return null;
    }

    lastCheckedClipboard = trimmedClipboard;
    return clipboardText;
  } catch (error) {
    console.warn("Failed to read clipboard:", error);
    return null;
  }
}

/**
 * Enhanced clipboard processing with error handling
 */
async function showClipboardPanel(clipboardContent) {
  return await safeAsyncOperationLocal(
    async () => {
      const panel = $$("clipboard-panel");
      const preview = $$("clipboard-preview");
      const previewStatus = $$("clipboard-preview-status");

      if (!panel || !preview) return;

      let result;

      if (workerManager) {
        // Use Web Worker for clipboard optimization
        result = await workerManager.optimizeClipboardText(
          clipboardContent,
          DEFAULT_IMG_CONFIG.charsPerLine * 2
        );
      } else {
        // Fallback processing
        const lines = clipboardContent.split(/\r?\n/);
        result = {
          originalText: clipboardContent,
          preview: lines.slice(0, 10).join("\n"),
          isLong: lines.length > 10,
          lineCount: lines.length,
          characterCount: clipboardContent.length,
          processed: false,
          fallback: true,
        };
      }

      // Get first 10 lines for preview
      const previewText = result.preview || getFirstLines(clipboardContent, 10);
      const isPreviewTruncated =
        result.isLong || clipboardContent.split(/\r?\n/).length > 10;

      // Clear previous content
      preview.innerHTML = "";
      preview.classList.remove("empty");

      // Set initial header text
      if (previewStatus) {
        previewStatus.textContent = isPreviewTruncated
          ? "Preview (first 10 lines):"
          : "Preview:";
      }

      // Create preview text container
      const previewContainer = document.createElement("div");
      previewContainer.textContent = previewText;
      preview.appendChild(previewContainer);

      // Add expand/collapse link if content is truncated
      if (isPreviewTruncated) {
        const expandLink = document.createElement("a");
        expandLink.href = "#";
        expandLink.style.cssText =
          "display: block; font-size: 11px; color: #007bff; margin-top: 8px; text-decoration: underline; cursor: pointer;";
        expandLink.textContent = "▼ Show full content";

        let isExpanded = false;

        expandLink.onclick = async (e) => {
          e.preventDefault();

          if (!isExpanded) {
            // Expand to show full content
            if (result.processed && result.justifiedText) {
              // Use pre-processed justified text from worker
              previewContainer.textContent = result.justifiedText;
            } else {
              // Use original text
              previewContainer.textContent = clipboardContent;
            }
            expandLink.textContent = "▲ Show less";
            if (previewStatus) {
              previewStatus.textContent = "Preview (full content):";
            }
            isExpanded = true;
          } else {
            // Collapse to show truncated content
            previewContainer.textContent = previewText;
            expandLink.textContent = "▼ Show full content";
            if (previewStatus) {
              previewStatus.textContent = "Preview (first 10 lines):";
            }
            isExpanded = false;
          }
        };

        preview.appendChild(expandLink);
      }

      // Store full content for later use
      $$("apply-clipboard-btn").dataset.clipboardContent = clipboardContent;

      // Show panel with animation
      panel.style.display = "block";

      // Show processing info if available
      if (result.workerUsed !== undefined) {
        console.log(
          `Clipboard processed using ${
            result.workerUsed ? "Web Worker" : "fallback mode"
          }`
        );
      }
    },
    () => {
      // Fallback: simple clipboard preview
      const panel = $$("clipboard-panel");
      const preview = $$("clipboard-preview");

      if (panel && preview) {
        preview.innerHTML = "";
        preview.textContent = getFirstLines(clipboardContent, 10);
        $$("apply-clipboard-btn").dataset.clipboardContent = clipboardContent;
        panel.style.display = "block";
      }
    },
    "clipboard panel display"
  );
}

/**
 * Hides the clipboard panel
 */
function hideClipboardPanel() {
  const panel = $$("clipboard-panel");
  if (panel) {
    panel.style.display = "none";
    // Clear lastCheckedClipboard to allow future automatic detection
    lastCheckedClipboard = "";
  }
}

/**
 * Applies clipboard content to the textarea
 */
function applyClipboardContent() {
  const btn = $$("apply-clipboard-btn");
  const clipboardContent = btn?.dataset.clipboardContent;

  if (!clipboardContent) return;

  const textarea = $$("txt");
  if (textarea) {
    textarea.value = clipboardContent;
    // Trigger keyup event to enable submit buttons
    textarea.dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));

    // Save to localStorage
    if (window.localStorage) {
      window.localStorage.setItem(STORAGE_KEYS.CURRENT_TEXT, clipboardContent);
    }

    // Smooth scroll to textarea
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });

    // Hide clipboard panel
    hideClipboardPanel();

    // Focus textarea
    setTimeout(() => textarea.focus(), 500);
  }
}

/**
 * Checks clipboard and shows panel if new content is detected
 */
async function checkClipboardAndShow() {
  // Clear any existing timeout
  if (clipboardCheckTimeout) {
    clearTimeout(clipboardCheckTimeout);
  }

  // Don't check if panel is already visible or if currently processing
  const panel = $$("clipboard-panel");
  if ((panel && panel.style.display !== "none") || isProcessing) {
    return;
  }

  try {
    const clipboardContent = await readClipboardContent();
    if (clipboardContent) {
      // Show clipboard panel with Web Worker processing
      await showClipboardPanel(clipboardContent);
    }
  } catch (error) {
    console.error("Clipboard check failed:", error);
  }
}

/**
 * Forces clipboard check and update, bypassing normal restrictions
 */
async function forceCheckClipboard() {
  // Clear any existing timeout
  if (clipboardCheckTimeout) {
    clearTimeout(clipboardCheckTimeout);
  }

  try {
    // Check if clipboard API is available
    if (!isClipboardAPIAvailable()) {
      console.warn("Clipboard API not available");
      showWorkerStatus("Clipboard not supported", "worker-error");
      return;
    }

    // Read clipboard content directly without restrictions
    const clipboardText = await navigator.clipboard.readText();
    const trimmedClipboard = clipboardText.trim();

    if (!trimmedClipboard) {
      // Hide panel if clipboard is empty
      hideClipboardPanel();
      showWorkerStatus("Clipboard is empty", "worker-fallback");
      return;
    }

    // Update lastCheckedClipboard to the new content
    lastCheckedClipboard = trimmedClipboard;

    // Show clipboard panel with the content
    await showClipboardPanel(clipboardText);

    showWorkerStatus("Clipboard refreshed", "worker-ready");
  } catch (error) {
    console.error("Force clipboard check failed:", error);
    showWorkerStatus("Clipboard check failed", "worker-error");
  }
}

/**
 * Automatic clipboard check that can update panel even when visible
 */
async function autoCheckClipboard() {
  // Clear any existing timeout
  if (clipboardCheckTimeout) {
    clearTimeout(clipboardCheckTimeout);
  }

  // Skip if currently processing to avoid interference
  if (isProcessing) {
    return;
  }

  try {
    // Check if clipboard API is available
    if (!isClipboardAPIAvailable()) {
      return;
    }

    // Read clipboard content directly
    const clipboardText = await navigator.clipboard.readText();
    const trimmedClipboard = clipboardText.trim();
    const currentTextArea = $$("txt").value.trim();

    // Check if clipboard has new content
    if (!trimmedClipboard) {
      // If clipboard is empty and panel is visible, hide it
      const panel = $$("clipboard-panel");
      if (panel && panel.style.display !== "none") {
        hideClipboardPanel();
      }
      return;
    }

    // Skip if clipboard content is same as textarea
    if (trimmedClipboard === currentTextArea) {
      return;
    }

    // Check if clipboard content has changed
    if (trimmedClipboard !== lastCheckedClipboard) {
      // Update lastCheckedClipboard and show/update panel
      lastCheckedClipboard = trimmedClipboard;
      await showClipboardPanel(clipboardText);
    }
  } catch (error) {
    // Silently handle errors for automatic checks
    console.warn("Auto clipboard check failed:", error);
  }
}

/**
 * Checks clipboard with debouncing for automatic detection
 */
async function debouncedClipboardCheck() {
  if (clipboardCheckTimeout) {
    clearTimeout(clipboardCheckTimeout);
  }

  clipboardCheckTimeout = setTimeout(async () => {
    try {
      await autoCheckClipboard();
    } catch (error) {
      console.error("Debounced clipboard check failed:", error);
    }
  }, 500);
}

// Initialize the page
document.addEventListener("DOMContentLoaded", (_event) => {
  // Initialize Web Worker Manager first
  initializeWorkerManager();

  $$("txt").onkeyup = onTextAreaKeyUp;
  $$("submit-btn").onclick = onGenerateButtonClick;
  $$("submit-btn-dark").onclick = onGenerateDarkButtonClick;

  // Set up copy button
  $$("copy-text-btn").onclick = function () {
    const textToCopy = this.dataset.textToCopy;
    if (textToCopy) {
      copyToClipboard(textToCopy);
    }
  };

  // Set up modal delete button
  $$("modal-delete-btn").onclick = function () {
    const entryId = this.dataset.entryId;
    if (entryId) {
      deleteTextEntry(entryId);
      // Close the modal after deletion
      const modal = bootstrap.Modal.getInstance($$("textViewModal"));
      if (modal) {
        modal.hide();
      }
    }
  };

  // Set up delete all button
  $$("delete-all-btn").onclick = deleteAllTexts;

  // Set up annotation buttons
  $$("annotate-btn").onclick = toggleAnnotationMode;
  $$("clear-annotations-btn").onclick = clearAllAnnotations;

  // Set up zoom buttons
  $$("zoom-in-btn").onclick = zoomIn;
  $$("zoom-out-btn").onclick = zoomOut;
  $$("zoom-reset-btn").onclick = resetZoom;

  // Set up clipboard panel buttons
  $$("apply-clipboard-btn").onclick = applyClipboardContent;
  $$("dismiss-clipboard-btn").onclick = hideClipboardPanel;

  // Debounced clipboard refresh to prevent rapid clicking
  const debouncedForceCheckClipboard = debounce(async () => {
    try {
      await forceCheckClipboard();
    } catch (error) {
      console.error("Manual clipboard check failed:", error);
      showWorkerStatus("Clipboard check failed", "worker-error");
    }
  }, 300);

  $$("refresh-clipboard-btn").onclick = debouncedForceCheckClipboard;

  // Load and display text history
  displayTextHistory();

  // Automatic clipboard checking
  if (isClipboardAPIAvailable()) {
    // Check clipboard on page load (with delay to allow worker initialization)
    setTimeout(async () => {
      try {
        await checkClipboardAndShow();
      } catch (error) {
        console.error("Initial clipboard check failed:", error);
      }
    }, 2000);

    // Check clipboard when page regains focus
    window.addEventListener("focus", async () => {
      try {
        await debouncedClipboardCheck();
      } catch (error) {
        console.error("Focus clipboard check failed:", error);
      }
    });

    // Check clipboard when user clicks anywhere (with debouncing)
    document.addEventListener("click", async () => {
      try {
        await debouncedClipboardCheck();
      } catch (error) {
        console.error("Click clipboard check failed:", error);
      }
    });

    // Periodic clipboard checking (every 30 seconds when page is visible)
    setInterval(async () => {
      if (!document.hidden && !isProcessing) {
        try {
          await autoCheckClipboard();
        } catch (error) {
          console.error("Periodic clipboard check failed:", error);
        }
      }
    }, 30000);
  } else {
    console.warn("Clipboard API not available. Clipboard detection disabled.");
  }

  if (window.localStorage) {
    const userText = window.localStorage.getItem(STORAGE_KEYS.CURRENT_TEXT);
    if (userText) {
      $$("txt").value = userText;
      $$("txt").dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    }
  }

  // Clean up worker on page unload
  window.addEventListener("beforeunload", () => {
    if (workerManager) {
      workerManager.terminate();
    }
  });
});

// Global error handler for unhandled promises
window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason);
  reportError(event.reason, "unhandled promise rejection");

  // Prevent the default behavior (logging to console)
  event.preventDefault();

  // Show user-friendly error message
  showWorkerStatus("Unexpected error occurred", "worker-error");
});

// Global error handler for uncaught exceptions
window.addEventListener("error", (event) => {
  console.error("Uncaught error:", event.error);
  reportError(event.error, "uncaught exception");

  // Show user-friendly error message
  showWorkerStatus("System error occurred", "worker-error");
});
