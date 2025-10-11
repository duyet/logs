/**
 * Input sanitization utilities for SQL injection prevention
 * Follows OWASP guidelines for injection prevention
 */

import { isValidProjectId } from './validation.js';

/**
 * Sanitization error thrown when input validation fails
 */
export class SanitizationError extends Error {
  constructor(
    message: string,
    public readonly field: string,
    public readonly value: unknown
  ) {
    super(message);
    this.name = 'SanitizationError';
  }
}

/**
 * Sanitize project ID for SQL queries
 * Uses whitelist validation approach - only allows safe characters
 *
 * @param projectId - The project ID to sanitize
 * @param options - Sanitization options
 * @returns Sanitized project ID
 * @throws {SanitizationError} If project ID contains dangerous characters
 *
 * Security measures:
 * 1. Validates against strict pattern: ^[a-z0-9-]{3,32}$
 * 2. Rejects any SQL metacharacters (quotes, semicolons, etc.)
 * 3. Length limits prevent buffer overflow attacks
 * 4. Whitelist-only approach (deny by default)
 */
export function sanitizeProjectId(
  projectId: string | null | undefined,
  options: { throwOnInvalid?: boolean; logAttempts?: boolean } = {}
): string | null {
  const { throwOnInvalid = true, logAttempts = true } = options;

  // Null/undefined is valid - means no filtering
  if (projectId === null || projectId === undefined) {
    return null;
  }

  // Empty string is invalid
  if (typeof projectId !== 'string' || projectId.trim() === '') {
    if (throwOnInvalid) {
      throw new SanitizationError(
        'Project ID cannot be empty',
        'project_id',
        projectId
      );
    }
    return null;
  }

  const trimmed = projectId.trim();

  // Detect SQL injection attempts
  const dangerousPatterns = [
    // SQL keywords
    /\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|UNION|EXEC|EXECUTE)\b/i,
    // SQL operators and metacharacters
    /[;'"\\]/,
    /--/,
    /\/\*/,
    /\*\//,
    // SQL functions
    /\b(SLEEP|BENCHMARK|WAITFOR)\b/i,
  ];

  for (const pattern of dangerousPatterns) {
    if (pattern.test(trimmed)) {
      if (logAttempts) {
        console.warn(
          `[SECURITY] SQL injection attempt detected in project_id: ${trimmed.substring(0, 50)}`
        );
      }
      if (throwOnInvalid) {
        throw new SanitizationError(
          'Project ID contains invalid characters',
          'project_id',
          trimmed
        );
      }
      return null;
    }
  }

  // Validate against strict whitelist pattern
  if (!isValidProjectId(trimmed)) {
    if (logAttempts) {
      console.warn(
        `[SECURITY] Invalid project_id format: ${String(trimmed).substring(0, 50)}`
      );
    }
    if (throwOnInvalid) {
      throw new SanitizationError(
        'Project ID must be 3-32 lowercase alphanumeric characters with hyphens',
        'project_id',
        trimmed
      );
    }
    return null;
  }

  return trimmed;
}

/**
 * Sanitize SQL LIMIT value
 * Prevents DOS attacks via excessive limits
 *
 * @param limit - The limit value to sanitize
 * @param maxLimit - Maximum allowed limit (default: 100000)
 * @returns Sanitized limit value
 * @throws {SanitizationError} If limit is invalid
 */
export function sanitizeLimit(
  limit: number | string | null | undefined,
  maxLimit: number = 100000
): number {
  // Default limit
  if (limit === null || limit === undefined) {
    return 10000;
  }

  // Parse to number
  const parsed =
    typeof limit === 'string' ? parseInt(limit, 10) : Number(limit);

  // Validate
  if (isNaN(parsed) || !isFinite(parsed)) {
    throw new SanitizationError('Limit must be a valid number', 'limit', limit);
  }

  if (parsed < 1) {
    throw new SanitizationError('Limit must be greater than 0', 'limit', limit);
  }

  if (parsed > maxLimit) {
    throw new SanitizationError(
      `Limit cannot exceed ${maxLimit}`,
      'limit',
      limit
    );
  }

  return parsed;
}

/**
 * Sanitize SQL INTERVAL value for time range queries
 * Prevents injection via time range manipulation
 *
 * @param hours - Number of hours for interval
 * @param maxHours - Maximum allowed hours (default: 8760 = 1 year)
 * @returns Sanitized hours value
 * @throws {SanitizationError} If hours is invalid
 */
export function sanitizeInterval(
  hours: number,
  maxHours: number = 8760
): number {
  if (!Number.isFinite(hours) || isNaN(hours)) {
    throw new SanitizationError(
      'Interval hours must be a valid number',
      'interval',
      hours
    );
  }

  if (hours < 0) {
    throw new SanitizationError(
      'Interval hours cannot be negative',
      'interval',
      hours
    );
  }

  if (hours > maxHours) {
    throw new SanitizationError(
      `Interval hours cannot exceed ${maxHours}`,
      'interval',
      hours
    );
  }

  return Math.ceil(hours);
}

/**
 * Sanitize dataset name for SQL queries
 * Validates against known dataset names
 *
 * @param datasetName - The dataset name to sanitize
 * @param allowedDatasets - List of allowed dataset names
 * @returns Sanitized dataset name
 * @throws {SanitizationError} If dataset name is invalid
 */
export function sanitizeDatasetName(
  datasetName: string,
  allowedDatasets: string[]
): string {
  if (typeof datasetName !== 'string' || datasetName.trim() === '') {
    throw new SanitizationError(
      'Dataset name cannot be empty',
      'dataset_name',
      datasetName
    );
  }

  const trimmed = datasetName.trim();

  // Check against whitelist
  if (!allowedDatasets.includes(trimmed)) {
    throw new SanitizationError(
      `Dataset name must be one of: ${allowedDatasets.join(', ')}`,
      'dataset_name',
      trimmed
    );
  }

  // Additional validation - dataset names should only contain safe characters
  const safePattern = /^[a-z0-9_]+$/;
  if (!safePattern.test(trimmed)) {
    throw new SanitizationError(
      'Dataset name contains invalid characters',
      'dataset_name',
      trimmed
    );
  }

  return trimmed;
}

/**
 * Escape SQL string literal (defense in depth)
 * Use as last resort - prefer parameterized queries
 *
 * @param value - The string to escape
 * @returns Escaped string safe for SQL
 */
export function escapeSqlString(value: string): string {
  // Replace single quotes with two single quotes (SQL standard escaping)
  return value.replace(/'/g, "''");
}
