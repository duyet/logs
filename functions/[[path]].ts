import { createRouter } from '../src/routes/router.js';
import type { Env } from '../src/types/index.js';

// Export Durable Object
export { RealtimeAggregator } from '../src/durable-objects/realtime-aggregator.js';

/**
 * Cloudflare Pages Function - Catch-all route
 * Handles all incoming requests and routes them through Hono
 * Sentry error tracking is configured in functions/_middleware.ts
 */
export const onRequest: PagesFunction<Env> = (context) => {
  const app = createRouter();
  return app.fetch(context.request, context.env);
};
