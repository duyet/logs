import { createRouter } from '../src/routes/router.js';
import type { Env } from '../src/types/index.js';

/**
 * Cloudflare Pages Function - Catch-all route
 * Handles all incoming requests and routes them through Hono
 */
export const onRequest: PagesFunction<Env> = (context) => {
  const app = createRouter();
  return app.fetch(context.request, context.env);
};
