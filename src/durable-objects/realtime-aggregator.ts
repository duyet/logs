import type {
  RealtimeEvent,
  RealtimeStats,
  AggregatedData,
} from '../types/realtime';
import { parseUserAgent } from '../utils/user-agent-parser';
import { detectBot } from '../utils/bot-detection';

/**
 * Durable Object for real-time analytics aggregation
 *
 * Maintains a 5-minute sliding window of visitor events with:
 * - Event collection and storage
 * - Real-time statistics aggregation
 * - Unique visitor tracking (via fingerprint or visitor_id)
 * - Browser, OS, device type breakdown
 * - Bot vs human traffic classification
 * - Automatic cleanup of old windows
 * - Memory-bounded event storage (FIFO queue with max 10,000 events)
 *
 * Storage keys:
 * - `window:{timestamp}` → RealtimeEvent[] (events for that window)
 *
 * Window calculation:
 * - Window size: 5 minutes (300,000ms)
 * - Current window = floor(now / windowSize) * windowSize
 * - This ensures all requests in same 5-min period use same window
 *
 * Memory Management:
 * - MAX_EVENTS_PER_WINDOW prevents unbounded growth
 * - FIFO queue: oldest events removed when limit reached
 * - Aggregated stats remain accurate (computed from current events)
 * - Estimated memory: ~5MB per window (10K events × ~500 bytes)
 */
export class RealtimeAggregator implements DurableObject {
  private state: DurableObjectState;
  private windowSize = 5 * 60 * 1000; // 5 minutes in milliseconds
  private operationLock: Promise<void> = Promise.resolve();

  /**
   * Maximum events per window to prevent memory exhaustion
   * At 10,000 events × ~500 bytes = ~5MB per window
   * This prevents OOM crashes in high-traffic scenarios (1000+ events/sec)
   */
  private static readonly MAX_EVENTS_PER_WINDOW = 10_000;

  /**
   * Approximate size of a typical RealtimeEvent in bytes
   * Used for memory usage estimation
   */
  private static readonly APPROX_EVENT_SIZE_BYTES = 500;

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  /**
   * Add event to current window with FIFO queue behavior
   * Events are stored in Durable Object storage under window-specific keys
   * Uses serialization lock to prevent race conditions with cleanup
   *
   * Memory Management:
   * - Enforces MAX_EVENTS_PER_WINDOW limit to prevent memory exhaustion
   * - When limit reached, removes oldest events (FIFO)
   * - Aggregated stats remain accurate (computed from current events)
   * - Logs warning when approaching memory limits
   */
  async addEvent(event: RealtimeEvent): Promise<void> {
    return this.withLock(async () => {
      const currentWindow = this.getCurrentWindow();
      const key = `window:${currentWindow}`;

      // Get existing events for this window
      const events = (await this.state.storage.get<RealtimeEvent[]>(key)) || [];

      // Add new event
      events.push(event);

      // Enforce FIFO queue limit to prevent memory exhaustion
      if (events.length > RealtimeAggregator.MAX_EVENTS_PER_WINDOW) {
        const eventsToRemove =
          events.length - RealtimeAggregator.MAX_EVENTS_PER_WINDOW;
        const removedEvents = events.splice(0, eventsToRemove);

        // Log warning if removing significant number of events
        if (eventsToRemove > 100) {
          console.warn(
            `[RealtimeAggregator] Memory limit reached for window ${currentWindow}. ` +
              `Removed ${eventsToRemove} oldest events (kept ${events.length}). ` +
              `Current memory estimate: ${this.estimateMemoryUsage(events.length)}MB`
          );
        }

        // Optional: Log removed event details for debugging (disabled by default)
        if (process.env.DEBUG_EVENT_REMOVAL === 'true') {
          console.debug(
            `[RealtimeAggregator] Removed events: ${JSON.stringify(removedEvents.slice(0, 3))}...`
          );
        }
      }

      // Save back to storage
      await this.state.storage.put(key, events);
    });
  }

  /**
   * Get aggregated statistics for current window
   * Returns real-time metrics without exposing raw events
   */
  async getStats(): Promise<RealtimeStats> {
    const currentWindow = this.getCurrentWindow();
    const key = `window:${currentWindow}`;
    const events = (await this.state.storage.get<RealtimeEvent[]>(key)) || [];

    return this.aggregateEvents(events);
  }

