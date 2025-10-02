import { Hono } from 'hono';
import { serveStatic } from 'hono/cloudflare-pages';
import type { Env, PingResponse } from '../types/index.js';
import { ClaudeCodeAdapter } from '../adapters/claude-code.js';
import { GoogleAnalyticsAdapter } from '../adapters/google-analytics.js';
import { AnalyticsEngineService } from '../services/analytics-engine.js';
import { logger } from '../middleware/logger.js';
import { projectIdMiddleware } from '../middleware/project-id.js';
import { createAnalyticsHandler } from '../utils/route-handler.js';
import { handleError } from '../utils/error-handler.js';
import { createProjectsRouter } from './projects.js';

/**
 * Create and configure Hono app with all routes
 */
export function createRouter(): Hono<{ Bindings: Env }> {
  const app = new Hono<{ Bindings: Env }>();
  const analyticsService = new AnalyticsEngineService();
  const claudeCodeAdapter = new ClaudeCodeAdapter();
  const googleAnalyticsAdapter = new GoogleAnalyticsAdapter();

  // Create route handlers
  const claudeCodeHandler = createAnalyticsHandler(
    'CLAUDE_CODE_ANALYTICS',
    claudeCodeAdapter,
    analyticsService
  );
  const googleAnalyticsHandler = createAnalyticsHandler(
    'GA_ANALYTICS',
    googleAnalyticsAdapter,
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
        projects: '/projects',
        'create-project': '/create',
        analytics: {
          'claude-code': '/cc',
          'google-analytics': '/ga',
        },
        api: {
          projects: '/api/projects',
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

  // Apply project-id middleware to analytics endpoints
  app.use('/cc', projectIdMiddleware);
  app.use('/ga', projectIdMiddleware);

  // Claude Code analytics endpoints
  app.get('/cc', claudeCodeHandler.handleGet);
  app.post('/cc', claudeCodeHandler.handlePost);

  // Google Analytics endpoints
  app.get('/ga', googleAnalyticsHandler.handleGet);
  app.post('/ga', googleAnalyticsHandler.handlePost);

  // Projects API routes
  app.route('/api/projects', createProjectsRouter());

  // Simple projects listing (JSON)
  app.get('/projects', async (c) => {
    try {
      const { listProjects } = await import('../services/project.js');
      const projects = await listProjects(c.env.DB, 100, 0);

      return c.json({
        success: true,
        total: projects.length,
        projects: projects,
      });
    } catch (err) {
      return c.json(
        {
          error: 'Failed to fetch projects',
          message: err instanceof Error ? err.message : 'Unknown error',
        },
        500
      );
    }
  });

  app.get('/create', async (c) => {
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
