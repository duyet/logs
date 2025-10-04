import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';
import {
  googleAnalyticsDataSchema,
  type GoogleAnalyticsData,
} from '../schemas/index.js';

/**
 * Adapter for Google Analytics GA4 Measurement Protocol format
 */
export class GoogleAnalyticsAdapter extends BaseAdapter<GoogleAnalyticsData> {
  /**
   * Validate input data using Zod schema
   */
  validate(data: unknown): data is GoogleAnalyticsData {
    const result = googleAnalyticsDataSchema.safeParse(data);
    return result.success;
  }

  transform(data: GoogleAnalyticsData): AnalyticsEngineDataPoint {
    // Analytics Engine supports max 1 index - use project_id for filtering
    const indexes: string[] = data.project_id
      ? [this.toIndex(data.project_id)]
      : [];

    // Store all metadata in blobs as JSON
    const metadata = {
      client_id: data.client_id,
      user_id: data.user_id,
      timestamp_micros: data.timestamp_micros,
      user_properties: data.user_properties,
      events: data.events,
    };

    const blobs: string[] = [this.toBlob(JSON.stringify(metadata))];
    const doubles: number[] = [data.events.length];

    return { indexes, blobs, doubles };
  }
}
