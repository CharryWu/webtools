# Testing & CI/CD Setup

This document explains the testing infrastructure and continuous integration setup for the text2longimage project.

## 🧪 Testing Framework

The project uses **Jest** as the testing framework with the following configuration:

### Test Scripts
```bash
npm test              # Run all tests
npm run test:watch    # Run tests in watch mode
npm run test:coverage # Run tests with coverage report
npm run test:verbose  # Run tests with verbose output
```

### Test Structure
- **Test Location**: `__tests__/` directory
- **Test Files**:
  - `utils.test.js` - Pure utility function tests
  - `worker-manager.test.js` - Web Worker management tests
  - `text-processor-worker.test.js` - Background worker tests
  - `integration.test.js` - End-to-end integration tests
- **Setup**: `__tests__/setup.js` - Test environment configuration

### Test Coverage
Current test coverage includes:
- ✅ **106 passing tests** across 4 test suites
- ✅ Text processing algorithms (CJK detection, justification)
- ✅ Web Worker functionality and fallbacks
- ✅ Error handling and edge cases
- ✅ Performance optimizations

## 🔧 Code Quality

### ESLint Configuration
- **Config File**: `.eslintrc.cjs`
- **Rules**: Configured for ES6 modules with browser/Node.js/Jest environments
- **Scripts**:
  ```bash
  npm run lint      # Check code quality
  npm run lint:fix  # Auto-fix issues where possible
  ```

### Supported Environments
- Browser (DOM APIs, Web Workers)
- Node.js (for testing)
- Jest (testing framework)
- WebAssembly (WASM globals)

## 🚀 Continuous Integration

### GitHub Actions Workflow
**File**: `.github/workflows/test.yml`

**Triggers**:
- Push to `main`, `master`, or `develop` branches
- Pull requests to `main`, `master`, or `develop` branches
- Only runs when `text2longimage/` files change

**Test Environment**:
- Node.js 20.x (LTS)
- Ubuntu latest

**Steps**:
1. Checkout code
2. Setup Node.js with npm caching
3. Install dependencies (`npm ci`)
4. Run tests (`npm test`)
5. Generate coverage report (`npm run test:coverage`)
6. Upload coverage to Codecov

### Pre-commit Hooks

**Setup**: Uses Husky for Git hooks
**Location**: `.husky/pre-commit`

**What it does**:
1. ✅ Runs `npm test` in text2longimage directory
2. ⚠️ Runs ESLint (warnings allowed, doesn't block commits)
3. 📝 Provides clear feedback on test results

**Installation**:
```bash
# At root level
npm install --save-dev husky
npm run prepare
```

## 🏃‍♂️ Running Tests Locally

### Prerequisites
1. Node.js 20+ installed
2. Navigate to text2longimage directory: `cd text2longimage`
3. Install dependencies: `npm install`

### Common Testing Commands

```bash
# Quick test run
npm test

# Watch mode for development
npm run test:watch

# Generate coverage report
npm run test:coverage

# Lint code
npm run lint

# Auto-fix linting issues
npm run lint:fix
```

### Testing with WASM
The tests include WebAssembly functionality:
1. **Automatic Fallback**: Tests work even if WASM fails to load
2. **Mock Support**: WASM functions are mocked in test environment
3. **Performance Testing**: Includes benchmarks for WASM vs JS performance

## 🔄 Development Workflow

### Recommended Workflow
1. **Make Changes**: Edit source files
2. **Run Tests**: `npm test` to ensure functionality
3. **Check Linting**: `npm run lint` for code quality
4. **Commit**: Git commit triggers pre-commit hook automatically
5. **Push**: GitHub Actions runs full test suite

### Pre-commit Hook Behavior
```bash
🔍 Running pre-commit tests for text2longimage...
> text2longimage@1.0.0 test
> jest
 PASS  __tests__/utils.test.js
 PASS  __tests__/worker-manager.test.js
 PASS  __tests__/text-processor-worker.test.js
 PASS  __tests__/integration.test.js
Test Suites: 4 passed, 4 total
Tests:       106 passed, 106 total

🔧 Running ESLint (warnings allowed)...
⚠️  ESLint found issues but continuing...

✅ Pre-commit checks completed!
```

## 📊 Performance Testing

The test suite includes performance benchmarks:
- **Text Processing Speed**: Measures processing time for various text sizes
- **Memory Usage**: Tracks memory consumption during operations
- **Worker Efficiency**: Compares Web Worker vs main thread performance
- **WASM Performance**: Benchmarks WASM vs JavaScript implementations

## 🐛 Troubleshooting

### Common Issues

**Tests failing locally but passing in CI:**
- Check Node.js version (CI uses 20.x)
- Clear npm cache: `npm cache clean --force`
- Delete node_modules and reinstall: `rm -rf node_modules && npm install`

**Pre-commit hook not running:**
- Ensure Husky is installed at root level
- Check hook permissions: `chmod +x .husky/pre-commit`
- Verify Git hooks are enabled: `git config core.hooksPath .husky`

**ESLint errors:**
- Many existing code style issues are expected
- Use `npm run lint:fix` to auto-fix what's possible
- Pre-commit hook allows ESLint warnings to prevent blocking development

### Getting Help
- Check test output for detailed error messages
- Review coverage reports in `coverage/` directory
- See GitHub Actions logs for CI failures
- ESLint provides specific rule violations and suggestions
