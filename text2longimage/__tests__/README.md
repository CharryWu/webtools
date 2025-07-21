# Text2LongImage Test Suite

Comprehensive Jest test suite for the Text2LongImage project, providing unit tests, integration tests, and performance validation for all core functionality.

## 🚀 Quick Start

### Installation

1. Navigate to the text2longimage directory:
```bash
cd text2longimage
```

2. Install dependencies:
```bash
npm install
```

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode (reruns on file changes)
npm run test:watch

# Run tests with coverage report
npm run test:coverage

# Run tests with verbose output
npm run test:verbose
```

## 📁 Test Structure

```
__tests__/
├── setup.js                 # Jest configuration and mocks
├── utils.test.js            # Tests for utility functions
├── worker-manager.test.js   # Tests for WorkerManager class
├── text-processor-worker.test.js # Tests for worker functionality
├── integration.test.js      # Integration and end-to-end tests
└── README.md               # This file
```

## 🧪 Test Categories

### 1. Utils Tests (`utils.test.js`)
Tests for core utility functions including:
- **Text Processing**: `justifyText`, `justifyTextCJK`, `justifyTextEnglish`, `isCJK`
- **Performance Utilities**: `throttle`, `debounce`, `throttleRAF`
- **Validation**: `validateTextInput`
- **Async Operations**: `retryOperation`, `safeAsyncOperation`
- **Date/Time Formatting**: `formatDate`, `getFirstLines`
- **Clipboard API**: `isClipboardAPIAvailable`

### 2. WorkerManager Tests (`worker-manager.test.js`)
Tests for Web Worker management including:
- **Initialization**: Worker creation, fallback mode detection
- **Message Handling**: Request/response cycles, error handling
- **Text Processing**: Background text justification
- **Performance**: Request timeouts, cleanup procedures
- **Status Management**: Worker lifecycle, status reporting

### 3. Text Processor Worker Tests (`text-processor-worker.test.js`)
Tests for worker-specific functionality including:
- **Text Processing Algorithms**: Chunked processing, line position calculation
- **Message Protocol**: Worker communication patterns
- **Performance**: Processing time measurement
- **Error Handling**: Worker error scenarios

### 4. Integration Tests (`integration.test.js`)
End-to-end workflow tests including:
- **Complete Workflows**: Text-to-image processing pipeline
- **Performance Integration**: Throttling and debouncing in context
- **Canvas Simulation**: Rendering workflow testing
- **Real-world Scenarios**: Social media posts, code snippets, multilingual content

## 🛠️ Test Configuration

### Jest Configuration
The project uses Jest with the following key configurations:

```json
{
  "testEnvironment": "jsdom",
  "extensionsToTreatAsEsm": [".js"],
  "moduleNameMapping": {
    "^(\\.{1,2}/.*)\\.js$": "$1"
  }
}
```

### Mocked APIs
The test setup includes comprehensive mocks for:
- **Web Workers**: `Worker` constructor and message handling
- **Canvas API**: `HTMLCanvasElement` and `CanvasRenderingContext2D`
- **Web Storage**: `localStorage` and `sessionStorage`
- **Clipboard API**: `navigator.clipboard`
- **Performance API**: `performance.now()`

## 📊 Coverage Reports

Generate detailed coverage reports:

```bash
npm run test:coverage
```

This creates a `coverage/` directory with:
- **HTML Report**: `coverage/lcov-report/index.html`
- **Text Summary**: Console output during test run
- **LCOV Data**: `coverage/lcov.info` for CI/CD integration

### Coverage Targets
- **Lines**: >95%
- **Functions**: >95%
- **Branches**: >90%
- **Statements**: >95%

## 🔧 Writing New Tests

### Test File Naming
- Use `.test.js` suffix for test files
- Place in `__tests__/` directory
- Mirror source file structure when possible

### Test Structure Example
```javascript
import { describe, it, expect, beforeEach } from '@jest/globals';
import { functionToTest } from '../utils.js';

