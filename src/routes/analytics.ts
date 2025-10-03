import { Hono } from 'hono';
import type { Env } from '../types/index.js';
import {
  AnalyticsQueryService,
  type AnalyticsQueryParams,
} from '../services/analytics-query.js';

/**
 * Create analytics insights router
 */
export function createAnalyticsRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  const queryService = new AnalyticsQueryService();

  /**
   * GET /api/analytics/insights
   *
   * Query analytics data and generate insights
   *
   * Query Parameters:
   * - dataset: CLAUDE_CODE_ANALYTICS | CLAUDE_CODE_LOGS | CLAUDE_CODE_METRICS | GA_ANALYTICS (required)
   * - project_id: Filter by project ID (optional)
   * - start: Start time in ISO 8601 format (optional, default: 24h ago)
   * - end: End time in ISO 8601 format (optional, default: now)
   * - limit: Max number of results (optional, default: 10000)
   */
  app.get('/insights', async (c) => {
    const dataset = c.req.query('dataset');
    const projectId = c.req.query('project_id');
    const start = c.req.query('start');
    const end = c.req.query('end');
    const limit = c.req.query('limit');

    // Validate dataset parameter
    const validDatasets = [
      'CLAUDE_CODE_ANALYTICS',
      'CLAUDE_CODE_LOGS',
      'CLAUDE_CODE_METRICS',
      'GA_ANALYTICS',
    ];

    if (!dataset) {
      return c.json(
        {
          error: 'Bad Request',
          message: 'Missing required parameter: dataset',
          validValues: validDatasets,
        },
        400
      );
    }

    if (!validDatasets.includes(dataset)) {
      return c.json(
        {
          error: 'Bad Request',
          message: `Invalid dataset: ${dataset}`,
          validValues: validDatasets,
        },
        400
      );
    }

    // Build query parameters
    const params: AnalyticsQueryParams = {
      dataset: dataset as AnalyticsQueryParams['dataset'],
      projectId,
      limit: limit ? parseInt(limit, 10) : undefined,
    };

    // Add time range if provided
    if (start && end) {
      // Validate ISO 8601 format
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
        return c.json(
          {
            error: 'Bad Request',
            message:
              'Invalid time format. Use ISO 8601 format (e.g., 2024-01-01T00:00:00Z)',
          },
          400
        );
      }

      params.timeRange = {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
      };
    }

    try {
      // Query analytics and generate insights
      const insights = await queryService.getInsights(c.env, params);

      return c.json(insights);
    } catch (error) {
      console.error('[Analytics API] Failed to get insights:', error);

      // Check error type
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to query analytics';
      const isCredentialsError = errorMessage.includes(
        'credentials not configured'
      );
      const isNotImplemented = errorMessage.includes('not yet implemented');

      return c.json(
        {
          error: isCredentialsError
            ? 'Service Unavailable'
            : isNotImplemented
              ? 'Not Implemented'
              : 'Internal Server Error',
          message: errorMessage,
        },
        isCredentialsError ? 503 : isNotImplemented ? 501 : 500
      );
    }
  });

  /**
   * GET /api/analytics/datasets
   *
   * List available datasets
   */
  app.get('/datasets', (c) => {
    return c.json({
      datasets: [
        {
          name: 'CLAUDE_CODE_ANALYTICS',
          description:
            'Claude Code analytics data (legacy + auto-detect format)',
        },
        {
          name: 'CLAUDE_CODE_LOGS',
          description: 'Claude Code OTLP logs',
        },
        {
          name: 'CLAUDE_CODE_METRICS',
          description: 'Claude Code OTLP metrics',
        },
        {
          name: 'GA_ANALYTICS',
          description: 'Google Analytics GA4 data',
        },
      ],
    });
  });

  return app;
}
