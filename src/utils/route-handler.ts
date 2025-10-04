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
  handleGet: (c: Context<{ Bindings: Env }>) => Response;
  handlePost: (c: Context<{ Bindings: Env }>) => Promise<Response>;
} {
  return {
    /**
     * Handle GET requests with query parameters
     */
    handleGet: (c: Context<{ Bindings: Env }>): Response => {
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
      analyticsService.writeDataPoint(c.env, dataset, adapter, dataWithProject);

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

      // Debug logging to see what OTLP sends
      console.log('[DEBUG OTLP] Route:', c.req.method, c.req.path);
      console.log('[DEBUG OTLP] Project ID:', projectId);
      console.log('[DEBUG OTLP] Data keys:', Object.keys(rawData));
      console.log(
        '[DEBUG OTLP] Full data (first 1000 chars):',
        JSON.stringify(rawData).substring(0, 1000)
      );

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
      analyticsService.writeDataPoint(c.env, dataset, adapter, dataWithProject);

      const response: SuccessResponse = {
        success: true,
        message: 'Data processed',
      };
      return c.json(response);
    },
  };
}
