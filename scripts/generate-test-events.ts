/**
 * Generate test analytics events
 * Usage:
 *   npx tsx scripts/generate-test-events.ts                    # Send to local dev server
 *   npx tsx scripts/generate-test-events.ts --remote           # Send to production
 *   npx tsx scripts/generate-test-events.ts --count 50         # Generate 50 events
 *   npx tsx scripts/generate-test-events.ts --project myproj   # Use specific project ID
 *
 * Endpoints are configured in package.json config.endpoints
 */

import { loadEndpoints } from './config';

interface EventOptions {
  endpoint: string;
  projectId?: string;
  count: number;
}

const CLAUDE_CODE_METRICS = [
  'claude_code.token.usage',
  'claude_code.api.request',
  'claude_code.tool.execution',
  'claude_code.cache.hit',
];

const EVENT_NAMES = [
  'user_prompt',
  'tool_result',
  'api_request',
  'api_error',
  'tool_decision',
];

const MODELS = ['claude-sonnet-4-5', 'claude-sonnet-3-5', 'claude-opus-3'];

const TOOLS = ['Read', 'Write', 'Edit', 'Bash', 'Grep', 'Glob'];

const SENTRY_LEVELS = ['fatal', 'error', 'warning', 'info', 'debug'] as const;

const ERROR_TYPES = [
  'ReferenceError',
  'TypeError',
  'SyntaxError',
  'RangeError',
  'Error',
];

const LOG_LEVELS = ['debug', 'info', 'warn', 'error', 'fatal'] as const;

/**
 * Generate random 32-char hex string for Sentry event_id
 */
function generateEventId(): string {
  return Array.from({ length: 32 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

/**
 * Generate random Claude Code metric
 */
function generateMetric(projectId?: string): Record<string, unknown> {
  const metric = {
    session_id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    metric_name:
      CLAUDE_CODE_METRICS[
        Math.floor(Math.random() * CLAUDE_CODE_METRICS.length)
      ],
    value: Math.floor(Math.random() * 10000) + 100,
    app_version: '1.0.0',
    attributes: {
      type: ['input', 'output', 'cacheRead'][Math.floor(Math.random() * 3)] as
        | 'input'
        | 'output'
        | 'cacheRead',
      model: MODELS[Math.floor(Math.random() * MODELS.length)],
    },
    timestamp: new Date().toISOString(),
  };

  if (projectId) {
    return { ...metric, project_id: projectId };
  }

  return metric;
}

/**
 * Generate random Claude Code event
 */
function generateEvent(projectId?: string): Record<string, unknown> {
  const event = {
    event_name: EVENT_NAMES[
      Math.floor(Math.random() * EVENT_NAMES.length)
    ] as (typeof EVENT_NAMES)[number],
    timestamp: new Date().toISOString(),
    session_id: `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    attributes: {
      tool: TOOLS[Math.floor(Math.random() * TOOLS.length)],
      duration_ms: Math.floor(Math.random() * 1000),
      success: Math.random() > 0.1,
    },
  };

  if (projectId) {
    return { ...event, project_id: projectId };
  }

  return event;
}

/**
 * Generate random GA event
 */
function generateGAEvent(projectId?: string): Record<string, unknown> {
  const events = [
    {
      name: 'page_view',
      params: { page_location: 'https://example.com', page_title: 'Home' },
    },
    {
      name: 'click',
      params: { element_id: 'button-123', element_text: 'Click me' },
    },
    {
      name: 'scroll',
      params: { percent_scrolled: Math.floor(Math.random() * 100) },
    },
    {
      name: 'purchase',
      params: { value: (Math.random() * 100).toFixed(2), currency: 'USD' },
    },
  ];

  const data = {
    client_id: `client-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    events: [events[Math.floor(Math.random() * events.length)]],
    timestamp_micros: (Date.now() * 1000).toString(),
  };

  if (projectId) {
    return { ...data, project_id: projectId };
  }

  return data;
}

/**
 * Generate random Sentry error event
 */
function generateSentryEvent(projectId?: string): Record<string, unknown> {
  const errorType = ERROR_TYPES[Math.floor(Math.random() * ERROR_TYPES.length)];
  const level = SENTRY_LEVELS[Math.floor(Math.random() * SENTRY_LEVELS.length)];

  const data = {
    event_id: generateEventId(),
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level,
    exception: {
      values: [
        {
          type: errorType,
          value: `Test ${errorType}: Simulated error from test script`,
          stacktrace: {
            frames: [
              {
                filename: 'app.js',
                function: 'handleRequest',
                lineno: Math.floor(Math.random() * 100) + 1,
                colno: Math.floor(Math.random() * 50) + 1,
              },
              {
                filename: 'middleware.js',
                function: 'processData',
                lineno: Math.floor(Math.random() * 100) + 1,
                colno: Math.floor(Math.random() * 50) + 1,
              },
            ],
          },
        },
      ],
    },
    tags: {
      environment: 'testing',
      source: 'test-script',
    },
    user: {
      id: `user-${Math.random().toString(36).substr(2, 9)}`,
    },
  };

  if (projectId) {
    return { ...data, project_id: projectId };
  }

  return data;
}

/**
 * Generate random Logtail log event
 */
function generateLogtailEvent(projectId?: string): Record<string, unknown> {
  const level = LOG_LEVELS[Math.floor(Math.random() * LOG_LEVELS.length)];
  const messages = [
    'User authentication successful',
    'Database query completed',
    'API request processed',
    'Cache miss occurred',
    'File upload completed',
    'Background job started',
    'WebSocket connection established',
    'Rate limit check passed',
  ];

  const data = {
    message: messages[Math.floor(Math.random() * messages.length)],
    level,
    timestamp: new Date().toISOString(),
    dt: new Date().toISOString(),
    context: {
      service: 'test-service',
      version: '1.0.0',
      hostname: `host-${Math.floor(Math.random() * 10)}`,
    },
    metadata: {
      request_id: `req-${Math.random().toString(36).substr(2, 9)}`,
      user_id: `user-${Math.random().toString(36).substr(2, 9)}`,
      duration_ms: Math.floor(Math.random() * 1000),
    },
  };

  if (projectId) {
    return { ...data, project_id: projectId };
  }

  return data;
}

/**
 * Send event to endpoint
 */
async function sendEvent(
  endpoint: string,
  data: Record<string, unknown>,
  type: 'cc' | 'ga' | 'sentry' | 'logtail'
): Promise<void> {
  const url = `${endpoint}/${type}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed to send ${type} event:`, result);
    } else {
      let eventInfo = 'event';

      if ('metric_name' in data && typeof data.metric_name === 'string') {
        eventInfo = data.metric_name;
      } else if ('event_name' in data && typeof data.event_name === 'string') {
        eventInfo = data.event_name;
      } else if (
        'events' in data &&
        Array.isArray(data.events) &&
        data.events[0]
      ) {
        const firstEvent = data.events[0] as { name?: string };
        eventInfo = firstEvent.name || 'event';
      } else if (
        type === 'sentry' &&
        'level' in data &&
        typeof data.level === 'string'
      ) {
        eventInfo = `${data.level} error`;
      } else if (
        type === 'logtail' &&
        'level' in data &&
        typeof data.level === 'string'
      ) {
        eventInfo = `${data.level} log`;
      }

      console.log(`✅ Sent ${type} event:`, eventInfo);
    }
  } catch (error: unknown) {
    console.error(`❌ Error sending ${type} event:`, error);
  }
}

