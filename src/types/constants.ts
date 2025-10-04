/**
 * Data type constants for Analytics Engine data classification
 * Used to categorize different analytics data formats for querying and analysis
 */
export const DATA_TYPE = {
  LEGACY_METRIC: 'legacy_metric',
  LEGACY_EVENT: 'legacy_event',
  OTLP_LOGS: 'otlp_logs',
  OTLP_METRICS: 'otlp_metrics',
} as const;

/**
 * Data format constants
 * Indicates the original format of the analytics data
 */
export const FORMAT = {
  SIMPLE: 'simple',
  OTLP: 'otlp',
} as const;

/**
 * Type-safe data type values
 */
export type DataType = (typeof DATA_TYPE)[keyof typeof DATA_TYPE];

/**
 * Type-safe format values
 */
export type Format = (typeof FORMAT)[keyof typeof FORMAT];
