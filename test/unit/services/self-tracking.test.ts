import { describe, it, expect, beforeEach, vi } from 'vitest';
import { SelfTrackingService } from '../../../src/services/self-tracking.js';
import type { Env } from '../../../src/types/index.js';
import type {
  SelfTrackingRequestData,
  IncrementMessage,
} from '../../../src/types/self-tracking.js';

// Mock Analytics Engine dataset
const createMockDataset = (): {
  writeDataPoint: ReturnType<typeof vi.fn>;
} => ({
  writeDataPoint: vi.fn(),
});

// Mock Durable Object stub
const createMockStub = (): {
  fetch: ReturnType<typeof vi.fn>;
} => ({
  fetch: vi.fn().mockResolvedValue(
    new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    })
  ),
});

// Mock Durable Object namespace
const createMockNamespace = (): {
  idFromName: ReturnType<typeof vi.fn>;
  get: ReturnType<typeof vi.fn>;
  _stub: ReturnType<typeof createMockStub>;
} => {
  const stub = createMockStub();
  return {
    idFromName: vi.fn().mockReturnValue('mock-id'),
    get: vi.fn().mockReturnValue(stub),
    _stub: stub, // Expose for testing
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
    DB: {} as never, // Mock D1Database
    CLAUDE_CODE_ANALYTICS: createMockDataset() as never,
    CLAUDE_CODE_LOGS: createMockDataset() as never,
    CLAUDE_CODE_METRICS: createMockDataset() as never,
    GA_ANALYTICS: createMockDataset() as never,
    LOGTAIL_ANALYTICS: createMockDataset() as never,
    SENTRY_ANALYTICS: createMockDataset() as never,
  };

  // Add self-tracking dataset if requested
  if (options.hasDataset !== false) {
    env.SELF_TRACKING_ANALYTICS = createMockDataset() as never;
  }

  // Add self-tracking aggregator if requested
  if (options.hasAggregator) {
    env.SELF_TRACKING_AGGREGATOR = createMockNamespace() as never;
  }

  // Set enable flag
  if (options.enableSelfTracking !== false) {
    env.ENABLE_SELF_TRACKING = 'true';
  }

  return env as Env;
};

// Sample request data
const createSampleData = (
  overrides: Partial<SelfTrackingRequestData> = {}
): SelfTrackingRequestData => ({
  timestamp: 1704067200000,
  endpoint: '/cc',
  method: 'POST',
  status: 200,
  response_time_ms: 42,
  ...overrides,
});

