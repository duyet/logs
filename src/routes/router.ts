import { Hono } from 'hono';
import type { Context, Next } from 'hono';
import { serveStatic } from 'hono/cloudflare-pages';
import type { Env, PingResponse } from '../types/index.js';
import { ClaudeCodeAdapter } from '../adapters/claude-code.js';
import { GoogleAnalyticsAdapter } from '../adapters/google-analytics.js';
import { LogtailAdapter } from '../adapters/logtail.js';
import { SentryAdapter } from '../adapters/sentry.js';
import { AnalyticsEngineService } from '../services/analytics-engine.js';
import { logger } from '../middleware/logger.js';
import { projectIdMiddleware } from '../middleware/project-id.js';
import { createAnalyticsHandler } from '../utils/route-handler.js';
import { handleError } from '../utils/error-handler.js';
import { createProjectsRouter } from './projects.js';
import { createAnalyticsRouter } from './analytics.js';
import { realtimeRouter } from './realtime.js';

/**
 * Create and configure Hono app with all routes
 */
export function createRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  const analyticsService = new AnalyticsEngineService();
  const claudeCodeAdapter = new ClaudeCodeAdapter();
  const googleAnalyticsAdapter = new GoogleAnalyticsAdapter();
  const logtailAdapter = new LogtailAdapter();
  const sentryAdapter = new SentryAdapter();

  // Create route handlers
  const claudeCodeHandler = createAnalyticsHandler(
    'CLAUDE_CODE_ANALYTICS', // Legacy + auto-detect format
    claudeCodeAdapter,
    analyticsService
  );
  const claudeCodeLogsHandler = createAnalyticsHandler(
    'CLAUDE_CODE_LOGS', // OTLP Logs only
    claudeCodeAdapter,
    analyticsService
  );
  const claudeCodeMetricsHandler = createAnalyticsHandler(
    'CLAUDE_CODE_METRICS', // OTLP Metrics only
    claudeCodeAdapter,
    analyticsService
  );
  const googleAnalyticsHandler = createAnalyticsHandler(
    'GA_ANALYTICS',
    googleAnalyticsAdapter,
    analyticsService
  );
  const logtailHandler = createAnalyticsHandler(
    'LOGTAIL_ANALYTICS',
    logtailAdapter,
    analyticsService
  );
  const sentryHandler = createAnalyticsHandler(
    'SENTRY_ANALYTICS',
    sentryAdapter,
    analyticsService
  );

  // Error handler using onError
  app.onError(handleError);

  // Global middleware
  app.use('*', logger);

  // Root endpoint - App version and info
  app.get('/', (c) => {
    return c.json({
      name: 'duyet-logs',
      version: '1.0.0',
      description: 'Analytics data router for Cloudflare Pages with Hono',
      status: 'ok',
      timestamp: new Date().toISOString(),
      endpoints: {
        ping: '/ping',
        ui: {
          'new project': '/ui/project',
        },
        analytics: {
          'claude-code': ['/cc', '/cc/:project_id'],
          'google-analytics': ['/ga', '/ga/:project_id'],
          logtail: ['/logtail', '/logtail/:project_id'],
          sentry: ['/sentry', '/sentry/:project_id'],
        },
        api: {
          projects: '/api/project',
          analytics: '/api/analytics/insights',
        },
      },
    });
  });

  // Health check endpoint
  app.get('/ping', (c) => {
    const response: PingResponse = {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
    return c.json(response);
  });

  // Middleware to set default project_id when not provided
  const defaultProjectMiddleware = async (
    c: Context<{ Bindings: Env }>,
    next: Next
  ): Promise<void> => {
    // If no project_id is in the path, set it to "default"
    if (!c.req.param('project_id')) {
      c.set('project_id', 'default');
    }
    await next();
  };

  // Apply project-id middleware to analytics endpoints
  app.use('/cc', projectIdMiddleware);
  app.use('/cc/:project_id', projectIdMiddleware);
  app.use('/ga', projectIdMiddleware);
  app.use('/ga/:project_id', projectIdMiddleware);
  app.use('/logtail', projectIdMiddleware);
  app.use('/logtail/:project_id', projectIdMiddleware);
  app.use('/sentry', projectIdMiddleware);
  app.use('/sentry/:project_id', projectIdMiddleware);

  // OTLP standard endpoints WITHOUT project_id (use "default" project)
  app.use('/cc/v1/logs', defaultProjectMiddleware, projectIdMiddleware);
  app.post('/cc/v1/logs', claudeCodeLogsHandler.handlePost);
  app.use('/cc/v1/metrics', defaultProjectMiddleware, projectIdMiddleware);
  app.post('/cc/v1/metrics', claudeCodeMetricsHandler.handlePost);

  // OTLP standard endpoints WITH project_id (MUST be after default routes)
  app.use('/cc/:project_id/v1/logs', projectIdMiddleware);
  app.post('/cc/:project_id/v1/logs', claudeCodeLogsHandler.handlePost);
  app.use('/cc/:project_id/v1/metrics', projectIdMiddleware);
  app.post('/cc/:project_id/v1/metrics', claudeCodeMetricsHandler.handlePost);

  // Claude Code analytics endpoints (generic routes AFTER specific routes)
  app.get('/cc', claudeCodeHandler.handleGet);
  app.post('/cc', claudeCodeHandler.handlePost);
  app.get('/cc/:project_id', claudeCodeHandler.handleGet);
  app.post('/cc/:project_id', claudeCodeHandler.handlePost);

  // Google Analytics endpoints
  app.get('/ga', googleAnalyticsHandler.handleGet);
  app.post('/ga', googleAnalyticsHandler.handlePost);
  app.get('/ga/:project_id', googleAnalyticsHandler.handleGet);
  app.post('/ga/:project_id', googleAnalyticsHandler.handlePost);

  // Logtail / Better Stack endpoints
  app.get('/logtail', logtailHandler.handleGet);
  app.post('/logtail', logtailHandler.handlePost);
  app.get('/logtail/:project_id', logtailHandler.handleGet);
  app.post('/logtail/:project_id', logtailHandler.handlePost);

  // Sentry error tracking endpoints
  app.get('/sentry', sentryHandler.handleGet);
  app.post('/sentry', sentryHandler.handlePost);
  app.get('/sentry/:project_id', sentryHandler.handleGet);
  app.post('/sentry/:project_id', sentryHandler.handlePost);

  // Projects API routes
  app.route('/api/project', createProjectsRouter());

  // Analytics API routes
  app.route('/api/analytics', createAnalyticsRouter());

  // Real-time analytics routes
  app.use('/realtime', projectIdMiddleware);
  app.use('/realtime/:project_id', projectIdMiddleware);
  app.route('/realtime', realtimeRouter);
  app.route('/realtime/:project_id', realtimeRouter);

  // Create project UI
  app.get('/ui/project', async (c) => {
    if (c.env.ASSETS) {
      // Fetch create.html from ASSETS
      const response = await c.env.ASSETS.fetch(
        new Request(new URL('/create.html', c.req.url))
      );
      return response;
    }
    return c.text('Static assets not available', 503);
  });

  // Serve other static files from public directory
  app.get('*', async (c, next) => {
    // Try to serve static files if ASSETS is available (production)
    if (c.env.ASSETS) {
      return serveStatic()(c, next);
    }
    // In development/testing, return 404 for unknown routes
    await next();
  });

  // Final 404 handler for routes not matched above
  app.notFound((c) => {
    return c.json({ error: 'Not Found', message: 'Endpoint not found' }, 404);
  });

  return app;
}
