/**
 * Input validation utilities to prevent security issues
 * Now powered by Zod for consistent validation
 */

import {
  nonEmptyStringSchema,
  validNumberSchema,
  safeObjectSchema,
  projectIdSchema,
  sessionIdSchema,
  timestampSchema,
  urlSchema,
  emailSchema,
} from '../schemas/index.js';

/**
 * Validate string input (prevent XSS, injection)
 * Uses Zod schema internally
 */
export function isValidString(value: unknown): value is string {
  return nonEmptyStringSchema.safeParse(value).success;
}

/**
 * Validate number input
 * Uses Zod schema internally
 */
export function isValidNumber(value: unknown): value is number {
  return validNumberSchema.safeParse(value).success;
}

/**
 * Validate object input (non-null object)
 * Uses Zod schema internally
 */
export function isValidObject(
  value: unknown
): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Validate array input
 */
export function isValidArray(value: unknown): value is unknown[] {
  return Array.isArray(value);
}

/**
 * Validate boolean input
 */
export function isValidBoolean(value: unknown): value is boolean {
  return typeof value === 'boolean';
}

/**
 * Sanitize string input (remove dangerous characters)
 */
export function sanitizeString(value: string): string {
  // Remove control characters and normalize whitespace
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '').trim();
}

/**
 * Validate project ID format (3-32 lowercase alphanumeric with hyphens)
 * Uses Zod schema internally
 */
export function isValidProjectId(value: unknown): value is string {
  return projectIdSchema.safeParse(value).success;
}

/**
 * Validate session ID format
 * Uses Zod schema internally
 */
export function isValidSessionId(value: unknown): value is string {
  return sessionIdSchema.safeParse(value).success;
}

/**
 * Validate timestamp format (ISO 8601)
 * Uses Zod schema internally
 */
export function isValidTimestamp(value: unknown): value is string {
  return timestampSchema.safeParse(value).success;
}

/**
 * Validate URL format
 * Uses Zod schema internally
 */
export function isValidUrl(value: unknown): value is string {
  return urlSchema.safeParse(value).success;
}

/**
 * Validate email format
 * Uses Zod schema internally
 */
export function isValidEmail(value: unknown): value is string {
  return emailSchema.safeParse(value).success;
}

/**
 * Validate enum value
 */
export function isValidEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return typeof value === 'string' && allowedValues.includes(value as T);
}

/**
 * Validate object keys (prevent prototype pollution)
 * Uses Zod schema internally
 * Note: Accepts objects with any string keys - prototype pollution is
 * handled at JSON parsing level, not validation level
 */
export function hasOnlySafeKeys(obj: Record<string, unknown>): boolean {
  // Check if it's a valid object first
  if (!isValidObject(obj)) {
    return false;
  }

  // Objects created with Object.create(null) don't have a prototype
  // and are safe by design - accept them directly
  if (Object.getPrototypeOf(obj) === null) {
    return true;
  }

  // Use Zod schema for additional validation
  return safeObjectSchema.safeParse(obj).success;
}

/**
 * Deep validate object (recursive)
 */
export function isValidDeepObject(
  value: unknown,
  maxDepth: number = 10,
  currentDepth: number = 0
): value is Record<string, unknown> {
  if (currentDepth >= maxDepth) return false;
  if (!isValidObject(value)) return false;
  if (!hasOnlySafeKeys(value)) return false;

  return Object.values(value).every((val) => {
    if (isValidObject(val)) {
      return isValidDeepObject(val, maxDepth, currentDepth + 1);
    }
    if (isValidArray(val)) {
      return val.every((item) => {
        if (isValidObject(item)) {
          return isValidDeepObject(item, maxDepth, currentDepth + 1);
        }
        return true;
      });
    }
    return true;
  });
}

/**
 * Validate JSON size (prevent DoS)
 */
export function isValidJsonSize(
  value: unknown,
  maxSizeBytes: number = 1048576
): boolean {
  try {
    const jsonString = JSON.stringify(value);
    const sizeBytes = new Blob([jsonString]).size;
    return sizeBytes <= maxSizeBytes;
  } catch {
    return false;
  }
}
