#!/usr/bin/env tsx

/**
 * Test script for OTLP format endpoints
 * Usage: tsx scripts/test-otlp.ts [endpoint]
 * Default endpoint: http://localhost:8788/cc/duyet
 */

// Colors for console output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
};

function log(emoji: string, message: string) {
  console.log(`${emoji} ${colors.bright}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}✅ ${message}${colors.reset}`);
}

function logError(message: string) {
  console.error(`${colors.red}❌ ${message}${colors.reset}`);
}

async function testEndpoint(
  name: string,
  endpoint: string,
  data: unknown
): Promise<boolean> {
  try {
    log('📤', `Testing ${name}...`);
    console.log(`${colors.cyan}Endpoint: ${endpoint}${colors.reset}`);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      logError(
        `${name} failed with status ${response.status} ${response.statusText}`
      );
      const text = await response.text();
      console.error(`Response: ${text}`);
      return false;
    }

    const result = await response.json();
    logSuccess(`${name} succeeded`);
    console.log(`Response:`, result);
    console.log();
    return true;
  } catch (error) {
    logError(`${name} failed`);
    if (error instanceof Error) {
      console.error(error.message);
    }
    console.log();
    return false;
  }
}

async function main() {
  const endpoint = process.argv[2] || 'http://localhost:8788/cc/duyet';

  log('🧪', 'OTLP Format Testing');
  console.log(`${colors.blue}Target: ${endpoint}${colors.reset}`);
  console.log();

  let allPassed = true;

  // Test 1: OTLP Logs
  const otlpLogs = {
    resourceLogs: [
      {
        resource: {
          attributes: [
            { key: 'host.arch', value: { stringValue: 'arm64' } },
            { key: 'os.type', value: { stringValue: 'darwin' } },
            { key: 'os.version', value: { stringValue: '25.0.0' } },
            { key: 'service.name', value: { stringValue: 'claude-code' } },
            { key: 'service.version', value: { stringValue: '2.0.1' } },
          ],
          droppedAttributesCount: 0,
        },
        scopeLogs: [
          {
            scope: {
              name: 'com.anthropic.claude_code.events',
              version: '2.0.1',
            },
            logRecords: [
              {
                timeUnixNano: '1759397617368000000',
                observedTimeUnixNano: '1759397617368000000',
                severityNumber: 9,
                severityText: 'INFO',
                body: {
                  stringValue: 'User prompt received',
                },
                attributes: [
                  {
                    key: 'session_id',
                    value: { stringValue: 'session-test-123' },
                  },
                  { key: 'event_name', value: { stringValue: 'user_prompt' } },
                  { key: 'prompt_length', value: { intValue: 150 } },
                ],
                droppedAttributesCount: 0,
              },
            ],
          },
        ],
      },
    ],
  };

  allPassed =
    (await testEndpoint('OTLP Logs', endpoint, otlpLogs)) && allPassed;

  // Test 2: OTLP Metrics
  const otlpMetrics = {
    resourceMetrics: [
      {
        resource: {
          attributes: [
            { key: 'host.arch', value: { stringValue: 'arm64' } },
            { key: 'os.type', value: { stringValue: 'darwin' } },
            { key: 'service.name', value: { stringValue: 'claude-code' } },
            { key: 'service.version', value: { stringValue: '2.0.1' } },
          ],
        },
        scopeMetrics: [
          {
            scope: {
              name: 'com.anthropic.claude_code.metrics',
              version: '2.0.1',
            },
            metrics: [
              {
                name: 'claude_code.token.usage',
                description: 'Token usage by type',
                unit: 'tokens',
                sum: {
                  dataPoints: [
                    {
                      timeUnixNano: '1759397617368000000',
                      asDouble: 1500,
                      attributes: [
                        { key: 'type', value: { stringValue: 'input' } },
                        {
                          key: 'model',
                          value: { stringValue: 'claude-sonnet-4-5' },
                        },
                      ],
                    },
                  ],
                  aggregationTemporality: 2,
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  allPassed =
    (await testEndpoint('OTLP Metrics', endpoint, otlpMetrics)) && allPassed;

  // Test 3: Legacy Simple Format
  const legacyFormat = {
    session_id: 'session-legacy-123',
    metric_name: 'claude_code.token.usage',
    value: 1000,
    attributes: {
      type: 'input',
      model: 'claude-sonnet-4-5',
    },
  };

  allPassed =
    (await testEndpoint('Legacy Format', endpoint, legacyFormat)) && allPassed;

  // Summary
  console.log();
  if (allPassed) {
    logSuccess('All tests passed!');
    log(
      '💡',
      'Check your server logs for Analytics Engine write confirmations'
    );
    process.exit(0);
  } else {
    logError('Some tests failed!');
    process.exit(1);
  }
}

main();
