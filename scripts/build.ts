#!/usr/bin/env tsx

/**
 * Build script for Cloudflare Pages with Hono
 * Replaces ./scripts/build.sh
 */

import { execSync } from 'node:child_process';
import { existsSync, rmSync, mkdirSync, cpSync } from 'node:fs';
import { readdir } from 'node:fs/promises';

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
};

function log(emoji: string, message: string): void {
  console.log(`${emoji} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message: string): void {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string): void {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

async function main(): Promise<void> {
  try {
    log('🔨', 'Building Cloudflare Pages with Hono...');
    console.log();

    // Step 1: Clean dist directory
    log('🧹', 'Cleaning dist directory...');
    if (existsSync('dist')) {
      rmSync('dist', { recursive: true, force: true });
    }
    mkdirSync('dist', { recursive: true });
    logSuccess('Cleaned dist directory');
    console.log();

    // Step 2: Type check
    log('🔍', 'Running type check...');
    try {
      execSync('npm run type-check', { stdio: 'inherit' });
      logSuccess('Type check passed');
    } catch (error) {
      logError('Type check failed!');
      process.exit(1);
    }
    console.log();

    // Step 3: Compile TypeScript
    log('⚙️', 'Compiling TypeScript...');
    try {
      execSync('tsc', { stdio: 'inherit' });
      logSuccess('TypeScript compiled');
    } catch (error) {
      logError('TypeScript compilation failed!');
      process.exit(1);
    }
    console.log();

    // Step 4: Copy public files if they exist
    if (existsSync('public')) {
      log('📋', 'Copying public files...');
      cpSync('public', 'dist', { recursive: true });
      logSuccess('Public files copied');
      console.log();
    }

    // Step 5: Verify build output
    log('✨', 'Verifying build output...');
    const files = await readdir('dist');
    if (files.length === 0) {
      logError('Build output is empty!');
      process.exit(1);
    }
    console.log(
      `${colors.blue}Built files: ${files.join(', ')}${colors.reset}`
    );
    console.log();

    logSuccess('Build completed successfully!');
    log('📦', 'Ready for deployment');
  } catch (error) {
    logError('Build failed!');
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
}

void main();
