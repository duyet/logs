import { z } from 'zod';
import {
  projectIdSchema,
  sessionIdSchema,
  unixTimestampSchema,
  urlSchema,
  safeStringSchema,
  eventTypeSchema,
  validNumberSchema,
  positiveNumberSchema,
} from './common.js';

/**
 * Fingerprint components schema
 */
export const fingerprintComponentsSchema = z.object({
  screen: z.object({
    width: positiveNumberSchema,
    height: positiveNumberSchema,
    colorDepth: positiveNumberSchema,
  }),
  timezone: safeStringSchema,
  language: safeStringSchema,
  platform: safeStringSchema,
  cookieEnabled: z.boolean(),
  doNotTrack: z.boolean(),
});

/**
 * Fingerprint schema
 */
export const fingerprintSchema = z.object({
  hash: safeStringSchema,
  components: fingerprintComponentsSchema,
  confidence: z.number().min(0).max(100),
});

/**
 * Viewport schema (deprecated)
 */
const viewportSchema = z
  .object({
    width: positiveNumberSchema,
    height: positiveNumberSchema,
  })
  .optional();

/**
 * Screen schema (deprecated)
 */
const screenSchema = z
  .object({
    width: positiveNumberSchema,
    height: positiveNumberSchema,
    colorDepth: positiveNumberSchema,
  })
  .optional();

/**
 * Performance metrics schema
 */
const performanceSchema = z
  .object({
    dns: validNumberSchema.optional(),
    tcp: validNumberSchema.optional(),
    ttfb: validNumberSchema.optional(),
    download: validNumberSchema.optional(),
    domInteractive: validNumberSchema.optional(),
    domComplete: validNumberSchema.optional(),
    loadComplete: validNumberSchema.optional(),
  })
  .optional();

/**
 * Real-time event schema
 */
export const realtimeEventSchema = z.object({
  // Required fields
  event_type: eventTypeSchema,
  timestamp: unixTimestampSchema,
  url: urlSchema,
  user_agent: safeStringSchema,
  fingerprint: fingerprintSchema,

  // Optional identification
  referrer: urlSchema.optional(),
  project_id: projectIdSchema.optional(),
  session_id: sessionIdSchema.optional(),
  visitor_id: safeStringSchema.optional(),
  user_id: safeStringSchema.optional(),

  // Click event specific
  click_target: safeStringSchema.optional(),
  click_text: safeStringSchema.optional(),

  // Custom event specific
  custom_data: z.record(z.string(), z.unknown()).optional(),

  // Deprecated fields (for backwards compatibility)
  viewport: viewportSchema,
  screen: screenSchema,
  timezone: safeStringSchema.optional(),
  language: safeStringSchema.optional(),
  platform: safeStringSchema.optional(),
  cookieEnabled: z.boolean().optional(),
  doNotTrack: z.boolean().optional(),
  event_name: safeStringSchema.optional(),
  event_properties: z
    .record(z.string(), z.union([z.string(), z.number(), z.boolean()]))
    .optional(),

  // Performance metrics
  performance: performanceSchema,
});

/**
 * Server context schema (Cloudflare request headers)
 */
export const serverContextSchema = z.object({
  ip: safeStringSchema,
  country: safeStringSchema.nullable(),
  city: safeStringSchema.nullable(),
  region: safeStringSchema.nullable(),
  timezone: safeStringSchema.nullable(),
  asn: z.number().int().nullable(),
  isp: safeStringSchema.nullable(),
  cf_ray: safeStringSchema.nullable(),
  cf_connecting_ip: safeStringSchema.nullable(),
});

/**
 * Browser info schema
 */
export const browserInfoSchema = z.object({
  name: safeStringSchema,
  version: safeStringSchema,
  engine: safeStringSchema,
});

/**
 * OS info schema
 */
export const osInfoSchema = z.object({
  name: safeStringSchema,
  version: safeStringSchema,
});

/**
 * Device info schema
 */
export const deviceInfoSchema = z.object({
  type: z.enum(['desktop', 'mobile', 'tablet', 'bot', 'unknown']),
  vendor: safeStringSchema,
  model: safeStringSchema,
});

/**
 * Parsed User-Agent schema
 */
export const parsedUserAgentSchema = z.object({
  browser: browserInfoSchema,
  os: osInfoSchema,
  device: deviceInfoSchema,
  raw: safeStringSchema,
});

/**
 * Bot detection result schema
 */
export const botDetectionResultSchema = z.object({
  isBot: z.boolean(),
  score: z.number().min(0).max(100),
  reasons: z.array(z.string()),
  detectionMethod: z.enum([
    'ua-string',
    'behavioral',
    'fingerprint',
    'combined',
  ]),
});

/**
 * Real-time stats schema
 */
export const realtimeStatsSchema = z.object({
  timestamp: unixTimestampSchema,
  window_size: positiveNumberSchema,

  // Traffic metrics
  total_events: z.number().int().nonnegative(),
  unique_visitors: z.number().int().nonnegative(),

  // Event breakdown
  pageviews: z.number().int().nonnegative(),
  clicks: z.number().int().nonnegative(),
  custom_events: z.number().int().nonnegative(),

  // Browser breakdown
  browsers: z.record(z.string(), z.number().int().nonnegative()),

  // OS breakdown
  operating_systems: z.record(z.string(), z.number().int().nonnegative()),

  // Device breakdown
  device_types: z.record(z.string(), z.number().int().nonnegative()),

  // Bot traffic
  bot_traffic: z.number().int().nonnegative(),
  human_traffic: z.number().int().nonnegative(),
});

/**
 * Infer types from schemas
 */
export type RealtimeEvent = z.infer<typeof realtimeEventSchema>;
export type ServerContext = z.infer<typeof serverContextSchema>;
export type Fingerprint = z.infer<typeof fingerprintSchema>;
export type FingerprintComponents = z.infer<typeof fingerprintComponentsSchema>;
export type ParsedUserAgent = z.infer<typeof parsedUserAgentSchema>;
export type BotDetectionResult = z.infer<typeof botDetectionResultSchema>;
export type RealtimeStats = z.infer<typeof realtimeStatsSchema>;
export type BrowserInfo = z.infer<typeof browserInfoSchema>;
export type OSInfo = z.infer<typeof osInfoSchema>;
export type DeviceInfo = z.infer<typeof deviceInfoSchema>;
