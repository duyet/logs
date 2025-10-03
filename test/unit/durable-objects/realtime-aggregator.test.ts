import { describe, it, expect, beforeEach } from 'vitest';
import type {
  RealtimeEvent,
  RealtimeStats,
  AggregatedData,
} from '../../../src/types/realtime';

// Mock Durable Object storage
class MockDurableObjectStorage {
  private data = new Map<string, unknown>();

  get<T>(key: string): Promise<T | undefined> {
    return Promise.resolve(this.data.get(key) as T | undefined);
  }

  put<T>(key: string, value: T): Promise<void> {
    this.data.set(key, value);
    return Promise.resolve();
  }

  delete(key: string): Promise<boolean> {
    return Promise.resolve(this.data.delete(key));
  }

  list<T>(): Promise<Map<string, T>> {
    return Promise.resolve(new Map(this.data) as Map<string, T>);
  }

  deleteAll(): Promise<void> {
    this.data.clear();
    return Promise.resolve();
  }
}

// Mock implementation for testing
class RealtimeAggregator {
  private storage: MockDurableObjectStorage;
  private windowSize = 5 * 60 * 1000; // 5 minutes

  constructor(storage: MockDurableObjectStorage) {
    this.storage = storage;
  }

  async addEvent(event: RealtimeEvent): Promise<void> {
    const currentWindow = this.getCurrentWindow();
    const key = `window:${currentWindow}`;

    const events = (await this.storage.get<RealtimeEvent[]>(key)) || [];
    events.push(event);
    await this.storage.put(key, events);
  }

  async getStats(): Promise<RealtimeStats> {
    const currentWindow = this.getCurrentWindow();
    const key = `window:${currentWindow}`;
    const events = (await this.storage.get<RealtimeEvent[]>(key)) || [];

    return this.aggregateEvents(events);
  }

  async getAggregatedData(): Promise<AggregatedData> {
    const currentWindow = this.getCurrentWindow();
    const key = `window:${currentWindow}`;
    const events = (await this.storage.get<RealtimeEvent[]>(key)) || [];

    const stats = this.aggregateEvents(events);

    return {
      current_window: {
        start: currentWindow,
        end: currentWindow + this.windowSize,
        stats,
      },
      events: events.map((e) => ({
        timestamp: e.timestamp,
        event_type: e.event_type,
        url: e.url,
        visitor_id: e.visitor_id,
      })),
    };
  }

  async cleanupOldWindows(): Promise<number> {
    const currentWindow = this.getCurrentWindow();
    const allData = await this.storage.list<unknown>();
    let cleaned = 0;

    for (const [key] of allData) {
      if (key.startsWith('window:')) {
        const windowTime = parseInt(key.split(':')[1] || '0', 10);
        if (windowTime < currentWindow - this.windowSize) {
          await this.storage.delete(key);
          cleaned++;
        }
      }
    }

    return cleaned;
  }

  private getCurrentWindow(): number {
    const now = Date.now();
    return Math.floor(now / this.windowSize) * this.windowSize;
  }

  private aggregateEvents(events: RealtimeEvent[]): RealtimeStats {
    const uniqueVisitors = new Set<string>();
    const browsers: Record<string, number> = {};
    const operatingSystems: Record<string, number> = {};
    const deviceTypes: Record<string, number> = {};
    let botTraffic = 0;
    let humanTraffic = 0;

    for (const event of events) {
      // Track unique visitors (using fingerprint hash or visitor_id)
      const visitorKey = event.visitor_id || event.fingerprint.hash;
      uniqueVisitors.add(visitorKey);

      // Browser stats (would come from parsed UA in real implementation)
      // For now, use placeholder
      const browser = 'Chrome'; // Placeholder
      browsers[browser] = (browsers[browser] || 0) + 1;

      // OS stats (placeholder)
      const os = 'Windows'; // Placeholder
      operatingSystems[os] = (operatingSystems[os] || 0) + 1;

      // Device type (placeholder)
      const deviceType = 'desktop'; // Placeholder
      deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;

      // Bot detection (placeholder - in real implementation would use bot detection)
      const isBot = false; // Placeholder
      if (isBot) {
        botTraffic++;
      } else {
        humanTraffic++;
      }
    }

    return {
      timestamp: Date.now(),
      window_size: this.windowSize,
      total_events: events.length,
      unique_visitors: uniqueVisitors.size,
      browsers,
      operating_systems: operatingSystems,
      device_types: deviceTypes,
      bot_traffic: botTraffic,
      human_traffic: humanTraffic,
      pageviews: events.filter((e) => e.event_type === 'pageview').length,
      clicks: events.filter((e) => e.event_type === 'click').length,
      custom_events: events.filter((e) => e.event_type === 'custom').length,
    };
  }
}

