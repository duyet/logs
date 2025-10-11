/**
 * Self-tracking analytics types for monitoring the logs system itself
 */

/**
 * Raw request data captured by middleware
 */
export interface SelfTrackingRequestData {
  // Request metadata
  timestamp: number; // Unix timestamp in milliseconds
  endpoint: string; // Request path (e.g., "/cc/myproject")
  method: string; // HTTP method (GET, POST, etc.)
  status: number; // HTTP status code
  response_time_ms: number; // Response time in milliseconds
  project_id?: string; // Optional project ID from request

  // User-Agent information
  user_agent?: string; // Raw user-agent string

  // Cloudflare request metadata (from CF headers)
  cf_ray?: string; // CF-Ray header
  cf_country?: string; // Country code
  cf_ip?: string; // IP address (anonymized)

  // Error information (if status >= 400)
  error_message?: string; // Error message
  error_stack?: string; // Stack trace (truncated)
}

/**
 * Aggregated statistics from Durable Object
 */
export interface SelfTrackingStats {
  // Time window
  timestamp: number; // Window end timestamp
  window_size: number; // Window size in milliseconds (300000 = 5 min)

  // Request metrics
  total_requests: number; // Total requests in window
  success_count: number; // Successful requests (2xx, 3xx)
  error_count: number; // Failed requests (4xx, 5xx)

  // Status code distribution
  status_codes: Record<number, number>; // { 200: 150, 404: 5, 500: 2 }

  // Endpoint usage
  endpoints: Record<string, number>; // { "/cc": 100, "/ga": 50 }

  // Project breakdown
  projects: Record<string, number>; // { "default": 80, "blog": 30 }

  // Performance metrics
  performance: {
    avg_response_time: number; // Average response time (ms)
    p50_response_time: number; // 50th percentile
    p95_response_time: number; // 95th percentile
    p99_response_time: number; // 99th percentile
    max_response_time: number; // Maximum response time
  };
}

/**
 * Durable Object increment message
 */
export interface IncrementMessage {
  timestamp: number;
  endpoint: string;
  method: string;
  status: number;
  response_time_ms: number;
  project_id?: string;
  error?: boolean;
}

/**
 * Durable Object state interface
 */
export interface DurableObjectState {
  // Window metadata
  window_start: number; // Window start timestamp
  window_size: number; // Window size in milliseconds

  // Request tracking
  total_requests: number;
  success_count: number;
  error_count: number;

  // Maps for breakdown data
  status_codes: Record<number, number>;
  endpoints: Record<string, number>;
  projects: Record<string, number>;

  // Response times for percentile calculation
  response_times: number[]; // Sorted array
}
