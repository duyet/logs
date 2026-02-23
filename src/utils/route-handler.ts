import type { Context } from 'hono';
import type { Env, SuccessResponse, DataAdapter } from '../types/index.js';
import { AnalyticsEngineService } from '../services/analytics-engine.js';

/**
 * Generic route handler factory for analytics endpoints
 * Eliminates duplication across GET/POST handlers
 */
export function createAnalyticsHandler<T>(
  dataset: keyof Env,
  adapter: DataAdapter<T>,
  analyticsService: AnalyticsEngineService
): {
  handleGet: (c: Context<{ Bindings: Env }>) => Promise<Response>;
  handlePost: (c: Context<{ Bindings: Env }>) => Promise<Response>;
} {
  return {
    /**
     * Handle GET requests with query parameters
     */
    handleGet: async (c: Context<{ Bindings: Env }>): Promise<Response> => {
      const rawData = c.req.query() as Record<string, string | string[]>;
      const projectId = c.get('project_id');

      // Set project ID on adapter for OTLP format
      if (
        'setProjectId' in adapter &&
        typeof adapter.setProjectId === 'function'
      ) {
        (adapter.setProjectId as (id?: string) => void)(projectId);
      }

      const dataWithProject = projectId
        ? { ...rawData, project_id: projectId }
        : rawData;
      const result = await analyticsService.writeDataPoint(
        c.env,
        dataset,
        adapter,
        dataWithProject
      );

      if (!result.success) {
        // Determine error type and status code
        const isValidationError = result.error === 'Invalid data format';
        const isConfigError = result.error?.includes(
          'Dataset binding not found'
        );

        let statusCode: 400 | 500 = 500;
        let errorType = 'Internal Server Error';

        if (isValidationError) {
          statusCode = 400;
          errorType = 'Bad Request';
        } else if (isConfigError) {
          statusCode = 500;
          errorType = 'Configuration Error';
        }

        return c.json(
          {
            error: errorType,
            message: result.error || 'Failed to write data',
            status: statusCode,
          },
          statusCode
        );
      }

      const response: SuccessResponse = {
        success: true,
        message: 'Data recorded successfully',
      };
      return c.json(response);
    },

    /**
     * Handle POST requests with JSON body
     */
    handlePost: async (c: Context<{ Bindings: Env }>): Promise<Response> => {
      const rawData = await c.req.json<Record<string, unknown>>();
      const projectId = c.get('project_id');

      // Set project ID on adapter for OTLP format
      if (
        'setProjectId' in adapter &&
        typeof adapter.setProjectId === 'function'
      ) {
        (adapter.setProjectId as (id?: string) => void)(projectId);
      }

      // Don't add project_id to the data for arrays - adapter handles it via setProjectId
      const dataWithProject =
        projectId && !Array.isArray(rawData)
          ? { ...rawData, project_id: projectId }
          : rawData;
      const result = await analyticsService.writeDataPoint(
        c.env,
        dataset,
        adapter,
        dataWithProject
      );

      if (!result.success) {
        // Determine error type and status code
        const isValidationError = result.error === 'Invalid data format';
        const isConfigError = result.error?.includes(
          'Dataset binding not found'
        );

        let statusCode: 400 | 500 = 500;
        let errorType = 'Internal Server Error';

        if (isValidationError) {
          statusCode = 400;
          errorType = 'Bad Request';
        } else if (isConfigError) {
          statusCode = 500;
          errorType = 'Configuration Error';
        }

        return c.json(
          {
            error: errorType,
            message: result.error || 'Failed to write data',
            status: statusCode,
          },
          statusCode
        );
      }

      const response: SuccessResponse = {
        success: true,
        message: 'Data processed',
      };
      return c.json(response);
    },
  };
}
