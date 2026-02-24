import type { Env } from '../types/index.js';
import type { SelfTrackingRequestData } from '../types/self-tracking.js';
import { SelfTrackingAdapter } from '../adapters/self-tracking.js';
import { AnalyticsEngineService } from './analytics-engine.js';

/**
 * Service for writing self-tracking analytics data
 * Non-blocking writes to Analytics Engine and Durable Object
 */
export class SelfTrackingService {
  private readonly adapter: SelfTrackingAdapter;
  private readonly analyticsService: AnalyticsEngineService;

  constructor() {
    this.adapter = new SelfTrackingAdapter();
    this.analyticsService = new AnalyticsEngineService();
  }

  /**
   * Check if self-tracking is enabled
   * @param env Environment bindings
   * @returns true if enabled, false otherwise
   */
  isEnabled(env: Env): boolean {
    // Check for ENABLE_SELF_TRACKING environment variable
    const enabledVar = env.ENABLE_SELF_TRACKING;
    if (enabledVar === undefined) {
      return false; // Disabled by default
    }

    // Parse boolean value (supports "true", "1", "yes")
    const enabled = ['true', '1', 'yes'].includes(enabledVar.toLowerCase());
    return enabled;
  }

  /**
   * Check if SELF_TRACKING_ANALYTICS dataset is available
   * @param env Environment bindings
   * @returns true if dataset binding exists, false otherwise
   */
  hasDataset(env: Env): boolean {
    return (
      'SELF_TRACKING_ANALYTICS' in env &&
      env.SELF_TRACKING_ANALYTICS !== undefined
    );
  }

  /**
   * Track a request to Analytics Engine
   * Non-blocking operation using waitUntil
   * @param env Environment bindings
   * @param data Request data to track
   * @param waitUntil Function to register async work (from ExecutionContext)
   */
  trackRequest(
    env: Env,
    data: SelfTrackingRequestData,
    waitUntil?: (promise: Promise<unknown>) => void
  ): void {
    // Check if self-tracking is enabled
    if (!this.isEnabled(env)) {
      return;
    }

    // Check if dataset binding exists
    if (!this.hasDataset(env)) {
      console.warn('[Self-Tracking] SELF_TRACKING_ANALYTICS binding not found');
      return;
    }

    // Set project_id on adapter if available
    if (data.project_id) {
      this.adapter.setProjectId(data.project_id);
    }

    // Create async write operation
    const writePromise = Promise.resolve().then(async () => {
      const result = await this.analyticsService.writeDataPoint(
        env,
        'SELF_TRACKING_ANALYTICS',
        this.adapter,
        data
      );

      if (!result.success) {
        console.error(
          '[Self-Tracking] Failed to write to Analytics Engine:',
          result.error
        );
      }

      return result;
    });

    // Register async work if waitUntil is available
    if (waitUntil) {
      waitUntil(writePromise);
    } else {
      // Fallback: fire and forget (for testing)
      writePromise.catch((error) => {
        console.error('[Self-Tracking] Unexpected error:', error);
      });
    }
  }

  /**
   * Increment Durable Object statistics
   * Non-blocking operation using waitUntil
   * @param env Environment bindings
   * @param data Request data to track
   * @param waitUntil Function to register async work (from ExecutionContext)
   */
  incrementStats(
    env: Env,
    data: SelfTrackingRequestData,
    waitUntil?: (promise: Promise<unknown>) => void
  ): void {
    // Check if self-tracking is enabled
    if (!this.isEnabled(env)) {
      return;
    }

    // Check if Durable Object binding exists
    if (!env.SELF_TRACKING_AGGREGATOR) {
      console.warn(
        '[Self-Tracking] SELF_TRACKING_AGGREGATOR binding not found'
      );
      return;
    }

    // Create async increment operation
    const incrementPromise = this.performIncrement(env, data);

    // Register async work if waitUntil is available
    if (waitUntil) {
      waitUntil(incrementPromise);
    } else {
      // Fallback: fire and forget (for testing)
      incrementPromise.catch((error) => {
        console.error('[Self-Tracking] Durable Object increment error:', error);
      });
    }
  }

  /**
   * Perform Durable Object increment
   * @private
   */
  private async performIncrement(
    env: Env,
    data: SelfTrackingRequestData
  ): Promise<void> {
    try {
      // Get Durable Object stub (using "global" as the ID for single aggregator)
      const id = env.SELF_TRACKING_AGGREGATOR!.idFromName('global');
      const stub = env.SELF_TRACKING_AGGREGATOR!.get(id);

      // Send increment request
      const response = await stub.fetch('https://fake-host/increment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          timestamp: data.timestamp,
          endpoint: data.endpoint,
          method: data.method,
          status: data.status,
          response_time_ms: data.response_time_ms,
          project_id: data.project_id,
          error: data.status >= 400,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(
          '[Self-Tracking] Durable Object increment failed:',
          response.status,
          errorText
        );
      }
    } catch (error) {
      console.error('[Self-Tracking] Durable Object increment error:', error);
    }
  }

  /**
   * Track request with both Analytics Engine and Durable Object
   * Convenience method that calls both trackRequest and incrementStats
   * @param env Environment bindings
   * @param data Request data to track
   * @param waitUntil Function to register async work (from ExecutionContext)
   */
  track(
    env: Env,
    data: SelfTrackingRequestData,
    waitUntil?: (promise: Promise<unknown>) => void
  ): void {
    this.trackRequest(env, data, waitUntil);
    this.incrementStats(env, data, waitUntil);
  }
}
