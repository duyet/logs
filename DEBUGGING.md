# Debugging OTEL Data Not Sent to Logs API

## Issue Summary

Claude Code is not sending telemetry data to the logs API even with the correct configuration.

## Root Cause

**Format Mismatch**: The current adapter expects a simple flat format, but Claude Code sends data in **OpenTelemetry Protocol (OTLP) HTTP/JSON format**, which has a completely different structure.

### Expected Format (Current Adapter)

```json
{
  "session_id": "session-123",
  "metric_name": "claude_code.token.usage",
  "value": 1000
}
```

### Actual Format (OTLP/HTTP JSON)

**Metrics:**

```json
{
  "resourceMetrics": [
    {
      "resource": {
        "attributes": [
          { "key": "service.name", "value": { "stringValue": "claude-code" } },
          { "key": "service.version", "value": { "stringValue": "1.0.0" } }
        ]
      },
      "scopeMetrics": [
        {
          "scope": {
            "name": "claude-code-metrics"
          },
          "metrics": [
            {
              "name": "claude_code.token.usage",
              "unit": "1",
              "sum": {
                "dataPoints": [
                  {
                    "startTimeUnixNano": "1640000000000000000",
                    "timeUnixNano": "1640000100000000000",
                    "asDouble": 1000,
                    "attributes": [
                      { "key": "type", "value": { "stringValue": "input" } },
                      {
                        "key": "model",
                        "value": { "stringValue": "claude-sonnet-4-5" }
                      }
                    ]
                  }
                ]
              }
            }
          ]
        }
      ]
    }
  ]
}
```

**Logs:**

```json
{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [...]
      },
      "scopeLogs": [
        {
          "scope": {
            "name": "claude-code-logs"
          },
          "logRecords": [
            {
              "timeUnixNano": "1640000100000000000",
              "severityNumber": 9,
              "severityText": "INFO",
              "body": {
                "stringValue": "User prompt received"
              },
              "attributes": [
                {"key": "session_id", "value": {"stringValue": "session-123"}},
                {"key": "event_name", "value": {"stringValue": "user_prompt"}}
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

## Debugging Steps

### 1. Check Production Logs

Deploy the debug version (already pushed to production) and check Cloudflare Pages logs:

```bash
# View live logs
wrangler pages deployment tail

