#!/bin/bash

# Test script for OTLP format locally
# Usage: ./test-otlp-local.sh

ENDPOINT="${1:-http://localhost:8788/cc/duyet}"

echo "Testing OTLP Logs format..."
echo "Endpoint: $ENDPOINT"
echo ""

# Sample OTLP Logs data (based on actual Claude Code format)
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
  "resourceLogs": [
    {
      "resource": {
        "attributes": [
          {"key": "host.arch", "value": {"stringValue": "arm64"}},
          {"key": "os.type", "value": {"stringValue": "darwin"}},
          {"key": "os.version", "value": {"stringValue": "25.0.0"}},
          {"key": "service.name", "value": {"stringValue": "claude-code"}},
          {"key": "service.version", "value": {"stringValue": "2.0.1"}}
        ],
        "droppedAttributesCount": 0
      },
      "scopeLogs": [
        {
          "scope": {
            "name": "com.anthropic.claude_code.events",
            "version": "2.0.1"
          },
          "logRecords": [
            {
              "timeUnixNano": "1759397617368000000",
              "observedTimeUnixNano": "1759397617368000000",
              "severityNumber": 9,
              "severityText": "INFO",
              "body": {
                "stringValue": "User prompt received"
              },
              "attributes": [
                {"key": "session_id", "value": {"stringValue": "session-test-123"}},
                {"key": "event_name", "value": {"stringValue": "user_prompt"}},
                {"key": "prompt_length", "value": {"intValue": 150}}
              ],
              "droppedAttributesCount": 0
            }
          ]
        }
      ]
    }
  ]
}'

echo ""
echo ""
echo "Testing OTLP Metrics format..."
echo ""

# Sample OTLP Metrics data
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
  "resourceMetrics": [
    {
      "resource": {
        "attributes": [
          {"key": "host.arch", "value": {"stringValue": "arm64"}},
          {"key": "os.type", "value": {"stringValue": "darwin"}},
          {"key": "service.name", "value": {"stringValue": "claude-code"}},
          {"key": "service.version", "value": {"stringValue": "2.0.1"}}
        ]
      },
      "scopeMetrics": [
        {
          "scope": {
            "name": "com.anthropic.claude_code.metrics",
            "version": "2.0.1"
          },
          "metrics": [
            {
              "name": "claude_code.token.usage",
              "description": "Token usage by type",
              "unit": "tokens",
              "sum": {
                "dataPoints": [
                  {
                    "timeUnixNano": "1759397617368000000",
                    "asDouble": 1500,
                    "attributes": [
                      {"key": "type", "value": {"stringValue": "input"}},
                      {"key": "model", "value": {"stringValue": "claude-sonnet-4-5"}}
                    ]
                  }
                ],
                "aggregationTemporality": 2,
                "isMonotonic": true
              }
            }
          ]
        }
      ]
    }
  ]
}'

echo ""
echo ""
echo "Testing legacy simple format (should still work)..."
echo ""

# Legacy simple format
curl -X POST "$ENDPOINT" \
  -H "Content-Type: application/json" \
  -d '{
  "session_id": "session-legacy-123",
  "metric_name": "claude_code.token.usage",
  "value": 1000,
  "attributes": {
    "type": "input",
    "model": "claude-sonnet-4-5"
  }
}'

echo ""
echo ""
echo "Done! Check your local server logs for validation and write confirmation."
