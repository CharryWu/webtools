/**
 * Tests for worker-manager.js
 * Comprehensive test suite for WorkerManager class
 */
import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";

// Import WorkerManager
import WorkerManager from "../worker-manager.js";

describe("WorkerManager", () => {
  let workerManager;
  let mockWorker;

  beforeEach(() => {
    // Reset global mocks
    global.Worker = jest.fn();

    // Create a more sophisticated worker mock
    mockWorker = {
      postMessage: jest.fn(),
      terminate: jest.fn(),
      onmessage: null,
      onerror: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
    };

    global.Worker.mockImplementation((scriptUrl, options) => {
      return mockWorker;
    });

    // Mock URL creation for blob workers
    global.URL.createObjectURL = jest.fn(() => "blob:mock-worker-url");
    global.Blob = jest.fn(() => ({}));

    // Mock window.justifyText for fallback mode - ensure window exists
    if (!global.window) {
      global.window = {};
    }
    global.window.justifyText = jest.fn(
      (text, maxChars) => `justified: ${text}`
    );
  });

  afterEach(() => {
    if (workerManager) {
      workerManager.terminate();
    }
    jest.clearAllMocks();
  });

  describe("Constructor and Initialization", () => {
    it("should initialize with worker support", () => {
      workerManager = new WorkerManager();

      expect(workerManager.workerSupported).toBe(true);
      expect(workerManager.fallbackMode).toBe(false);
      expect(global.Worker).toHaveBeenCalledWith("text-processor-worker.js", {
        type: "module",
      });
    });

    it("should initialize in fallback mode when Worker is not supported", () => {
      global.Worker = undefined;

      workerManager = new WorkerManager();

      expect(workerManager.workerSupported).toBe(false);
      expect(workerManager.fallbackMode).toBe(true);
    });

    it("should set up worker event handlers", () => {
      workerManager = new WorkerManager();

      expect(mockWorker.onmessage).toBeInstanceOf(Function);
      expect(mockWorker.onerror).toBeInstanceOf(Function);
    });

    it("should set fallback mode on worker initialization error", () => {
      global.Worker.mockImplementation(() => {
        throw new Error("Worker initialization failed");
      });

      workerManager = new WorkerManager();

      expect(workerManager.fallbackMode).toBe(true);
    });
  });

  describe("Message Handling", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
    });

    it("should handle ready message", () => {
      const readyMessage = {
        data: { type: "ready", timestamp: Date.now() },
      };

      mockWorker.onmessage(readyMessage);

      expect(workerManager.isWorkerReady).toBe(true);
    });

    it("should handle result message", async () => {
      // First ensure worker is ready to avoid fallback mode
      workerManager.isWorkerReady = true;

      const resultPromise = workerManager.sendRequest("testAction", {
        test: "data",
      });

      // Wait a bit for the promise to start and check if postMessage was called
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockWorker.postMessage).toHaveBeenCalled();

      // Get the request ID from the postMessage call
      const postMessageCall = mockWorker.postMessage.mock.calls[0];
      const requestId = postMessageCall[0].id;

      const resultMessage = {
        data: {
          type: "result",
          action: "testAction",
          result: { success: true },
          processingTime: 100,
          id: requestId,
        },
      };

      mockWorker.onmessage(resultMessage);

      const result = await resultPromise;
      expect(result).toEqual({ success: true, workerProcessingTime: 100 });
    });

    it("should handle error message", async () => {
      // Ensure worker is ready to avoid fallback mode
      workerManager.isWorkerReady = true;

      const resultPromise = workerManager.sendRequest("testAction", {
        test: "data",
      });

      // Wait for the request to be sent
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalled();

      const postMessageCall = mockWorker.postMessage.mock.calls[0];
      const requestId = postMessageCall[0].id;

      const errorMessage = {
        data: {
          type: "error",
          action: "testAction",
          error: { message: "Test error" },
          id: requestId,
        },
      };

      mockWorker.onmessage(errorMessage);

      await expect(resultPromise).rejects.toThrow("Test error");
    });

    it("should handle progress messages", async () => {
      // Ensure worker is ready to avoid fallback mode
      workerManager.isWorkerReady = true;

      const progressCallback = jest.fn();
      const requestPromise = workerManager.sendRequest(
        "testAction",
        { test: "data" },
        progressCallback
      );

      // Wait for the request to be sent
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalled();

      const postMessageCall = mockWorker.postMessage.mock.calls[0];
      const requestId = postMessageCall[0].id;

      const progressMessage = {
        data: {
          type: "progress",
          progress: 50,
          id: requestId,
        },
      };

      mockWorker.onmessage(progressMessage);

      expect(progressCallback).toHaveBeenCalledWith({
        type: "progress",
        progress: 50,
        id: requestId,
      });
    });
  });

  describe("Worker Error Handling", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
    });

    it("should handle worker errors", () => {
      const error = new Error("Worker error");

      mockWorker.onerror(error);

      expect(workerManager.fallbackMode).toBe(true);
    });

    it("should reject pending requests on worker error", async () => {
      // Set up worker as ready first to avoid fallback mode
      workerManager.isWorkerReady = true;

      const request1 = workerManager.sendRequest("testAction", {});
      const request2 = workerManager.sendRequest("testAction", {});

      mockWorker.onerror(new Error("Worker failed"));

      await expect(request1).rejects.toThrow("Worker failed");
      await expect(request2).rejects.toThrow("Worker failed");
    });
  });

  describe("Text Processing", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
      workerManager.isWorkerReady = true;
    });

    it("should process text successfully", async () => {
      const mockResult = {
        justifiedText: "processed text",
        lines: ["line1", "line2"],
        linePositions: [],
        chunked: false,
      };

      // Mock sendRequest to resolve immediately
      jest.spyOn(workerManager, "sendRequest").mockResolvedValue(mockResult);

      const result = await workerManager.processText(
        "test text",
        20,
        {},
        jest.fn()
      );

      expect(result.justifiedText).toBe("processed text");
      expect(result.totalProcessingTime).toBeDefined();
      expect(result.workerUsed).toBe(true);
    });

    it("should optimize clipboard text", async () => {
      const mockResult = {
        originalText: "clipboard text",
        preview: "preview",
        isLong: false,
        processed: true,
      };

      jest.spyOn(workerManager, "sendRequest").mockResolvedValue(mockResult);

      const result = await workerManager.optimizeClipboardText(
        "clipboard text",
        20
      );

      expect(result.originalText).toBe("clipboard text");
      expect(result.workerUsed).toBe(true);
    });

    it("should calculate line positions", async () => {
      const mockResult = [
        { text: "line1", x: 0, y: 0, lineIndex: 0 },
        { text: "line2", x: 0, y: 32, lineIndex: 1 },
      ];

      jest.spyOn(workerManager, "sendRequest").mockResolvedValue(mockResult);

      const result = await workerManager.calculateLinePositions(
        ["line1", "line2"],
        {}
      );

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("line1");
    });

    it("should batch process operations", async () => {
      const mockResult = [
        { index: 0, justifiedText: "result1" },
        { index: 1, justifiedText: "result2" },
      ];

      jest.spyOn(workerManager, "sendRequest").mockResolvedValue(mockResult);

      const operations = [
        { text: "text1", maxChars: 20, config: {} },
        { text: "text2", maxChars: 20, config: {} },
      ];

      const result = await workerManager.batchProcess(operations, jest.fn());

      expect(result).toHaveLength(2);
      expect(result[0].justifiedText).toBe("result1");
    });
  });

  describe("Fallback Processing", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
      workerManager.fallbackMode = true;
    });

    it("should use fallback for text justification", async () => {
      // Make sure window.justifyText is properly mocked
      global.window.justifyText = jest.fn(
        (text, maxChars) => `justified: ${text}`
      );

      const result = await workerManager.processText("test text", 20, {
        fontSize: 16,
        padding: 10,
      });

      expect(result.justifiedText).toBe("justified: test text");
      expect(result.fallback).toBe(true);
      expect(result.workerUsed).toBe(false);
    });

    it("should use fallback for clipboard optimization", async () => {
      const result = await workerManager.optimizeClipboardText(
        "clipboard text",
        20
      );

      expect(result.originalText).toBe("clipboard text");
      expect(result.fallback).toBe(true);
    });

    it("should use fallback for line position calculation", async () => {
      const lines = ["line1", "line2"];
      const config = { fontSize: 16, padding: 10 };

      const result = await workerManager.calculateLinePositions(lines, config);

      expect(result).toHaveLength(2);
      expect(result[0].text).toBe("line1");
      expect(result[0].x).toBe(10);
      expect(result[0].y).toBe(10);
      expect(result[1].y).toBe(34); // 16 * 1.5 + 10
    });

    it("should handle unknown actions in fallback", async () => {
      await expect(
        workerManager.sendRequest("unknownAction", {})
      ).rejects.toThrow("Unknown fallback action: unknownAction");
    });
  });

  describe("Request Management", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
      workerManager.isWorkerReady = true;
    });

    it("should generate unique request IDs", async () => {
      const promise1 = workerManager.sendRequest("action1", {});
      const promise2 = workerManager.sendRequest("action2", {});

      const call1 = mockWorker.postMessage.mock.calls[0][0];
      const call2 = mockWorker.postMessage.mock.calls[1][0];

      expect(call1.id).not.toBe(call2.id);
      expect(call1.id).toBeGreaterThan(0);
      expect(call2.id).toBeGreaterThan(call1.id);
    });

    it("should timeout requests", async () => {
      jest.useFakeTimers();

      const requestPromise = workerManager.sendRequest("slowAction", {});

      jest.advanceTimersByTime(30001); // Advance past 30 second timeout

      await expect(requestPromise).rejects.toThrow("Worker request timeout");

      jest.useRealTimers();
    });

    it("should cleanup progress callbacks on completion", async () => {
      // Make sure worker is ready and not in fallback mode
      workerManager.isWorkerReady = true;
      workerManager.fallbackMode = false;

      const progressCallback = jest.fn();

      // Make a request that uses a real action that will succeed
      const requestPromise = workerManager.sendRequest(
        "justifyText",
        { text: "test", maxChars: 20, config: {} },
        progressCallback
      );

      // Wait for the request to be sent
      await new Promise((resolve) => setTimeout(resolve, 10));
      expect(mockWorker.postMessage).toHaveBeenCalled();

      const postMessageCall = mockWorker.postMessage.mock.calls[0];
      const requestId = postMessageCall[0].id;

      // Verify progress callback is stored
      expect(workerManager.progressCallbacks.has(requestId)).toBe(true);

      // Send result message
      const resultMessage = {
        data: {
          type: "result",
          action: "justifyText",
          result: {
            justifiedText: "test",
            lines: ["test"],
            linePositions: [],
          },
          id: requestId,
        },
      };

      mockWorker.onmessage(resultMessage);
      await requestPromise;

      // Verify progress callback is cleaned up
      expect(workerManager.progressCallbacks.has(requestId)).toBe(false);
    });
  });

  describe("Status and Lifecycle", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
    });

    it("should return correct status information", () => {
      workerManager.isWorkerReady = true;

      const status = workerManager.getStatus();

      expect(status).toEqual({
        supported: true,
        ready: true,
        fallbackMode: false,
        pendingRequests: 0,
        hasWorker: true,
      });
    });

    it("should terminate worker properly", () => {
      workerManager.terminate();

      expect(mockWorker.terminate).toHaveBeenCalled();
      expect(workerManager.worker).toBeNull();
      expect(workerManager.isWorkerReady).toBe(false);
      expect(workerManager.pendingRequests.size).toBe(0);
      expect(workerManager.progressCallbacks.size).toBe(0);
    });

    it("should handle initialization timeout", () => {
      jest.useFakeTimers();

      workerManager = new WorkerManager();
      expect(workerManager.fallbackMode).toBe(false);

      jest.advanceTimersByTime(2001); // Advance past 2 second timeout

      expect(workerManager.fallbackMode).toBe(true);

      jest.useRealTimers();
    });
  });

  describe("Edge Cases", () => {
    beforeEach(() => {
      workerManager = new WorkerManager();
    });

    it("should handle message with unknown type", () => {
      const unknownMessage = {
        data: { type: "unknown", someData: "value" },
      };

      // Should not throw error
      expect(() => mockWorker.onmessage(unknownMessage)).not.toThrow();
    });

    it("should handle result for non-existent request", () => {
      const resultMessage = {
        data: {
          type: "result",
          result: { success: true },
          id: "non-existent-id",
        },
      };

      // Should not throw error
      expect(() => mockWorker.onmessage(resultMessage)).not.toThrow();
    });

    it("should handle progress for non-existent request", () => {
      const progressMessage = {
        data: {
          type: "progress",
          progress: 50,
          id: "non-existent-id",
        },
      };

      // Should not throw error
      expect(() => mockWorker.onmessage(progressMessage)).not.toThrow();
    });
  });
});
