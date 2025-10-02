#!/bin/bash
set -e

echo "🔨 Building Cloudflare Pages with Hono..."

# Clean dist directory
echo "🧹 Cleaning dist directory..."
rm -rf dist
mkdir -p dist

# Type check
echo "🔍 Type checking..."
npm run type-check

# Compile TypeScript
echo "📦 Compiling TypeScript..."
tsc

# Copy public files to dist root
echo "📄 Copying static files..."
if [ -d "public" ]; then
  cp -r public/* dist/
fi

# Note: wrangler will bundle src/index.ts into _worker.js during deployment
# For local dev, the compiled JS files in dist/ are sufficient

# Verify build output
echo "✅ Build complete!"
echo ""
echo "📊 Build output:"
ls -lh dist/
echo ""
echo "📦 Compiled sources:"
ls -lh dist/src/ | head -10

echo ""
echo "✨ Build successful! Ready for deployment."
echo "Note: wrangler will bundle src/index.ts → _worker.js during deploy"
