import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';
import {
  realtimeEventSchema,
  type RealtimeEvent,
  type ServerContext,
} from '../schemas/index.js';
import { parseUserAgent } from '../utils/user-agent-parser.js';
import { detectBot } from '../utils/bot-detection.js';

/**
 * Adapter for real-time analytics events
 * Transforms RealtimeEvent data into Analytics Engine format with:
 * - User-Agent parsing (browser, OS, device detection)
 * - Bot detection (multi-layer scoring)
 * - Fingerprint integration (privacy-conscious visitor tracking)
 * - Server context enrichment (IP, country, CF-Ray)
 */
export class RealtimeAdapter extends BaseAdapter<RealtimeEvent> {
  /**
   * Validate RealtimeEvent structure using Zod schema
   * Required fields: event_type, timestamp, url, user_agent, fingerprint
   * Optional fields: project_id, session_id, visitor_id, referrer, click_*, custom_data
   */
  validate(data: unknown): data is RealtimeEvent {
    const result = realtimeEventSchema.safeParse(data);
    return result.success;
  }

  /**
   * Transform RealtimeEvent to Analytics Engine format
   * Structure:
   * - indexes[0]: project_id (max 96 bytes)
   * - doubles[0]: timestamp
   * - blobs[0]: JSON with all event data, parsed UA, bot detection, server context
   */
  transform(
    data: RealtimeEvent,
    serverContext?: ServerContext
  ): AnalyticsEngineDataPoint {
    // Parse User-Agent
    const parsedUA = parseUserAgent(data.user_agent);

    // Detect bot using parsed UA and fingerprint
    const botDetection = detectBot(parsedUA, data.fingerprint);

    // Get project_id (event data > context > undefined)
    const projectId = data.project_id || this.getProjectId();

    // Build blob data with all event information
    const blobData = {
      // Event metadata
      event_type: data.event_type,
      timestamp: data.timestamp,
      url: data.url,
      referrer: data.referrer || null,

      // Session tracking
      session_id: data.session_id || null,
      visitor_id: data.visitor_id || null,
      project_id: projectId || null,

      // Parsed User-Agent
      browser: {
        name: parsedUA.browser.name,
        version: parsedUA.browser.version,
        engine: parsedUA.browser.engine,
      },
      os: {
        name: parsedUA.os.name,
        version: parsedUA.os.version,
      },
      device: {
        type: parsedUA.device.type,
        vendor: parsedUA.device.vendor,
        model: parsedUA.device.model,
      },

      // Bot detection results
      bot: {
        isBot: botDetection.isBot,
        score: botDetection.score,
        reasons: botDetection.reasons,
        detectionMethod: botDetection.detectionMethod,
      },

      // Fingerprint
      fingerprint: {
        hash: data.fingerprint.hash,
        confidence: data.fingerprint.confidence,
      },

      // Server context (Cloudflare headers)
      server: serverContext
        ? {
            ip: serverContext.ip,
            country: serverContext.country,
            city: serverContext.city,
            region: serverContext.region,
            timezone: serverContext.timezone,
            asn: serverContext.asn,
            isp: serverContext.isp,
            cf_ray: serverContext.cf_ray,
          }
        : null,

      // Event-specific data
      ...(data.event_type === 'click' && {
        click: {
          target: data.click_target || null,
          text: data.click_text || null,
        },
      }),
      ...(data.event_type === 'custom' && {
        custom: data.custom_data || null,
      }),
    };

    // Serialize to JSON and truncate to Analytics Engine blob limit (5120 bytes)
    const blobJson = this.toBlob(JSON.stringify(blobData));

    return {
      // Max 1 index: use project_id for filtering
      indexes: projectId ? [this.toIndex(projectId)] : [],

      // Timestamp as numeric value
      doubles: [this.toDouble(data.timestamp)],

      // All event data as JSON blob
      blobs: [blobJson],
    };
  }
}
