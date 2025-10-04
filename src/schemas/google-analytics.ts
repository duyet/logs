import { z } from 'zod';
import { projectIdSchema, safeStringSchema } from './common.js';

/**
 * Google Analytics event parameter values
 */
const gaEventParamValueSchema = z.union([z.string(), z.number(), z.boolean()]);

/**
 * Google Analytics event schema
 */
export const googleAnalyticsEventSchema = z.object({
  name: safeStringSchema,
  params: z.record(z.string(), gaEventParamValueSchema).optional(),
});

/**
 * Google Analytics user property value schema
 */
const gaUserPropertyValueSchema = z.object({
  value: z.union([z.string(), z.number(), z.boolean()]),
});

/**
 * Google Analytics data schema (GA4 Measurement Protocol)
 */
export const googleAnalyticsDataSchema = z.object({
  client_id: safeStringSchema,
  user_id: safeStringSchema.optional(),
  project_id: projectIdSchema.optional(),
  timestamp_micros: safeStringSchema.optional(),
  user_properties: z.record(z.string(), gaUserPropertyValueSchema).optional(),
  events: z.array(googleAnalyticsEventSchema).min(1, {
    message: 'At least one event is required',
  }),
});

/**
 * Infer types from schemas
 */
export type GoogleAnalyticsEvent = z.infer<typeof googleAnalyticsEventSchema>;
export type GoogleAnalyticsData = z.infer<typeof googleAnalyticsDataSchema>;
