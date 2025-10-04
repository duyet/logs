import * as Sentry from '@sentry/cloudflare';
import type { Env } from '../src/types/index.js';

/**
 * Sentry middleware for Cloudflare Pages
 * This must be the first middleware in the chain
 */
export const onRequest = [
  Sentry.sentryPagesPlugin((context) => {
    const env = context.env;
    const { id: versionId } = env.CF_VERSION_METADATA || { id: 'unknown' };

    return {
      // Use SENTRY_DSN from environment, or default to self-tracking endpoint
      dsn: env.SENTRY_DSN || 'https://logs.duyet.net/sentry/logs',

      // Release tracking using Cloudflare version metadata
      release: versionId,

      // Include request headers and IP for users
      sendDefaultPii: true,

      // Enable logs to be sent to Sentry
      enableLogs: true,

      // Set tracesSampleRate to 1.0 to capture 100% of spans for tracing
      tracesSampleRate: 1.0,

      // Environment (defaults to production if not set)
      environment: env.ENVIRONMENT || 'production',

      // Override beforeSend to customize error events
      beforeSend(event: Sentry.ErrorEvent): Sentry.ErrorEvent | null {
        // Add custom tags for better error tracking
        event.tags = {
          ...event.tags,
          service: 'duyet-logs',
          platform: 'cloudflare-pages',
        };
        return event;
      },
    };
  }),
] as PagesFunction<Env>[];
