/**
 * Integration Tests for Text2LongImage
 * Tests component interactions and end-to-end workflows
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
  throttle,
  debounce,
  justifyText,
  validateTextInput,
  formatDate,
  isClipboardAPIAvailable,
} from "../utils.js";

describe("Text2LongImage Integration Tests", () => {
  describe("Text Processing Workflow", () => {
    it("should handle complete text-to-image workflow", async () => {
      const inputText =
        "This is a sample text that will be processed through the complete text2longimage workflow including validation, justification, and preparation for canvas rendering.";

      // Step 1: Validate input
      expect(() => validateTextInput(inputText)).not.toThrow();

      // Step 2: Justify text
      const justifiedText = justifyText(
        inputText,
        DEFAULT_IMG_CONFIG.charsPerLine * 2
      );
      expect(justifiedText).toBeDefined();
      expect(justifiedText).toContain("\r\n");

      // Step 3: Prepare for canvas
      const lines = justifiedText.split("\n");
      expect(lines.length).toBeGreaterThan(1);

      // Step 4: Calculate positions (simulate worker behavior)
      const linePositions = lines.map((line, index) => ({
        text: line,
        x: DEFAULT_IMG_CONFIG.padding,
        y:
          DEFAULT_IMG_CONFIG.fontSize * DEFAULT_IMG_CONFIG.lineSpacing * index +
          DEFAULT_IMG_CONFIG.padding,
        lineIndex: index,
      }));

      expect(linePositions).toHaveLength(lines.length);
      expect(linePositions[0].x).toBe(DEFAULT_IMG_CONFIG.padding);
      expect(linePositions[0].y).toBe(DEFAULT_IMG_CONFIG.padding);
    });

    it("should handle multilingual text workflow", () => {
      const multilingualText =
        "English text mixed with 中文内容 and more English content.";

      // Validate
      expect(() => validateTextInput(multilingualText)).not.toThrow();

      // Process
      const result = justifyText(multilingualText, 20);
      expect(result).toBeDefined();
      expect(typeof result).toBe("string");

      // Should handle mixed content gracefully
      const lines = result.split("\r\n");
      expect(lines.length).toBeGreaterThan(0);
      lines.forEach((line) => {
        expect(line.length).toBeLessThanOrEqual(30); // Reasonable line length
      });
    });
  });

  describe("Performance Optimization Integration", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("should integrate throttle with text processing", () => {
      const processText = jest.fn((text) => justifyText(text, 20));
      const throttledProcess = throttle(processText, 500);

      // Multiple rapid calls
      throttledProcess("text1");
      throttledProcess("text2");
      throttledProcess("text3");

      expect(processText).toHaveBeenCalledTimes(1);
      expect(processText).toHaveBeenCalledWith("text1");

      // Wait for throttle delay
      jest.advanceTimersByTime(500);

      expect(processText).toHaveBeenCalledTimes(2);
      expect(processText).toHaveBeenLastCalledWith("text3");
    });

    it("should integrate debounce with input handling", () => {
      const handleInput = jest.fn((text) => {
        validateTextInput(text);
        return justifyText(text, 15);
      });

      const debouncedHandler = debounce(handleInput, 300);

      // Simulate rapid typing
      debouncedHandler("H");
      debouncedHandler("He");
      debouncedHandler("Hel");
      debouncedHandler("Hell");
      debouncedHandler("Hello");

      expect(handleInput).not.toHaveBeenCalled();

      jest.advanceTimersByTime(300);

      expect(handleInput).toHaveBeenCalledTimes(1);
      expect(handleInput).toHaveBeenCalledWith("Hello");
    });
  });

  describe("Canvas Integration Simulation", () => {
    let mockCanvas, mockContext;

    beforeEach(() => {
      mockContext = {
        fillStyle: "",
        font: "",
        textBaseline: "",
        fillRect: jest.fn(),
        fillText: jest.fn(),
        measureText: jest.fn(() => ({ width: 100 })),
        clearRect: jest.fn(),
      };

      mockCanvas = {
        width: 0,
        height: 0,
        style: {},
        getContext: jest.fn(() => mockContext),
        toDataURL: jest.fn(() => "data:image/png;base64,mock"),
      };

      global.document.createElement = jest.fn((tagName) => {
        if (tagName === "canvas") return mockCanvas;
        return { style: {} };
      });
    });

    it("should simulate canvas rendering workflow", () => {
      const text = "Sample text for canvas rendering";
      const config = { ...DEFAULT_IMG_CONFIG };

      // Process text
      const justifiedText = justifyText(text, config.charsPerLine * 2);
      const lines = justifiedText.split("\n");

      // Simulate canvas setup
      const canvas = document.createElement("canvas");
      canvas.width = config.fontSize * config.charsPerLine + config.padding * 2;
      canvas.height =
        config.fontSize * config.lineSpacing * lines.length +
        config.padding * 2;

      const ctx = canvas.getContext("2d");

      // Simulate rendering
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.fillStyle = "#222";
      ctx.font = `${config.fontWeight} ${config.fontSize}px sans-serif`;
      ctx.textBaseline = "top";

      lines.forEach((line, index) => {
        ctx.fillText(
          line,
          config.padding,
          config.fontSize * config.lineSpacing * index + config.padding,
          canvas.width
        );
      });

      // Verify canvas operations
      expect(mockContext.fillRect).toHaveBeenCalledWith(
        0,
        0,
        canvas.width,
        canvas.height
      );
      expect(mockContext.fillText).toHaveBeenCalledTimes(lines.length);
      expect(canvas.toDataURL).toBeDefined();
    });
  });

  describe("Clipboard Integration", () => {
    beforeEach(() => {
      global.navigator = global.navigator || {};
      global.navigator.clipboard = {
        readText: jest.fn(),
        writeText: jest.fn(),
      };
    });

    it("should handle clipboard availability check", () => {
      expect(isClipboardAPIAvailable()).toBe(true);

      delete global.navigator.clipboard;
      expect(isClipboardAPIAvailable()).toBe(false);
    });

    it("should simulate clipboard text processing", async () => {
      const clipboardText = "Text from clipboard that needs processing";
      global.navigator.clipboard.readText.mockResolvedValue(clipboardText);

      const text = await global.navigator.clipboard.readText();
      expect(text).toBe(clipboardText);

      // Process clipboard text
      const processed = justifyText(text, 25);
      expect(processed).toBeDefined();
      expect(processed.length).toBeGreaterThanOrEqual(text.length);
    });
  });

  describe("History Management Integration", () => {
    beforeEach(() => {
      global.localStorage.clear();
    });

    it("should simulate text history workflow", () => {
      const texts = [
        "First saved text",
        "Second saved text",
        "Third saved text",
      ];

      // Simulate saving texts to history
      texts.forEach((text, index) => {
        const entry = {
          text: text,
          timestamp: Date.now() - 1000 * 60 * index, // Different timestamps
          id: `id-${index}`,
        };

        const historyKey = "text2longimage-history";
        const existingHistory = JSON.parse(
          localStorage.getItem(historyKey) || "[]"
        );
        existingHistory.unshift(entry);
        localStorage.setItem(historyKey, JSON.stringify(existingHistory));
      });

      // Retrieve and verify history
      const history = JSON.parse(
        localStorage.getItem("text2longimage-history")
      );
      expect(history).toHaveLength(3);
      expect(history[0].text).toBe("Third saved text"); // Most recent first

      // Test date formatting for history entries
      history.forEach((entry) => {
        const formattedDate = formatDate(entry.timestamp);
        expect(formattedDate).toBeDefined();
        expect(typeof formattedDate).toBe("string");
      });
    });
  });

  describe("Error Handling Integration", () => {
    it("should handle validation errors in workflow", () => {
      const invalidInputs = [
        null,
        undefined,
        "",
        123,
        "a".repeat(500001), // Too long
      ];

      invalidInputs.forEach((input) => {
        expect(() => validateTextInput(input)).toThrow();
      });
    });

    it("should gracefully handle text processing errors", () => {
      // Edge cases that should not crash
      const edgeCases = [
        " ", // Only whitespace
        "\n\n\n", // Only newlines
        "   \n   \n   ", // Mixed whitespace
        "a", // Single character
        "a".repeat(10000), // Very long single word
      ];

      edgeCases.forEach((text) => {
        expect(() => {
          validateTextInput(text.trim() || "fallback");
          const result = justifyText(text, 20);
          expect(result).toBeDefined();
        }).not.toThrow();
      });
    });
  });

  describe("Configuration Integration", () => {
    it("should work with different configurations", () => {
      const text =
        "Configuration test text that will be processed with different settings";

      const configs = [
        { charsPerLine: 10, fontSize: 24, padding: 20 },
        { charsPerLine: 30, fontSize: 16, padding: 10 },
        { charsPerLine: 50, fontSize: 12, padding: 5 },
      ];

      configs.forEach((config) => {
        const result = justifyText(text, config.charsPerLine * 2);
        const lines = result.split("\n");

        // Calculate expected dimensions
        const expectedWidth =
          config.fontSize * config.charsPerLine + config.padding * 2;
        const expectedHeight =
          config.fontSize * 1.5 * lines.length + config.padding * 2;

        expect(expectedWidth).toBeGreaterThan(0);
        expect(expectedHeight).toBeGreaterThan(0);
        expect(lines.length).toBeGreaterThan(0);
      });
    });
  });

  describe("Real-world Scenarios", () => {
    it("should handle social media post scenario", () => {
      const socialMediaPost = `
        Just had an amazing day at the beach! 🏖️

        The weather was perfect, and I finally learned how to surf! 🏄‍♂️

        Can't wait to go back tomorrow. Life is good! ✨

        #beach #surfing #goodvibes #blessed
      `.trim();

      expect(() => validateTextInput(socialMediaPost)).not.toThrow();

      const processed = justifyText(socialMediaPost, 40);
      const lines = processed.split("\n");

      expect(lines.length).toBeGreaterThan(3);
      expect(processed).toContain("beach");
      expect(processed).toContain("surfing");
    });

    it("should handle code snippet scenario", () => {
      const codeSnippet = `
        function calculateTotal(items) {
          return items.reduce((sum, item) => {
            return sum + (item.price * item.quantity);
          }, 0);
        }

        const items = [
          { name: 'apple', price: 1.5, quantity: 3 },
          { name: 'banana', price: 0.8, quantity: 6 }
        ];

        console.log('Total:', calculateTotal(items));
      `.trim();

      expect(() => validateTextInput(codeSnippet)).not.toThrow();

      const processed = justifyText(codeSnippet, 60);
      expect(processed).toContain("function");
      expect(processed).toContain("reduce");

      // Should preserve code structure reasonably
      const lines = processed.split("\n");
      expect(lines.length).toBeGreaterThan(5);
    });

    it("should handle multilingual content scenario", () => {
      const multilingualContent = `
        Welcome to our international platform! 欢迎来到我们的国际平台！

        Today's menu / 今日菜单:
        - Pizza Margherita / 玛格丽特比萨
        - Sushi Combo / 寿司套餐 🍣
        - Pasta Carbonara / 培根蛋面

        Thank you for your visit! 谢谢您的光临！
      `.trim();

      expect(() => validateTextInput(multilingualContent)).not.toThrow();

      const processed = justifyText(multilingualContent, 35);
      const lines = processed.split("\n");

      expect(lines.length).toBeGreaterThan(5);
      expect(processed).toContain("Welcome");
      expect(processed).toContain("欢迎");
      expect(processed).toContain("谢谢");
    });
  });
});