# Or check via Cloudflare dashboard:
# https://dash.cloudflare.com → Pages → duyet-logs → Logs
```

Look for these debug messages:

- `[DEBUG] Received data:` - Shows what Claude Code is sending
- `[DEBUG] Data keys:` - Shows top-level keys in the data
- `[ERROR] Validation failed` - Confirms validation is failing

### 2. Expected Debug Output

If Claude Code is sending OTLP format, you should see:

```
[DEBUG] Received data: {"resourceMetrics":[{"resource":{"attributes":[...
[DEBUG] Data keys: [ 'resourceMetrics' ]
[ERROR] Validation failed for data: {"resourceMetrics":[...
```

This confirms the format mismatch.

### 3. Verify Configuration

Ensure your `~/.claude/settings.json` has:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc/duyet",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "https://logs.duyet.net/cc/duyet",
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/json"
  }
}
```

**Important**: The `http/json` protocol means OTLP format, not simple JSON.

## Solution

We need to update the `ClaudeCodeAdapter` to handle OTLP format. Here's the implementation plan:

### 1. Update Types

Add OTLP types to `src/types/index.ts`:

```typescript
// OTLP Metrics Format
export interface OTLPMetrics {
  resourceMetrics: Array<{
    resource?: {
      attributes?: Array<{
        key: string;
        value: { stringValue?: string; intValue?: number; doubleValue?: number };
      }>;
    };
    scopeMetrics: Array<{
      scope?: { name: string };
      metrics: Array<{
        name: string;
        unit?: string;
        sum?: {
          dataPoints: Array<{
            startTimeUnixNano?: string;
            timeUnixNano?: string;
            asDouble?: number;
            asInt?: number;
            attributes?: Array<{
              key: string;
              value: { stringValue?: string; intValue?: number; doubleValue?: number };
            }>;
          }>;
        };
        gauge?: {
          dataPoints: Array<{...}>;
        };
      }>;
    }>;
  }>;
}

// OTLP Logs Format
export interface OTLPLogs {
  resourceLogs: Array<{
    resource?: {
      attributes?: Array<{...}>;
    };
    scopeLogs: Array<{
      scope?: { name: string };
      logRecords: Array<{
        timeUnixNano?: string;
        severityNumber?: number;
        severityText?: string;
        body?: {
          stringValue?: string;
        };
        attributes?: Array<{
          key: string;
          value: { stringValue?: string; intValue?: number };
        }>;
      }>;
    }>;
  }>;
}
```

### 2. Update Adapter

Modify `src/adapters/claude-code.ts` to detect and transform OTLP format:

```typescript
export class ClaudeCodeAdapter extends BaseAdapter<
  ClaudeCodeData | OTLPMetrics | OTLPLogs
> {
  validate(data: unknown): data is ClaudeCodeData | OTLPMetrics | OTLPLogs {
    if (!this.isObject(data)) {
      return false;
    }

    // Check if it's OTLP Metrics format
    if ('resourceMetrics' in data) {
      return this.isArray(data.resourceMetrics);
    }

    // Check if it's OTLP Logs format
    if ('resourceLogs' in data) {
      return this.isArray(data.resourceLogs);
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
    data: ClaudeCodeData | OTLPMetrics | OTLPLogs
  ): AnalyticsEngineDataPoint {
    // Detect format and route to appropriate transformer
    if ('resourceMetrics' in data) {
      return this.transformOTLPMetrics(data as OTLPMetrics);
    }
    if ('resourceLogs' in data) {
      return this.transformOTLPLogs(data as OTLPLogs);
    }
    if (this.isMetric(data as ClaudeCodeData)) {
      return this.transformMetric(data as ClaudeCodeMetric);
    }
    return this.transformEvent(data as ClaudeCodeEvent);
  }

  private transformOTLPMetrics(otlp: OTLPMetrics): AnalyticsEngineDataPoint {
    const projectId = this.getProjectId();
    const indexes: string[] = projectId ? [this.toIndex(projectId)] : [];

    // Extract all metrics and aggregate
    const metrics: any[] = [];
    let totalValue = 0;

    otlp.resourceMetrics.forEach((rm) => {
      rm.scopeMetrics.forEach((sm) => {
        sm.metrics.forEach((metric) => {
          const dataPoints =
            metric.sum?.dataPoints || metric.gauge?.dataPoints || [];
          dataPoints.forEach((dp) => {
            const value = dp.asDouble || dp.asInt || 0;
            totalValue += value;

            // Convert OTLP attributes to simple key-value
            const attributes: Record<string, any> = {};
            dp.attributes?.forEach((attr) => {
              attributes[attr.key] =
                attr.value.stringValue ||
                attr.value.intValue ||
                attr.value.doubleValue;
            });

            metrics.push({
              name: metric.name,
              value: value,
              timestamp: dp.timeUnixNano,
              attributes: attributes,
            });
          });
        });
      });
    });

    const blobs: string[] = [
      this.toBlob(
        JSON.stringify({
          metrics: metrics,
          resource_attributes: this.extractResourceAttributes(
            otlp.resourceMetrics[0]?.resource
          ),
        })
      ),
    ];

    const doubles: number[] = [totalValue];

    return { indexes, blobs, doubles };
  }

  private transformOTLPLogs(otlp: OTLPLogs): AnalyticsEngineDataPoint {
    const projectId = this.getProjectId();
    const indexes: string[] = projectId ? [this.toIndex(projectId)] : [];

    // Extract all log records
    const logs: any[] = [];

    otlp.resourceLogs.forEach((rl) => {
      rl.scopeLogs.forEach((sl) => {
        sl.logRecords.forEach((log) => {
          // Convert OTLP attributes to simple key-value
          const attributes: Record<string, any> = {};
          log.attributes?.forEach((attr) => {
            attributes[attr.key] =
              attr.value.stringValue || attr.value.intValue;
          });

          logs.push({
            timestamp: log.timeUnixNano,
            severity: log.severityText || log.severityNumber,
            body: log.body?.stringValue,
            attributes: attributes,
          });
        });
      });
    });

    const blobs: string[] = [
      this.toBlob(
        JSON.stringify({
          logs: logs,
          resource_attributes: this.extractResourceAttributes(
            otlp.resourceLogs[0]?.resource
          ),
        })
      ),
    ];

    return { indexes, blobs, doubles: [] };
  }

  private extractResourceAttributes(resource: any): Record<string, any> {
    const attrs: Record<string, any> = {};
    resource?.attributes?.forEach((attr: any) => {
      attrs[attr.key] =
        attr.value.stringValue || attr.value.intValue || attr.value.doubleValue;
    });
    return attrs;
  }

  // Keep existing methods for backward compatibility
  private isMetric(data: ClaudeCodeData): data is ClaudeCodeMetric {
    return 'metric_name' in data && 'value' in data;
  }

  private transformMetric(metric: ClaudeCodeMetric): AnalyticsEngineDataPoint {
    // ... existing implementation
  }

  private transformEvent(event: ClaudeCodeEvent): AnalyticsEngineDataPoint {
    // ... existing implementation
  }
}
```

### 3. Add Tests

Create tests for OTLP format in `test/unit/adapters/claude-code.test.ts`:

```typescript
describe('OTLP Metrics Format', () => {
  it('should validate OTLP metrics format', () => {
    const otlpMetrics = {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: [
                {
                  name: 'claude_code.token.usage',
                  sum: {
                    dataPoints: [
                      {
                        asDouble: 1000,
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(adapter.validate(otlpMetrics)).toBe(true);
  });

  it('should transform OTLP metrics to Analytics Engine format', () => {
    const otlpMetrics = {
      resourceMetrics: [
        {
          resource: {
            attributes: [
              { key: 'service.name', value: { stringValue: 'claude-code' } },
            ],
          },
          scopeMetrics: [
            {
              metrics: [
                {
                  name: 'claude_code.token.usage',
                  sum: {
                    dataPoints: [
                      {
                        asDouble: 1000,
                        attributes: [
                          { key: 'type', value: { stringValue: 'input' } },
                        ],
                      },
                    ],
                  },
                },
              ],
            },
          ],
        },
      ],
    };

    adapter.setProjectId('testproject');
    const result = adapter.transform(otlpMetrics);

    expect(result.indexes).toEqual(['testproject']);
    expect(result.doubles).toEqual([1000]);
    expect(result.blobs).toHaveLength(1);
  });
});

describe('OTLP Logs Format', () => {
  it('should validate OTLP logs format', () => {
    const otlpLogs = {
      resourceLogs: [
        {
          scopeLogs: [
            {
              logRecords: [
                {
                  body: { stringValue: 'test' },
                },
              ],
            },
          ],
        },
      ],
    };
    expect(adapter.validate(otlpLogs)).toBe(true);
  });
});
```

## Next Steps

1. **Immediate**: Check production logs to confirm OTLP format is being sent
2. **Short-term**: Implement OTLP adapter updates (estimated: 2-3 hours)
3. **Testing**: Add comprehensive tests for OTLP format (100% coverage)
4. **Deploy**: Deploy updated adapter to production
5. **Verify**: Confirm Claude Code telemetry is being recorded

## Verification

After implementing the fix, verify it works:

```bash
# 1. Check logs for successful writes
wrangler pages deployment tail

# Expected output:
# [DEBUG] Received data: {"resourceMetrics":[...
# [DEBUG] Data keys: [ 'resourceMetrics' ]
# [DEBUG] Validation passed, transforming...
# [DEBUG] Writing to Analytics Engine...
# [DEBUG] Successfully written to Analytics Engine

# 2. Query Analytics Engine to see data
# (Use Cloudflare dashboard or GraphQL API)
```

## References

- [OpenTelemetry Protocol Specification](https://github.com/open-telemetry/opentelemetry-proto)
- [OTLP/HTTP JSON Encoding](https://github.com/open-telemetry/opentelemetry-proto/blob/main/docs/specification.md#otlphttp)
- [Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)

## Files Modified

- `src/utils/route-handler.ts` - Added debug logging to POST handler
- `src/services/analytics-engine.ts` - Added debug logging to validation and write operations

## Commit

```
debug: add logging to track OTEL data format (b86810b)
```
