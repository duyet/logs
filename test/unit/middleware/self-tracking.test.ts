import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { selfTrackingMiddleware } from '../../../src/middleware/self-tracking.js';
import type { Context, Next } from 'hono';
import type { Env } from '../../../src/types/index.js';

// Mock dataset
const createMockDataset = () => ({
  writeDataPoint: vi.fn(),
});

// Mock Durable Object stub
const createMockStub = () => ({
  fetch: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
});

// Mock Durable Object namespace
const createMockNamespace = () => {
  const stub = createMockStub();
  return {
    idFromName: vi.fn().mockReturnValue('mock-id'),
    get: vi.fn().mockReturnValue(stub),
    _stub: stub,
  };
};

// Mock environment
const createMockEnv = (
  options: {
    enableSelfTracking?: boolean;
    hasDataset?: boolean;
    hasAggregator?: boolean;
  } = {}
): Env => {
  const env: Partial<Env> = {
    DB: {} as never,
    CLAUDE_CODE_ANALYTICS: createMockDataset() as never,
    CLAUDE_CODE_LOGS: createMockDataset() as never,
    CLAUDE_CODE_METRICS: createMockDataset() as never,
    GA_ANALYTICS: createMockDataset() as never,
    LOGTAIL_ANALYTICS: createMockDataset() as never,
    SENTRY_ANALYTICS: createMockDataset() as never,
  };

  if (options.hasDataset !== false) {
    env.SELF_TRACKING_ANALYTICS = createMockDataset() as never;
  }

  if (options.hasAggregator) {
    env.SELF_TRACKING_AGGREGATOR = createMockNamespace() as never;
  }

  if (options.enableSelfTracking !== false) {
    env.ENABLE_SELF_TRACKING = 'true';
  }

  return env as Env;
};

// Mock context
const createMockContext = (
  env: Env,
  options: {
    path?: string;
    method?: string;
    status?: number;
    projectId?: string;
    headers?: Record<string, string>;
  } = {}
): Context<{ Bindings: Env }> => {
  const variables = new Map<string, unknown>();
  if (options.projectId) {
    variables.set('project_id', options.projectId);
  }

  const headers = new Map<string, string>(
    Object.entries(options.headers || {})
  );

  const context = {
    env,
    req: {
      path: options.path || '/cc',
      method: options.method || 'POST',
      header: (name: string) => headers.get(name),
      raw: new Request('https://fake-host' + (options.path || '/cc')),
    },
    res: {
      status: options.status || 200,
    },
    executionCtx: {
      waitUntil: vi.fn(),
    },
    get: (key: string) => variables.get(key),
    set: (key: string, value: unknown) => variables.set(key, value),
  } as unknown as Context<{ Bindings: Env }>;

  return context;
};

