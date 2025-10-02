import { BaseAdapter } from './base.js';
import type {
  AnalyticsEngineDataPoint,
  GoogleAnalyticsData,
} from '../types/index.js';

/**
 * Adapter for Google Analytics GA4 Measurement Protocol format
 */
export class GoogleAnalyticsAdapter extends BaseAdapter<GoogleAnalyticsData> {
  validate(data: unknown): data is GoogleAnalyticsData {
    if (!this.isObject(data)) {
      return false;
    }

    return (
      this.isString(data.client_id) &&
      Array.isArray(data.events) &&
      data.events.length > 0 &&
      data.events.every(
        (event) =>
          this.isObject(event) &&
          this.isString(event.name) &&
          (event.params === undefined || this.isObject(event.params))
      )
    );
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
