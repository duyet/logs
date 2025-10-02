// Import Hono context variable extensions
import './hono.js';

/**
 * Cloudflare Analytics Engine data format
 */
export interface AnalyticsEngineDataPoint {
  blobs?: string[];
  doubles?: number[];
  indexes?: string[];
}

/**
 * Cloudflare Pages environment with Analytics Engine bindings
 */
export interface Env {
  CLAUDE_CODE_ANALYTICS: AnalyticsEngineDataset;
  GA_ANALYTICS: AnalyticsEngineDataset;
  DB: D1Database;
}

/**
 * Analytics Engine dataset binding interface
 */
export interface AnalyticsEngineDataset {
  writeDataPoint(data: AnalyticsEngineDataPoint): void;
}

/**
 * Base adapter interface for transforming data formats
 */
export interface DataAdapter<T = unknown> {
  /**
   * Transform input data to Analytics Engine format
   */
  transform(data: T): AnalyticsEngineDataPoint;

  /**
   * Validate input data
   */
  validate(data: unknown): data is T;
}

/**
 * Claude Code OpenTelemetry metric format
 */
export interface ClaudeCodeMetric {
  session_id: string;
  app_version?: string;
  organization_id?: string;
  user_account_uuid?: string;
  metric_name: string;
  value: number;
  project_id?: string;
  attributes?: {
    type?: 'input' | 'output' | 'cacheRead' | 'cacheCreation';
    model?: string;
    tool?: string;
    decision?: 'accept' | 'reject';
    language?: string;
  };
  timestamp?: string;
}

/**
 * Claude Code OpenTelemetry event format
 */
export interface ClaudeCodeEvent {
  event_name:
    | 'user_prompt'
    | 'tool_result'
    | 'api_request'
    | 'api_error'
    | 'tool_decision';
  timestamp: string;
  session_id: string;
  project_id?: string;
  attributes: Record<string, string | number | boolean>;
}

/**
 * Claude Code data (metrics or events)
 */
export type ClaudeCodeData = ClaudeCodeMetric | ClaudeCodeEvent;

/**
 * Google Analytics event format
 */
export interface GoogleAnalyticsEvent {
  name: string;
  params?: Record<string, string | number | boolean>;
}

/**
 * Google Analytics data format (GA4 Measurement Protocol)
 */
export interface GoogleAnalyticsData {
  client_id: string;
  user_id?: string;
  project_id?: string;
  timestamp_micros?: string;
  user_properties?: Record<string, { value: string | number | boolean }>;
  events: GoogleAnalyticsEvent[];
}

/**
 * Endpoint configuration
 */
export interface EndpointConfig {
  path: string;
  dataset: keyof Env;
  methods: ('GET' | 'POST')[];
}

/**
 * API error response
 */
export interface ErrorResponse {
  error: string;
  message: string;
  status: number;
}

/**
 * API success response
 */
export interface SuccessResponse {
  success: boolean;
  message: string;
}

/**
 * Health check response
 */
export interface PingResponse {
  status: 'ok';
  timestamp: string;
}

/**
 * Project entity
 */
export interface Project {
  id: string;
  description: string;
  created_at: number;
  last_used: number | null;
}

/**
 * Project creation request
 */
export interface ProjectCreateRequest {
  id?: string;
  description: string;
}

/**
 * Project creation response
 */
export interface ProjectCreateResponse {
  success: boolean;
  project: Project;
}

/**
 * Project list response
 */
export interface ProjectListResponse {
  success: boolean;
  projects: Project[];
  total: number;
}