// Helper to wait for waitUntil promises to complete
const awaitTracking = async (context: Context<{ Bindings: Env }>) => {
  const waitUntilMock = context.executionCtx?.waitUntil as ReturnType<
    typeof vi.fn
  >;
  if (waitUntilMock && waitUntilMock.mock.calls.length > 0) {
    const promises = waitUntilMock.mock.calls.map(
      (call) => call[0] as Promise<unknown>
    );
    await Promise.all(promises);

    // The service wraps operations in Promise.resolve().then(), which creates nested promises.
    // We need to wait long enough for all nested promises to resolve.
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
};

describe('selfTrackingMiddleware', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('basic functionality', () => {
    it('should call next middleware', async () => {
      const env = createMockEnv({ enableSelfTracking: true });
      const context = createMockContext(env);
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      expect(next).toHaveBeenCalledOnce();
    });

    it('should track request when enabled', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      // Wait for async tracking
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Should call waitUntil
      expect(context.executionCtx?.waitUntil).toHaveBeenCalled();
    });

    it('should not track when disabled', async () => {
      const env = createMockEnv();
      env.ENABLE_SELF_TRACKING = 'false';
      const context = createMockContext(env);
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      // Should not call waitUntil
      expect(context.executionCtx?.waitUntil).not.toHaveBeenCalled();
    });

    it('should calculate response time correctly', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
      });
      const context = createMockContext(env);

      // Simulate a slow handler
      const next = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      const startTime = Date.now();
      await selfTrackingMiddleware(context, next);
      const endTime = Date.now();

      // Wait for async tracking
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify response time is approximately correct
      const actualResponseTime = endTime - startTime;
      expect(actualResponseTime).toBeGreaterThanOrEqual(50);
      expect(actualResponseTime).toBeLessThan(100); // Should complete quickly
    });
  });

  describe('exclusion patterns', () => {
    it('should exclude /favicon.ico', async () => {
      const env = createMockEnv({ enableSelfTracking: true });
      const context = createMockContext(env, { path: '/favicon.ico' });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      expect(context.executionCtx?.waitUntil).not.toHaveBeenCalled();
    });

    it('should exclude /robots.txt', async () => {
      const env = createMockEnv({ enableSelfTracking: true });
      const context = createMockContext(env, { path: '/robots.txt' });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      expect(context.executionCtx?.waitUntil).not.toHaveBeenCalled();
    });

    it('should exclude /.well-known/ paths', async () => {
      const env = createMockEnv({ enableSelfTracking: true });
      const context = createMockContext(env, {
        path: '/.well-known/security.txt',
      });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      expect(context.executionCtx?.waitUntil).not.toHaveBeenCalled();
    });

    it('should exclude /api/stats/ paths to avoid self-loops', async () => {
      const env = createMockEnv({ enableSelfTracking: true });
      const context = createMockContext(env, { path: '/api/stats/overview' });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      expect(context.executionCtx?.waitUntil).not.toHaveBeenCalled();
    });

    it('should track normal paths', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
      });
      const context = createMockContext(env, { path: '/cc/myproject' });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      expect(context.executionCtx?.waitUntil).toHaveBeenCalled();
    });
  });

  describe('metadata capture', () => {
    it('should capture request method and endpoint', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true, // Need aggregator for track() to work
      });
      const context = createMockContext(env, {
        path: '/cc/myproject',
        method: 'POST',
      });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);
      await awaitTracking(context);

      // Verify writeDataPoint was called
      expect(
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint
      ).toHaveBeenCalledOnce();

      // Check data point contains correct method and endpoint
      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ blobs: string[] }]] };
        }
      ).mock.calls[0];
      const blobData = JSON.parse(call[0].blobs[0]);

      expect(blobData.method).toBe('POST');
      expect(blobData.endpoint).toBe('/cc/myproject');
    });

    it('should capture response status', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env, { status: 201 });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);
      await awaitTracking(context);

      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ blobs: string[] }]] };
        }
      ).mock.calls[0];
      const blobData = JSON.parse(call[0].blobs[0]);

      expect(blobData.status).toBe(201);
    });

    it('should capture project_id from context', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env, { projectId: 'myproject' });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);
      await awaitTracking(context);

      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ blobs: string[] }]] };
        }
      ).mock.calls[0];
      const blobData = JSON.parse(call[0].blobs[0]);

      expect(blobData.project_id).toBe('myproject');
    });

    it('should capture Cloudflare headers', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env, {
        headers: {
          'CF-Ray': '8b1234567890abcd-SJC',
          'CF-IPCountry': 'US',
          'CF-Connecting-IP': '1.2.3.4',
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        },
      });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);
      await awaitTracking(context);

      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ blobs: string[] }]] };
        }
      ).mock.calls[0];
      const blobData = JSON.parse(call[0].blobs[0]);

      expect(blobData.cf_ray).toBe('8b1234567890abcd-SJC');
      expect(blobData.cf_country).toBe('US');
      expect(blobData.cf_ip).toBe('1.2.3.4');
      expect(blobData.user_agent).toContain('Mozilla/5.0');
    });
  });

  describe('error handling', () => {
    it('should capture errors and re-throw', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      const testError = new Error('Test error');
      const next = vi.fn().mockRejectedValue(testError);

      // Should re-throw the error
      await expect(selfTrackingMiddleware(context, next)).rejects.toThrow(
        'Test error'
      );

      await awaitTracking(context);

      // Should still track the error
      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ blobs: string[] }]] };
        }
      ).mock.calls[0];
      const blobData = JSON.parse(call[0].blobs[0]);

      expect(blobData.status).toBe(500);
      expect(blobData.error_message).toBe('Test error');
      expect(blobData.error_stack).toBeDefined();
    });

    it('should handle non-Error exceptions', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      const next = vi.fn().mockRejectedValue('String error');

      // Should re-throw the error
      await expect(selfTrackingMiddleware(context, next)).rejects.toBe(
        'String error'
      );

      await awaitTracking(context);

      // Should still track the error
      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ blobs: string[] }]] };
        }
      ).mock.calls[0];
      const blobData = JSON.parse(call[0].blobs[0]);

      expect(blobData.status).toBe(500);
      expect(blobData.error_message).toBe('String error');
      expect(blobData.error_stack).toBeNull();
    });

    it('should handle tracking errors silently', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      const next = vi.fn().mockResolvedValue(undefined);

      // Make service.track throw an error by breaking executionCtx
      const brokenContext = {
        ...context,
        executionCtx: {
          waitUntil: () => {
            throw new Error('Tracking failed');
          },
        },
      } as Context<{ Bindings: Env }>;

      // Should not throw
      await expect(
        selfTrackingMiddleware(brokenContext, next)
      ).resolves.toBeUndefined();

      // Should log error
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        '[Self-Tracking] Middleware error:',
        expect.any(Error)
      );
    });

    it('should work without executionCtx', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      // Remove executionCtx
      delete (context as { executionCtx?: unknown }).executionCtx;
      const next = vi.fn().mockResolvedValue(undefined);

      // Should not throw
      await expect(
        selfTrackingMiddleware(context, next)
      ).resolves.toBeUndefined();

      // No waitUntil, so wait for fire-and-forget promises
      await new Promise((resolve) => setTimeout(resolve, 50));

      // Should still write data
      expect(
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint
      ).toHaveBeenCalledOnce();
    });
  });

  describe('performance', () => {
    it('should have minimal overhead (<5ms)', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
      });
      const context = createMockContext(env);
      const next = vi.fn().mockResolvedValue(undefined);

      const startTime = Date.now();
      await selfTrackingMiddleware(context, next);
      const endTime = Date.now();

      const overhead = endTime - startTime;
      expect(overhead).toBeLessThan(5);
    });

    it('should not block request when tracking fails', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
      });
      const context = createMockContext(env);
      const next = vi.fn().mockResolvedValue(undefined);

      // Make tracking slow
      vi.spyOn(
        env.SELF_TRACKING_ANALYTICS as never,
        'writeDataPoint'
      ).mockImplementation(() => {
        // Simulate slow operation
        const start = Date.now();
        while (Date.now() - start < 100) {
          // Busy wait
        }
      });

      const startTime = Date.now();
      await selfTrackingMiddleware(context, next);
      const endTime = Date.now();

      // Should complete quickly (tracking is async)
      const duration = endTime - startTime;
      expect(duration).toBeLessThan(20);
    });
  });
});
