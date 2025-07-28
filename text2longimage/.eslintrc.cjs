module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true,
    worker: true,
  },
  extends: ["eslint:recommended"],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  globals: {
    // Browser APIs
    bootstrap: "readonly",
    TextEncoder: "readonly",
    TextDecoder: "readonly",
    WebAssembly: "readonly",

    // Custom globals
    WorkerManager: "readonly",
    justifyText: "readonly",

    // Jest globals (from @jest/globals)
    describe: "readonly",
    test: "readonly",
    it: "readonly",
    expect: "readonly",
    beforeEach: "readonly",
    afterEach: "readonly",
    beforeAll: "readonly",
    afterAll: "readonly",
    jest: "readonly",
  },
  rules: {
    // Disable some overly strict rules for this project
    "no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-console": "off", // Allow console.log for debugging
    "no-undef": "error",
    "no-redeclare": "error",
    "no-unreachable": "error",
    "no-unused-expressions": "off", // Allow some expressions
    "prefer-const": "warn",
    "no-var": "error",

    // Relaxed rules for test files
    "max-len": "off",
  },
  overrides: [
    {
      // Special rules for test files
      files: ["**/__tests__/**/*.js", "**/*.test.js", "**/*.spec.js"],
      rules: {
        "no-unused-vars": "off", // More lenient in test files
      },
    },
    {
      // Special rules for worker files
      files: ["*worker*.js"],
      env: {
        worker: true,
      },
      globals: {
        self: "readonly",
        importScripts: "readonly",
        postMessage: "readonly",
      },
    },
  ],
};
