import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';
import type { SelfTrackingRequestData } from '../types/self-tracking.js';

/**
 * Adapter for self-tracking analytics events
 * Transforms request metadata into Analytics Engine format for monitoring
 * the logs system itself
 */
export class SelfTrackingAdapter extends BaseAdapter<SelfTrackingRequestData> {
  /**
   * Validate SelfTrackingRequestData structure
   * Required fields: timestamp, endpoint, method, status, response_time_ms
   * Optional fields: project_id, user_agent, cf_ray, cf_country, cf_ip, error_message, error_stack
   */
  validate(data: unknown): data is SelfTrackingRequestData {
    if (!this.isObject(data)) {
      return false;
    }

    // Required fields
    const hasRequiredFields =
      'timestamp' in data &&
      'endpoint' in data &&
      'method' in data &&
      'status' in data &&
      'response_time_ms' in data;

    if (!hasRequiredFields) {
      return false;
    }

    // Type checks for required fields
    const validTypes =
      this.isNumber(data.timestamp) &&
      this.isString(data.endpoint) &&
      this.isString(data.method) &&
      this.isNumber(data.status) &&
      this.isNumber(data.response_time_ms);

    if (!validTypes) {
      return false;
    }

    // Optional field type checks
    if ('project_id' in data && !this.isString(data.project_id)) {
      return false;
    }

    if ('user_agent' in data && !this.isString(data.user_agent)) {
      return false;
    }

    if ('cf_ray' in data && !this.isString(data.cf_ray)) {
      return false;
    }

    if ('cf_country' in data && !this.isString(data.cf_country)) {
      return false;
    }

    if ('cf_ip' in data && !this.isString(data.cf_ip)) {
      return false;
    }

    if ('error_message' in data && !this.isString(data.error_message)) {
      return false;
    }

    if ('error_stack' in data && !this.isString(data.error_stack)) {
      return false;
    }

    return true;
  }

  /**
   * Transform SelfTrackingRequestData to Analytics Engine format
   * Structure:
   * - indexes[0]: project_id (max 96 bytes) if available
   * - doubles[0]: timestamp
   * - doubles[1]: status
   * - doubles[2]: response_time_ms
   * - blobs[0]: JSON with all request data
   */
  transform(data: SelfTrackingRequestData): AnalyticsEngineDataPoint {
    // Get project_id from data or context
    const projectId = data.project_id || this.getProjectId();

    // Determine if this is an error request
    const isError = data.status >= 400;

    // Build blob data with all request information
    const blobData = {
      // Request metadata
      timestamp: data.timestamp,
      endpoint: data.endpoint,
      method: data.method,
      status: data.status,
      response_time_ms: data.response_time_ms,
      project_id: projectId || null,

      // Classification
      is_error: isError,
      is_success: !isError,

      // User-Agent
      user_agent: data.user_agent || null,

      // Cloudflare metadata
      cf_ray: data.cf_ray || null,
      cf_country: data.cf_country || null,
      cf_ip: data.cf_ip || null,

      // Error information (if applicable)
      error_message: data.error_message || null,
      error_stack: data.error_stack
        ? this.toBlob(data.error_stack, 2000)
        : null, // Truncate stack traces
    };

    // Serialize to JSON and truncate to Analytics Engine blob limit (5120 bytes)
    const blobJson = this.toBlob(JSON.stringify(blobData));

    return {
      // Max 1 index: use project_id for filtering (if available)
      indexes: projectId ? [this.toIndex(projectId)] : [],

      // Numeric values: timestamp, status, response_time_ms
      doubles: [
        this.toDouble(data.timestamp),
        this.toDouble(data.status),
        this.toDouble(data.response_time_ms),
      ],

      // All request data as JSON blob
      blobs: [blobJson],
    };
  }
}
