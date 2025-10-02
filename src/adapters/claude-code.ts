import { BaseAdapter } from './base.js';
import type {
  AnalyticsEngineDataPoint,
  ClaudeCodeData,
  ClaudeCodeMetric,
  ClaudeCodeEvent,
} from '../types/index.js';

/**
 * Adapter for Claude Code OpenTelemetry format
 */
export class ClaudeCodeAdapter extends BaseAdapter<ClaudeCodeData> {
  validate(data: unknown): data is ClaudeCodeData {
    if (!this.isObject(data)) {
      return false;
    }

    // Check if it's a metric
    if ('metric_name' in data && 'value' in data) {
      return (
        this.isString(data.session_id) &&
        this.isString(data.metric_name) &&
        this.isNumber(data.value)
      );
    }

    // Check if it's an event
    if ('event_name' in data) {
      return (
        this.isString(data.event_name) &&
        this.isString(data.timestamp) &&
        this.isString(data.session_id) &&
        this.isObject(data.attributes)
      );
    }

    return false;
  }

  transform(data: ClaudeCodeData): AnalyticsEngineDataPoint {
    if (this.isMetric(data)) {
      return this.transformMetric(data);
    }
    return this.transformEvent(data);
  }

  private isMetric(data: ClaudeCodeData): data is ClaudeCodeMetric {
    return 'metric_name' in data && 'value' in data;
  }

  private transformMetric(metric: ClaudeCodeMetric): AnalyticsEngineDataPoint {
    // Analytics Engine supports max 1 index - use project_id for filtering
    const indexes: string[] = metric.project_id
      ? [this.toIndex(metric.project_id)]
      : [];

    // Store all metadata in blobs as JSON
    const metadata = {
      session_id: metric.session_id,
      metric_name: metric.metric_name,
      app_version: metric.app_version,
      organization_id: metric.organization_id,
      user_account_uuid: metric.user_account_uuid,
      timestamp: metric.timestamp,
      attributes: metric.attributes,
    };

    const blobs: string[] = [this.toBlob(JSON.stringify(metadata))];
    const doubles: number[] = [metric.value];

    return { indexes, blobs, doubles };
  }

  private transformEvent(event: ClaudeCodeEvent): AnalyticsEngineDataPoint {
    // Analytics Engine supports max 1 index - use project_id for filtering
    const indexes: string[] = event.project_id
      ? [this.toIndex(event.project_id)]
      : [];

    // Store all metadata in blobs as JSON
    const metadata = {
      session_id: event.session_id,
      event_name: event.event_name,
      timestamp: event.timestamp,
      attributes: event.attributes,
    };

    const blobs: string[] = [this.toBlob(JSON.stringify(metadata))];
    const doubles: number[] = [];

    return { indexes, blobs, doubles };
  }
}
