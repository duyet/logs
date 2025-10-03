import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RealtimeAggregator } from '../../../src/durable-objects/realtime-aggregator';
import type {
  RealtimeEvent,
  FingerprintComponents,
} from '../../../src/types/realtime';

// Helper to create complete fingerprint components
function createFingerprintComponents(
  overrides?: Partial<FingerprintComponents>
): FingerprintComponents {
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
    ...overrides,
  };
}

// Mock Durable Object State
class MockDurableObjectState implements DurableObjectState {
  private data = new Map<string, unknown>();
  public blockConcurrencyWhile = vi.fn();
  public id = { name: 'test', toString: () => 'test' } as DurableObjectId;

  // Create mock functions that can be accessed without unbound method warnings
  public getMock = vi.fn(<T>(key: string) =>
    Promise.resolve(this.data.get(key) as T | undefined)
  );
  public putMock = vi.fn(<T>(key: string, value: T) => {
    this.data.set(key, value);
    return Promise.resolve();
  });
  public deleteMock = vi.fn((key: string) =>
    Promise.resolve(this.data.delete(key))
  );
  public listMock = vi.fn(<T>() =>
    Promise.resolve(new Map(this.data) as Map<string, T>)
  );
  public deleteAllMock = vi.fn(() => {
    this.data.clear();
    return Promise.resolve();
  });

  public storage = {
    get: this.getMock,
    put: this.putMock,
    delete: this.deleteMock,
    list: this.listMock,
    deleteAll: this.deleteAllMock,
    transaction: vi.fn(),
    getAlarm: vi.fn(),
    setAlarm: vi.fn(),
    deleteAlarm: vi.fn(),
    sync: vi.fn(),
  } as unknown as DurableObjectStorage;

  public waitUntil = vi.fn();
}

describe('RealtimeAggregator', () => {
  let aggregator: RealtimeAggregator;
  let state: MockDurableObjectState;

  beforeEach(() => {
    state = new MockDurableObjectState();
    aggregator = new RealtimeAggregator(state, {} as Env);
  });

  describe('addEvent', () => {
    it('should add event to current window', async () => {
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

      await aggregator.addEvent(event);

      expect(state.getMock).toHaveBeenCalled();
      expect(state.putMock).toHaveBeenCalled();
    });
  });

  describe('getStats', () => {
    it('should return stats for current window', async () => {
      const stats = await aggregator.getStats();

      expect(stats).toBeDefined();
      expect(stats.timestamp).toBeGreaterThan(0);
      expect(stats.window_size).toBe(5 * 60 * 1000);
      expect(stats.total_events).toBe(0);
    });

    it('should calculate stats from events', async () => {
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

      await aggregator.addEvent(event);
      const stats = await aggregator.getStats();

      expect(stats.total_events).toBe(1);
      expect(stats.unique_visitors).toBe(1);
      expect(stats.pageviews).toBe(1);
    });
  });

  describe('fetch', () => {
    it('should handle POST /event', async () => {
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

      const request = new Request('http://do/event', {
        method: 'POST',
        body: JSON.stringify(event),
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await aggregator.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toEqual({ success: true });
    });

    it('should handle GET /stats', async () => {
      const request = new Request('http://do/stats', {
        method: 'GET',
      });

      const response = await aggregator.fetch(request);
      const stats = await response.json();

      expect(response.status).toBe(200);
      expect(stats.timestamp).toBeGreaterThan(0);
      expect(stats.total_events).toBeGreaterThanOrEqual(0);
    });

    it('should handle GET /data', async () => {
      const request = new Request('http://do/data', {
        method: 'GET',
      });

      const response = await aggregator.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.current_window).toBeDefined();
      expect(data.events).toBeInstanceOf(Array);
    });

    it('should handle POST /cleanup', async () => {
      const request = new Request('http://do/cleanup', {
        method: 'POST',
      });

      const response = await aggregator.fetch(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.cleaned).toBeGreaterThanOrEqual(0);
    });

    it('should handle invalid routes', async () => {
      const request = new Request('http://do/invalid', {
        method: 'GET',
      });

      const response = await aggregator.fetch(request);

      expect(response.status).toBe(404);
    });

    it('should handle errors gracefully', async () => {
      const request = new Request('http://do/event', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      });

      const response = await aggregator.fetch(request);

      expect(response.status).toBe(500);
    });
  });

  describe('cleanupOldWindows', () => {
    it('should remove old windows', async () => {
      const removedCount = await aggregator.cleanupOldWindows();

      expect(state.listMock).toHaveBeenCalled();
      expect(removedCount).toBeGreaterThanOrEqual(0);
    });
  });

  describe('aggregateEvents', () => {
    it('should aggregate multiple events', async () => {
      const events: RealtimeEvent[] = [
        {
          event_type: 'pageview',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent:
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
          fingerprint: {
            hash: 'hash1',
            components: createFingerprintComponents(),
            confidence: 85,
          },
        },
        {
          event_type: 'click',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent:
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          fingerprint: {
            hash: 'hash2',
            components: createFingerprintComponents({
              platform: 'MacIntel',
            }),
            confidence: 90,
          },
        },
        {
          event_type: 'pageview',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent: 'Googlebot/2.1',
          fingerprint: {
            hash: 'hash3',
            components: createFingerprintComponents(),
            confidence: 50,
          },
        },
      ];

      for (const event of events) {
        await aggregator.addEvent(event);
      }

      const stats = await aggregator.getStats();

      expect(stats.total_events).toBe(3);
      expect(stats.unique_visitors).toBe(3);
      expect(stats.pageviews).toBe(2);
      expect(stats.clicks).toBe(1);
      expect(stats.bot_traffic).toBeGreaterThan(0);
      expect(stats.human_traffic).toBeGreaterThan(0);
    });
  });
});
