import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';

/**
 * Sentry stack frame interface
 */
export interface SentryStackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  abs_path?: string;
  context_line?: string;
  in_app?: boolean;
  module?: string;
  pre_context?: string[];
  post_context?: string[];
  vars?: Record<string, unknown>;
}

/**
 * Sentry exception interface
 */
export interface SentryException {
  type: string;
  value: string;
  module?: string;
  stacktrace?: {
    frames: SentryStackFrame[];
  };
  mechanism?: {
    type?: string;
    handled?: boolean;
    help_link?: string;
    data?: Record<string, unknown>;
  };
}

/**
 * Sentry breadcrumb interface
 */
export interface SentryBreadcrumb {
  timestamp: string | number;
  message?: string;
  category?: string;
  level?: string;
  type?: string;
  data?: Record<string, unknown>;
}

/**
 * Sentry user interface
 */
export interface SentryUser {
  id?: string;
  email?: string;
  ip_address?: string;
  name?: string;
  username?: string;
}

/**
 * Sentry request interface
 */
export interface SentryRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string> | Array<[string, string]>;
  data?: unknown;
  query_string?: string | Array<[string, string]>;
  cookies?: string | Record<string, string>;
  env?: Record<string, string>;
}

/**
 * Sentry SDK interface
 */
export interface SentrySdk {
  name?: string;
  version?: string;
  integrations?: string[];
  packages?: Array<{
    name: string;
    version: string;
  }>;
}

/**
 * Sentry event interface
 * Based on Sentry's official event payload structure
 * See: https://develop.sentry.dev/sdk/event-payloads/
 */
export interface SentryEvent {
  event_id: string; // Required: 32 lowercase hex chars (UUID4 without dashes)
  timestamp?: string | number; // RFC 3339 or Unix epoch
  platform?: string; // "javascript", "python", etc.
  level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  logger?: string;
  transaction?: string;
  server_name?: string;
  release?: string;
  dist?: string;
  environment?: string;
  modules?: Record<string, string>;
  message?: string;
  fingerprint?: string[];
  exception?: {
    values: SentryException[];
  };
  logentry?: {
    message?: string;
    formatted?: string;
    params?: unknown[];
  };
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  user?: SentryUser;
  contexts?: Record<string, unknown>;
  breadcrumbs?: {
    values: SentryBreadcrumb[];
  };
  request?: SentryRequest;
  sdk?: SentrySdk;
  [key: string]: unknown;
}

/**
 * Adapter for Sentry event format
 * Transforms Sentry error tracking payloads to Analytics Engine
 *
 * Supports Sentry's official event payload format with:
 * - Error/exception tracking with stacktraces
 * - Breadcrumbs (user actions leading to error)
 * - Tags, user context, and metadata
 * - Multiple exception types (chained exceptions)
 * - Request and environment context
 */