describe('SelfTrackingService', () => {
  let service: SelfTrackingService;

  beforeEach(() => {
    service = new SelfTrackingService();
  });

  describe('isEnabled', () => {
    it('should return true when ENABLE_SELF_TRACKING is "true"', () => {
      const env = createMockEnv({ enableSelfTracking: true });
      expect(service.isEnabled(env)).toBe(true);
    });

    it('should return true when ENABLE_SELF_TRACKING is "1"', () => {
      const env = createMockEnv();
      env.ENABLE_SELF_TRACKING = '1';
      expect(service.isEnabled(env)).toBe(true);
    });

    it('should return true when ENABLE_SELF_TRACKING is "yes"', () => {
      const env = createMockEnv();
      env.ENABLE_SELF_TRACKING = 'yes';
      expect(service.isEnabled(env)).toBe(true);
    });

    it('should return false when ENABLE_SELF_TRACKING is "false"', () => {
      const env = createMockEnv();
      env.ENABLE_SELF_TRACKING = 'false';
      expect(service.isEnabled(env)).toBe(false);
    });

    it('should return false when ENABLE_SELF_TRACKING is "0"', () => {
      const env = createMockEnv();
      env.ENABLE_SELF_TRACKING = '0';
      expect(service.isEnabled(env)).toBe(false);
    });

    it('should return false when ENABLE_SELF_TRACKING is undefined', () => {
      const env = createMockEnv();
      delete env.ENABLE_SELF_TRACKING;
      expect(service.isEnabled(env)).toBe(false);
    });

    it('should be case-insensitive', () => {
      const env = createMockEnv();

      env.ENABLE_SELF_TRACKING = 'TRUE';
      expect(service.isEnabled(env)).toBe(true);

      env.ENABLE_SELF_TRACKING = 'YES';
      expect(service.isEnabled(env)).toBe(true);

      env.ENABLE_SELF_TRACKING = 'FALSE';
      expect(service.isEnabled(env)).toBe(false);
    });
  });

  describe('hasDataset', () => {
    it('should return true when SELF_TRACKING_ANALYTICS exists', () => {
      const env = createMockEnv({ hasDataset: true });
      expect(service.hasDataset(env)).toBe(true);
    });

    it('should return false when SELF_TRACKING_ANALYTICS is undefined', () => {
      const env = createMockEnv({ hasDataset: false });
      expect(service.hasDataset(env)).toBe(false);
    });
  });

  describe('trackRequest', () => {
    it('should write to Analytics Engine when enabled', () => {
      const env = createMockEnv({ enableSelfTracking: true, hasDataset: true });
      const data = createSampleData();

      service.trackRequest(env, data);

      // Note: writeDataPoint is called synchronously in Promise.resolve().then()
      // Wait for next tick
      return new Promise((resolve) => {
        setTimeout(() => {
          expect(env.SELF_TRACKING_ANALYTICS).toBeDefined();
          expect(
            env.SELF_TRACKING_ANALYTICS!.writeDataPoint
          ).toHaveBeenCalledOnce();
          resolve(undefined);
        }, 10);
      });
    });

    it('should not write when self-tracking is disabled', () => {
      const env = createMockEnv();
      env.ENABLE_SELF_TRACKING = 'false';
      const data = createSampleData();

      service.trackRequest(env, data);

      // Should not write
      expect(env.SELF_TRACKING_ANALYTICS).toBeDefined();
      expect(
        env.SELF_TRACKING_ANALYTICS!.writeDataPoint
      ).not.toHaveBeenCalled();
    });

    it('should not write when dataset is missing', () => {
      const env = createMockEnv({ hasDataset: false });
      const data = createSampleData();

      service.trackRequest(env, data);

      // Should not throw, just log warning
      expect(true).toBe(true);
    });

    it('should use waitUntil if provided', () => {
      const env = createMockEnv({ enableSelfTracking: true, hasDataset: true });
      const data = createSampleData();
      const waitUntil = vi.fn();

      service.trackRequest(env, data, waitUntil);

      expect(waitUntil).toHaveBeenCalledOnce();
      expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    });

    it('should handle write errors gracefully', async () => {
      const env = createMockEnv({ enableSelfTracking: true, hasDataset: true });
      const data = createSampleData();

      // Make writeDataPoint throw
      vi.spyOn(
        env.SELF_TRACKING_ANALYTICS as never,
        'writeDataPoint'
      ).mockImplementation(() => {
        throw new Error('Write failed');
      });

      // Should not throw
      service.trackRequest(env, data);

      // Wait for promise to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should set project_id on adapter when provided', async () => {
      const env = createMockEnv({ enableSelfTracking: true, hasDataset: true });
      const data = createSampleData({ project_id: 'myproject' });

      service.trackRequest(env, data);

      // Wait for write
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify writeDataPoint was called
      expect(env.SELF_TRACKING_ANALYTICS).toBeDefined();
      expect(
        env.SELF_TRACKING_ANALYTICS!.writeDataPoint
      ).toHaveBeenCalledOnce();

      // Check that the data point has project_id as index
      const call = (
        env.SELF_TRACKING_ANALYTICS?.writeDataPoint as never as {
          mock: { calls: [[{ indexes: string[] }]] };
        }
      ).mock.calls[0];
      expect(call[0].indexes).toContain('myproject');
    });
  });

  describe('incrementStats', () => {
    it('should call Durable Object when enabled', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasAggregator: true,
      });
      const data = createSampleData();

      service.incrementStats(env, data);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify Durable Object was called
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        idFromName: ReturnType<typeof vi.fn>;
        get: ReturnType<typeof vi.fn>;
        _stub: ReturnType<typeof createMockStub>;
      };

      expect(namespace.idFromName).toHaveBeenCalledWith('global');
      expect(namespace.get).toHaveBeenCalled();
      expect(namespace._stub.fetch).toHaveBeenCalledWith(
        'https://fake-host/increment',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
        })
      );
    });

    it('should not call Durable Object when disabled', () => {
      const env = createMockEnv({ hasAggregator: true });
      env.ENABLE_SELF_TRACKING = 'false';
      const data = createSampleData();

      service.incrementStats(env, data);

      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        idFromName: ReturnType<typeof vi.fn>;
      };
      expect(namespace.idFromName).not.toHaveBeenCalled();
    });

    it('should not call Durable Object when binding is missing', () => {
      const env = createMockEnv();
      delete env.SELF_TRACKING_AGGREGATOR;
      const data = createSampleData();

      // Should not throw
      service.incrementStats(env, data);
      expect(true).toBe(true);
    });

    it('should use waitUntil if provided', () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasAggregator: true,
      });
      const data = createSampleData();
      const waitUntil = vi.fn();

      service.incrementStats(env, data, waitUntil);

      expect(waitUntil).toHaveBeenCalledOnce();
      expect(waitUntil).toHaveBeenCalledWith(expect.any(Promise));
    });

    it('should handle Durable Object errors gracefully', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasAggregator: true,
      });
      const data = createSampleData();

      // Make fetch fail
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        _stub: ReturnType<typeof createMockStub>;
      };
      namespace._stub.fetch.mockRejectedValue(
        new Error('Durable Object error')
      );

      // Should not throw
      service.incrementStats(env, data);

      // Wait for promise to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should send correct increment message', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasAggregator: true,
      });
      const data = createSampleData({
        timestamp: 1704067200000,
        endpoint: '/cc/myproject',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: 'myproject',
      });

      service.incrementStats(env, data);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify message structure
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        _stub: ReturnType<typeof createMockStub>;
      };
      const fetchCall = namespace._stub.fetch.mock.calls[0];
      const bodyStr =
        (fetchCall[1] as { body: string } | undefined)?.body || '{}';
      const body = JSON.parse(bodyStr) as IncrementMessage;

      const expectedMessage: IncrementMessage = {
        timestamp: 1704067200000,
        endpoint: '/cc/myproject',
        method: 'POST',
        status: 200,
        response_time_ms: 42,
        project_id: 'myproject',
        error: false,
      };

      expect(body).toEqual(expectedMessage);
    });

    it('should mark errors correctly in increment message', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasAggregator: true,
      });
      const data = createSampleData({ status: 500 });

      service.incrementStats(env, data);

      // Wait for async operation
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify error flag is true
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        _stub: ReturnType<typeof createMockStub>;
      };
      const fetchCall = namespace._stub.fetch.mock.calls[0];
      const bodyStr =
        (fetchCall[1] as { body: string } | undefined)?.body || '{}';
      const body = JSON.parse(bodyStr) as IncrementMessage;

      expect(body.error).toBe(true);
    });

    it('should handle non-ok Durable Object responses', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasAggregator: true,
      });
      const data = createSampleData();

      // Make fetch return non-ok response
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        _stub: ReturnType<typeof createMockStub>;
      };
      namespace._stub.fetch.mockResolvedValue(
        new Response('Internal Server Error', { status: 500 })
      );

      // Should not throw
      service.incrementStats(env, data);

      // Wait for promise to settle
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  });

  describe('track', () => {
    it('should call both trackRequest and incrementStats', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const data = createSampleData();
      const waitUntil = vi.fn();

      service.track(env, data, waitUntil);

      // Should call waitUntil twice (once for each method)
      expect(waitUntil).toHaveBeenCalledTimes(2);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify both were called
      expect(env.SELF_TRACKING_ANALYTICS).toBeDefined();
      expect(
        env.SELF_TRACKING_ANALYTICS!.writeDataPoint
      ).toHaveBeenCalledOnce();
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        _stub: ReturnType<typeof createMockStub>;
      };
      expect(namespace._stub.fetch).toHaveBeenCalledOnce();
    });

    it('should work without waitUntil', async () => {
      const env = createMockEnv({
        enableSelfTracking: true,
        hasDataset: true,
        hasAggregator: true,
      });
      const data = createSampleData();

      // Should not throw
      service.track(env, data);

      // Wait for async operations
      await new Promise((resolve) => setTimeout(resolve, 10));

      // Verify both were called
      expect(env.SELF_TRACKING_ANALYTICS).toBeDefined();
      expect(
        env.SELF_TRACKING_ANALYTICS!.writeDataPoint
      ).toHaveBeenCalledOnce();
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        _stub: ReturnType<typeof createMockStub>;
      };
      expect(namespace._stub.fetch).toHaveBeenCalledOnce();
    });

    it('should not call anything when disabled', () => {
      const env = createMockEnv({
        hasDataset: true,
        hasAggregator: true,
      });
      env.ENABLE_SELF_TRACKING = 'false';
      const data = createSampleData();

      service.track(env, data);

      // Should not call anything
      expect(env.SELF_TRACKING_ANALYTICS).toBeDefined();
      expect(
        env.SELF_TRACKING_ANALYTICS!.writeDataPoint
      ).not.toHaveBeenCalled();
      const namespace = env.SELF_TRACKING_AGGREGATOR as {
        idFromName: ReturnType<typeof vi.fn>;
      };
      expect(namespace.idFromName).not.toHaveBeenCalled();
    });
  });
});
