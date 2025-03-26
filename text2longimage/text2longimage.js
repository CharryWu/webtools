const DEFAULT_IMG_CONFIG = {
  charsPerLine: 18,
  fontSize: 32,
  lineSpacing: 1.5,
  fontWeight: "400",
  padding: 42,
};

const $$ = (id) => document.getElementById(id);

/**
 * Justifies a given text by inserting line breaks at appropriate positions.
 * Ensures that each line does not exceed a specified maximum number of characters.
 *
 * @param {string} text - The text to be justified.
 * @param {number} maxCharsAllowedPerLine - Maximum number of characters allowed per line.
 * @returns {string} - The justified text with line breaks.
 */
function justifyText(text, maxCharsAllowedPerLine) {
  let curLineCharCount = 0; // Initialize the character count for the current line
  return text.replace(/[\S\s]/g, (char) => { // `\s` matches whitespace (spaces, tabs and new lines). `\S` is negated `\s`.
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
 * @param {string} textAreaId - The ID of the text area element which contains the user input.
 * @param {string} canvasId - The ID of the canvas element which will render the image.
 * @param {boolean} darkMode - Whether to use dark mode for the image.
 * @param {object} config - Configuration for the image generation.
 * @returns {void}
 */
function textToImg(textAreaId, canvasId, darkMode, config = DEFAULT_IMG_CONFI) {
  let userText = $$(textAreaId).value;
  let $canvas = $$(canvasId);
  if (!$canvas) return;
  if (userText == "") {
    alert("Please enter some text!");
    $textArea.focus();
  }
  const { charsPerLine, fontSize, fontWeight, padding, lineSpacing } = config;
  const bgColor = darkMode ? "#222" : "#fff";
  const fgColor = darkMode ? "#fff" : "#222";
  const txtWithLineBreaks = justifyText(userText, charsPerLine * 2);
  let textLines = txtWithLineBreaks.split("\n");
  $canvas.width = fontSize * charsPerLine + padding * 2;
  $canvas.height = fontSize * lineSpacing * textLines.length + padding * 2;
  $canvas.style.background = bgColor;
  let canvasContext = $canvas.getContext("2d");
  canvasContext.clearRect(0, 0, $canvas.width, $canvas.height);
  canvasContext.fillStyle = bgColor;
  canvasContext.beginPath();
  canvasContext.fillRect(0, 0, $canvas.width, $canvas.height);
  canvasContext.fill();
  canvasContext.fillStyle = fgColor;
  canvasContext.font = fontWeight + " " + fontSize + "px sans-serif";
  canvasContext.textBaseline = "top";
  $canvas.style.display = "none";
  for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
    canvasContext.fillText(textLines[lineIdx], padding, fontSize * 1.5 * lineIdx + padding, $canvas.width);
  }
  $$("img").src = $canvas.toDataURL("image/png");
  $$("download-btn").onclick = function () {
    let date = new Date().valueOf(); // Timestamp in milliseconds since 1970-01-01
    let outputImgName = "changweibo" + date + ".png";
    download($canvas, outputImgName);
  };
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
    _event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
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

function onTextAreaKeyUp(e) {
  console.log('eee')
  if (!e.target.value) {
    $$('submit-btn').disabled = true;
    $$('submit-btn-dark').disabled = true;
  } else {
    $$('submit-btn').disabled = false;
    $$('submit-btn-dark').disabled = false;
  }
}

document.addEventListener("DOMContentLoaded", (event) => {
  $$("txt").onkeyup = onTextAreaKeyUp;
  $$("submit-btn").onclick = onGenerateButtonClick;
  $$("submit-btn-dark").onclick = onGenerateDarkButtonClick;
});
