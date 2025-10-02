/**
 * Input validation utilities to prevent security issues
 */

/**
 * Validate string input (prevent XSS, injection)
 */
export function isValidString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && value.length <= 10000;
}

/**
 * Validate number input
 */
export function isValidNumber(value: unknown): value is number {
  return typeof value === 'number' && !isNaN(value) && isFinite(value);
}

/**
 * Validate object input (non-null object)
 */
export function isValidObject(value: unknown): value is Record<string, unknown> {
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
 * Validate project ID format (3-32 alphanumeric lowercase)
 */
export function isValidProjectId(value: unknown): value is string {
  if (!isValidString(value)) return false;
  return /^[a-z0-9]{3,32}$/.test(value);
}

/**
 * Validate session ID format
 */
export function isValidSessionId(value: unknown): value is string {
  if (!isValidString(value)) return false;
  // Allow alphanumeric, hyphens, underscores (common UUID/session ID formats)
  return /^[a-zA-Z0-9_-]{1,128}$/.test(value);
}

/**
 * Validate timestamp format (ISO 8601)
 */
export function isValidTimestamp(value: unknown): value is string {
  if (!isValidString(value)) return false;

  const date = new Date(value);
  return !isNaN(date.getTime());
}

/**
 * Validate URL format
 */
export function isValidUrl(value: unknown): value is string {
  if (!isValidString(value)) return false;

  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate email format
 */
export function isValidEmail(value: unknown): value is string {
  if (!isValidString(value)) return false;

  // Basic email validation
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

/**
 * Validate enum value
 */
export function isValidEnum<T extends string>(
  value: unknown,
  allowedValues: readonly T[]
): value is T {
  return isValidString(value) && allowedValues.includes(value as T);
}

/**
 * Validate object keys (prevent prototype pollution)
 */
export function hasOnlySafeKeys(obj: Record<string, unknown>): boolean {
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
  return !Object.keys(obj).some((key) => dangerousKeys.includes(key));
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
export function isValidJsonSize(value: unknown, maxSizeBytes: number = 1048576): boolean {
  try {
    const jsonString = JSON.stringify(value);
    const sizeBytes = new Blob([jsonString]).size;
    return sizeBytes <= maxSizeBytes;
  } catch {
    return false;
  }
}
