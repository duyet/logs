import { Hono } from 'hono';
import type { Env, PingResponse, SuccessResponse } from '../types/index.js';
import { ClaudeCodeAdapter } from '../adapters/claude-code.js';
import { GoogleAnalyticsAdapter } from '../adapters/google-analytics.js';
import { AnalyticsEngineService } from '../services/analytics-engine.js';
import { logger } from '../middleware/logger.js';

/**
 * Create and configure Hono app with all routes
 */
export function createRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  const analyticsService = new AnalyticsEngineService();
  const claudeCodeAdapter = new ClaudeCodeAdapter();
  const googleAnalyticsAdapter = new GoogleAnalyticsAdapter();

  // Error handler using onError
  app.onError((err, c) => {
    console.error(err);

    const errorResponse: import('../types/index.js').ErrorResponse = {
      error: 'Internal Server Error',
      message: err.message || 'Unknown error',
      status: 500,
    };

    // Handle specific error types
    if (err.message.includes('Invalid data format')) {
      errorResponse.status = 400;
      errorResponse.error = 'Bad Request';
    } else if (err.message.includes('Dataset binding not found')) {
      errorResponse.status = 500;
      errorResponse.error = 'Configuration Error';
    }

    return c.json(errorResponse, errorResponse.status as 400 | 500);
  });

  // Middleware
  app.use('*', logger);

  // Health check endpoint
  app.get('/ping', (c) => {
    const response: PingResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  });

  // Claude Code analytics endpoint - GET
  app.get('/cc', async (c) => {
    const rawData = c.req.query();
    await analyticsService.writeDataPoint(
      c.env,
      'CLAUDE_CODE_ANALYTICS',
      claudeCodeAdapter,
      rawData
    );

    const response: SuccessResponse = {
      success: true,
      message: 'Data recorded successfully',
    };
    return c.json(response);
  });

  // Claude Code analytics endpoint - POST
  app.post('/cc', async (c) => {
    const rawData = await c.req.json();
    await analyticsService.writeDataPoint(
      c.env,
      'CLAUDE_CODE_ANALYTICS',
      claudeCodeAdapter,
      rawData
    );

    const response: SuccessResponse = {
      success: true,
      message: 'Data recorded successfully',
    };
    return c.json(response);
  });

  // Google Analytics endpoint - GET
  app.get('/ga', async (c) => {
    const rawData = c.req.query();
    await analyticsService.writeDataPoint(
      c.env,
      'GA_ANALYTICS',
      googleAnalyticsAdapter,
      rawData
    );

    const response: SuccessResponse = {
      success: true,
      message: 'Data recorded successfully',
    };
    return c.json(response);
  });

  // Google Analytics endpoint - POST
  app.post('/ga', async (c) => {
    const rawData = await c.req.json();
    await analyticsService.writeDataPoint(
      c.env,
      'GA_ANALYTICS',
      googleAnalyticsAdapter,
      rawData
    );

    const response: SuccessResponse = {
      success: true,
      message: 'Data recorded successfully',
    };
    return c.json(response);
  });

  return app;
}
