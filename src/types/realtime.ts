/**
 * Real-time analytics types
 */

/**
 * Browser information parsed from User-Agent
 */
export interface BrowserInfo {
  name: string;
  version: string;
  engine: string;
}

/**
 * Operating System information parsed from User-Agent
 */
export interface OSInfo {
  name: string;
  version: string;
}

/**
 * Device information parsed from User-Agent
 */
export interface DeviceInfo {
  type: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown';
  vendor: string;
  model: string;
}

/**
 * Parsed User-Agent information
 */
export interface ParsedUserAgent {
  browser: BrowserInfo;
  os: OSInfo;
  device: DeviceInfo;
  raw: string;
}

/**
 * Bot detection result
 */
export interface BotDetectionResult {
  isBot: boolean;
  score: number; // 0-100, higher = more likely bot
  reasons: string[];
  detectionMethod: 'ua-string' | 'behavioral' | 'fingerprint' | 'combined';
}

/**
 * Client fingerprint components
 */
export interface FingerprintComponents {
  screen: {
    width: number;
    height: number;
    colorDepth: number;
  };
  timezone: string;
  language: string;
  platform: string;
  cookieEnabled: boolean;
  doNotTrack: boolean;
}

/**
 * Generated fingerprint
 */
export interface Fingerprint {
  hash: string;
  components: FingerprintComponents;
  confidence: number; // 0-100
}

/**
 * Real-time analytics event data (from client)
 */
export interface RealtimeEvent {
  // Required fields
  event_type: 'pageview' | 'click' | 'custom';
  timestamp: number; // Unix timestamp in milliseconds
  url: string;
  referrer?: string;
  user_agent: string;
  fingerprint: Fingerprint;

  // Optional identification
  project_id?: string;
  session_id?: string;
  visitor_id?: string;
  user_id?: string;

  // Click event specific
  click_target?: string;
  click_text?: string;

  // Custom event specific
  custom_data?: Record<string, unknown>;

  // Client info (deprecated - use fingerprint instead)
  viewport?: {
    width: number;
    height: number;
  };
  screen?: {
    width: number;
    height: number;
    colorDepth: number;
  };
  timezone?: string;
  language?: string;
  platform?: string;
  cookieEnabled?: boolean;
  doNotTrack?: boolean;

  // Custom event data (deprecated - use custom_data instead)
  event_name?: string;
  event_properties?: Record<string, string | number | boolean>;

  // Performance metrics (for pageview events)
  performance?: {
    dns?: number;
    tcp?: number;
    ttfb?: number;
    download?: number;
    domInteractive?: number;
    domComplete?: number;
    loadComplete?: number;
  };
}

/**
 * Processed real-time analytics data (server-side)
 */
export interface ProcessedRealtimeData {
  // Original event data
  event_type: string;
  timestamp: number;
  url: string;
  referrer: string;
  project_id: string;

  // Session tracking
  session_id: string;
  visitor_id: string; // Fingerprint hash
  user_id: string | null;

  // Parsed client info
  user_agent: ParsedUserAgent;
  bot_detection: BotDetectionResult;
  fingerprint: Fingerprint;

  // Geo location (from Cloudflare request.cf)
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: string | null;
  longitude: string | null;

  // Custom event data
  event_name: string | null;
  event_properties: Record<string, string | number | boolean> | null;

  // Performance metrics
  performance: RealtimeEvent['performance'] | null;
}

/**
 * Aggregated real-time statistics (5-minute window)
 */
export interface RealtimeStats {
  timestamp: number; // Window start time
  window_size: number; // Window size in milliseconds (default 5 minutes)

  // Traffic metrics
  total_events: number;
  unique_visitors: number;

  // Event breakdown
  pageviews: number;
  clicks: number;
  custom_events: number;

  // Browser breakdown
  browsers: Record<string, number>;

  // OS breakdown
  operating_systems: Record<string, number>;

  // Device breakdown
  device_types: Record<string, number>;

  // Bot traffic
  bot_traffic: number;
  human_traffic: number;
}

/**
 * Real-time dashboard query parameters
 */
export interface RealtimeDashboardQuery {
  project_id?: string;
  start?: string; // ISO 8601
  end?: string; // ISO 8601
  interval?: '1m' | '5m' | '1h'; // Aggregation interval
}

/**
 * Real-time dashboard response
 */
export interface RealtimeDashboardResponse {
  success: boolean;
  data: {
    current_stats: RealtimeStats;
    timeseries: RealtimeStats[];
  };
}

/**
 * Cloudflare server context from request headers
 */
export interface ServerContext {
  ip: string;
  country: string | null;
  city: string | null;
  region: string | null;
  timezone: string | null;
  asn: number | null;
  isp: string | null;
  cf_ray: string | null;
  cf_connecting_ip: string | null;
}

/**
 * Aggregated data with event list
 */
export interface AggregatedData {
  current_window: {
    start: number;
    end: number;
    stats: RealtimeStats;
  };
  events: Array<{
    timestamp: number;
    event_type: string;
    url: string;
    visitor_id?: string;
  }>;
}

/**
 * Analytics Engine data point format
 * Reference: https://developers.cloudflare.com/analytics/analytics-engine/
 */
export interface AnalyticsEngineDataPoint {
  indexes?: string[]; // Max 1 index, max 96 bytes each
  doubles?: number[]; // Numeric values
  blobs?: string[]; // String values, max 5120 bytes each
}
