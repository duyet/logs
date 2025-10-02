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
 * SQL API result row from Analytics Engine
 */
interface SQLResultRow {
  dataset?: string;
  timestamp?: string;
  _sample_interval?: number;
  index1?: string;
  blob1?: string;
  blob2?: string;
  double1?: number;
  double2?: number;
}

/**
 * SQL API response from Analytics Engine
 */
interface SQLAPIResponse {
  data?: SQLResultRow[];
  rows?: number;
  meta?: Array<{ name: string; type: string }>;
}

/**
 * Service for querying Analytics Engine data via SQL API
 */
export class AnalyticsQueryService {
  private readonly SQL_API_BASE =
    'https://api.cloudflare.com/client/v4/accounts';

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
   * Execute SQL query against Analytics Engine
   */
  private async executeSQL(
    accountId: string,
    apiToken: string,
    query: string
  ): Promise<SQLAPIResponse> {
    const url = `${this.SQL_API_BASE}/${accountId}/analytics_engine/sql`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiToken}`,
        'Content-Type': 'application/json',
      },
      body: query,
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`SQL API query failed: ${response.status} ${errorText}`);
    }

    // JSONEachRow format returns newline-delimited JSON (one JSON object per line)
    const text = await response.text();
    const lines = text
      .trim()
      .split('\n')
      .filter((line) => line.trim());
    const data: SQLResultRow[] = lines.map((line) => JSON.parse(line));

    return {
      data,
      rows: data.length,
    };
  }

  /**
   * Get dataset name from environment variables
   */
  private getDatasetName(env: Env, binding: string): string {
    const envKey = `DATASET_${binding}` as keyof Env;
    const datasetName = env[envKey] as string | undefined;

    if (!datasetName) {
      const defaultMapping: Record<string, string> = {
        CLAUDE_CODE_ANALYTICS: 'duyet_logs_claude_code_analytics',
        CLAUDE_CODE_LOGS: 'duyet_logs_claude_code_logs',
        CLAUDE_CODE_METRICS: 'duyet_logs_claude_code_metrics',
        GA_ANALYTICS: 'duyet_logs_ga_analytics',
      };
      return defaultMapping[binding] || binding.toLowerCase();
    }

    return datasetName;
  }

  /**
   * Query analytics data with insights
   */
  async getInsights(
    env: Env,
    params: AnalyticsQueryParams
  ): Promise<AnalyticsInsightsResponse> {
    // Get credentials from Secrets Store or environment variables
    const accountId = await this.getSecretValue(env.CLOUDFLARE_ACCOUNT_ID);
    const apiToken = await this.getSecretValue(env.CLOUDFLARE_API_TOKEN);

    if (!accountId || !apiToken) {
      throw new Error(
        'Analytics Engine credentials not configured. Set CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN in Cloudflare Pages dashboard.'
      );
    }

    const timeRange = params.timeRange || this.getDefaultTimeRange();
    const datasetName = this.getDatasetName(env, params.dataset);

    // Build SQL query
    const projectFilter = params.projectId
      ? `AND index1 = '${params.projectId}'`
      : '';
    const limit = params.limit || 10000;

    // Calculate time range in hours for INTERVAL
    const startTime = new Date(timeRange.start);
    const endTime = new Date(timeRange.end);
    const hoursDiff = Math.ceil(
      (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60)
    );

    const query = `
      SELECT
        timestamp,
        index1 AS project_id,
        blob1,
        double1,
        _sample_interval
      FROM ${datasetName}
      WHERE timestamp > NOW() - INTERVAL '${hoursDiff}' HOUR
        ${projectFilter}
      ORDER BY timestamp ASC
      LIMIT ${limit}
      FORMAT JSONEachRow
    `;

    const result = await this.executeSQL(accountId, apiToken, query);

    return this.processResults(result, params, timeRange);
  }

  /**
   * Get default time range (last 24 hours)
   */
  private getDefaultTimeRange(): TimeRange {
    const end = new Date();
    const start = new Date(end.getTime() - 24 * 60 * 60 * 1000);
    return {
      start: start.toISOString(),
      end: end.toISOString(),
    };
  }

  /**
   * Process SQL results into insights
   */
  private processResults(
    result: SQLAPIResponse,
    params: AnalyticsQueryParams,
    timeRange: TimeRange
  ): AnalyticsInsightsResponse {
    const rows = result.data || [];

    // Build time series (accounting for sampling)
    const timeseries: TimeSeriesPoint[] = rows.map((row) => ({
      timestamp: row.timestamp || new Date().toISOString(),
      value: (row.double1 || 0) * (row._sample_interval || 1),
      metadata: { project_id: row.index1 },
    }));

    // Count by project (accounting for sampling)
    const projectCounts: Record<string, number> = {};
    rows.forEach((row) => {
      const projectId = row.index1 || 'unknown';
      const count = (row.double1 || 1) * (row._sample_interval || 1);
      projectCounts[projectId] = (projectCounts[projectId] || 0) + count;
    });

    // Top projects
    const topProjects = Object.entries(projectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({ id, count: Math.round(count) }));

    // Calculate total events (sum of all sample intervals)
    const totalEvents = rows.reduce(
      (sum, row) => sum + (row._sample_interval || 1),
      0
    );

    // Generate insights
    const insights = this.generateInsights(timeseries, params.dataset);

    return {
      summary: {
        totalEvents,
        timeRange,
        topProjects,
        dataset: params.dataset,
      },
      insights,
      data: {
        timeseries,
        breakdown: projectCounts,
      },
    };
  }

  /**
   * Generate insights from time series data
   */
  private generateInsights(
    timeseries: TimeSeriesPoint[],
    dataset: string
  ): AnalyticsInsights {
    const trends: Trend[] = [];
    const anomalies: Anomaly[] = [];
    const recommendations: string[] = [];

    if (timeseries.length < 2) {
      return { trends, anomalies, recommendations };
    }

    // Calculate trend
    const recentValues = timeseries.slice(-10).map((p) => p.value);
    const olderValues = timeseries.slice(0, 10).map((p) => p.value);

    if (recentValues.length > 0 && olderValues.length > 0) {
      const recentAvg =
        recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
      const olderAvg =
        olderValues.reduce((a, b) => a + b, 0) / olderValues.length;

      if (olderAvg > 0) {
        const change = ((recentAvg - olderAvg) / olderAvg) * 100;
        const direction = change > 5 ? 'up' : change < -5 ? 'down' : 'stable';

        trends.push({
          metric: 'event_volume',
          change: Math.round(change * 10) / 10,
          direction,
          description: `Event volume is ${direction} by ${Math.abs(Math.round(change))}%`,
        });
      }
    }

    // Detect anomalies (simple threshold-based)
    const allValues = timeseries.map((p) => p.value);
    const mean = allValues.reduce((a, b) => a + b, 0) / allValues.length;
    const stdDev = Math.sqrt(
      allValues.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) /
        allValues.length
    );

    timeseries.forEach((point) => {
      const zScore = Math.abs((point.value - mean) / stdDev);
      if (zScore > 2.5 && allValues.length > 10) {
        anomalies.push({
          timestamp: point.timestamp,
          description: `Unusual activity detected: ${Math.round(point.value)} events`,
          severity: zScore > 3 ? 'high' : 'medium',
          value: point.value,
        });
      }
    });

    // Generate recommendations
    if (trends.length > 0 && trends[0]?.direction === 'up') {
      recommendations.push(
        'Consider increasing rate limits or capacity planning'
      );
    }

    if (anomalies.length > 0) {
      recommendations.push(
        `Investigate ${anomalies.length} anomalies detected in time range`
      );
    }

    if (dataset === 'CLAUDE_CODE_METRICS') {
      recommendations.push('Monitor token usage trends to optimize costs');
    }

    return { trends, anomalies, recommendations };
  }
}
