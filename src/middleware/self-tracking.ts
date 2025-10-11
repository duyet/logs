import type { Context, Next } from 'hono';
import type { Env } from '../types/index.js';
import type { SelfTrackingRequestData } from '../types/self-tracking.js';
import { SelfTrackingService } from '../services/self-tracking.js';

/**
 * Self-tracking middleware
 * Tracks request metadata to monitor the logs system itself
 * Non-blocking: uses waitUntil to defer writes after response
 */
export async function selfTrackingMiddleware(
  c: Context<{ Bindings: Env }>,
  next: Next
): Promise<void> {
  // Initialize service
  const service = new SelfTrackingService();

  // Early exit if self-tracking is disabled
  if (!service.isEnabled(c.env)) {
    await next();
    return;
  }

  // Check exclusion patterns (avoid tracking certain paths)
  const path = c.req.path;
  const excludedPatterns = [
    '/favicon.ico',
    '/robots.txt',
    '/.well-known/',
    '/api/stats/', // Don't track stats API calls to avoid self-loops
  ];

  const shouldExclude = excludedPatterns.some((pattern) =>
    path.includes(pattern)
  );

  if (shouldExclude) {
    await next();
    return;
  }

  // Capture request start time
  const startTime = Date.now();
  const method = c.req.method;
  const endpoint = path;

  // Get project_id from context (set by project-id middleware)
  const projectId = c.get('project_id');

  // Get Cloudflare request metadata
  const cfRay = c.req.header('CF-Ray');
  const cfCountry = c.req.header('CF-IPCountry');
  const cfIp = c.req.header('CF-Connecting-IP');
  const userAgent = c.req.header('User-Agent');

  // Execute request handler
  let status = 500; // Default to error in case of exception
  let errorMessage: string | undefined;
  let errorStack: string | undefined;

  try {
    await next();
    status = c.res.status;
  } catch (error) {
    // Capture error information
    status = 500;
    errorMessage = error instanceof Error ? error.message : String(error);
    errorStack = error instanceof Error ? error.stack : undefined;

    // Re-throw to let error handler deal with it
    throw error;
  } finally {
    // Calculate response time
    const responseTimeMs = Date.now() - startTime;

    // Build request data
    const requestData: SelfTrackingRequestData = {
      timestamp: startTime,
      endpoint,
      method,
      status,
      response_time_ms: responseTimeMs,
      project_id: projectId,
      user_agent: userAgent,
      cf_ray: cfRay,
      cf_country: cfCountry,
      cf_ip: cfIp,
      error_message: errorMessage,
      error_stack: errorStack,
    };

    // Track request (non-blocking via waitUntil)
    try {
      const waitUntil = c.executionCtx?.waitUntil?.bind(c.executionCtx);
      service.track(c.env, requestData, waitUntil);
    } catch (trackError) {
      // Silently fail - don't break the request if tracking fails
      console.error('[Self-Tracking] Middleware error:', trackError);
    }
  }
}
