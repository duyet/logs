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
 *
 * Storage keys:
 * - `window:{timestamp}` → RealtimeEvent[] (events for that window)
 *
 * Window calculation:
 * - Window size: 5 minutes (300,000ms)
 * - Current window = floor(now / windowSize) * windowSize
 * - This ensures all requests in same 5-min period use same window
 */
export class RealtimeAggregator implements DurableObject {
  private state: DurableObjectState;
  private windowSize = 5 * 60 * 1000; // 5 minutes in milliseconds
  private operationLock: Promise<void> = Promise.resolve();

  constructor(state: DurableObjectState) {
    this.state = state;
  }

  /**
   * Add event to current window
   * Events are stored in Durable Object storage under window-specific keys
   * Uses serialization lock to prevent race conditions with cleanup
   */
  async addEvent(event: RealtimeEvent): Promise<void> {
    return this.withLock(async () => {
      const currentWindow = this.getCurrentWindow();
      const key = `window:${currentWindow}`;

      // Get existing events for this window
      const events = (await this.state.storage.get<RealtimeEvent[]>(key)) || [];

      // Add new event
      events.push(event);

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
