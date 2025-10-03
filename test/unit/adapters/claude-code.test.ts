/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect } from 'vitest';
import { ClaudeCodeAdapter } from '../../../src/adapters/claude-code.js';
import type {
  ClaudeCodeMetric,
  ClaudeCodeEvent,
  OTLPLogs,
  OTLPMetrics,
} from '../../../src/types/index.js';

describe('ClaudeCodeAdapter', () => {
  const adapter = new ClaudeCodeAdapter();

  describe('validate', () => {
    it('should validate metric format', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
      };
      expect(adapter.validate(metric)).toBe(true);
    });

    it('should validate event format', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: { test: 'value' },
      };
      expect(adapter.validate(event)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate({})).toBe(false);
      expect(adapter.validate({ session_id: 'test' })).toBe(false);
      expect(
        adapter.validate({ metric_name: 'test', value: 'not-a-number' })
      ).toBe(false);
    });
  });

  describe('transform - metrics', () => {
    it('should transform basic metric', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
      };

      const result = adapter.transform(metric);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([100]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.metric_name).toBe('claude_code.token.usage');
    });

    it('should include optional metric fields', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
        app_version: '1.0.0',
        organization_id: 'org-123',
        user_account_uuid: 'user-123',
        timestamp: '2024-01-01T00:00:00Z',
        attributes: {
          type: 'input',
          model: 'claude-3',
          tool: 'Edit',
          decision: 'accept',
          language: 'TypeScript',
        },
      };

      const result = adapter.transform(metric);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.app_version).toBe('1.0.0');
      expect(metadata.organization_id).toBe('org-123');
      expect(metadata.user_account_uuid).toBe('user-123');
      expect(metadata.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(metadata.attributes.type).toBe('input');
      expect(metadata.attributes.model).toBe('claude-3');
      expect(metadata.attributes.tool).toBe('Edit');
      expect(metadata.attributes.decision).toBe('accept');
      expect(metadata.attributes.language).toBe('TypeScript');
    });

    it('should handle metrics with partial attributes', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.cost.usage',
        value: 0.05,
        attributes: {
          model: 'claude-3',
        },
      };

      const result = adapter.transform(metric);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([0.05]);

      // Check metadata in blobs[0]
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.attributes.model).toBe('claude-3');
    });
  });

  describe('transform - events', () => {
    it('should transform basic event', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: { prompt_length: 100 },
      };

      const result = adapter.transform(event);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.event_name).toBe('user_prompt');
      expect(metadata.timestamp).toBe('2024-01-01T00:00:00Z');
      expect(metadata.attributes.prompt_length).toBe(100);
    });

    it('should serialize event attributes as JSON', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'tool_result',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: {
          tool_name: 'Read',
          success: true,
          duration_ms: 50,
        },
      };

      const result = adapter.transform(event);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.attributes.tool_name).toBe('Read');
      expect(metadata.attributes.success).toBe(true);
      expect(metadata.attributes.duration_ms).toBe(50);
    });
  });

  describe('edge cases', () => {
    it('should handle empty attributes', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
        attributes: {},
      };

      const result = adapter.transform(metric);
      expect(result).toBeDefined();
    });

    it('should handle very long session IDs', () => {
      const longId = 'a'.repeat(200);
      const metric: ClaudeCodeMetric = {
        session_id: longId,
        metric_name: 'test',
        value: 1,
      };

      const result = adapter.transform(metric);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // Session ID is in metadata, not truncated
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe(longId);
    });
  });

  describe('project_id support', () => {
    it('should include project_id in metric indexes as first element', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 100,
        project_id: 'proj123',
      };

      const result = adapter.transform(metric);

      // Only project_id in indexes
      expect(result.indexes).toEqual(['proj123']);

      // Other fields are in metadata
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.metric_name).toBe('claude_code.token.usage');
    });

    it('should include project_id in event indexes as first element', () => {
      const event: ClaudeCodeEvent = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        project_id: 'proj456',
        attributes: { test: 'value' },
      };

      const result = adapter.transform(event);

      // Only project_id in indexes
      expect(result.indexes).toEqual(['proj456']);

      // Other fields are in metadata
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
      expect(metadata.event_name).toBe('user_prompt');
    });

    it('should work without project_id', () => {
      const metric: ClaudeCodeMetric = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
      };

      const result = adapter.transform(metric);

      // No project_id means empty indexes
      expect(result.indexes).toEqual([]);

      // Data is in metadata
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.session_id).toBe('session-123');
    });
  });

  describe('OTLP Logs format', () => {
    it('should validate OTLP logs format', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'claude-code' } },
                { key: 'service.version', value: { stringValue: '1.0.0' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'claude-code' },
                logRecords: [
                  {
                    timeUnixNano: '1704067200000000000',
                    severityText: 'INFO',
                    body: { stringValue: 'User prompt submitted' },
                    attributes: [
                      {
                        key: 'session.id',
                        value: { stringValue: 'session-123' },
                      },
                      { key: 'user.id', value: { stringValue: 'user-456' } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      expect(adapter.validate(otlpLogs)).toBe(true);
    });

    it('should transform OTLP logs with resource attributes', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'claude-code' } },
                { key: 'service.version', value: { stringValue: '1.0.0' } },
                { key: 'host.arch', value: { stringValue: 'arm64' } },
                { key: 'os.type', value: { stringValue: 'darwin' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'claude-code' },
                logRecords: [
                  {
                    timeUnixNano: '1704067200000000000',
                    severityText: 'INFO',
                    body: { stringValue: 'User prompt submitted' },
                    attributes: [
                      {
                        key: 'session.id',
                        value: { stringValue: 'session-123' },
                      },
                      { key: 'prompt.length', value: { intValue: 150 } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      adapter.setProjectId('test-project');
      const result = adapter.transform(otlpLogs);

      expect(result.indexes).toEqual(['test-project']);
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.data_type).toBe('otlp_logs');
      expect(metadata.format).toBe('otlp');
      expect(metadata.resource['service.name']).toBe('claude-code');
      expect(metadata.resource['service.version']).toBe('1.0.0');
      expect(metadata.resource['host.arch']).toBe('arm64');
      expect(metadata.resource['os.type']).toBe('darwin');
      expect(metadata.logs).toBeDefined();
      expect(metadata.logs.length).toBe(1);
      expect(metadata.logs[0].timestamp).toBe('1704067200000000000');
      expect(metadata.logs[0].severity).toBe('INFO');
      expect(metadata.logs[0].body).toBe('User prompt submitted');
      expect(metadata.logs[0].attributes['session.id']).toBe('session-123');
      expect(metadata.logs[0].attributes['prompt.length']).toBe(150);
    });

    it('should handle multiple log records', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'claude-code' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'claude-code' },
                logRecords: [
                  {
                    timeUnixNano: '1704067200000000000',
                    severityText: 'INFO',
                    body: { stringValue: 'Log 1' },
                    attributes: [],
                  },
                  {
                    timeUnixNano: '1704067201000000000',
                    severityText: 'WARN',
                    body: { stringValue: 'Log 2' },
                    attributes: [],
                  },
                  {
                    timeUnixNano: '1704067202000000000',
                    severityText: 'ERROR',
                    body: { stringValue: 'Log 3' },
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      const result = adapter.transform(otlpLogs);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.logs.length).toBe(3);
      expect(metadata.logs[0].body).toBe('Log 1');
      expect(metadata.logs[1].body).toBe('Log 2');
      expect(metadata.logs[2].body).toBe('Log 3');
    });

    it('should handle log body with different value types', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: { attributes: [] },
            scopeLogs: [
              {
                scope: { name: 'test' },
                logRecords: [
                  {
                    timeUnixNano: '1704067200000000000',
                    severityText: 'INFO',
                    body: { intValue: 42 },
                    attributes: [],
                  },
                  {
                    timeUnixNano: '1704067201000000000',
                    severityText: 'INFO',
                    body: { doubleValue: 3.14 },
                    attributes: [],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      const result = adapter.transform(otlpLogs);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.logs[0].body).toBe('42');
      expect(metadata.logs[1].body).toBe('3.14');
    });

    it('should handle missing optional fields', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            scopeLogs: [
              {
                logRecords: [
                  {
                    timeUnixNano: '1704067200000000000',
                    body: { stringValue: 'Minimal log' },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      const result = adapter.transform(otlpLogs);

      expect(result.blobs).toBeDefined();
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.logs[0].body).toBe('Minimal log');
    });
  });

  describe('OTLP Metrics format', () => {
    it('should validate OTLP metrics format', () => {
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
                scope: { name: 'claude-code' },
                metrics: [
                  {
                    name: 'claude_code.token.usage',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 1000,
                          timeUnixNano: '1704067200000000000',
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
      } as unknown as OTLPMetrics;

      expect(adapter.validate(otlpMetrics)).toBe(true);
    });

    it('should transform OTLP metrics with gauge', () => {
      const otlpMetrics = {
        resourceMetrics: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'claude-code' } },
                { key: 'service.version', value: { stringValue: '1.0.0' } },
              ],
            },
            scopeMetrics: [
              {
                scope: { name: 'claude-code' },
                metrics: [
                  {
                    name: 'claude_code.token.usage',
                    unit: 'tokens',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 1500,
                          timeUnixNano: '1704067200000000000',
                          attributes: [
                            { key: 'type', value: { stringValue: 'input' } },
                            {
                              key: 'model',
                              value: { stringValue: 'claude-sonnet-4-5' },
                            },
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
      } as unknown as OTLPMetrics;

      adapter.setProjectId('metrics-project');
      const result = adapter.transform(otlpMetrics);

      expect(result.indexes).toEqual(['metrics-project']);
      expect(result.doubles).toEqual([1500]);
      expect(result.blobs).toBeDefined();

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.data_type).toBe('otlp_metrics');
      expect(metadata.format).toBe('otlp');
      expect(metadata.resource['service.name']).toBe('claude-code');
      expect(metadata.resource['service.version']).toBe('1.0.0');
      expect(metadata.metrics).toBeDefined();
      expect(metadata.metrics.length).toBe(1);
      expect(metadata.metrics[0].name).toBe('claude_code.token.usage');
      expect(metadata.metrics[0].value).toBe(1500);
      expect(metadata.metrics[0].unit).toBe('tokens');
      expect(metadata.metrics[0].attributes.type).toBe('input');
      expect(metadata.metrics[0].attributes.model).toBe('claude-sonnet-4-5');
    });

    it('should transform OTLP metrics with sum', () => {
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
                scope: { name: 'claude-code' },
                metrics: [
                  {
                    name: 'claude_code.cost',
                    unit: 'USD',
                    sum: {
                      dataPoints: [
                        {
                          asDouble: 0.05,
                          timeUnixNano: '1704067200000000000',
                          attributes: [
                            {
                              key: 'model',
                              value: { stringValue: 'claude-sonnet-4-5' },
                            },
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
      } as unknown as OTLPMetrics;

      const result = adapter.transform(otlpMetrics);

      expect(result.doubles).toEqual([0.05]);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.metrics[0].name).toBe('claude_code.cost');
      expect(metadata.metrics[0].value).toBe(0.05);
      expect(metadata.metrics[0].unit).toBe('USD');
    });

    it('should handle metrics with asInt value', () => {
      const otlpMetrics = {
        resourceMetrics: [
          {
            resource: { attributes: [] },
            scopeMetrics: [
              {
                scope: { name: 'test' },
                metrics: [
                  {
                    name: 'test.counter',
                    gauge: {
                      dataPoints: [
                        {
                          asInt: 42,
                          timeUnixNano: '1704067200000000000',
                          attributes: [],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPMetrics;

      const result = adapter.transform(otlpMetrics);

      expect(result.doubles).toEqual([42]);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.metrics[0].value).toBe(42);
    });

    it('should handle multiple metrics', () => {
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
                scope: { name: 'claude-code' },
                metrics: [
                  {
                    name: 'tokens.input',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 1000,
                          timeUnixNano: '1704067200000000000',
                          attributes: [],
                        },
                      ],
                    },
                  },
                  {
                    name: 'tokens.output',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 500,
                          timeUnixNano: '1704067201000000000',
                          attributes: [],
                        },
                      ],
                    },
                  },
                  {
                    name: 'tokens.cache_read',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 200,
                          timeUnixNano: '1704067202000000000',
                          attributes: [],
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPMetrics;

      const result = adapter.transform(otlpMetrics);

      // Total value is sum of all metrics (stored in doubles)
      expect(result.doubles).toEqual([1700]);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.metrics.length).toBe(3);
      expect(metadata.metrics[0].name).toBe('tokens.input');
      expect(metadata.metrics[0].value).toBe(1000);
      expect(metadata.metrics[1].name).toBe('tokens.output');
      expect(metadata.metrics[1].value).toBe(500);
      expect(metadata.metrics[2].name).toBe('tokens.cache_read');
      expect(metadata.metrics[2].value).toBe(200);
    });

    it('should handle metrics with multiple data points', () => {
      const otlpMetrics = {
        resourceMetrics: [
          {
            resource: { attributes: [] },
            scopeMetrics: [
              {
                scope: { name: 'test' },
                metrics: [
                  {
                    name: 'test.metric',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 10,
                          timeUnixNano: '1704067200000000000',
                          attributes: [
                            { key: 'label', value: { stringValue: 'a' } },
                          ],
                        },
                        {
                          asDouble: 20,
                          timeUnixNano: '1704067201000000000',
                          attributes: [
                            { key: 'label', value: { stringValue: 'b' } },
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
      } as unknown as OTLPMetrics;

      const result = adapter.transform(otlpMetrics);

      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.metrics.length).toBe(2);
      expect(metadata.metrics[0].attributes.label).toBe('a');
      expect(metadata.metrics[1].attributes.label).toBe('b');
    });

    it('should handle missing optional fields', () => {
      const otlpMetrics = {
        resourceMetrics: [
          {
            scopeMetrics: [
              {
                metrics: [
                  {
                    name: 'minimal.metric',
                    gauge: {
                      dataPoints: [
                        {
                          asDouble: 100,
                          timeUnixNano: '1704067200000000000',
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPMetrics;

      const result = adapter.transform(otlpMetrics);

      expect(result.doubles).toEqual([100]);
      const metadata = JSON.parse(result.blobs![0]!);
      expect(metadata.metrics[0].name).toBe('minimal.metric');
    });

    it('should handle logs with missing timestamps (fallback to Date.now)', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'test-scope' },
                logRecords: [
                  {
                    // No timeUnixNano or observedTimeUnixNano
                    body: { stringValue: 'log without timestamp' },
                    severityText: 'INFO',
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      const result = adapter.transform(otlpLogs);
      const metadata = JSON.parse(result.blobs![0]!);

      // Should use Date.now() fallback
      expect(metadata.logs[0].timestamp).toBeDefined();
      expect(typeof metadata.logs[0].timestamp).toBe('string');
    });

    it('should handle logs with observedTimeUnixNano as string', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test' } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'test-scope' },
                logRecords: [
                  {
                    // No timeUnixNano, use observedTimeUnixNano as string
                    observedTimeUnixNano: '1704067200000000000',
                    body: { stringValue: 'log with observed time' },
                    severityText: 'INFO',
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      const result = adapter.transform(otlpLogs);
      const metadata = JSON.parse(result.blobs![0]!);

      // Should use observedTimeUnixNano
      expect(metadata.logs[0].timestamp).toBe('1704067200000000000');
    });

    it('should handle metrics with no value (fallback to 0)', () => {
      const otlpMetrics = {
        resourceMetrics: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test' } },
              ],
            },
            scopeMetrics: [
              {
                scope: { name: 'test-scope' },
                metrics: [
                  {
                    name: 'metric.no.value',
                    sum: {
                      dataPoints: [
                        {
                          // No asDouble or asInt
                          timeUnixNano: '1704067200000000000',
                        },
                      ],
                    },
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPMetrics;

      const result = adapter.transform(otlpMetrics);

      // Should use 0 as fallback
      expect(result.doubles).toEqual([0]);
    });

    it('should handle attributes with doubleValue and boolValue', () => {
      const otlpLogs = {
        resourceLogs: [
          {
            resource: {
              attributes: [
                { key: 'service.name', value: { stringValue: 'test' } },
                { key: 'metric.value', value: { doubleValue: 123.45 } },
                { key: 'is.enabled', value: { boolValue: true } },
              ],
            },
            scopeLogs: [
              {
                scope: { name: 'test-scope' },
                logRecords: [
                  {
                    timeUnixNano: '1704067200000000000',
                    body: { stringValue: 'test log' },
                    severityText: 'INFO',
                    attributes: [
                      { key: 'double.attr', value: { doubleValue: 99.99 } },
                      { key: 'bool.attr', value: { boolValue: false } },
                    ],
                  },
                ],
              },
            ],
          },
        ],
      } as unknown as OTLPLogs;

      const result = adapter.transform(otlpLogs);
      const metadata = JSON.parse(result.blobs![0]!);

      // Check resource attributes
      expect(metadata.resource['metric.value']).toBe(123.45);
      expect(metadata.resource['is.enabled']).toBe(true);

      // Check log attributes
      expect(metadata.logs[0].attributes['double.attr']).toBe(99.99);
      expect(metadata.logs[0].attributes['bool.attr']).toBe(false);
    });
  });
});
