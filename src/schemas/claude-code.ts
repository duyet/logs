import { z } from 'zod';
import {
  sessionIdSchema,
  projectIdSchema,
  timestampSchema,
  validNumberSchema,
  safeStringSchema,
  safeObjectSchema,
} from './common.js';

/**
 * Claude Code metric attributes schema
 */
export const claudeCodeMetricAttributesSchema = z
  .object({
    type: z.enum(['input', 'output', 'cacheRead', 'cacheCreation']).optional(),
    model: safeStringSchema.optional(),
    tool: safeStringSchema.optional(),
    decision: z.enum(['accept', 'reject']).optional(),
    language: safeStringSchema.optional(),
  })
  .optional();

/**
 * Claude Code metric schema (legacy simple format)
 */
export const claudeCodeMetricSchema = z.object({
  session_id: sessionIdSchema,
  app_version: safeStringSchema.optional(),
  organization_id: safeStringSchema.optional(),
  user_account_uuid: safeStringSchema.optional(),
  metric_name: safeStringSchema,
  value: validNumberSchema,
  project_id: projectIdSchema.optional(),
  attributes: claudeCodeMetricAttributesSchema,
  timestamp: timestampSchema.optional(),
});

/**
 * Claude Code event schema (legacy simple format)
 */
export const claudeCodeEventSchema = z.object({
  event_name: z.enum([
    'user_prompt',
    'tool_result',
    'api_request',
    'api_error',
    'tool_decision',
  ]),
  timestamp: timestampSchema,
  session_id: sessionIdSchema,
  project_id: projectIdSchema.optional(),
  attributes: safeObjectSchema,
});

/**
 * Claude Code data schema (metric or event)
 */
export const claudeCodeDataSchema = z.union([
  claudeCodeMetricSchema,
  claudeCodeEventSchema,
]);

/**
 * OTLP AnyValue schema (simplified for validation)
 */
export const otlpAnyValueSchema = z.object({
  stringValue: z.string().optional(),
  intValue: z.number().int().optional(),
  doubleValue: z.number().optional(),
  boolValue: z.boolean().optional(),
});

/**
 * OTLP KeyValue schema
 */
export const otlpKeyValueSchema = z.object({
  key: z.string(),
  value: otlpAnyValueSchema,
});

/**
 * OTLP Resource schema
 */
export const otlpResourceSchema = z
  .object({
    attributes: z.array(otlpKeyValueSchema).optional(),
  })
  .optional();

/**
 * OTLP Scope schema
 */
export const otlpScopeSchema = z
  .object({
    name: z.string().optional(),
    version: z.string().optional(),
  })
  .optional();

/**
 * OTLP Log Body schema
 */
export const otlpLogBodySchema = z
  .object({
    stringValue: z.string().optional(),
    intValue: z.number().int().optional(),
    doubleValue: z.number().optional(),
  })
  .optional();

/**
 * OTLP LogRecord schema
 */
export const otlpLogRecordSchema = z.object({
  timeUnixNano: z.union([z.string(), z.number()]).optional(),
  observedTimeUnixNano: z.union([z.string(), z.number()]).optional(),
  severityNumber: z.number().int().optional(),
  severityText: z.string().optional(),
  body: otlpLogBodySchema,
  attributes: z.array(otlpKeyValueSchema).optional(),
});

/**
 * OTLP ScopeLogs schema
 */
export const otlpScopeLogsSchema = z.object({
  scope: otlpScopeSchema,
  logRecords: z.array(otlpLogRecordSchema).optional(),
});

/**
 * OTLP ResourceLogs schema
 */
export const otlpResourceLogsSchema = z.object({
  resource: otlpResourceSchema,
  scopeLogs: z.array(otlpScopeLogsSchema).optional(),
});

/**
 * OTLP Logs schema (IExportLogsServiceRequest)
 */
export const otlpLogsSchema = z
  .object({
    resourceLogs: z.array(otlpResourceLogsSchema).optional(),
  })
  .refine((data) => 'resourceLogs' in data, {
    message: 'OTLP logs must have resourceLogs field',
  });

/**
 * OTLP NumberDataPoint schema
 */
export const otlpNumberDataPointSchema = z.object({
  timeUnixNano: z.union([z.string(), z.number()]).optional(),
  asInt: z.number().int().optional(),
  asDouble: z.number().optional(),
  attributes: z.array(otlpKeyValueSchema).optional(),
});

/**
 * OTLP Gauge schema
 */
export const otlpGaugeSchema = z
  .object({
    dataPoints: z.array(otlpNumberDataPointSchema).optional(),
  })
  .optional();

/**
 * OTLP Sum schema
 */
export const otlpSumSchema = z
  .object({
    dataPoints: z.array(otlpNumberDataPointSchema).optional(),
  })
  .optional();

/**
 * OTLP Metric schema
 */
export const otlpMetricSchema = z.object({
  name: z.string(),
  unit: z.string().optional(),
  gauge: otlpGaugeSchema,
  sum: otlpSumSchema,
});

/**
 * OTLP ScopeMetrics schema
 */
export const otlpScopeMetricsSchema = z.object({
  scope: otlpScopeSchema,
  metrics: z.array(otlpMetricSchema).optional(),
});

/**
 * OTLP ResourceMetrics schema
 */
export const otlpResourceMetricsSchema = z.object({
  resource: otlpResourceSchema,
  scopeMetrics: z.array(otlpScopeMetricsSchema).optional(),
});

/**
 * OTLP Metrics schema (IExportMetricsServiceRequest)
 */
export const otlpMetricsSchema = z
  .object({
    resourceMetrics: z.array(otlpResourceMetricsSchema).optional(),
  })
  .refine((data) => 'resourceMetrics' in data, {
    message: 'OTLP metrics must have resourceMetrics field',
  });

/**
 * Combined schema for all Claude Code formats (auto-detect)
 * Accepts: simple metric, simple event, OTLP logs, OTLP metrics
 */
export const claudeCodeCombinedSchema = z.union([
  claudeCodeMetricSchema,
  claudeCodeEventSchema,
  otlpLogsSchema,
  otlpMetricsSchema,
]);

/**
 * Infer types from schemas
 */
export type ClaudeCodeMetric = z.infer<typeof claudeCodeMetricSchema>;
export type ClaudeCodeEvent = z.infer<typeof claudeCodeEventSchema>;
export type ClaudeCodeData = z.infer<typeof claudeCodeDataSchema>;
export type OTLPLogs = z.infer<typeof otlpLogsSchema>;
export type OTLPMetrics = z.infer<typeof otlpMetricsSchema>;
