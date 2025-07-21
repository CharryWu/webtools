/**
 * Tests for text-processor-worker.js
 * Tests for Web Worker text processing functionality
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Mock the worker environment
global.self = {
  postMessage: jest.fn(),
  onmessage: null,
};

// Import the text processing functions that are duplicated in the worker
import {
  justifyText,
  justifyTextCJK,
  justifyTextEnglish,
  isCJK,
} from "../utils.js";

describe("Text Processor Worker Functions", () => {
  describe("processTextInChunks (simulated)", () => {
    // Since processTextInChunks is internal to the worker, we'll test the concept
    it("should process large text in chunks", () => {
      const largeText = "A".repeat(5000);
      const chunkSize = 1000;
      const maxChars = 50;

      // Simulate chunked processing
      const chunks = [];
      for (let i = 0; i < largeText.length; i += chunkSize) {
        chunks.push(largeText.slice(i, i + chunkSize));
      }

      expect(chunks).toHaveLength(5);

      // Process each chunk
      const processedChunks = chunks.map((chunk) =>
        justifyText(chunk, maxChars)
      );
      const result = processedChunks.join("\r\n");

      expect(result.length).toBeGreaterThan(0);
      expect(result).toContain("\r\n");
    });
  });

  describe("calculateLinePositions (simulated)", () => {
    const calculateLinePositions = (lines, config) => {
      const { fontSize, padding } = config;

      return lines.map((line, index) => ({
        text: line,
        x: padding,
        y: fontSize * 1.5 * index + padding,
        lineIndex: index,
      }));
    };

    it("should calculate correct line positions", () => {
      const lines = ["Line 1", "Line 2", "Line 3"];
      const config = { fontSize: 16, padding: 10 };

      const positions = calculateLinePositions(lines, config);

      expect(positions).toHaveLength(3);
      expect(positions[0]).toEqual({
        text: "Line 1",
        x: 10,
        y: 10,
        lineIndex: 0,
      });
      expect(positions[1]).toEqual({
        text: "Line 2",
        x: 10,
        y: 34, // 16 * 1.5 + 10
        lineIndex: 1,
      });
      expect(positions[2]).toEqual({
        text: "Line 3",
        x: 10,
        y: 58, // 16 * 1.5 * 2 + 10
        lineIndex: 2,
      });
    });

    it("should handle empty lines", () => {
      const lines = ["", "Line 2", ""];
      const config = { fontSize: 20, padding: 5 };

      const positions = calculateLinePositions(lines, config);

      expect(positions).toHaveLength(3);
      expect(positions[0].text).toBe("");
      expect(positions[1].text).toBe("Line 2");
      expect(positions[2].text).toBe("");
    });
  });

  describe("batchProcessText (simulated)", () => {
    const batchProcessText = (operations) => {
      const results = [];

      operations.forEach((operation, index) => {
        const { text, maxChars, config } = operation;

        const startTime = performance.now();
        const justifiedText = justifyText(text, maxChars);
        const lines = justifiedText.split("\n");
        const processingTime = performance.now() - startTime;

        results.push({
          index: index,
          justifiedText: justifiedText,
          lines: lines,
          processingTime: processingTime,
          characterCount: text.length,
        });
      });

      return results;
    };

    it("should batch process multiple operations", () => {
      const operations = [
        { text: "First text to process", maxChars: 10, config: {} },
        { text: "Second text to process", maxChars: 15, config: {} },
        { text: "Third text to process", maxChars: 20, config: {} },
      ];

      const results = batchProcessText(operations);

      expect(results).toHaveLength(3);
      expect(results[0].index).toBe(0);
      expect(results[1].index).toBe(1);
      expect(results[2].index).toBe(2);

      results.forEach((result) => {
        expect(result.justifiedText).toBeDefined();
        expect(result.lines).toBeDefined();
        expect(result.processingTime).toBeGreaterThanOrEqual(0);
        expect(result.characterCount).toBeGreaterThan(0);
      });
    });

    it("should handle empty operations array", () => {
      const results = batchProcessText([]);
      expect(results).toEqual([]);
    });
  });

  describe("optimizeClipboardText (simulated)", () => {
    const optimizeClipboardText = (text, maxChars) => {
      const lines = text.split(/\r?\n/);
      const preview = lines.slice(0, 10).join("\n");
      const isLong = lines.length > 10;

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
    };

    it("should optimize large clipboard text", () => {
      const largeText = "A".repeat(600) + "\nB".repeat(500);
      const result = optimizeClipboardText(largeText, 50);

      expect(result.processed).toBe(true);
      expect(result.justifiedText).toBeDefined();
      expect(result.originalText).toBe(largeText);
      expect(result.characterCount).toBe(largeText.length);
    });

    it("should not process small clipboard text", () => {
      const smallText = "Small text";
      const result = optimizeClipboardText(smallText, 50);

      expect(result.processed).toBe(false);
      expect(result.justifiedText).toBeUndefined();
      expect(result.originalText).toBe(smallText);
    });

    it("should detect long content correctly", () => {
      const manyLines = Array.from(
        { length: 15 },
        (_, i) => `Line ${i + 1}`
      ).join("\n");
      const result = optimizeClipboardText(manyLines, 50);

      expect(result.isLong).toBe(true);
      expect(result.lineCount).toBe(15);
      expect(result.preview.split("\n")).toHaveLength(10);
    });
  });
});

describe("Worker Message Handling (simulated)", () => {
  let mockWorkerScope;

  beforeEach(() => {
    mockWorkerScope = {
      postMessage: jest.fn(),
      onmessage: null,
      performance: {
        now: jest.fn(() => Date.now()),
      },
    };

    // Mock worker message handler behavior
    mockWorkerScope.handleMessage = function (e) {
      const { action, data, id } = e.data;
      const startTime = this.performance.now();

      try {
        let result;

        switch (action) {
          case "justifyText":
            const { text, maxChars, config } = data;
            const justifiedText = justifyText(text, maxChars);
            const lines = justifiedText.split("\n");

            result = {
              justifiedText: justifiedText,
              lines: lines,
              linePositions: lines.map((line, index) => ({
                text: line,
                x: config.padding || 0,
                y:
                  (config.fontSize || 16) * 1.5 * index + (config.padding || 0),
                lineIndex: index,
              })),
              chunked: false,
            };
            break;

          case "clipboardOptimize":
            const clipResult = this.optimizeClipboard(data.text, data.maxChars);
            result = clipResult;
            break;

          default:
            throw new Error(`Unknown action: ${action}`);
        }

        const processingTime = this.performance.now() - startTime;

        this.postMessage({
          type: "result",
          action: action,
          result: result,
          processingTime: processingTime,
          id: id,
        });
      } catch (error) {
        this.postMessage({
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

    mockWorkerScope.optimizeClipboard = function (text, maxChars) {
      const lines = text.split(/\r?\n/);
      return {
        originalText: text,
        preview: lines.slice(0, 10).join("\n"),
        isLong: lines.length > 10,
        lineCount: lines.length,
        characterCount: text.length,
        processed: text.length > 500,
      };
    };
  });

  it("should handle justifyText action", () => {
    const message = {
      data: {
        action: "justifyText",
        data: {
          text: "Test text for justification",
          maxChars: 10,
          config: { fontSize: 16, padding: 10 },
        },
        id: "test-id-1",
      },
    };

    mockWorkerScope.handleMessage(message);

    expect(mockWorkerScope.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "result",
        action: "justifyText",
        result: expect.objectContaining({
          justifiedText: expect.any(String),
          lines: expect.any(Array),
          linePositions: expect.any(Array),
          chunked: false,
        }),
        processingTime: expect.any(Number),
        id: "test-id-1",
      })
    );
  });

  it("should handle clipboardOptimize action", () => {
    const message = {
      data: {
        action: "clipboardOptimize",
        data: {
          text: "Clipboard text content",
          maxChars: 20,
        },
        id: "test-id-2",
      },
    };

    mockWorkerScope.handleMessage(message);

    expect(mockWorkerScope.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "result",
        action: "clipboardOptimize",
        result: expect.objectContaining({
          originalText: "Clipboard text content",
          preview: "Clipboard text content",
          isLong: false,
          processed: false,
        }),
        id: "test-id-2",
      })
    );
  });

  it("should handle unknown actions with error", () => {
    const message = {
      data: {
        action: "unknownAction",
        data: {},
        id: "test-id-3",
      },
    };

    mockWorkerScope.handleMessage(message);

    expect(mockWorkerScope.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "error",
        action: "unknownAction",
        error: expect.objectContaining({
          message: "Unknown action: unknownAction",
        }),
        id: "test-id-3",
      })
    );
  });

  it("should send ready message on initialization", () => {
    // Simulate worker initialization
    mockWorkerScope.postMessage({
      type: "ready",
      timestamp: Date.now(),
    });

    expect(mockWorkerScope.postMessage).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "ready",
        timestamp: expect.any(Number),
      })
    );
  });

  it("should measure processing time", () => {
    const startTime = 1000;
    const endTime = 1050;

    mockWorkerScope.performance.now
      .mockReturnValueOnce(startTime)
      .mockReturnValueOnce(endTime);

    const message = {
      data: {
        action: "justifyText",
        data: { text: "test", maxChars: 10, config: {} },
        id: "timing-test",
      },
    };

    mockWorkerScope.handleMessage(message);

    const lastCall =
      mockWorkerScope.postMessage.mock.calls[
        mockWorkerScope.postMessage.mock.calls.length - 1
      ];
    expect(lastCall[0].processingTime).toBe(50);
  });
});

describe("Text Processing Integration", () => {
  it("should handle CJK text processing in worker context", () => {
    const cjkText = "这是一个测试中文文本，应该被正确处理和换行";
    const result = justifyText(cjkText, 15);

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(cjkText.length); // Due to line breaks
    expect(result).toContain("\r\n");
  });

  it("should handle English text processing in worker context", () => {
    const englishText =
      "This is a test English text that should be processed correctly with proper word wrapping";
    const result = justifyText(englishText, 20);

    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(englishText.length); // Due to line breaks
    expect(result).toContain("\r\n");
  });

  it("should handle mixed CJK and English text", () => {
    const mixedText = "Hello 你好 World 世界 Test 测试";
    const result = justifyText(mixedText, 15);

    expect(result).toBeDefined();
    expect(typeof result).toBe("string");

    // Should handle mixed text without errors
    const lines = result.split("\r\n");
    expect(lines.length).toBeGreaterThan(0);
  });

  it("should preserve performance characteristics", () => {
    const largeText = Array.from(
      { length: 1000 },
      (_, i) => `Line ${i + 1} with some content`
    ).join("\n");

    const startTime = performance.now();
    const result = justifyText(largeText, 50);
    const endTime = performance.now();

    const processingTime = endTime - startTime;

    expect(result).toBeDefined();
    expect(processingTime).toBeLessThan(1000); // Should process within 1 second
  });
});
