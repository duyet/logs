import { BaseAdapter } from './base.js';
import type {
  AnalyticsEngineDataPoint,
  ClaudeCodeData,
  ClaudeCodeMetric,
  ClaudeCodeEvent,
  OTLPLogs,
  OTLPMetrics,
  IKeyValue,
} from '../types/index.js';

/**
 * Adapter for Claude Code OpenTelemetry format
 * Supports both legacy simple format and OTLP/HTTP JSON format
 */
export class ClaudeCodeAdapter extends BaseAdapter<
  ClaudeCodeData | OTLPLogs | OTLPMetrics
> {
  validate(data: unknown): data is ClaudeCodeData | OTLPLogs | OTLPMetrics {
    if (!this.isObject(data)) {
      return false;
    }

    // Check if it's OTLP Logs format
    if ('resourceLogs' in data) {
      return this.isArray(data.resourceLogs);
    }

    // Check if it's OTLP Metrics format
    if ('resourceMetrics' in data) {
      return this.isArray(data.resourceMetrics);
    }

    // Check if it's legacy simple format (metric)
    if ('metric_name' in data && 'value' in data) {
      return (
        this.isString(data.session_id) &&
        this.isString(data.metric_name) &&
        this.isNumber(data.value)
      );
    }

    // Check if it's legacy simple format (event)
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

  transform(
    data: ClaudeCodeData | OTLPLogs | OTLPMetrics
  ): AnalyticsEngineDataPoint {
    // Detect format and route to appropriate transformer
    if ('resourceLogs' in data) {
      return this.transformOTLPLogs(data);
    }
    if ('resourceMetrics' in data) {
      return this.transformOTLPMetrics(data);
    }
    if (this.isMetric(data as ClaudeCodeData)) {
      return this.transformMetric(data as ClaudeCodeMetric);
    }
    return this.transformEvent(data as ClaudeCodeEvent);
  }

  private isMetric(data: ClaudeCodeData): data is ClaudeCodeMetric {
    return 'metric_name' in data && 'value' in data;
  }

  private transformMetric(metric: ClaudeCodeMetric): AnalyticsEngineDataPoint {
    // Analytics Engine supports max 1 index - use project_id for filtering
    const indexes: string[] = metric.project_id
      ? [this.toIndex(metric.project_id)]
      : [];

    // Store all metadata in blobs as JSON with type classification
    const metadata = {
      data_type: 'legacy_metric', // Classification field
      format: 'simple',
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

    // Store all metadata in blobs as JSON with type classification
    const metadata = {
      data_type: 'legacy_event', // Classification field
      format: 'simple',
      session_id: event.session_id,
      event_name: event.event_name,
      timestamp: event.timestamp,
      attributes: event.attributes,
    };

    const blobs: string[] = [this.toBlob(JSON.stringify(metadata))];
    const doubles: number[] = [];

    return { indexes, blobs, doubles };
  }

  /**
   * Transform OTLP Logs format to Analytics Engine format
   */
  private transformOTLPLogs(otlp: OTLPLogs): AnalyticsEngineDataPoint {
    const projectId = this.getProjectId();
    const indexes: string[] = projectId ? [this.toIndex(projectId)] : [];

    // Extract all log records and resource attributes
    const logs: Array<{
      timestamp: string;
      severity?: string | number;
      body?: string;
      attributes: Record<string, string | number | boolean>;
      scope?: string;
    }> = [];

    let resourceAttrs: Record<string, string | number | boolean> = {};

    otlp.resourceLogs?.forEach((rl) => {
      // Extract resource attributes (service.name, service.version, etc.)
      if (rl.resource) {
        resourceAttrs = this.extractAttributes(rl.resource.attributes || []);
      }

      // Process each scope's log records
      rl.scopeLogs?.forEach((sl) => {
        const scopeName = sl.scope?.name;

        sl.logRecords?.forEach((log) => {
          const attrs = this.extractAttributes(log.attributes || []);

          logs.push({
            timestamp:
              (typeof log.timeUnixNano === 'string'
                ? log.timeUnixNano
                : typeof log.timeUnixNano === 'number'
                  ? String(log.timeUnixNano)
                  : '') ||
              (typeof log.observedTimeUnixNano === 'string'
                ? log.observedTimeUnixNano
                : typeof log.observedTimeUnixNano === 'number'
                  ? String(log.observedTimeUnixNano)
                  : '') ||
              Date.now().toString(),
            severity: log.severityText || log.severityNumber,
            body:
              log.body?.stringValue ||
              log.body?.intValue?.toString() ||
              log.body?.doubleValue?.toString(),
            attributes: attrs,
            scope: scopeName,
          });
        });
      });
    });

    // Store everything in blobs with type classification
    const metadata = {
      data_type: 'otlp_logs', // Classification field
      format: 'otlp',
      resource: resourceAttrs,
      logs: logs,
      timestamp: new Date().toISOString(),
    };

    const blobs: string[] = [this.toBlob(JSON.stringify(metadata))];

    return { indexes, blobs, doubles: [] };
  }

  /**
   * Transform OTLP Metrics format to Analytics Engine format
   */
  private transformOTLPMetrics(otlp: OTLPMetrics): AnalyticsEngineDataPoint {
    const projectId = this.getProjectId();
    const indexes: string[] = projectId ? [this.toIndex(projectId)] : [];

    // Extract all metrics and resource attributes
    const metrics: Array<{
      name: string;
      value: number;
      timestamp: string;
      attributes: Record<string, string | number | boolean>;
      unit?: string;
      scope?: string;
    }> = [];

    let resourceAttrs: Record<string, string | number | boolean> = {};
    let totalValue = 0;

    otlp.resourceMetrics?.forEach((rm) => {
      // Extract resource attributes
      if (rm.resource) {
        resourceAttrs = this.extractAttributes(rm.resource.attributes || []);
      }

      // Process each scope's metrics
      rm.scopeMetrics?.forEach((sm) => {
        const scopeName = sm.scope?.name;

        sm.metrics?.forEach((metric) => {
          // Extract data points from sum, gauge, or histogram
          const dataPoints =
            metric.sum?.dataPoints || metric.gauge?.dataPoints || [];

          dataPoints.forEach((dp) => {
            const value =
              ('asDouble' in dp ? dp.asDouble : undefined) ||
              ('asInt' in dp ? dp.asInt : undefined) ||
              0;
            totalValue += value;

            const attrs = this.extractAttributes(dp.attributes || []);

            metrics.push({
              name: metric.name,
              value: value,
              timestamp:
                (typeof dp.timeUnixNano === 'string'
                  ? dp.timeUnixNano
                  : typeof dp.timeUnixNano === 'number'
                    ? String(dp.timeUnixNano)
                    : '') || Date.now().toString(),
              attributes: attrs,
              unit: metric.unit,
              scope: scopeName,
            });
          });
        });
      });
    });

    // Store everything in blobs with type classification
    const metadata = {
      data_type: 'otlp_metrics', // Classification field
      format: 'otlp',
      resource: resourceAttrs,
      metrics: metrics,
      timestamp: new Date().toISOString(),
    };

    const blobs: string[] = [this.toBlob(JSON.stringify(metadata))];
    const doubles: number[] = [totalValue];

    return { indexes, blobs, doubles };
  }

  /**
   * Extract attributes from OTLP KeyValue array to simple object
   */
  private extractAttributes(
    attrs: IKeyValue[]
  ): Record<string, string | number | boolean> {
    const result: Record<string, string | number | boolean> = {};

    attrs.forEach((attr) => {
      const value =
        attr.value.stringValue ??
        attr.value.intValue ??
        attr.value.doubleValue ??
        attr.value.boolValue;

      if (value !== undefined && value !== null) {
        result[attr.key] = value;
      }
    });

    return result;
  }
}
