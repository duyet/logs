import { z } from 'zod';

/**
 * Common validation schemas used across different adapters
 */

/**
 * Project ID validation (3-32 lowercase alphanumeric with hyphens)
 */
export const projectIdSchema = z
  .string()
  .min(3)
  .max(32)
  .regex(/^[a-z0-9-]+$/, {
    message: 'Project ID must be lowercase alphanumeric with hyphens',
  });

/**
 * Session ID validation (1-128 alphanumeric, hyphens, underscores)
 */
export const sessionIdSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/, {
    message:
      'Session ID must be alphanumeric with hyphens and underscores only',
  });

/**
 * ISO 8601 timestamp validation
 */
export const timestampSchema = z.string().datetime({
  message: 'Timestamp must be a valid ISO 8601 date-time string',
});

/**
 * Unix timestamp in milliseconds validation
 */
export const unixTimestampSchema = z.number().int().positive();

/**
 * URL validation
 */
export const urlSchema = z.string().url({
  message: 'Must be a valid URL',
});

/**
 * Email validation
 */
export const emailSchema = z.string().email({
  message: 'Must be a valid email address',
});

/**
 * Non-empty string validation (max 10000 chars)
 */
export const nonEmptyStringSchema = z.string().min(1).max(10000);

/**
 * Safe string that allows empty values (for analytics data)
 */
export const safeStringSchema = z.string().max(10000);

/**
 * Valid number (no NaN, no Infinity)
 */
export const validNumberSchema = z.number().finite();

/**
 * Positive number validation
 */
export const positiveNumberSchema = z.number().positive();

/**
 * Safe object with no dangerous keys (prototype pollution protection)
 */
export const safeObjectSchema = z.record(z.unknown()).refine(
  (obj) => {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    return !Object.keys(obj).some((key) => dangerousKeys.includes(key));
  },
  {
    message: 'Object contains dangerous keys (prototype pollution risk)',
  }
);

/**
 * Analytics Engine index (max 96 bytes)
 */
export const indexSchema = z.string().max(96);

/**
 * Analytics Engine blob (max 5120 bytes)
 */
export const blobSchema = z.string().max(5120);

/**
 * Event type enum for realtime analytics
 */
export const eventTypeSchema = z.enum(['pageview', 'click', 'custom']);

/**
 * Browser enum
 */
export const browserSchema = z.enum([
  'Chrome',
  'Firefox',
  'Safari',
  'Edge',
  'Opera',
  'IE',
  'Unknown',
]);

/**
 * OS enum
 */
export const osSchema = z.enum([
  'Windows',
  'macOS',
  'Linux',
  'iOS',
  'Android',
  'Unknown',
]);

/**
 * Device type enum
 */
export const deviceTypeSchema = z.enum(['mobile', 'tablet', 'desktop']);

/**
 * Bot type enum
 */
export const botTypeSchema = z.enum(['user', 'bot', 'ai-bot']);
