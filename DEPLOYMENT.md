# Deployment Instructions for text2longimage

This document explains how to deploy your Rust WASM project to GitHub Pages using GitHub Actions.

## Overview

The `text2longimage` project uses Rust compiled to WebAssembly (WASM) for high-performance text processing. Since GitHub Pages doesn't support building Rust projects directly, we use GitHub Actions to build the WASM files and deploy them.

## Setup Steps

### 1. Enable GitHub Actions (if not already enabled)

1. Go to your repository on GitHub
2. Click on **Settings** tab
3. Scroll down to **Actions** in the left sidebar
4. Ensure **Actions** are enabled for your repository

### 2. Configure GitHub Pages

1. In your repository, go to **Settings** → **Pages**
2. Under **Source**, select **GitHub Actions**
3. Save the configuration

### 3. The Workflow

The GitHub Actions workflow (`.github/workflows/deploy.yml`) will:

1. **Install Rust** with the `wasm32-unknown-unknown` target
2. **Install wasm-pack** for building Rust to WASM
3. **Install Node.js dependencies** for testing
4. **Build the WASM package** using `wasm-pack build --target web`
5. **Run tests** to ensure everything works
6. **Deploy to GitHub Pages**

## What Changed

### Fixed Issues:
- ✅ **Package Name**: Changed from `snake_game` to `text_processor` in `Cargo.toml`
- ✅ **Rust Edition**: Updated from `2024` to `2021` (2024 doesn't exist)
- ✅ **JavaScript Import**: Updated `utils.js` to import `text_processor.js` instead of `snake_game.js`
- ✅ **WASM Build**: The `pkg` folder now contains `text_processor.js` and related files

### Architecture:
```
text2longimage/
├── src/lib.rs           # Rust source code for text processing
├── Cargo.toml           # Rust project configuration
├── pkg/                 # Generated WASM files (built by wasm-pack)
│   ├── text_processor.js       # JavaScript bindings
│   ├── text_processor_bg.wasm  # Compiled WASM binary
│   └── text_processor.d.ts     # TypeScript definitions
├── utils.js             # JavaScript utilities that import WASM
└── index.html           # Main HTML file
```

## Local Development

To test locally after making changes to the Rust code:

```bash
cd text2longimage
wasm-pack build --target web --out-dir pkg
```

Then serve the files using a local HTTP server:

```bash
# Using Python
python -m http.server 8000

# Using Node.js (if you have http-server installed)
npx http-server

# Using PHP
php -S localhost:8000
```

## Deployment Process

1. **Push to main branch**: Any push to the `main` branch triggers the deployment
2. **Automatic build**: GitHub Actions builds the WASM files
3. **Automatic deployment**: The built site is deployed to GitHub Pages
4. **Access your site**: Available at `https://yourusername.github.io/webtools/text2longimage/`

## Troubleshooting

### Common Issues:

1. **404 errors for WASM files**: Make sure the GitHub Actions workflow completed successfully
2. **MIME type errors**: These should be resolved by serving files through GitHub Pages
3. **Import errors**: Ensure `utils.js` imports the correct `text_processor.js` file

### Check Deployment Status:

1. Go to **Actions** tab in your GitHub repository
2. Check if the latest workflow run was successful
3. If it failed, click on the failed run to see error details

## Performance Notes

The WASM module provides significant performance improvements for:
- ✅ **CJK text processing** (Chinese, Japanese, Korean)
- ✅ **Text justification** algorithms
- ✅ **Large text handling** with chunked processing
- ✅ **Character width calculations** for mixed-script text

## Best Practices Implemented

1. **Version Control**: WASM files in `pkg/` are gitignored (generated during build)
2. **Automated Building**: WASM is built during deployment, not locally committed
3. **Proper Naming**: Package name reflects actual functionality
4. **Target Configuration**: Uses `web` target for browser compatibility
5. **Testing**: Automated tests run before deployment
