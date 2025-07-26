/**
 * Jest Setup File for Text2LongImage Tests
 * Configures testing environment with necessary mocks and globals
 */

import { jest } from "@jest/globals";

// Mock Web APIs that aren't available in Node.js test environment
global.Worker = jest.fn(() => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null,
}));

// Mock Canvas API - Complete mock without requiring native canvas
global.HTMLCanvasElement.prototype.getContext = jest.fn((contextType) => {
  if (contextType === "2d") {
    return {
      fillStyle: "",
      strokeStyle: "",
      font: "",
      textBaseline: "",
      textAlign: "",
      globalAlpha: 1,
      lineWidth: 1,
      fillRect: jest.fn(),
      strokeRect: jest.fn(),
      clearRect: jest.fn(),
      fillText: jest.fn(),
      strokeText: jest.fn(),
      measureText: jest.fn((text) => ({
        width: text ? text.length * 8 : 0, // Simple width calculation
        actualBoundingBoxLeft: 0,
        actualBoundingBoxRight: text ? text.length * 8 : 0,
        actualBoundingBoxAscent: 12,
        actualBoundingBoxDescent: 4,
      })),
      beginPath: jest.fn(),
      closePath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      arc: jest.fn(),
      save: jest.fn(),
      restore: jest.fn(),
      translate: jest.fn(),
      scale: jest.fn(),
      rotate: jest.fn(),
      drawImage: jest.fn(),
      createImageData: jest.fn(() => ({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
      })),
      getImageData: jest.fn(() => ({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray(4),
      })),
      putImageData: jest.fn(),
    };
  }
  return null;
});

global.HTMLCanvasElement.prototype.toDataURL = jest.fn(
  () =>
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg=="
);

global.HTMLCanvasElement.prototype.toBlob = jest.fn((callback) => {
  const blob = new Blob(["fake-canvas-blob"], { type: "image/png" });
  if (callback) callback(blob);
});

// Mock OffscreenCanvas if needed
global.OffscreenCanvas = jest.fn(() => ({
  width: 300,
  height: 150,
  getContext: global.HTMLCanvasElement.prototype.getContext,
  convertToBlob: jest.fn().mockResolvedValue(new Blob()),
}));

// Mock localStorage
const localStorageMock = {
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
};
global.localStorage = localStorageMock;

// Mock clipboard API
global.navigator = global.navigator || {};
global.navigator.clipboard = {
  readText: jest.fn().mockResolvedValue(""),
  writeText: jest.fn().mockResolvedValue(undefined),
};

// Mock performance API
global.performance = global.performance || {
  now: jest.fn(() => Date.now()),
};

// Mock requestAnimationFrame
global.requestAnimationFrame = jest.fn((cb) => {
  const id = setTimeout(cb, 16);
  return id;
});
global.cancelAnimationFrame = jest.fn((id) => clearTimeout(id));

// Mock URL.createObjectURL
global.URL.createObjectURL = jest.fn(() => "blob:mock-url");
global.URL.revokeObjectURL = jest.fn();

// Mock document methods used in tests
global.document.createElement = jest.fn((tagName) => {
  const element = {
    tagName: tagName.toUpperCase(),
    style: {},
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    appendChild: jest.fn(),
    removeChild: jest.fn(),
    getAttribute: jest.fn(),
    setAttribute: jest.fn(),
    classList: {
      add: jest.fn(),
      remove: jest.fn(),
      contains: jest.fn(),
    },
  };

  if (tagName === "canvas") {
    element.getContext = global.HTMLCanvasElement.prototype.getContext;
    element.toDataURL = global.HTMLCanvasElement.prototype.toDataURL;
    element.width = 800;
    element.height = 600;
  }

  return element;
});

// Mock console methods for cleaner test output
const originalConsole = global.console;
global.console = {
  ...originalConsole,
  log: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  localStorageMock.getItem.mockClear();
  localStorageMock.setItem.mockClear();
  localStorageMock.removeItem.mockClear();
  localStorageMock.clear.mockClear();

  // Re-setup RAF mock for each test
  global.requestAnimationFrame = jest.fn((cb) => {
    const id = setTimeout(cb, 16);
    return id;
  });
});