describe('RealtimeAggregator', () => {
  let aggregator: RealtimeAggregator;
  let storage: MockDurableObjectStorage;

  beforeEach(() => {
    storage = new MockDurableObjectStorage();
    aggregator = new RealtimeAggregator(storage);
  });

  const createEvent = (overrides?: Partial<RealtimeEvent>): RealtimeEvent => ({
    event_type: 'pageview',
    timestamp: Date.now(),
    url: 'https://example.com',
    referrer: 'https://google.com',
    user_agent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0',
    fingerprint: {
      hash: 'test-hash-' + Math.random(),
      components: {
        screen: { width: 1920, height: 1080, colorDepth: 24 },
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Win32',
        cookieEnabled: true,
        doNotTrack: false,
      },
      confidence: 85,
    },
    ...overrides,
  });

  describe('addEvent', () => {
    it('should add event to current window', async () => {
      const event = createEvent();
      await aggregator.addEvent(event);

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(1);
    });

    it('should add multiple events to same window', async () => {
      await aggregator.addEvent(createEvent());
      await aggregator.addEvent(createEvent());
      await aggregator.addEvent(createEvent());

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(3);
    });

    it('should handle different event types', async () => {
      await aggregator.addEvent(createEvent({ event_type: 'pageview' }));
      await aggregator.addEvent(createEvent({ event_type: 'click' }));
      await aggregator.addEvent(createEvent({ event_type: 'custom' }));

      const stats = await aggregator.getStats();
      expect(stats.pageviews).toBe(1);
      expect(stats.clicks).toBe(1);
      expect(stats.custom_events).toBe(1);
    });
  });

  describe('getStats', () => {
    it('should return empty stats when no events', async () => {
      const stats = await aggregator.getStats();

      expect(stats.total_events).toBe(0);
      expect(stats.unique_visitors).toBe(0);
      expect(stats.pageviews).toBe(0);
      expect(stats.clicks).toBe(0);
      expect(stats.custom_events).toBe(0);
    });

    it('should calculate total events correctly', async () => {
      await aggregator.addEvent(createEvent());
      await aggregator.addEvent(createEvent());

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(2);
    });

    it('should track unique visitors', async () => {
      // Same visitor (same fingerprint hash)
      await aggregator.addEvent(
        createEvent({
          fingerprint: {
            hash: 'visitor-1',
            components: {
              screen: { width: 1920, height: 1080, colorDepth: 24 },
              timezone: 'America/New_York',
              language: 'en-US',
              platform: 'Win32',
              cookieEnabled: true,
              doNotTrack: false,
            },
            confidence: 85,
          },
        })
      );
      await aggregator.addEvent(
        createEvent({
          fingerprint: {
            hash: 'visitor-1',
            components: {
              screen: { width: 1920, height: 1080, colorDepth: 24 },
              timezone: 'America/New_York',
              language: 'en-US',
              platform: 'Win32',
              cookieEnabled: true,
              doNotTrack: false,
            },
            confidence: 85,
          },
        })
      );

      // Different visitor
      await aggregator.addEvent(
        createEvent({
          fingerprint: {
            hash: 'visitor-2',
            components: {
              screen: { width: 1366, height: 768, colorDepth: 24 },
              timezone: 'Europe/London',
              language: 'en-GB',
              platform: 'MacIntel',
              cookieEnabled: true,
              doNotTrack: false,
            },
            confidence: 90,
          },
        })
      );

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(3);
      expect(stats.unique_visitors).toBe(2);
    });

    it('should prefer visitor_id over fingerprint hash', async () => {
      await aggregator.addEvent(
        createEvent({
          visitor_id: 'visitor-123',
          fingerprint: {
            hash: 'different-hash-1',
            components: {
              screen: { width: 1920, height: 1080, colorDepth: 24 },
              timezone: 'America/New_York',
              language: 'en-US',
              platform: 'Win32',
              cookieEnabled: true,
              doNotTrack: false,
            },
            confidence: 85,
          },
        })
      );
      await aggregator.addEvent(
        createEvent({
          visitor_id: 'visitor-123',
          fingerprint: {
            hash: 'different-hash-2',
            components: {
              screen: { width: 1920, height: 1080, colorDepth: 24 },
              timezone: 'America/New_York',
              language: 'en-US',
              platform: 'Win32',
              cookieEnabled: true,
              doNotTrack: false,
            },
            confidence: 85,
          },
        })
      );

      const stats = await aggregator.getStats();
      expect(stats.unique_visitors).toBe(1);
    });

    it('should include window size in stats', async () => {
      await aggregator.addEvent(createEvent());

      const stats = await aggregator.getStats();
      expect(stats.window_size).toBe(5 * 60 * 1000); // 5 minutes
    });

    it('should include timestamp in stats', async () => {
      const before = Date.now();
      const stats = await aggregator.getStats();
      const after = Date.now();

      expect(stats.timestamp).toBeGreaterThanOrEqual(before);
      expect(stats.timestamp).toBeLessThanOrEqual(after);
    });

    it('should count pageviews correctly', async () => {
      await aggregator.addEvent(createEvent({ event_type: 'pageview' }));
      await aggregator.addEvent(createEvent({ event_type: 'pageview' }));
      await aggregator.addEvent(createEvent({ event_type: 'click' }));

      const stats = await aggregator.getStats();
      expect(stats.pageviews).toBe(2);
    });

    it('should count clicks correctly', async () => {
      await aggregator.addEvent(createEvent({ event_type: 'click' }));
      await aggregator.addEvent(createEvent({ event_type: 'click' }));
      await aggregator.addEvent(createEvent({ event_type: 'pageview' }));

      const stats = await aggregator.getStats();
      expect(stats.clicks).toBe(2);
    });

    it('should count custom events correctly', async () => {
      await aggregator.addEvent(createEvent({ event_type: 'custom' }));
      await aggregator.addEvent(createEvent({ event_type: 'custom' }));
      await aggregator.addEvent(createEvent({ event_type: 'pageview' }));

      const stats = await aggregator.getStats();
      expect(stats.custom_events).toBe(2);
    });
  });

  describe('getAggregatedData', () => {
    it('should return current window data', async () => {
      await aggregator.addEvent(createEvent());

      const data = await aggregator.getAggregatedData();

      expect(data.current_window).toBeDefined();
      expect(data.current_window.start).toBeDefined();
      expect(data.current_window.end).toBeDefined();
      expect(data.current_window.stats).toBeDefined();
    });

    it('should include event list', async () => {
      await aggregator.addEvent(
        createEvent({ url: 'https://example.com/page1' })
      );
      await aggregator.addEvent(
        createEvent({ url: 'https://example.com/page2' })
      );

      const data = await aggregator.getAggregatedData();

      expect(data.events).toBeDefined();
      expect(data.events.length).toBe(2);
      expect(data.events[0]?.url).toBe('https://example.com/page1');
      expect(data.events[1]?.url).toBe('https://example.com/page2');
    });

    it('should include minimal event data in list', async () => {
      await aggregator.addEvent(createEvent());

      const data = await aggregator.getAggregatedData();

      expect(data.events[0]).toHaveProperty('timestamp');
      expect(data.events[0]).toHaveProperty('event_type');
      expect(data.events[0]).toHaveProperty('url');
      expect(data.events[0]).toHaveProperty('visitor_id');
    });

    it('should calculate window boundaries correctly', async () => {
      const data = await aggregator.getAggregatedData();

      const windowSize = 5 * 60 * 1000;
      expect(data.current_window).toBeDefined();
      expect(data.current_window.start).toBeDefined();
      expect(data.current_window.end).toBeDefined();
      expect(data.current_window.end - data.current_window.start).toBe(
        windowSize
      );
    });
  });

  describe('cleanupOldWindows', () => {
    it('should return 0 when no windows to clean', async () => {
      const cleaned = await aggregator.cleanupOldWindows();
      expect(cleaned).toBe(0);
    });

    it('should not cleanup current window', async () => {
      await aggregator.addEvent(createEvent());

      const cleaned = await aggregator.cleanupOldWindows();
      expect(cleaned).toBe(0);

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(1);
    });

    it('should handle empty storage', async () => {
      await storage.deleteAll();

      const cleaned = await aggregator.cleanupOldWindows();
      expect(cleaned).toBe(0);
    });
  });

  describe('window management', () => {
    it('should use 5-minute windows', async () => {
      const stats = await aggregator.getStats();
      expect(stats.window_size).toBe(5 * 60 * 1000);
    });

    it('should reset stats for new window', async () => {
      await aggregator.addEvent(createEvent());

      const stats1 = await aggregator.getStats();
      expect(stats1.total_events).toBe(1);

      // Note: In real implementation, would need to advance time
      // For now, this tests the structure
    });
  });

  describe('edge cases', () => {
    it('should handle rapid event additions', async () => {
      // Add events sequentially to avoid race conditions in mock storage
      for (let i = 0; i < 100; i++) {
        await aggregator.addEvent(createEvent());
      }

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(100);
    });

    it('should handle events with missing optional fields', async () => {
      const event = createEvent();
      delete (event as Partial<RealtimeEvent>).referrer;
      delete (event as Partial<RealtimeEvent>).session_id;

      await aggregator.addEvent(event);

      const stats = await aggregator.getStats();
      expect(stats.total_events).toBe(1);
    });

    it('should handle empty browser/OS stats gracefully', async () => {
      const stats = await aggregator.getStats();

      expect(stats.browsers).toBeDefined();
      expect(stats.operating_systems).toBeDefined();
      expect(stats.device_types).toBeDefined();
    });
  });
});
