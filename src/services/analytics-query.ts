import type { Env } from '../types/index.js';

/**
 * Time range for analytics queries
 */
export interface TimeRange {
  start: string; // ISO 8601
  end: string; // ISO 8601
}

/**
 * Analytics query parameters
 */
export interface AnalyticsQueryParams {
  dataset:
    | 'CLAUDE_CODE_ANALYTICS'
    | 'CLAUDE_CODE_LOGS'
    | 'CLAUDE_CODE_METRICS'
    | 'GA_ANALYTICS';
  projectId?: string;
  timeRange?: TimeRange;
  limit?: number;
}

/**
 * Time series data point
 */
export interface TimeSeriesPoint {
  timestamp: string;
  value: number;
  metadata?: Record<string, unknown>;
}

/**
 * Analytics summary
 */
export interface AnalyticsSummary {
  totalEvents: number;
  timeRange: TimeRange;
  topProjects: Array<{ id: string; count: number }>;
  dataset: string;
}

/**
 * Trend analysis
 */
export interface Trend {
  metric: string;
  change: number; // percentage
  direction: 'up' | 'down' | 'stable';
  description: string;
}

/**
 * Anomaly detection
 */
export interface Anomaly {
  timestamp: string;
  description: string;
  severity: 'low' | 'medium' | 'high';
  value: number;
}

/**
 * Analytics insights
 */
export interface AnalyticsInsights {
  trends: Trend[];
  anomalies: Anomaly[];
  recommendations: string[];
}

/**
 * Analytics insights response
 */
export interface AnalyticsInsightsResponse {
  summary: AnalyticsSummary;
  insights: AnalyticsInsights;
  data: {
    timeseries: TimeSeriesPoint[];
    breakdown: Record<string, number>;
  };
}

/**
 * Service for querying Analytics Engine data
 * Note: Currently only validates credentials. Query functionality requires SQL API integration.
 */
export class AnalyticsQueryService {
  /**
   * Get secret value (supports both Secrets Store bindings and env vars)
   */
  private async getSecretValue(
    secret: { get(): Promise<string> } | string | undefined
  ): Promise<string | undefined> {
    if (!secret) {
      return undefined;
    }

    // Check if it's a Secrets Store binding (has a get method)
    if (
      typeof secret === 'object' &&
      'get' in secret &&
      typeof secret.get === 'function'
    ) {
      return await secret.get();
    }

    // Otherwise it's a plain string (env var)
    return secret as string;
  }

  /**
   * Query analytics data with insights
   */
  async getInsights(
    env: Env,
    _params: AnalyticsQueryParams
  ): Promise<AnalyticsInsightsResponse> {
    // Get credentials from Secrets Store or environment variables
    const accountId = await this.getSecretValue(env.CLOUDFLARE_ACCOUNT_ID);
    const apiToken = await this.getSecretValue(env.CLOUDFLARE_API_TOKEN);

    if (!accountId || !apiToken) {
      throw new Error(
        'Analytics Engine credentials not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Cloudflare Pages dashboard.'
      );
    }

    // Note: Analytics Engine currently doesn't support GraphQL queries via the public API
    // Analytics Engine data can only be queried using:
    // 1. Workers Analytics Engine binding (writeDataPoint) - for writing only
    // 2. SQL API - for querying (requires different implementation)
    // 3. Direct dataset access via Cloudflare dashboard
    //
    // This endpoint is designed for writing analytics data, not querying it.
    // Query functionality will be implemented using the SQL API in a future update.
    throw new Error(
      'Analytics Insights API not yet implemented. Analytics Engine supports writing data via this API, ' +
        'but querying requires the SQL API which is not yet integrated. ' +
        'Please use the Cloudflare dashboard to view analytics data, or wait for SQL API integration.'
    );
  }
}
