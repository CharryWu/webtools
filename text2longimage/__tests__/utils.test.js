/**
 * Tests for utils.js
 * Comprehensive test suite for text processing utilities
 */

import {
  jest,
  describe,
  it,
  expect,
  beforeEach,
  afterEach,
} from "@jest/globals";
import {
  DEFAULT_IMG_CONFIG,
  STORAGE_KEYS,
  throttle,
  debounce,
  throttleRAF,
  justifyText,
  justifyTextCJK,
  justifyTextEnglish,
  isCJK,
  validateTextInput,
  retryOperation,
  safeAsyncOperation,
  formatDate,
  getFirstLines,
  isClipboardAPIAvailable,
} from "../utils.js";

describe("Constants", () => {
  it("should have correct DEFAULT_IMG_CONFIG values", () => {
    expect(DEFAULT_IMG_CONFIG).toEqual({
      charsPerLine: 18,
      fontSize: 32,
      lineSpacing: 1.5,
      fontWeight: "400",
      padding: 42,
    });
  });

  it("should have correct STORAGE_KEYS values", () => {
    expect(STORAGE_KEYS).toEqual({
      TEXT_HISTORY: "text2longimage-history",
      CURRENT_TEXT: "user-text",
    });
  });
});

describe("Text Processing Functions", () => {
  describe("isCJK", () => {
    it("should detect Chinese characters", () => {
      expect(isCJK("你好")).toBe(true);
      expect(isCJK("中文测试")).toBe(true);
      expect(isCJK("Hello 你好")).toBe(true);
    });

    it("should detect Japanese characters", () => {
      expect(isCJK("こんにちは")).toBe(true);
      expect(isCJK("ひらがな")).toBe(true);
      expect(isCJK("カタカナ")).toBe(true);
    });

    it("should not detect English as CJK", () => {
      expect(isCJK("Hello World")).toBe(false);
      expect(isCJK("English text only")).toBe(false);
      expect(isCJK("123456")).toBe(false);
      expect(isCJK("!@#$%")).toBe(false);
    });

    it("should handle empty strings", () => {
      expect(isCJK("")).toBe(false);
      expect(isCJK(" ")).toBe(false);
    });
  });

  describe("justifyTextEnglish", () => {
    it("should wrap English text correctly", () => {
      const text = "This is a long sentence that should be wrapped";
      const result = justifyTextEnglish(text, 20);
      const lines = result.split("\r\n");

      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(20);
      });
    });

    it("should handle single word longer than max chars", () => {
      const result = justifyTextEnglish(
        "supercalifragilisticexpialidocious",
        10
      );
      expect(result).toBe("supercalifragilisticexpialidocious");
    });

    it("should handle empty text", () => {
      expect(justifyTextEnglish("", 20)).toBe("");
    });

    it("should handle single word within limit", () => {
      expect(justifyTextEnglish("hello", 20)).toBe("hello");
    });

    it("should preserve word boundaries", () => {
      const result = justifyTextEnglish("hello world test", 10);
      const lines = result.split("\r\n");
      expect(lines[0]).toBe("hello");
      expect(lines[1]).toBe("world test");
    });
  });

  describe("justifyTextCJK", () => {
    it("should wrap CJK text correctly", () => {
      const text = "这是一个很长的中文句子，应该被正确地换行处理";
      const result = justifyTextCJK(text, 10);
      const lines = result.split("\r\n");

      // Check that lines don't exceed character limit accounting for CJK width
      lines.forEach((line) => {
        let charCount = 0;
        for (const char of line) {
          charCount += char.charCodeAt(0) <= 255 ? 1 : 2;
        }
        expect(charCount).toBeLessThanOrEqual(10);
      });
    });

    it("should handle mixed CJK and ASCII", () => {
      const text = "中文English混合text测试";
      const result = justifyTextCJK(text, 15);
      expect(result).toContain("\r\n");
    });

    it("should preserve newlines", () => {
      const text = "第一行\n第二行\r\n第三行";
      const result = justifyTextCJK(text, 20);
      const lines = result.split("\r\n").filter((line) => line !== ""); // Filter empty lines
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("justifyText", () => {
    it("should handle CJK text", () => {
      const text = "这是中文测试";
      const result = justifyText(text, 10);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle English text", () => {
      const text = "This is English test";
      const result = justifyText(text, 10);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle mixed text", () => {
      const text = "English 中文 mixed content";
      const result = justifyText(text, 15);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");
    });

    it("should handle multiple lines", () => {
      const text = "Line 1\nLine 2\r\nLine 3";
      const result = justifyText(text, 20);
      const lines = result.split("\r\n");
      expect(lines.length).toBeGreaterThanOrEqual(3);
    });

    it("should trim lines", () => {
      const text = "  Line with spaces  \n  Another line  ";
      const result = justifyText(text, 20);
      const lines = result.split("\r\n");
      lines.forEach((line) => {
        if (line) {
          expect(line).toBe(line.trim());
        }
      });
    });
  });
});

describe("Performance Utilities", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  describe("throttle", () => {
    it("should throttle function calls", () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 1000);

      throttledFn("arg1");
      throttledFn("arg2");
      throttledFn("arg3");

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("arg1");
    });

    it("should execute after delay", () => {
      const mockFn = jest.fn();
      const throttledFn = throttle(mockFn, 1000);

      throttledFn("arg1");
      throttledFn("arg2");

      jest.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledTimes(2);
      expect(mockFn).toHaveBeenLastCalledWith("arg2");
    });

    it("should preserve context when provided", () => {
      const context = { value: 42 };
      const mockFn = jest.fn(function () {
        return this.value;
      });
      const throttledFn = throttle(mockFn, 1000, context);

      throttledFn();
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe("debounce", () => {
    it("should debounce function calls", () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn("arg1");
      debouncedFn("arg2");
      debouncedFn("arg3");

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(1000);

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("arg3");
    });

    it("should reset timer on subsequent calls", () => {
      const mockFn = jest.fn();
      const debouncedFn = debounce(mockFn, 1000);

      debouncedFn("arg1");
      jest.advanceTimersByTime(500);

      debouncedFn("arg2");
      jest.advanceTimersByTime(500);

      expect(mockFn).not.toHaveBeenCalled();

      jest.advanceTimersByTime(500);
      expect(mockFn).toHaveBeenCalledWith("arg2");
    });
  });

  describe("throttleRAF", () => {
    it("should throttle with requestAnimationFrame", () => {
      // Set up a fresh RAF mock for this test
      const rafMock = jest.fn((cb) => {
        const id = setTimeout(cb, 16);
        return id;
      });
      global.requestAnimationFrame = rafMock;

      const mockFn = jest.fn();
      const throttledFn = throttleRAF(mockFn);

      throttledFn("arg1");
      throttledFn("arg2");
      throttledFn("arg3");

      expect(rafMock).toHaveBeenCalledTimes(1);
      expect(mockFn).not.toHaveBeenCalled();

      // Simulate RAF callback
      const rafCallback = rafMock.mock.calls[0][0];
      rafCallback();

      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(mockFn).toHaveBeenCalledWith("arg1");
    });
  });
});

describe("Validation Functions", () => {
  describe("validateTextInput", () => {
    it("should accept valid text", () => {
      expect(() => validateTextInput("Valid text")).not.toThrow();
      expect(validateTextInput("Valid text")).toBe(true);
    });

    it("should reject empty or null text", () => {
      expect(() => validateTextInput("")).toThrow("Invalid text input");
      expect(() => validateTextInput(null)).toThrow("Invalid text input");
      expect(() => validateTextInput(undefined)).toThrow("Invalid text input");
    });

    it("should reject non-string input", () => {
      expect(() => validateTextInput(123)).toThrow("Invalid text input");
      expect(() => validateTextInput({})).toThrow("Invalid text input");
      expect(() => validateTextInput([])).toThrow("Invalid text input");
    });

    it("should reject text that is too large", () => {
      const largeText = "a".repeat(500001);
      expect(() => validateTextInput(largeText)).toThrow("Text too large");
    });

    it("should accept text at the limit", () => {
      const limitText = "a".repeat(500000);
      expect(() => validateTextInput(limitText)).not.toThrow();
    });
  });
});

describe("Async Utilities", () => {
  describe("retryOperation", () => {
    it("should succeed on first try", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await retryOperation(operation);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it("should retry on failure and eventually succeed", async () => {
      const operation = jest
        .fn()
        .mockRejectedValueOnce(new Error("fail 1"))
        .mockRejectedValueOnce(new Error("fail 2"))
        .mockResolvedValue("success");

      const result = await retryOperation(operation, 3, 10);

      expect(result).toBe("success");
      expect(operation).toHaveBeenCalledTimes(3);
    });

    it("should fail after max retries", async () => {
      const operation = jest.fn().mockRejectedValue(new Error("always fails"));

      await expect(retryOperation(operation, 2, 10)).rejects.toThrow(
        "always fails"
      );
      expect(operation).toHaveBeenCalledTimes(2);
    });
  });

  describe("safeAsyncOperation", () => {
    it("should execute operation successfully", async () => {
      const operation = jest.fn().mockResolvedValue("success");
      const result = await safeAsyncOperation(operation);

      expect(result).toBe("success");
    });

    it("should use fallback on error", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("operation failed"));
      const fallback = jest.fn().mockResolvedValue("fallback success");

      const result = await safeAsyncOperation(operation, fallback);

      expect(result).toBe("fallback success");
      expect(fallback).toHaveBeenCalledTimes(1);
    });

    it("should throw if no fallback provided", async () => {
      const operation = jest
        .fn()
        .mockRejectedValue(new Error("operation failed"));

      await expect(safeAsyncOperation(operation)).rejects.toThrow(
        "operation failed"
      );
    });
  });
});

describe("Utility Functions", () => {
  describe("formatDate", () => {
    const now = new Date("2023-12-01T12:00:00Z");
    const nowTime = now.getTime();

    beforeEach(() => {
      // Use fake timers to control Date
      jest.useFakeTimers();
      jest.setSystemTime(now);
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should format recent timestamps as "Just now"', () => {
      const oneMinuteAgo = nowTime - 60 * 1000;
      expect(formatDate(oneMinuteAgo)).toBe("Just now");
    });

    it("should format minutes ago", () => {
      const fiveMinutesAgo = nowTime - 5 * 60 * 1000;
      expect(formatDate(fiveMinutesAgo)).toBe("5 minutes ago");
    });

    it("should format hours ago", () => {
      const twoHoursAgo = nowTime - 2 * 60 * 60 * 1000;
      expect(formatDate(twoHoursAgo)).toBe("2 hours ago");
    });

    it("should format days ago", () => {
      const threeDaysAgo = nowTime - 3 * 24 * 60 * 60 * 1000;
      expect(formatDate(threeDaysAgo)).toBe("3 days ago");
    });

    it("should format old dates with toLocaleDateString", () => {
      const twoWeeksAgo = nowTime - 14 * 24 * 60 * 60 * 1000;
      const result = formatDate(twoWeeksAgo);
      expect(result).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/); // MM/DD/YYYY or similar
    });
  });

  describe("getFirstLines", () => {
    it("should return first N lines", () => {
      const text = "Line 1\nLine 2\nLine 3\nLine 4\nLine 5";
      expect(getFirstLines(text, 3)).toBe("Line 1\nLine 2\nLine 3");
    });

    it("should handle text with fewer lines than requested", () => {
      const text = "Line 1\nLine 2";
      expect(getFirstLines(text, 5)).toBe("Line 1\nLine 2");
    });

    it("should handle mixed line endings", () => {
      const text = "Line 1\r\nLine 2\nLine 3\rLine 4";
      const result = getFirstLines(text, 3);
      expect(result.split("\n")).toHaveLength(3);
    });

    it("should default to 10 lines", () => {
      const text = Array.from({ length: 15 }, (_, i) => `Line ${i + 1}`).join(
        "\n"
      );
      const result = getFirstLines(text);
      expect(result.split("\n")).toHaveLength(10);
    });
  });

  describe("isClipboardAPIAvailable", () => {
    beforeEach(() => {
      // Reset navigator state before each test
      global.navigator = global.navigator || {};
    });

    it("should return true when clipboard API is available", () => {
      global.navigator.clipboard = {
        readText: jest.fn(),
      };
      expect(isClipboardAPIAvailable()).toBe(true);
    });

    it("should return false when clipboard API is not available", () => {
      delete global.navigator.clipboard;
      expect(isClipboardAPIAvailable()).toBe(false);
    });

    it("should return false when readText is not available", () => {
      global.navigator.clipboard = {};
      expect(isClipboardAPIAvailable()).toBe(false);
    });
  });
});
