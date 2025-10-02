#!/usr/bin/env tsx

/**
 * Deployment script for Cloudflare Pages
 * Replaces npm run build && wrangler pages deploy dist
 */

import { execSync } from 'node:child_process';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
};

function log(emoji: string, message: string) {
  console.log(`${emoji} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

function runCommand(command: string, description: string): boolean {
  log('⚙️', description);
  try {
    execSync(command, { stdio: 'inherit' });
    logSuccess(`${description} - Done`);
    console.log();
    return true;
  } catch (error) {
    logError(`${description} - Failed`);
    return false;
  }
}

function main() {
  try {
    log('🚀', 'Starting deployment process...');
    console.log();

    // Step 1: Build
    if (!runCommand('npm run build', 'Building project')) {
      logError('Build failed! Aborting deployment.');
      process.exit(1);
    }

    // Step 2: Run tests
    if (!runCommand('npm test', 'Running tests')) {
      logError('Tests failed! Aborting deployment.');
      process.exit(1);
    }

    // Step 3: Type check
    if (!runCommand('npm run type-check', 'Running type check')) {
      logError('Type check failed! Aborting deployment.');
      process.exit(1);
    }

    // Step 4: Deploy to Cloudflare Pages
    if (
      !runCommand(
        'npx wrangler pages deploy dist',
        'Deploying to Cloudflare Pages'
      )
    ) {
      logError('Deployment failed!');
      process.exit(1);
    }

    console.log();
    logSuccess('Deployment completed successfully! 🎉');
    log('🌐', 'Your site is now live at: https://logs.duyet.net');
  } catch (error) {
    logError('Deployment failed!');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

void main();
