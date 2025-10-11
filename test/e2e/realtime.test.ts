/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type { Env } from '../../src/types/index.js';
import type {
  RealtimeEvent,
  FingerprintComponents,
} from '../../src/types/realtime.js';

// Helper to create fingerprint components
function createFingerprintComponents(): FingerprintComponents {
  return {
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
    },
    timezone: 'America/Los_Angeles',
    language: 'en-US',
    platform: 'MacIntel',
    cookieEnabled: true,
    doNotTrack: false,
  };
}

describe('Realtime Analytics E2E', () => {
  let app: ReturnType<typeof createRouter>;
  let env: Env;
  let mockDurableObjectStub: DurableObjectStub;

  beforeEach((): void => {
    // Mock Durable Object stub
    mockDurableObjectStub = {
      fetch: (request: Request): Response => {
        const url = new URL(request.url);
        if (url.pathname === '/stats') {
          return new Response(
            JSON.stringify({
              timestamp: Date.now(),
              window_size: 300000,
              total_events: 0,
              unique_visitors: 0,
              pageviews: 0,
              clicks: 0,
              custom_events: 0,
              browsers: {},
              operating_systems: {},
              device_types: {},
              bot_traffic: 0,
              human_traffic: 0,
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
        if (url.pathname === '/data') {
          return new Response(
            JSON.stringify({
              current_window: {
                start: Date.now() - 300000,
                end: Date.now(),
                stats: {
                  timestamp: Date.now(),
                  window_size: 300000,
                  total_events: 0,
                  unique_visitors: 0,
                  pageviews: 0,
                  clicks: 0,
                  custom_events: 0,
                  browsers: {},
                  operating_systems: {},
                  device_types: {},
                  bot_traffic: 0,
                  human_traffic: 0,
                },
              },
              events: [],
            }),
            { headers: { 'Content-Type': 'application/json' } }
          );
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      },
    } as unknown as DurableObjectStub;

    app = createRouter();
    env = {
      CLAUDE_CODE_ANALYTICS: {
        writeDataPoint: (): void => {},
      },
      CLAUDE_CODE_LOGS: {
        writeDataPoint: (): void => {},
      },
      CLAUDE_CODE_METRICS: {
        writeDataPoint: (): void => {},
      },
      GA_ANALYTICS: {
        writeDataPoint: (): void => {},
      },
      REALTIME_ANALYTICS: {
        writeDataPoint: (): void => {},
      },
      LOGTAIL_ANALYTICS: {
        writeDataPoint: (): void => {},
      },
      SENTRY_ANALYTICS: {
        writeDataPoint: (): void => {},
      },
      REALTIME_AGGREGATOR: {
        idFromName: (): DurableObjectId =>
          ({ name: 'test' }) as DurableObjectId,
        get: (): DurableObjectStub => mockDurableObjectStub,
      } as unknown as DurableObjectNamespace,
      DB: {
        prepare: (): {
          bind: () => {
            first: () => Promise<null>;
            all: () => Promise<D1Result>;
            run: () => Promise<D1Result>;
          };
        } => ({
          bind: (): {
            first: () => Promise<null>;
            all: () => Promise<D1Result>;
            run: () => Promise<D1Result>;
          } => ({
            first: (): Promise<null> => Promise.resolve(null),
            all: (): Promise<D1Result> =>
              Promise.resolve({
                results: [],
                success: true,
                meta: {
                  duration: 0,
                  size_after: 0,
                  rows_read: 0,
                  rows_written: 0,
                  last_row_id: 0,
                  changed_db: false,
                  changes: 0,
                },
              } as D1Result),
            run: (): Promise<D1Result> =>
              Promise.resolve({
                success: true,
                meta: {
                  duration: 0,
                  size_after: 0,
                  rows_read: 0,
                  rows_written: 0,
                  last_row_id: 0,
                  changed_db: false,
                  changes: 0,
                },
              } as D1Result),
          }),
        }),
        batch: (): Promise<never[]> => Promise.resolve([]),
        exec: (): Promise<{ count: number; duration: number }> =>
          Promise.resolve({ count: 0, duration: 0 }),
      } as unknown as D1Database,
    };
  });

  describe('POST /realtime', () => {
    it('should track pageview event', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data).toEqual({ success: true });
    });

    it('should track click event', async () => {
      const event: RealtimeEvent = {
        event_type: 'click',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
        click_target: 'button#cta',
        click_text: 'Sign Up',
      };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
    });

    it('should reject invalid event format', async () => {
      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invalid: 'data' }),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Invalid event format');
    });

    it('should handle missing REALTIME_ANALYTICS binding', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const envWithoutBinding = { ...env, REALTIME_ANALYTICS: undefined };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, envWithoutBinding);

      expect(res.status).toBe(503);
      const data = (await res.json()) as any;
      expect(data.error).toBe('REALTIME_ANALYTICS not configured');
    });

    it('should succeed without REALTIME_AGGREGATOR binding (graceful degradation)', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const envWithoutBinding = { ...env, REALTIME_AGGREGATOR: undefined };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, envWithoutBinding);

      // Should succeed even without Durable Object - graceful degradation
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('should fail when Analytics Engine write fails', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const envWithFailingAE = {
        ...env,
        REALTIME_ANALYTICS: {
          writeDataPoint: (): Promise<void> => {
            throw new Error('Analytics Engine write failed');
          },
        },
      };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, envWithFailingAE);

      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Failed to store event to Analytics Engine');
    });

    it('should succeed when Durable Object write fails (graceful degradation)', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const failingDOStub = {
        fetch: (): Response => {
          throw new Error('Durable Object unavailable');
        },
      } as unknown as DurableObjectStub;

      const envWithFailingDO = {
        ...env,
        REALTIME_AGGREGATOR: {
          idFromName: (): DurableObjectId =>
            ({ name: 'test' }) as DurableObjectId,
          get: (): DurableObjectStub => failingDOStub,
        } as unknown as DurableObjectNamespace,
      };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, envWithFailingDO);

      // Should succeed even if Durable Object fails - graceful degradation
      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.success).toBe(true);
    });

    it('should fail when both Analytics Engine and Durable Object fail', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const failingDOStub = {
        fetch: (): Response => {
          throw new Error('Durable Object unavailable');
        },
      } as unknown as DurableObjectStub;

      const envWithBothFailing = {
        ...env,
        REALTIME_ANALYTICS: {
          writeDataPoint: (): Promise<void> => {
            throw new Error('Analytics Engine write failed');
          },
        },
        REALTIME_AGGREGATOR: {
          idFromName: (): DurableObjectId =>
            ({ name: 'test' }) as DurableObjectId,
          get: (): DurableObjectStub => failingDOStub,
        } as unknown as DurableObjectNamespace,
      };

      const req = new Request('http://localhost/realtime', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, envWithBothFailing);

      // Should fail because Analytics Engine is primary
      expect(res.status).toBe(500);
      const data = (await res.json()) as any;
      expect(data.error).toBe('Failed to store event to Analytics Engine');
    });
  });

  describe('POST /realtime/:project_id', () => {
    it('should accept project_id in path', async () => {
      const event: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'test-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      const req = new Request('http://localhost/realtime/myproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(event),
      });

      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /realtime/stats', () => {
    it('should return realtime statistics', async () => {
      const req = new Request('http://localhost/realtime/stats');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.timestamp).toBeGreaterThan(0);
      expect(data.window_size).toBe(300000);
      expect(data.total_events).toBeGreaterThanOrEqual(0);
    });

    it('should handle missing REALTIME_AGGREGATOR binding', async () => {
      const envWithoutBinding = { ...env, REALTIME_AGGREGATOR: undefined };
      const req = new Request('http://localhost/realtime/stats');
      const res = await app.fetch(req, envWithoutBinding);

      expect(res.status).toBe(503);
      const data = (await res.json()) as any;
      expect(data.error).toBe('REALTIME_AGGREGATOR not configured');
    });
  });

  describe('GET /realtime/:project_id/stats', () => {
    it('should return project-specific statistics', async () => {
      const req = new Request('http://localhost/realtime/myproject/stats');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.timestamp).toBeGreaterThan(0);
    });
  });

  describe('GET /realtime/data', () => {
    it('should return aggregated data', async () => {
      const req = new Request('http://localhost/realtime/data');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);
      const data = (await res.json()) as any;
      expect(data.current_window).toBeDefined();
      expect(data.events).toBeInstanceOf(Array);
    });

    it('should handle missing REALTIME_AGGREGATOR binding', async () => {
      const envWithoutBinding = { ...env, REALTIME_AGGREGATOR: undefined };
      const req = new Request('http://localhost/realtime/data');
      const res = await app.fetch(req, envWithoutBinding);

      expect(res.status).toBe(503);
      const data = (await res.json()) as any;
      expect(data.error).toBe('REALTIME_AGGREGATOR not configured');
    });
  });
});
