import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';

/**
 * Logtail log event interface
 * Compatible with Better Stack / Logtail HTTP API
 * See: https://betterstack.com/docs/logs/http-rest-api/
 */
export interface LogtailEvent {
  message: string;
  dt?: string | number; // Timestamp: UNIX time (seconds/ms/ns) or RFC 3339 string
  level?: string; // Log level: info, warn, error, debug, etc.
  [key: string]: unknown; // Additional fields
}

/**
 * Logtail data format - can be single event or array of events
 */
export type LogtailData = LogtailEvent | LogtailEvent[];

/**
 * Adapter for Logtail/Better Stack log format
 * Transforms Logtail HTTP API format to Analytics Engine
 *
 * Supported formats:
 * - Single event: {"message": "...", "dt": ..., "level": "..."}
 * - Multiple events: [{"message": "..."}, {"message": "..."}]
 *
 * Timestamp formats (dt field):
 * - UNIX time: 1672490759 (seconds), 1672490759123 (ms), 1672490759123456000 (ns)
 * - RFC 3339: "2022-12-31T13:45:59.123456Z", "2022-12-31 13:45:59.123456+02:00"
 *
 * Size limits:
 * - Max request: 10 MiB compressed
 * - Max log record: 1 MiB (recommended: < 100 KiB)
 */
export class LogtailAdapter extends BaseAdapter<LogtailData> {
  /**
   * Validate Logtail data format
   */
  validate(data: unknown): data is LogtailData {
    // Single event
    if (this.isObject(data)) {
      return this.isValidEvent(data);
    }

    // Array of events
    if (this.isArray(data)) {
      return data.length > 0 && data.every((item) => this.isValidEvent(item));
    }

    return false;
  }

  /**
   * Validate single event
   */
  private isValidEvent(event: unknown): event is LogtailEvent {
    if (!this.isObject(event)) {
      return false;
    }

    // Required: message field must be string
    if (!('message' in event) || !this.isString(event.message)) {
      return false;
    }

    // Optional: dt field (timestamp)
    if ('dt' in event && event.dt !== undefined && event.dt !== null) {
      const isValidTimestamp =
        this.isString(event.dt) || this.isNumber(event.dt);
      if (!isValidTimestamp) {
        return false;
      }
    }

    // Optional: level field
    if ('level' in event && event.level !== undefined && event.level !== null) {
      if (!this.isString(event.level)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Transform Logtail data to Analytics Engine format
   */
  transform(data: LogtailData): AnalyticsEngineDataPoint {
    const events = this.isArray(data) ? data : [data];
    const projectId = this.getProjectId();

    // For multiple events, we'll store them as a batch
    // For single event, store as individual record
    if (events.length === 1) {
      return this.transformSingleEvent(events[0], projectId);
    } else {
      return this.transformBatchEvents(events, projectId);
    }
  }

  /**
   * Transform single event
   */
  private transformSingleEvent(
    event: LogtailEvent,
    projectId?: string
  ): AnalyticsEngineDataPoint {
    const timestamp = this.parseTimestamp(event.dt);

    // Extract message and metadata
    const { message, level, ...metadata } = event;

    // Build the data object
    const data = {
      message,
      level: level || 'info',
      timestamp: new Date(timestamp).toISOString(),
      metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      event_count: 1,
    };

    return {
      // Use project_id as the only index (Analytics Engine limit: max 1 index)
      indexes: projectId ? [this.toIndex(projectId)] : [],

      // Store numeric data (timestamp)
      doubles: [this.toDouble(timestamp)],

      // Store all data as JSON in blobs (stringify then truncate)
      blobs: [this.toBlob(JSON.stringify(data))],
    };
  }

  /**
   * Transform batch of events
   */
  private transformBatchEvents(
    events: LogtailEvent[],
    projectId?: string
  ): AnalyticsEngineDataPoint {
    const now = Date.now();

    // Extract messages and metadata
    const processedEvents = events.map((event) => ({
      message: event.message,
      level: event.level || 'info',
      timestamp: event.dt
        ? new Date(this.parseTimestamp(event.dt)).toISOString()
        : new Date(now).toISOString(),
      metadata: Object.keys(event)
        .filter((key) => !['message', 'dt', 'level'].includes(key))
        .reduce(
          (acc, key) => {
            acc[key] = event[key];
            return acc;
          },
          {} as Record<string, unknown>
        ),
    }));

    // Build the data object
    const data = {
      batch: true,
      event_count: events.length,
      timestamp: new Date(now).toISOString(),
      events: processedEvents,
    };

    return {
      // Use project_id as the only index
      indexes: projectId ? [this.toIndex(projectId)] : [],

      // Store count and timestamp
      doubles: [this.toDouble(now), this.toDouble(events.length)],

      // Store batch data (stringify then truncate)
      blobs: [this.toBlob(JSON.stringify(data))],
    };
  }

  /**
   * Parse timestamp from various formats
   * Returns milliseconds since epoch
   */
  private parseTimestamp(dt: string | number | undefined): number {
    if (!dt) {
      return Date.now();
    }

    // String format (RFC 3339 / ISO 8601)
    if (this.isString(dt)) {
      const parsed = Date.parse(dt);
      return isNaN(parsed) ? Date.now() : parsed;
    }

    // Number format (UNIX time)
    if (this.isNumber(dt)) {
      // Detect format based on magnitude
      // Seconds: < 10^10 (before year 2286)
      // Milliseconds: 10^12 to 10^13
      // Nanoseconds: > 10^15
      if (dt < 10000000000) {
        // Seconds
        return dt * 1000;
      } else if (dt < 10000000000000) {
        // Milliseconds
        return dt;
      } else {
        // Nanoseconds
        return Math.floor(dt / 1000000);
      }
    }

    return Date.now();
  }
}
