#!/bin/bash
set -e

echo "🔨 Building Cloudflare Pages with Hono..."

# Clean dist directory
echo "🧹 Cleaning dist directory..."
rm -rf dist
mkdir -p dist/functions

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

# Verify build output
echo "✅ Build complete!"
echo ""
echo "📊 Build output:"
ls -lh dist/
echo ""
ls -lh dist/functions/

echo ""
echo "✨ Build successful! Ready for deployment."