/**
 * Parse command line arguments
 */
function parseArgs(): EventOptions {
  const args = process.argv.slice(2);
  const endpoints = loadEndpoints();

  let endpoint = endpoints.local;
  let projectId: string | undefined;
  let count = 10;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--remote':
      case '-r':
        endpoint = endpoints.production;
        // Set default project_id to 'testing' when --remote is used
        if (!projectId) {
          projectId = 'testing';
        }
        break;
      case '--endpoint':
      case '-e':
        endpoint = args[++i] ?? endpoint;
        break;
      case '--project':
      case '-p':
        projectId = args[++i] ?? projectId;
        break;
      case '--count':
      case '-c':
        count = parseInt(args[++i] ?? '10', 10);
        break;
      case '--help':
      case '-h':
        console.log(`
Usage: npx tsx scripts/generate-test-events.ts [options]

Options:
  --remote, -r              Send to production (${endpoints.production})
                           (default project_id: testing)
  --endpoint, -e <url>      Custom endpoint URL
  --project, -p <id>        Project ID to use (default: debug)
  --count, -c <number>      Number of events to generate (default: 10)
  --help, -h                Show this help message

Examples:
  npx tsx scripts/generate-test-events.ts
  npx tsx scripts/generate-test-events.ts --remote
  npx tsx scripts/generate-test-events.ts --count 50
  npx tsx scripts/generate-test-events.ts --project debug --remote
  npx tsx scripts/generate-test-events.ts --endpoint http://localhost:3000

Note: Events without explicit --project flag will use 'debug' for local
      and 'testing' for --remote

Endpoints configured in package.json:
  Local: ${endpoints.local}
  Production: ${endpoints.production}
        `);
        process.exit(0);
    }
  }

  // If no project_id specified, use 'debug' as default
  if (!projectId) {
    projectId = 'debug';
  }

  return { endpoint, projectId, count };
}

/**
 * Main function
 */
async function main(): Promise<void> {
  const options = parseArgs();

  console.log('🚀 Generating test analytics events...');
  console.log(`📡 Endpoint: ${options.endpoint}`);
  if (options.projectId) {
    console.log(`📊 Project ID: ${options.projectId}`);
  }
  console.log(`🔢 Count: ${options.count}`);
  console.log('');

  const promises: Promise<void>[] = [];

  for (let i = 0; i < options.count; i++) {
    const type = Math.random();

    if (type < 0.3) {
      // 30% metrics
      const metric = generateMetric(options.projectId);
      promises.push(sendEvent(options.endpoint, metric, 'cc'));
    } else if (type < 0.6) {
      // 30% events
      const event = generateEvent(options.projectId);
      promises.push(sendEvent(options.endpoint, event, 'cc'));
    } else if (type < 0.75) {
      // 15% GA events
      const gaEvent = generateGAEvent(options.projectId);
      promises.push(sendEvent(options.endpoint, gaEvent, 'ga'));
    } else if (type < 0.9) {
      // 15% Sentry events
      const sentryEvent = generateSentryEvent(options.projectId);
      promises.push(sendEvent(options.endpoint, sentryEvent, 'sentry'));
    } else {
      // 10% Logtail events
      const logtailEvent = generateLogtailEvent(options.projectId);
      promises.push(sendEvent(options.endpoint, logtailEvent, 'logtail'));
    }

    // Small delay to avoid overwhelming the server
    await new Promise((resolve) => setTimeout(resolve, 100));
  }

  await Promise.all(promises);

  console.log('');
  console.log(`✨ Generated ${options.count} test events successfully!`);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}
