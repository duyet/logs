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
 * Send event to endpoint
 */
async function sendEvent(
  endpoint: string,
  data: Record<string, unknown>,
  type: 'cc' | 'ga'
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

    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const result = await response.json();

    if (!response.ok) {
      console.error(`❌ Failed to send ${type} event:`, result);
    } else {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      console.log(
        `✅ Sent ${type} event:`,
        data.metric_name ||
          data.event_name ||
          (data.events as { name: string }[])?.[0]?.name
      );
    }
  } catch (error) {
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

    if (type < 0.4) {
      // 40% metrics
      const metric = generateMetric(options.projectId);
      promises.push(sendEvent(options.endpoint, metric, 'cc'));
    } else if (type < 0.8) {
      // 40% events
      const event = generateEvent(options.projectId);
      promises.push(sendEvent(options.endpoint, event, 'cc'));
    } else {
      // 20% GA events
      const gaEvent = generateGAEvent(options.projectId);
      promises.push(sendEvent(options.endpoint, gaEvent, 'ga'));
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
