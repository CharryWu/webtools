const DEFAULT_IMG_CONFIG = {
  charsPerLine: 18,
  fontSize: 32,
  lineSpacing: 1.5,
  fontWeight: "400",
  padding: 42,
};

const $ = (id) => document.getElementById(id);
function justifyText(text, maxCharsAllowedPerLine) {
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

function textToImg(textAreaId, canvasId, config = DEFAULT_IMG_CONFIG) {
  let userText = $(textAreaId).value;
  let $canvas = $(canvasId);
  if (!$canvas) return;
  if (userText == "") {
    alert("请输入文字！");
    $textArea.focus();
  }
  const { charsPerLine, fontSize, fontWeight, padding, lineSpacing } = config;
  const txtWithLineBreaks = justifyText(userText, charsPerLine * 2);
  let textLines = txtWithLineBreaks.split("\n");
  $canvas.width = fontSize * charsPerLine + padding * 2;
  $canvas.height = fontSize * lineSpacing * textLines.length + padding * 2;
  $canvas.style.background = "white";
  let canvasContext = $canvas.getContext("2d");
  canvasContext.clearRect(0, 0, $canvas.width, $canvas.height);
  canvasContext.fillStyle = "white";
  canvasContext.beginPath();
  canvasContext.fillRect(0, 0, $canvas.width, $canvas.height);
  canvasContext.fill();
  canvasContext.fillStyle = "black";
  canvasContext.font = fontWeight + " " + fontSize + "px sans-serif";
  canvasContext.textBaseline = "top";
  $canvas.style.display = "none";
  for (let lineIdx = 0; lineIdx < textLines.length; lineIdx++) {
    canvasContext.fillText(textLines[lineIdx], padding, fontSize * 1.5 * lineIdx + padding, $canvas.width);
  }
  $("img").src = $canvas.toDataURL("image/png");
  $("download-btn").onclick = function () {
    let date = new Date().valueOf();
    let outputImgName = "changweibo" + date + ".png";
    download($canvas, outputImgName);
  };
}
function download($canvas, outputImgName) {
  let $downloadLinkHidden = document.createElement("a");
  let _event;
  $downloadLinkHidden.download = outputImgName;
  $downloadLinkHidden.href = $canvas.toDataURL("image/png;base64");
  if (document.createEvent) {
    _event = document.createEvent("MouseEvents");
    _event.initMouseEvent("click", true, true, window, 0, 0, 0, 0, 0, false, false, false, false, 0, null);
    $downloadLinkHidden.dispatchEvent(_event);
  } else if ($downloadLinkHidden["fireEvent"]) {
    $downloadLinkHidden["fireEvent"]("onclick");
  }
}