  /**
   * Get full aggregated data including event list
   * Used for detailed analytics and debugging
   */
  async getAggregatedData(): Promise<AggregatedData> {
    const currentWindow = this.getCurrentWindow();
    const key = `window:${currentWindow}`;
    const events = (await this.state.storage.get<RealtimeEvent[]>(key)) || [];

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

  /**
   * Cleanup windows older than current window
   * Called periodically to prevent storage bloat
   * Returns number of windows cleaned
   * Uses serialization lock to prevent race conditions with addEvent
   */
  async cleanupOldWindows(): Promise<number> {
    return this.withLock(async () => {
      const currentWindow = this.getCurrentWindow();
      const allData = await this.state.storage.list<RealtimeEvent[]>();
      const keysToDelete: string[] = [];

      // First, collect all keys to delete
      for (const [key] of allData) {
        if (key.startsWith('window:')) {
          const windowTime = parseInt(key.split(':')[1] || '0', 10);
          // Delete windows older than current window (not including current window)
          if (windowTime < currentWindow - this.windowSize) {
            keysToDelete.push(key);
          }
        }
      }

      // Then delete all at once (atomic batch operation)
      if (keysToDelete.length > 0) {
        await Promise.all(
          keysToDelete.map((key) => this.state.storage.delete(key))
        );
      }

      return keysToDelete.length;
    });
  }

  /**
   * Handle HTTP requests to this Durable Object
   * Supports:
   * - POST /event - Add new event
   * - GET /stats - Get current stats
   * - GET /data - Get full aggregated data
   * - GET /memory - Get memory statistics
   * - POST /cleanup - Trigger cleanup
   */
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    try {
      // POST /event - Add event
      if (request.method === 'POST' && url.pathname === '/event') {
        const data: RealtimeEvent = await request.json();
        await this.addEvent(data);
        return new Response(JSON.stringify({ success: true }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // GET /stats - Get statistics
      if (request.method === 'GET' && url.pathname === '/stats') {
        const stats = await this.getStats();
        return new Response(JSON.stringify(stats), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // GET /data - Get full aggregated data
      if (request.method === 'GET' && url.pathname === '/data') {
        const data = await this.getAggregatedData();
        return new Response(JSON.stringify(data), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // GET /memory - Get memory statistics
      if (request.method === 'GET' && url.pathname === '/memory') {
        const memStats = await this.getMemoryStats();
        return new Response(JSON.stringify(memStats), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // POST /cleanup - Trigger cleanup
      if (request.method === 'POST' && url.pathname === '/cleanup') {
        const cleaned = await this.cleanupOldWindows();
        return new Response(JSON.stringify({ cleaned }), {
          headers: { 'Content-Type': 'application/json' },
        });
      }

      return new Response('Not Found', { status: 404 });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return new Response(JSON.stringify({ error: message }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }
  }

  /**
   * Get current window timestamp
   * Window = floor(now / windowSize) * windowSize
   * This ensures all times within a 5-min period map to same window
   */
  private getCurrentWindow(): number {
    const now = Date.now();
    return Math.floor(now / this.windowSize) * this.windowSize;
  }

  /**
   * Estimate memory usage in MB for given number of events
   * Uses conservative estimate of 500 bytes per event
   *
   * @param eventCount - Number of events in memory
   * @returns Estimated memory usage in MB
   */
  private estimateMemoryUsage(eventCount: number): number {
    const bytes = eventCount * RealtimeAggregator.APPROX_EVENT_SIZE_BYTES;
    return Math.round((bytes / (1024 * 1024)) * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Get memory statistics for current window
   * Used for monitoring and debugging
   *
   * @returns Memory stats including event count, estimated size, and limit
   */
  private async getMemoryStats(): Promise<{
    eventCount: number;
    estimatedMemoryMB: number;
    maxEvents: number;
    utilizationPercent: number;
  }> {
    const currentWindow = this.getCurrentWindow();
    const key = `window:${currentWindow}`;
    const events = (await this.state.storage.get<RealtimeEvent[]>(key)) || [];

    const eventCount = events.length;
    const estimatedMemoryMB = this.estimateMemoryUsage(eventCount);
    const maxEvents = RealtimeAggregator.MAX_EVENTS_PER_WINDOW;
    const utilizationPercent =
      Math.round((eventCount / maxEvents) * 100 * 100) / 100;

    return {
      eventCount,
      estimatedMemoryMB,
      maxEvents,
      utilizationPercent,
    };
  }

  /**
   * Serialize async operations to prevent race conditions
   * Implements a simple promise-based mutex lock pattern
   *
   * @param operation - Async function to execute atomically
   * @returns Promise that resolves with the operation result
   */
  private async withLock<T>(operation: () => Promise<T>): Promise<T> {
    // Chain the new operation after the current lock
    const previousLock = this.operationLock;

    // Create a new lock that will be released when the operation completes
    let releaseLock: () => void;
    this.operationLock = new Promise<void>((resolve) => {
      releaseLock = resolve;
    });

    try {
      // Wait for previous operations to complete
      await previousLock;

      // Execute the operation
      return await operation();
    } finally {
      // Release the lock so next operation can proceed
      releaseLock!();
    }
  }

  /**
   * Aggregate events into statistics
   * Performs:
   * - Unique visitor counting (deduplication by visitor_id or fingerprint)
   * - Browser/OS/device breakdown
   * - Bot detection and classification
   * - Event type counting
   */
  private aggregateEvents(events: RealtimeEvent[]): RealtimeStats {
    const uniqueVisitors = new Set<string>();
    const browsers: Record<string, number> = {};
    const operatingSystems: Record<string, number> = {};
    const deviceTypes: Record<string, number> = {};
    let botTraffic = 0;
    let humanTraffic = 0;

    for (const event of events) {
      // Track unique visitors (prefer visitor_id, fallback to fingerprint hash)
      const visitorKey = event.visitor_id || event.fingerprint.hash;
      uniqueVisitors.add(visitorKey);

      // Parse User-Agent for browser/OS/device info
      const parsedUA = parseUserAgent(event.user_agent);

      // Browser stats
      const browser = parsedUA.browser.name;
      browsers[browser] = (browsers[browser] || 0) + 1;

      // OS stats
      const os = parsedUA.os.name;
      operatingSystems[os] = (operatingSystems[os] || 0) + 1;

      // Device type stats
      const deviceType = parsedUA.device.type;
      deviceTypes[deviceType] = (deviceTypes[deviceType] || 0) + 1;

      // Bot detection
      const botDetection = detectBot(parsedUA, event.fingerprint);
      if (botDetection.isBot) {
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
