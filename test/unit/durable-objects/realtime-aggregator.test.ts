/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
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

  // WebSocket-related properties (not used but required by interface)
  public props = {};
  public acceptWebSocket = vi.fn();
  public getWebSockets = vi.fn(() => []);
  public setWebSocketAutoResponse = vi.fn();
  public getWebSocketAutoResponse = vi.fn();
  public setWebSocketAutoResponseTimestamp = vi.fn();
  public getWebSocketAutoResponseTimestamp = vi.fn();
  public getTags = vi.fn(() => []);
  public setTags = vi.fn();
  public getHibernationEventType = vi.fn();
  public setHibernatableWebSocketEventTimeout = vi.fn();
  public getHibernatableWebSocketEventTimeout = vi.fn();
  public abort = vi.fn();
}

describe('RealtimeAggregator', () => {
  let aggregator: RealtimeAggregator;
  let state: MockDurableObjectState;

  beforeEach(() => {
    state = new MockDurableObjectState();
    aggregator = new RealtimeAggregator(state);
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
      const stats = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(stats.timestamp).toBeGreaterThan(0);
      expect(stats.total_events).toBeGreaterThanOrEqual(0);
    });

    it('should handle GET /data', async () => {
      const request = new Request('http://do/data', {
        method: 'GET',
      });

      const response = await aggregator.fetch(request);
      const data = (await response.json()) as any;

      expect(response.status).toBe(200);
      expect(data.current_window).toBeDefined();
      expect(data.events).toBeInstanceOf(Array);
    });

    it('should handle POST /cleanup', async () => {
      const request = new Request('http://do/cleanup', {
        method: 'POST',
      });

      const response = await aggregator.fetch(request);
      const data = (await response.json()) as any;

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

    it('should not remove current window', async () => {
      // Add event to current window
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

      // Cleanup should not remove current window
      const cleaned = await aggregator.cleanupOldWindows();

      // Verify event is still there
      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(1);
      expect(cleaned).toBe(0);
    });

    it('should handle empty storage', async () => {
      const cleaned = await aggregator.cleanupOldWindows();
      expect(cleaned).toBe(0);
    });

    it('should cleanup multiple old windows', async () => {
      // Manually add old window data to storage
      const oldWindow1 = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const oldWindow2 = Date.now() - 15 * 60 * 1000; // 15 minutes ago

      await state.storage.put(`window:${oldWindow1}`, []);
      await state.storage.put(`window:${oldWindow2}`, []);

      const cleaned = await aggregator.cleanupOldWindows();
      expect(cleaned).toBe(2);
    });
  });

  describe('race condition prevention', () => {
    it('should handle concurrent addEvent and cleanupOldWindows', async () => {
      // Add an event to current window
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

      // Run addEvent and cleanupOldWindows concurrently
      await Promise.all([
        aggregator.addEvent(event),
        aggregator.cleanupOldWindows(),
      ]);

      // Verify event was added successfully
      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(1);
    });

    it('should handle multiple concurrent addEvent calls', async () => {
      const events: RealtimeEvent[] = Array.from({ length: 10 }, (_, i) => ({
        event_type: 'pageview' as const,
        timestamp: Date.now(),
        url: `https://example.com/${i}`,
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: `hash-${i}`,
          components: createFingerprintComponents(),
          confidence: 85,
        },
      }));

      // Add all events concurrently
      await Promise.all(events.map((event) => aggregator.addEvent(event)));

      // Verify all events were added
      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(10);
      expect(stats.unique_visitors).toBe(10);
    });

    it('should serialize addEvent during cleanup', async () => {
      // Add old window data
      const oldWindow = Date.now() - 10 * 60 * 1000;
      const oldEvents: RealtimeEvent[] = [
        {
          event_type: 'pageview',
          timestamp: oldWindow,
          url: 'https://example.com/old',
          user_agent: 'Mozilla/5.0',
          fingerprint: {
            hash: 'old-hash',
            components: createFingerprintComponents(),
            confidence: 85,
          },
        },
      ];
      await state.storage.put(`window:${oldWindow}`, oldEvents);

      // New event for current window
      const newEvent: RealtimeEvent = {
        event_type: 'pageview',
        timestamp: Date.now(),
        url: 'https://example.com/new',
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: 'new-hash',
          components: createFingerprintComponents(),
          confidence: 85,
        },
      };

      // Run cleanup and add event concurrently
      const [cleaned] = await Promise.all([
        aggregator.cleanupOldWindows(),
        aggregator.addEvent(newEvent),
      ]);

      // Verify cleanup removed old window
      expect(cleaned).toBe(1);

      // Verify new event is still there
      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(1);
    });

    it('should prevent event loss during concurrent operations', async () => {
      // Create multiple events
      const events: RealtimeEvent[] = Array.from({ length: 5 }, (_, i) => ({
        event_type: 'pageview' as const,
        timestamp: Date.now(),
        url: `https://example.com/${i}`,
        user_agent: 'Mozilla/5.0',
        fingerprint: {
          hash: `hash-${i}`,
          components: createFingerprintComponents(),
          confidence: 85,
        },
      }));

      // Add events and run cleanup multiple times concurrently
      await Promise.all([
        ...events.map((event) => aggregator.addEvent(event)),
        aggregator.cleanupOldWindows(),
        aggregator.cleanupOldWindows(),
      ]);

      // Verify all events were added and none were lost
      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(5);
    });

    it('should maintain consistent state with rapid operations', async () => {
      const operations: Promise<unknown>[] = [];

      // Mix of addEvent, getStats, and cleanup operations
      for (let i = 0; i < 20; i++) {
        if (i % 3 === 0) {
          operations.push(
            aggregator.addEvent({
              event_type: 'pageview',
              timestamp: Date.now(),
              url: `https://example.com/${i}`,
              user_agent: 'Mozilla/5.0',
              fingerprint: {
                hash: `hash-${i}`,
                components: createFingerprintComponents(),
                confidence: 85,
              },
            })
          );
        } else if (i % 3 === 1) {
          operations.push(aggregator.getStats());
        } else {
          operations.push(aggregator.cleanupOldWindows());
        }
      }

      // All operations should complete without errors
      await expect(Promise.all(operations)).resolves.toBeDefined();

      // Final state should be consistent
      const stats = await aggregator.getStats();
      expect(stats.total_events).toBeGreaterThanOrEqual(0);
      expect(stats.unique_visitors).toBeGreaterThanOrEqual(0);
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

  describe('memory management (BUG-004 fix)', () => {
    describe('event limit enforcement', () => {
      it('should enforce MAX_EVENTS_PER_WINDOW limit (10,000)', async () => {
        // Add 15,000 events to trigger FIFO queue behavior
        const eventCount = 15_000;
        const events: RealtimeEvent[] = Array.from(
          { length: eventCount },
          (_, i) => ({
            event_type: 'pageview' as const,
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          })
        );

        // Add all events
        for (const event of events) {
          await aggregator.addEvent(event);
        }

        // Verify only 10,000 events are kept
        const stats = await aggregator.getStats();
        expect(stats.total_events).toBe(10_000);
      });

      it('should handle events exactly at limit', async () => {
        // Add exactly 10,000 events
        const eventCount = 10_000;
        const events: RealtimeEvent[] = Array.from(
          { length: eventCount },
          (_, i) => ({
            event_type: 'pageview' as const,
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          })
        );

        // Add all events
        for (const event of events) {
          await aggregator.addEvent(event);
        }

        // Verify all 10,000 events are kept
        const stats = await aggregator.getStats();
        expect(stats.total_events).toBe(10_000);

        // Add one more event
        await aggregator.addEvent({
          event_type: 'pageview',
          timestamp: Date.now(),
          url: 'https://example.com/extra',
          user_agent: 'Mozilla/5.0',
          fingerprint: {
            hash: 'hash-extra',
            components: createFingerprintComponents(),
            confidence: 85,
          },
        });

        // Should still be 10,000 (oldest removed)
        const newStats = await aggregator.getStats();
        expect(newStats.total_events).toBe(10_000);
      });
    });

    describe('FIFO queue behavior', () => {
      it('should remove oldest events first when limit exceeded', async () => {
        // Add events with unique identifiable URLs
        const eventCount = 10_500;
        const events: RealtimeEvent[] = Array.from(
          { length: eventCount },
          (_, i) => ({
            event_type: 'pageview' as const,
            timestamp: Date.now() + i,
            url: `https://example.com/event-${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          })
        );

        // Add all events
        for (const event of events) {
          await aggregator.addEvent(event);
        }

        // Get aggregated data with event list
        const data = await aggregator.getAggregatedData();

        // Should have 10,000 events (500 oldest removed)
        expect(data.events.length).toBe(10_000);

        // First event should be event-500 (oldest 500 removed)
        expect(data.events[0]?.url).toBe('https://example.com/event-500');

        // Last event should be event-10499
        expect(data.events[data.events.length - 1]?.url).toBe(
          'https://example.com/event-10499'
        );
      });

      it('should maintain FIFO order with multiple batches', async () => {
        // Add first batch: 10,000 events
        for (let i = 0; i < 10_000; i++) {
          await aggregator.addEvent({
            event_type: 'pageview',
            timestamp: Date.now() + i,
            url: `https://example.com/batch1-${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash1-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          });
        }

        // Add second batch: 5,000 events (should remove 5,000 oldest from batch 1)
        for (let i = 0; i < 5_000; i++) {
          await aggregator.addEvent({
            event_type: 'pageview',
            timestamp: Date.now() + 10_000 + i,
            url: `https://example.com/batch2-${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash2-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          });
        }

        const data = await aggregator.getAggregatedData();

        // Should have 10,000 events
        expect(data.events.length).toBe(10_000);

        // First event should be from batch 1, starting at index 5000
        expect(data.events[0]?.url).toBe('https://example.com/batch1-5000');

        // Should have mix of batch1 (last 5000) and batch2 (all 5000)
        const batch1Count = data.events.filter((e) =>
          e.url.includes('batch1')
        ).length;
        const batch2Count = data.events.filter((e) =>
          e.url.includes('batch2')
        ).length;

        expect(batch1Count).toBe(5_000);
        expect(batch2Count).toBe(5_000);
      });
    });

    describe('stats accuracy after event removal', () => {
      it('should maintain accurate stats after FIFO removal', async () => {
        // Add 12,000 events with specific patterns
        // First 2,000: Chrome Windows
        for (let i = 0; i < 2_000; i++) {
          await aggregator.addEvent({
            event_type: 'pageview',
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent:
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          });
        }

        // Next 10,000: Firefox macOS
        for (let i = 2_000; i < 12_000; i++) {
          await aggregator.addEvent({
            event_type: 'click',
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:89.0) Gecko/20100101 Firefox/89.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents({
                platform: 'MacIntel',
              }),
              confidence: 85,
            },
          });
        }

        const stats = await aggregator.getStats();

        // Should have 10,000 events (2,000 oldest Chrome removed)
        expect(stats.total_events).toBe(10_000);

        // All remaining events should be Firefox clicks
        expect(stats.clicks).toBe(10_000);
        expect(stats.pageviews).toBe(0);

        // Browser stats should reflect only remaining events
        expect(stats.browsers.Chrome).toBeUndefined();
        expect(stats.browsers.Firefox).toBe(10_000);
      });

      it('should correctly count unique visitors after removal', async () => {
        // Add 15,000 events from 1,000 unique visitors (15 events each)
        const uniqueVisitors = 1_000;
        const eventsPerVisitor = 15;

        for (let i = 0; i < uniqueVisitors; i++) {
          for (let j = 0; j < eventsPerVisitor; j++) {
            await aggregator.addEvent({
              event_type: 'pageview',
              timestamp: Date.now() + i * eventsPerVisitor + j,
              url: `https://example.com/${i}-${j}`,
              user_agent: 'Mozilla/5.0',
              fingerprint: {
                hash: `visitor-${i}`, // Same hash for same visitor
                components: createFingerprintComponents(),
                confidence: 85,
              },
            });
          }
        }

        const stats = await aggregator.getStats();

        // Should have 10,000 events
        expect(stats.total_events).toBe(10_000);

        // Should still track unique visitors correctly
        // First 5,000 events removed = first ~333 visitors completely removed
        // Remaining events from ~667 visitors
        expect(stats.unique_visitors).toBeGreaterThan(600);
        expect(stats.unique_visitors).toBeLessThanOrEqual(1_000);
      });
    });

    describe('memory usage estimation', () => {
      it('should estimate memory usage correctly', async () => {
        // Add known number of events
        const eventCount = 5_000;

        for (let i = 0; i < eventCount; i++) {
          await aggregator.addEvent({
            event_type: 'pageview',
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          });
        }

        // Get memory stats via HTTP endpoint
        const request = new Request('http://do/memory', {
          method: 'GET',
        });

        const response = await aggregator.fetch(request);
        const memStats = (await response.json()) as any;

        expect(memStats.eventCount).toBe(5_000);
        expect(memStats.maxEvents).toBe(10_000);
        expect(memStats.utilizationPercent).toBe(50);
        expect(memStats.estimatedMemoryMB).toBeGreaterThan(0);
        expect(memStats.estimatedMemoryMB).toBeLessThan(10); // Should be around 2.5MB
      });

      it('should show high utilization near limit', async () => {
        // Add 9,500 events (95% of limit)
        const eventCount = 9_500;

        for (let i = 0; i < eventCount; i++) {
          await aggregator.addEvent({
            event_type: 'pageview',
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          });
        }

        const request = new Request('http://do/memory', {
          method: 'GET',
        });

        const response = await aggregator.fetch(request);
        const memStats = (await response.json()) as any;

        expect(memStats.eventCount).toBe(9_500);
        expect(memStats.utilizationPercent).toBe(95);
      });
    });

    describe('high-traffic scenarios', () => {
      it('should handle rapid event addition (1000+ events)', async () => {
        const eventCount = 1_500;
        const events: RealtimeEvent[] = Array.from(
          { length: eventCount },
          (_, i) => ({
            event_type: 'pageview' as const,
            timestamp: Date.now() + i,
            url: `https://example.com/${i}`,
            user_agent: 'Mozilla/5.0',
            fingerprint: {
              hash: `hash-${i}`,
              components: createFingerprintComponents(),
              confidence: 85,
            },
          })
        );

        // Add all events rapidly
        await Promise.all(events.map((event) => aggregator.addEvent(event)));

        // Should handle all events without error
        const stats = await aggregator.getStats();
        expect(stats.total_events).toBe(1_500);
        expect(stats.unique_visitors).toBe(1_500);
      });

      it('should maintain consistency under sustained load', async () => {
        // Simulate 30 seconds of 100 events/sec = 3,000 events
        const batchSize = 100;
        const batches = 30;

        for (let batch = 0; batch < batches; batch++) {
          const events: RealtimeEvent[] = Array.from(
            { length: batchSize },
            (_, i) => ({
              event_type: 'pageview' as const,
              timestamp: Date.now() + batch * batchSize + i,
              url: `https://example.com/batch${batch}-${i}`,
              user_agent: 'Mozilla/5.0',
              fingerprint: {
                hash: `hash-${batch}-${i}`,
                components: createFingerprintComponents(),
                confidence: 85,
              },
            })
          );

          // Add batch concurrently
          await Promise.all(events.map((event) => aggregator.addEvent(event)));
        }

        const stats = await aggregator.getStats();

        // Should have 3,000 events
        expect(stats.total_events).toBe(3_000);

        // Should be well under memory limit
        const request = new Request('http://do/memory', { method: 'GET' });
        const response = await aggregator.fetch(request);
        const memStats = (await response.json()) as any;

        expect(memStats.utilizationPercent).toBeLessThan(50);
      });
    });

    describe('edge cases', () => {
      it('should handle empty window', async () => {
        const stats = await aggregator.getStats();

        expect(stats.total_events).toBe(0);
        expect(stats.unique_visitors).toBe(0);

        const request = new Request('http://do/memory', { method: 'GET' });
        const response = await aggregator.fetch(request);
        const memStats = (await response.json()) as any;

        expect(memStats.eventCount).toBe(0);
        expect(memStats.estimatedMemoryMB).toBe(0);
        expect(memStats.utilizationPercent).toBe(0);
      });

      it('should handle single event', async () => {
        await aggregator.addEvent({
          event_type: 'pageview',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent: 'Mozilla/5.0',
          fingerprint: {
            hash: 'single-hash',
            components: createFingerprintComponents(),
            confidence: 85,
          },
        });

        const stats = await aggregator.getStats();
        expect(stats.total_events).toBe(1);

        const request = new Request('http://do/memory', { method: 'GET' });
        const response = await aggregator.fetch(request);
        const memStats = (await response.json()) as any;

        expect(memStats.eventCount).toBe(1);
        expect(memStats.utilizationPercent).toBe(0.01);
      });

      it('should handle events with large custom data', async () => {
        // Create event with large custom_data payload
        const largeData: Record<string, unknown> = {};
        for (let i = 0; i < 100; i++) {
          largeData[`field${i}`] = `value${i}`.repeat(10);
        }

        await aggregator.addEvent({
          event_type: 'custom',
          timestamp: Date.now(),
          url: 'https://example.com',
          user_agent: 'Mozilla/5.0',
          fingerprint: {
            hash: 'large-event',
            components: createFingerprintComponents(),
            confidence: 85,
          },
          custom_data: largeData,
        });

        const stats = await aggregator.getStats();
        expect(stats.total_events).toBe(1);
        expect(stats.custom_events).toBe(1);

        // Memory estimate should still work (1 event = 0.0005 MB, rounds to 0)
        const request = new Request('http://do/memory', { method: 'GET' });
        const response = await aggregator.fetch(request);
        const memStats = (await response.json()) as any;

        expect(memStats.eventCount).toBe(1);
        expect(memStats.estimatedMemoryMB).toBeGreaterThanOrEqual(0);
      });
    });
  });
});
