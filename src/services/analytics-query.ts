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
 * GraphQL query result for Analytics Engine
 */
interface GraphQLAnalyticsResult {
  data?: {
    viewer?: {
      accounts?: Array<{
        analyticsEngineDatasets?: Array<{
          nodes?: Array<{
            dimensions?: Record<string, string>;
            count?: number;
            timestamp?: string;
          }>;
        }>;
      }>;
    };
  };
  errors?: Array<{ message: string }>;
}

/**
 * Service for querying Analytics Engine data via GraphQL API
 */
export class AnalyticsQueryService {
  private readonly GRAPHQL_ENDPOINT =
    'https://api.cloudflare.com/client/v4/graphql';

  /**
   * Query Analytics Engine via GraphQL API
   */
  private async queryGraphQL(
    accountId: string,
    apiToken: string,
    query: string,
    variables: Record<string, unknown>
  ): Promise<GraphQLAnalyticsResult> {
    const response = await fetch(this.GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });

    if (!response.ok) {
      throw new Error(`GraphQL query failed: ${response.statusText}`);
    }

    return (await response.json()) as GraphQLAnalyticsResult;
  }

  /**
   * Get dataset name for GraphQL query
   */
  private getDatasetName(binding: string): string {
    const mapping: Record<string, string> = {
      CLAUDE_CODE_ANALYTICS: 'duyet_logs_claude_code_analytics',
      CLAUDE_CODE_LOGS: 'duyet_logs_claude_code_logs',
      CLAUDE_CODE_METRICS: 'duyet_logs_claude_code_metrics',
      GA_ANALYTICS: 'duyet_logs_ga_analytics',
    };
    return mapping[binding] || binding;
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
   * Query analytics data with insights
   */
  async getInsights(
    env: Env,
    params: AnalyticsQueryParams
  ): Promise<AnalyticsInsightsResponse> {
    // Get credentials from environment
    const accountId = env.CLOUDFLARE_ACCOUNT_ID as string | undefined;
    const apiToken = env.CLOUDFLARE_API_TOKEN as string | undefined;

    if (!accountId || !apiToken) {
      // Return mock data for development/testing
      return this.getMockInsights(params);
    }

    const timeRange = params.timeRange || this.getDefaultTimeRange();
    const datasetName = this.getDatasetName(params.dataset);

    // GraphQL query for Analytics Engine
    const query = `
      query GetAnalytics($accountId: String!, $dataset: String!, $start: Time!, $end: Time!) {
        viewer {
          accounts(filter: { accountTag: $accountId }) {
            analyticsEngineDatasets(filter: { dataset: $dataset }) {
              nodes(
                filter: { timestamp_geq: $start, timestamp_lt: $end }
                limit: 10000
                orderBy: [timestamp_ASC]
              ) {
                dimensions
                count
                timestamp
              }
            }
          }
        }
      }
    `;

    try {
      const result = await this.queryGraphQL(accountId, apiToken, query, {
        accountId,
        dataset: datasetName,
        start: timeRange.start,
        end: timeRange.end,
      });

      if (result.errors) {
        throw new Error(
          `GraphQL errors: ${result.errors.map((e) => e.message).join(', ')}`
        );
      }

      // Process results
      return this.processQueryResults(result, params, timeRange);
    } catch (error) {
      console.error('[Analytics Query] Failed to query GraphQL API:', error);
      // Fallback to mock data
      return this.getMockInsights(params);
    }
  }

  /**
   * Process GraphQL query results into insights
   */
  private processQueryResults(
    result: GraphQLAnalyticsResult,
    params: AnalyticsQueryParams,
    timeRange: TimeRange
  ): AnalyticsInsightsResponse {
    const nodes =
      result.data?.viewer?.accounts?.[0]?.analyticsEngineDatasets?.[0]?.nodes ||
      [];

    // Build time series
    const timeseries: TimeSeriesPoint[] = nodes.map((node) => ({
      timestamp: node.timestamp || new Date().toISOString(),
      value: node.count || 0,
      metadata: node.dimensions,
    }));

    // Count by project
    const projectCounts: Record<string, number> = {};
    nodes.forEach((node) => {
      const projectId = node.dimensions?.project_id || 'unknown';
      projectCounts[projectId] =
        (projectCounts[projectId] || 0) + (node.count || 0);
    });

    // Top projects
    const topProjects = Object.entries(projectCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([id, count]) => ({ id, count }));

    // Calculate total events
    const totalEvents = nodes.reduce((sum, node) => sum + (node.count || 0), 0);

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
          description: `Unusual activity detected: ${point.value} events`,
          severity: zScore > 3 ? 'high' : 'medium',
          value: point.value,
        });
      }
    });

    // Generate recommendations
    if (trends.length > 0 && trends[0].direction === 'up') {
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

  /**
   * Get mock insights for development/testing
   */
  private getMockInsights(
    params: AnalyticsQueryParams
  ): AnalyticsInsightsResponse {
    const timeRange = params.timeRange || this.getDefaultTimeRange();

    // Generate mock time series (hourly data for last 24h)
    const timeseries: TimeSeriesPoint[] = [];
    const start = new Date(timeRange.start);
    const end = new Date(timeRange.end);
    const hoursDiff = Math.floor(
      (end.getTime() - start.getTime()) / (60 * 60 * 1000)
    );

    for (let i = 0; i <= hoursDiff; i++) {
      const timestamp = new Date(start.getTime() + i * 60 * 60 * 1000);
      const baseValue = 50 + Math.sin(i / 6) * 20; // Sinusoidal pattern
      const noise = Math.random() * 10;
      timeseries.push({
        timestamp: timestamp.toISOString(),
        value: Math.round(baseValue + noise),
      });
    }

    const breakdown = {
      default: 450,
      duyet: 320,
      blog: 180,
      prod: 150,
      test: 50,
    };

    const totalEvents = Object.values(breakdown).reduce((a, b) => a + b, 0);

    return {
      summary: {
        totalEvents,
        timeRange,
        topProjects: Object.entries(breakdown)
          .map(([id, count]) => ({ id, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 5),
        dataset: params.dataset,
      },
      insights: {
        trends: [
          {
            metric: 'event_volume',
            change: 15.3,
            direction: 'up',
            description: 'Event volume is up by 15%',
          },
        ],
        anomalies: [
          {
            timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
            description: 'Unusual spike detected: 120 events',
            severity: 'medium',
            value: 120,
          },
        ],
        recommendations: [
          'Consider adding more projects to organize analytics data',
          'Review high-volume projects for optimization opportunities',
          'Set up alerts for anomaly detection',
        ],
      },
      data: {
        timeseries,
        breakdown,
      },
    };
  }
}