export class SentryAdapter extends BaseAdapter<SentryEvent> {
  /**
   * Validate Sentry event format
   */
  validate(data: unknown): data is SentryEvent {
    if (!this.isObject(data)) {
      return false;
    }

    // Required: event_id must be 32 lowercase hex characters
    if (!('event_id' in data) || !this.isValidEventId(data.event_id)) {
      return false;
    }

    // Optional: timestamp
    if ('timestamp' in data && data.timestamp !== undefined) {
      if (!this.isString(data.timestamp) && !this.isNumber(data.timestamp)) {
        return false;
      }
    }

    // Optional: level (validate enum if present)
    if ('level' in data && data.level !== undefined) {
      const validLevels = [
        'fatal',
        'error',
        'warning',
        'info',
        'debug',
      ] as const;
      const level = data.level;
      if (
        !this.isString(level) ||
        !(validLevels as readonly string[]).includes(level)
      ) {
        return false;
      }
    }

    // Optional: exception (validate structure if present)
    if ('exception' in data && data.exception !== undefined) {
      if (!this.isValidException(data.exception)) {
        return false;
      }
    }

    // Optional: user (validate structure if present)
    if ('user' in data && data.user !== undefined) {
      if (!this.isValidUser(data.user)) {
        return false;
      }
    }

    // Optional: breadcrumbs (validate structure if present)
    if ('breadcrumbs' in data && data.breadcrumbs !== undefined) {
      if (!this.isValidBreadcrumbs(data.breadcrumbs)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Validate event_id format (32 lowercase hex chars)
   */
  private isValidEventId(eventId: unknown): eventId is string {
    if (!this.isString(eventId)) {
      return false;
    }
    // Must be exactly 32 lowercase hexadecimal characters
    return /^[0-9a-f]{32}$/.test(eventId);
  }

  /**
   * Validate exception structure
   */
  private isValidException(exception: unknown): boolean {
    if (!this.isObject(exception)) {
      return false;
    }

    // Must have 'values' array
    if (!('values' in exception) || !this.isArray(exception.values)) {
      return false;
    }

    // Each exception must have type and value
    return exception.values.every(
      (ex: unknown) =>
        this.isObject(ex) &&
        'type' in ex &&
        'value' in ex &&
        this.isString(ex.type) &&
        this.isString(ex.value)
    );
  }

  /**
   * Validate user structure
   */
  private isValidUser(user: unknown): boolean {
    if (!this.isObject(user)) {
      return false;
    }

    // At least one field should be present
    const hasValidField =
      ('id' in user && this.isString(user.id)) ||
      ('email' in user && this.isString(user.email)) ||
      ('ip_address' in user && this.isString(user.ip_address)) ||
      ('name' in user && this.isString(user.name)) ||
      ('username' in user && this.isString(user.username));

    return hasValidField;
  }

  /**
   * Validate breadcrumbs structure
   */
  private isValidBreadcrumbs(breadcrumbs: unknown): boolean {
    if (!this.isObject(breadcrumbs)) {
      return false;
    }

    // Must have 'values' array
    if (!('values' in breadcrumbs) || !this.isArray(breadcrumbs.values)) {
      return false;
    }

    // Each breadcrumb must have timestamp
    return breadcrumbs.values.every(
      (crumb: unknown) =>
        this.isObject(crumb) &&
        'timestamp' in crumb &&
        (this.isString(crumb.timestamp) || this.isNumber(crumb.timestamp))
    );
  }

  /**
   * Transform Sentry event to Analytics Engine format
   */
  transform(data: SentryEvent): AnalyticsEngineDataPoint {
    const projectId = this.getProjectId();
    const timestamp = this.parseTimestamp(data.timestamp);

    // Extract exception summary (first exception)
    const exceptionSummary = this.extractExceptionSummary(data.exception);

    // Extract first stack frame for quick context
    const firstFrame = this.extractFirstFrame(data.exception);

    // Truncate stacktrace to first 10 frames to fit in blob limit
    const truncatedStacktrace = this.truncateStacktrace(data.exception);

    // Build compact data object
    const eventData = {
      // Core fields
      event_id: data.event_id,
      timestamp: new Date(timestamp).toISOString(),
      platform: data.platform,
      level: data.level || 'error',

      // Error information
      exception: exceptionSummary,
      first_frame: firstFrame,
      stacktrace: truncatedStacktrace,

      // Context
      transaction: data.transaction,
      logger: data.logger,
      server_name: data.server_name,
      environment: data.environment,
      release: data.release,

      // User and tags
      user: data.user,
      tags: data.tags,

      // Request context (compact)
      request: data.request
        ? {
            url: data.request.url,
            method: data.request.method,
          }
        : undefined,

      // SDK info
      sdk: data.sdk
        ? {
            name: data.sdk.name,
            version: data.sdk.version,
          }
        : undefined,

      // Breadcrumbs (limited to last 5)
      breadcrumbs: this.truncateBreadcrumbs(data.breadcrumbs),

      // Extra metadata (limited)
      extra: this.limitExtraData(data.extra),
    };

    // Remove undefined fields
    const compactData = this.removeUndefined(eventData);

    return {
      // Use project_id as the only index (Analytics Engine limit: max 1 index)
      indexes: projectId ? [this.toIndex(projectId)] : [],

      // Store numeric data (timestamp)
      doubles: [this.toDouble(timestamp)],

      // Store all data as JSON in blobs (stringify then truncate to 5120 bytes)
      blobs: [this.toBlob(JSON.stringify(compactData))],
    };
  }

  /**
   * Parse timestamp from various formats
   * Returns milliseconds since epoch
   */
  private parseTimestamp(timestamp: string | number | undefined): number {
    if (!timestamp) {
      return Date.now();
    }

    // String format (RFC 3339 / ISO 8601)
    if (this.isString(timestamp)) {
      const parsed = Date.parse(timestamp);
      return isNaN(parsed) ? Date.now() : parsed;
    }

    // Number format (Unix time)
    if (this.isNumber(timestamp)) {
      // Sentry uses Unix timestamp (seconds with decimal)
      // If less than 10^10, it's seconds; otherwise milliseconds
      if (timestamp < 10000000000) {
        return Math.floor(timestamp * 1000);
      }
      return Math.floor(timestamp);
    }

    return Date.now();
  }

  /**
   * Extract exception summary from exception data
   */
  private extractExceptionSummary(
    exception: SentryEvent['exception']
  ): { type: string; value: string; module?: string } | undefined {
    if (!exception?.values || exception.values.length === 0) {
      return undefined;
    }

    const firstException = exception.values[0];
    if (!firstException) {
      return undefined;
    }

    return {
      type: firstException.type,
      value: firstException.value,
      module: firstException.module,
    };
  }

  /**
   * Extract first stack frame for quick context
   */
  private extractFirstFrame(
    exception: SentryEvent['exception']
  ): Partial<SentryStackFrame> | undefined {
    if (!exception?.values || exception.values.length === 0) {
      return undefined;
    }

    const firstException = exception.values[0];
    const frames = firstException?.stacktrace?.frames;

    if (!frames || frames.length === 0) {
      return undefined;
    }

    const frame = frames[0];
    if (!frame) {
      return undefined;
    }

    return {
      filename: frame.filename,
      function: frame.function,
      lineno: frame.lineno,
      colno: frame.colno,
      in_app: frame.in_app,
    };
  }

  /**
   * Truncate stacktrace to first 10 frames
   */
  private truncateStacktrace(
    exception: SentryEvent['exception']
  ): SentryStackFrame[] | undefined {
    if (!exception?.values || exception.values.length === 0) {
      return undefined;
    }

    const firstException = exception.values[0];
    const frames = firstException?.stacktrace?.frames;

    if (!frames || frames.length === 0) {
      return undefined;
    }

    // Take first 10 frames and compact them
    return frames.slice(0, 10).map((frame) => ({
      filename: frame.filename,
      function: frame.function,
      lineno: frame.lineno,
      colno: frame.colno,
      abs_path: frame.abs_path,
      in_app: frame.in_app,
    }));
  }

  /**
   * Truncate breadcrumbs to last 5
   */
  private truncateBreadcrumbs(
    breadcrumbs: SentryEvent['breadcrumbs']
  ): SentryBreadcrumb[] | undefined {
    if (!breadcrumbs?.values || breadcrumbs.values.length === 0) {
      return undefined;
    }

    // Take last 5 breadcrumbs
    return breadcrumbs.values.slice(-5).map((crumb) => ({
      timestamp: crumb.timestamp,
      message: crumb.message,
      category: crumb.category,
      level: crumb.level,
    }));
  }

  /**
   * Limit extra data to prevent blob overflow
   */
  private limitExtraData(
    extra: Record<string, unknown> | undefined
  ): Record<string, unknown> | undefined {
    if (!extra || Object.keys(extra).length === 0) {
      return undefined;
    }

    // Take first 10 keys
    const limitedExtra: Record<string, unknown> = {};
    const keys = Object.keys(extra).slice(0, 10);

    for (const key of keys) {
      limitedExtra[key] = extra[key];
    }

    return limitedExtra;
  }

  /**
   * Remove undefined fields from object
   */
  private removeUndefined(
    obj: Record<string, unknown>
  ): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(obj)) {
      if (value !== undefined) {
        result[key] = value;
      }
    }

    return result;
  }
}
