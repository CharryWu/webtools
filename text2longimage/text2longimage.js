const DEFAULT_IMG_CONFIG = {
  charsPerLine: 18,
  fontSize: 32,
  lineSpacing: 1.5,
  fontWeight: "400",
  padding: 42,
};

const STORAGE_KEYS = {
  TEXT_HISTORY: "text2longimage-history",
  CURRENT_TEXT: "user-text",
};

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
 * Justifies a given text by inserting line breaks at appropriate positions.
 * Ensures that each line does not exceed a specified maximum number of characters.
 *
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
function justifyTextCJK(text, maxCharsAllowedPerLine) {
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
function isCJK(str) {
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
function justifyTextEnglish(text, maxCharsAllowedPerLine) {
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
 * Saves text to history in localStorage
 * @param {string} text - The text to save
 */
function saveTextToHistory(text) {
  if (!text.trim()) return;

  if (window.localStorage) {
    let history = getTextHistory();

    // Don't save duplicate consecutive entries
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
 * Formats timestamp to readable date string
 * @param {number} timestamp - Unix timestamp
 * @returns {string} Formatted date string
 */
function formatDate(timestamp) {
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
 * @param {string} textAreaId - The ID of the text area element which contains the user input.
 * @param {string} canvasId - The ID of the canvas element which will render the image.
 * @param {boolean} darkMode - Whether to use dark mode for the image.
 * @param {object} config - Configuration for the image generation.
 * @returns {void}
 */
function textToImg(
  textAreaId,
  canvasId,
  darkMode,
  config = DEFAULT_IMG_CONFIG
) {
  let userText = $$(textAreaId).value;
  let $canvas = $$(canvasId);
  if (!$canvas) return;
  if (userText == "") {
    alert("Please enter some text!");
    $$(textAreaId).focus();
    return;
  }

  // Store current state for annotation
  currentCanvas = $canvas;
  currentConfig = config;
  currentDarkMode = darkMode;
  highlights = []; // Reset highlights for new text
  tempHighlight = null; // Reset temp highlight
  zoomLevel = 1; // Reset zoom level

  const { charsPerLine, fontSize, fontWeight, padding, lineSpacing } = config;
  const bgColor = darkMode ? "#222" : "#fff";
  const fgColor = darkMode ? "#fff" : "#222";

  // Save text to history when generating image
  saveTextToHistory(userText);

  if (window.localStorage) {
    window.localStorage.setItem(STORAGE_KEYS.CURRENT_TEXT, userText);
  }
  const txtWithLineBreaks = justifyText(userText, charsPerLine * 2);
  textLines = txtWithLineBreaks.split("\n");

  // Calculate line positions for annotation
  linePositions = [];
  for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
    linePositions.push({
      text: textLines[lineIdx],
      x: padding,
      y: fontSize * 1.5 * lineIdx + padding,
      lineIndex: lineIdx,
    });
  }

  renderCanvas($canvas, darkMode, config);
  setupCanvasEvents($canvas);

  $$("img").src = $canvas.toDataURL("image/png");
  $$("download-btn").onclick = function () {
    let date = new Date().valueOf(); // Timestamp in milliseconds since 1970-01-01
    let outputImgName = "changweibo" + date + ".png";
    download($canvas, outputImgName);
  };
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

  let canvasContext = $canvas.getContext("2d");
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
    canvasContext.fillRect(
      tempHighlight.x,
      tempHighlight.y,
      tempHighlight.width,
      tempHighlight.height
    );
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
 * Zoom in function
 */
function zoomIn() {
  zoomLevel = Math.min(zoomLevel * 1.2, 3); // Max 3x zoom
  if (currentCanvas && currentConfig) {
    applyZoom(currentCanvas);
  }
}

/**
 * Zoom out function
 */
function zoomOut() {
  zoomLevel = Math.max(zoomLevel * 0.8, 0.5); // Min 0.5x zoom
  if (currentCanvas && currentConfig) {
    applyZoom(currentCanvas);
  }
}

/**
 * Reset zoom function
 */
function resetZoom() {
  zoomLevel = 1;
  if (currentCanvas && currentConfig) {
    applyZoom(currentCanvas);
  }
}

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

  // Handle single line selection
  if (start.lineIndex === current.lineIndex) {
    const linePos = linePositions[start.lineIndex];
    const lineText = linePos.text;
    const selectedText = lineText.substring(start.charIndex, current.charIndex);

    if (selectedText.trim()) {
      const startX =
        padding + ctx.measureText(lineText.substring(0, start.charIndex)).width;
      const width = ctx.measureText(selectedText).width;

      return {
        x: startX,
        y: linePos.y,
        width: width,
        height: fontSize,
      };
    }
  }

  return null; // For simplicity, only show temp highlight for single line selections
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
 * Handles canvas mouse move for text selection
 */
function handleCanvasMouseMove(e) {
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
 * Handles canvas mouse up for text selection
 */
function handleCanvasMouseUp(e) {
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

/**
 * Gets text position from canvas coordinates
 */
function getTextPositionFromCoords(x, y) {
  const fontSize = currentConfig.fontSize;
  const padding = currentConfig.padding;

  // Find which line was clicked
  for (let i = 0; i < linePositions.length; i++) {
    const linePos = linePositions[i];
    const lineTop = linePos.y;
    const lineBottom = linePos.y + fontSize;

    if (y >= lineTop && y <= lineBottom) {
      // Find character position within the line
      const canvas = currentCanvas;
      const ctx = canvas.getContext("2d");
      ctx.font = currentConfig.fontWeight + " " + fontSize + "px sans-serif";

      let charIndex = 0;
      const lineText = linePos.text;

      for (let j = 0; j <= lineText.length; j++) {
        const textWidth = ctx.measureText(lineText.substring(0, j)).width;
        const charX = padding + textWidth;

        if (x <= charX) {
          charIndex = j;
          break;
        }
        charIndex = j + 1;
      }

      return {
        lineIndex: i,
        charIndex: Math.min(charIndex, lineText.length),
        x: x,
        y: y,
      };
    }
  }
  return null;
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

      let startChar = lineIdx === start.lineIndex ? start.charIndex : 0;
      let endChar = lineIdx === end.lineIndex ? end.charIndex : lineText.length;

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

function onGenerateButtonClick() {
  textToImg("txt", "canvas", false, DEFAULT_IMG_CONFIG);
}

function onGenerateDarkButtonClick() {
  textToImg("txt", "canvas", true, DEFAULT_IMG_CONFIG);
}

/**
 * Enables/disables the image generation buttons based on the textarea value.
 * If the textarea has some text, the buttons are enabled; otherwise, they are disabled.
 * @param {KeyboardEvent} e - The keyup event object.
 */
function onTextAreaKeyUp(e) {
  if (!e.target.value) {
    $$("submit-btn").disabled = true;
    $$("submit-btn-dark").disabled = true;
  } else {
    $$("submit-btn").disabled = false;
    $$("submit-btn-dark").disabled = false;
  }
}

// Initialize the page
document.addEventListener("DOMContentLoaded", (event) => {
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

  // Load and display text history
  displayTextHistory();

  if (window.localStorage) {
    let userText = window.localStorage.getItem(STORAGE_KEYS.CURRENT_TEXT);
    if (userText) {
      $$("txt").value = userText;
      $$("txt").dispatchEvent(new KeyboardEvent("keyup", { key: "Enter" }));
    }
  }
});
