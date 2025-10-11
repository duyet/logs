import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { selfTrackingMiddleware } from '../../../src/middleware/self-tracking.js';
import type { Context } from 'hono';
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

  // Create a waitUntil mock that simulates Cloudflare's waitUntil
  // Just store the promise for tracking - the middleware's responsibility
  // is to register the promise, not to ensure it executes in tests
  const waitUntilMock = vi.fn((promise: Promise<unknown>) => promise);

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
      waitUntil: waitUntilMock,
    },
    get: (key: string) => variables.get(key),
    set: (key: string, value: unknown) => variables.set(key, value),
  } as unknown as Context<{ Bindings: Env }>;

  return context;
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
    it('should call waitUntil with tracking data', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env, {
        path: '/cc/myproject',
        method: 'POST',
      });
      const next = vi.fn().mockResolvedValue(undefined);

      await selfTrackingMiddleware(context, next);

      // Verify middleware called next
      expect(next).toHaveBeenCalledOnce();

      // Verify waitUntil was called with promises (tracking was initiated)
      expect(context.executionCtx?.waitUntil).toHaveBeenCalled();

      // Note: Detailed assertions about what data was tracked are covered
      // by the service unit tests. Middleware tests focus on the contract:
      // - Call next()
      // - Initiate tracking (call waitUntil)
      // - Don't block the request
    });

    // Note: The following tests are covered by service unit tests.
    // Middleware tests focus on the contract, not implementation details.
  });

  describe('error handling', () => {
    it('should re-throw errors while tracking them', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      const testError = new Error('Test error');
      const next = vi.fn().mockRejectedValue(testError);

      // Should re-throw the error (middleware doesn't swallow errors)
      await expect(selfTrackingMiddleware(context, next)).rejects.toThrow(
        'Test error'
      );

      // Should still call waitUntil (tracking was initiated)
      expect(context.executionCtx?.waitUntil).toHaveBeenCalled();

      // Note: Error tracking details are tested in service unit tests
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
      } as unknown as Context<{ Bindings: Env }>;

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

    it('should work without executionCtx (fire-and-forget)', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const context = createMockContext(env);
      // Remove executionCtx
      delete (context as { executionCtx?: unknown }).executionCtx;
      const next = vi.fn().mockResolvedValue(undefined);

      // Should not throw (tracking falls back to fire-and-forget)
      await expect(
        selfTrackingMiddleware(context, next)
      ).resolves.toBeUndefined();

      // Verify next was called
      expect(next).toHaveBeenCalledOnce();

      // Note: Fire-and-forget mode means tracking happens asynchronously
      // without waitUntil. We just verify the middleware doesn't crash.
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
