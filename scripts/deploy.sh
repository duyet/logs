#!/bin/bash

# Cloudflare Analytics Router Deployment Script
# Deploy to Cloudflare Pages: duyet-logs (logs.duyet.net)

set -e

echo "🚀 Starting deployment process..."
echo ""

# Step 1: Build
echo "📦 Building TypeScript..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Build failed!"
  exit 1
fi

echo "✅ Build successful"
echo ""

# Step 2: Run tests
echo "🧪 Running tests..."
npm test

if [ $? -ne 0 ]; then
  echo "❌ Tests failed!"
  exit 1
fi

echo "✅ Tests passed"
echo ""

# Step 3: Type check
echo "🔍 Type checking..."
npm run type-check

if [ $? -ne 0 ]; then
  echo "❌ Type check failed!"
  exit 1
fi

echo "✅ Type check passed"
echo ""

# Step 4: Deploy to Cloudflare Pages
echo "☁️  Deploying to Cloudflare Pages (duyet-logs)..."
npx wrangler pages deploy . --project-name=duyet-logs

if [ $? -ne 0 ]; then
  echo "❌ Deployment failed!"
  exit 1
fi

echo ""
echo "✅ Deployment successful!"
echo "🌐 Project: duyet-logs"
echo "🌐 Domain: logs.duyet.net"
echo ""
echo "📍 Endpoints:"
echo "  • https://logs.duyet.net/ping"
echo "  • https://logs.duyet.net/cc"
echo "  • https://logs.duyet.net/ga"
echo ""
echo "🎉 All done!"
