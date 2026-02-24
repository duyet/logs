import { Hono } from 'hono';
import type { Env } from '../types/index.js';
import { RealtimeAdapter } from '../adapters/realtime.js';
import type { ServerContext, RealtimeEvent } from '../types/realtime.js';

const realtimeRouter = new Hono<{ Bindings: Env }>();
const adapter = new RealtimeAdapter();

/**
 * POST /realtime - Track real-time event
 * Writes to Analytics Engine and forwards to Durable Object for 5-min aggregation
 */
realtimeRouter.post('/', async (c) => {
  try {
    const data = await c.req.json<RealtimeEvent>();

    // Validate event
    if (!adapter.validate(data)) {
      return c.json({ error: 'Invalid event format' }, 400);
    }

    const event = data;

    // Extract server context from Cloudflare request
    const serverContext: ServerContext = {
      ip: c.req.header('CF-Connecting-IP') || '',
      country: c.req.header('CF-IPCountry') || null,
      city: c.req.header('CF-IPCity') || null,
      region: c.req.header('CF-Region') || null,
      timezone: c.req.header('CF-Timezone') || null,
      asn: c.req.header('CF-ASN')
        ? parseInt(c.req.header('CF-ASN')!, 10)
        : null,
      isp: c.req.header('CF-ISP') || null,
      cf_ray: c.req.header('CF-Ray') || null,
      cf_connecting_ip: c.req.header('CF-Connecting-IP') || null,
    };

    // Get project_id from context (set by middleware)
    const projectId = c.get('project_id');
    if (projectId) {
      adapter.setProjectId(projectId);
    }

    // Transform to Analytics Engine format
    const dataPoint = adapter.transform(event, serverContext);

    // Write to Analytics Engine (PRIMARY - long-term storage, must succeed)
    if (!c.env.REALTIME_ANALYTICS) {
      return c.json({ error: 'REALTIME_ANALYTICS not configured' }, 503);
    }

    try {
      c.env.REALTIME_ANALYTICS.writeDataPoint(dataPoint);
    } catch (error) {
      console.error('Analytics Engine write failed (critical):', {
        error: error instanceof Error ? error.message : String(error),
        project_id: projectId,
        event_type: event.event_type,
      });
      return c.json(
        { error: 'Failed to store event to Analytics Engine' },
        500
      );
    }

    // Forward to Durable Object (SECONDARY - real-time aggregation, can fail gracefully)
    if (!c.env.REALTIME_AGGREGATOR) {
      console.warn(
        'REALTIME_AGGREGATOR not configured, skipping real-time aggregation'
      );
    } else {
      try {
        const doId = c.env.REALTIME_AGGREGATOR.idFromName(
          projectId || 'default'
        );
        const stub = c.env.REALTIME_AGGREGATOR.get(doId);
        await stub.fetch(
          new Request('http://do/event', {
            method: 'POST',
            body: JSON.stringify(event),
            headers: { 'Content-Type': 'application/json' },
          })
        );
      } catch (error) {
        // Log but don't fail - real-time stats are ephemeral and self-healing
        console.warn(
          'Durable Object write failed (non-critical, real-time stats may be delayed):',
          {
            error: error instanceof Error ? error.message : String(error),
            project_id: projectId,
            event_type: event.event_type,
          }
        );
      }
    }

    return c.json({ success: true });
  } catch (error) {
    console.error('Error tracking realtime event:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /realtime/stats - Get current real-time statistics
 * Queries Durable Object for 5-minute window aggregation
 */
realtimeRouter.get('/stats', async (c) => {
  try {
    if (!c.env.REALTIME_AGGREGATOR) {
      return c.json({ error: 'REALTIME_AGGREGATOR not configured' }, 503);
    }

    const projectId = c.get('project_id') || 'default';

    // Get Durable Object stub
    const doId = c.env.REALTIME_AGGREGATOR.idFromName(projectId);
    const stub = c.env.REALTIME_AGGREGATOR.get(doId);

    // Fetch stats
    const response = await stub.fetch(new Request('http://do/stats'));
    const stats = await response.json();

    return c.json(stats);
  } catch (error) {
    console.error('Error fetching realtime stats:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /realtime/data - Get full aggregated data with event list
 * Queries Durable Object for detailed analytics
 */
realtimeRouter.get('/data', async (c) => {
  try {
    if (!c.env.REALTIME_AGGREGATOR) {
      return c.json({ error: 'REALTIME_AGGREGATOR not configured' }, 503);
    }

    const projectId = c.get('project_id') || 'default';

    // Get Durable Object stub
    const doId = c.env.REALTIME_AGGREGATOR.idFromName(projectId);
    const stub = c.env.REALTIME_AGGREGATOR.get(doId);

    // Fetch aggregated data
    const response = await stub.fetch(new Request('http://do/data'));
    const data = await response.json();

    return c.json(data);
  } catch (error) {
    console.error('Error fetching realtime data:', error);
    const message = error instanceof Error ? error.message : 'Unknown error';
    return c.json({ error: message }, 500);
  }
});

export { realtimeRouter };