describe('Feature Name', () => {
  beforeEach(() => {
    // Setup before each test
  });

  describe('Specific Functionality', () => {
    it('should handle normal case', () => {
      const result = functionToTest('input');
      expect(result).toBe('expected');
    });

    it('should handle edge case', () => {
      expect(() => functionToTest(null)).toThrow();
    });
  });
});
```

### Best Practices
1. **Descriptive Test Names**: Use "should" statements describing expected behavior
2. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
3. **Mock External Dependencies**: Use Jest mocks for Web APIs and DOM interactions
4. **Test Edge Cases**: Include error conditions, empty inputs, and boundary values
5. **Performance Tests**: Measure execution time for critical algorithms

## 🐛 Debugging Tests

### Running Specific Tests
```bash
# Run specific test file
npm test utils.test.js

# Run specific test suite
npm test -- --testNamePattern="Text Processing"

# Run specific test
npm test -- --testNamePattern="should justify text correctly"
```

### Debugging in VS Code
1. Add breakpoints in test files
2. Use "Jest: Debug" configuration
3. Inspect variables and call stack

### Common Issues and Solutions

#### Installation Issues
If `npm install` fails with native compilation errors:
```bash
# The error typically looks like:
# "gyp: Call to 'pkg-config pixman-1 --libs' returned exit status 127"

# Solution: This project uses pure JS mocks - no native dependencies needed
# If you see canvas-related build errors, ensure package.json doesn't include:
# - canvas
# - node-canvas
# - Any other native graphics packages
```

**Why this works**: Our test suite uses comprehensive JavaScript mocks for all canvas functionality, so native graphics libraries aren't required.

#### ES6 Module Issues
If you encounter module import errors:
```bash
# Ensure Node.js version supports ES modules
node --version  # Should be 14+

# Check package.json has "type": "module"
```

#### Canvas Mock Issues
For canvas-related test failures, our setup provides comprehensive canvas mocking without requiring native dependencies. If you need additional canvas methods:

```javascript
// Add to test setup if needed
global.HTMLCanvasElement.prototype.getBoundingClientRect = jest.fn(() => ({
  x: 0, y: 0, width: 800, height: 600,
  top: 0, left: 0, bottom: 600, right: 800
}));
```

**Note**: This test suite uses **pure JavaScript mocks** for canvas functionality, eliminating the need for native canvas packages (like `node-canvas`) that require system dependencies like Cairo, Pixman, and other graphics libraries.

#### Worker Mock Issues
For Worker-related problems:
```javascript
// Ensure Worker constructor mock is properly set up
global.Worker = jest.fn((scriptUrl, options) => ({
  postMessage: jest.fn(),
  terminate: jest.fn(),
  onmessage: null,
  onerror: null
}));
```

## 🚀 Continuous Integration

### GitHub Actions Example
```yaml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
      - run: cd text2longimage && npm install
      - run: cd text2longimage && npm run test:coverage
      - run: cd text2longimage && npm run test:verbose
```

## 📈 Performance Testing

The test suite includes performance benchmarks:

```javascript
// Example performance test
it('should process large text efficiently', () => {
  const largeText = 'text'.repeat(10000);
  const startTime = performance.now();

  const result = justifyText(largeText, 50);

  const endTime = performance.now();
  expect(endTime - startTime).toBeLessThan(100); // Should complete in <100ms
  expect(result).toBeDefined();
});
```

## 📋 Test Checklist

Before submitting changes, ensure:
- [ ] All existing tests pass
- [ ] New functionality has corresponding tests
- [ ] Code coverage targets are met
- [ ] Integration tests cover main workflows
- [ ] Performance benchmarks are within acceptable ranges
- [ ] Edge cases and error conditions are tested

## 🤝 Contributing

When adding new tests:
1. Follow existing naming conventions
2. Include both positive and negative test cases
3. Add integration tests for new features
4. Update this README if adding new test categories
5. Ensure tests are deterministic and don't rely on external services

---

**Test Coverage Goals**: Maintain >95% code coverage while ensuring tests are meaningful and maintainable. Quality over quantity - focus on testing critical paths and edge cases rather than achieving 100% coverage through trivial tests.
