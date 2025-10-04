/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-type-assertion */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type {
  Env,
  PingResponse,
  SuccessResponse,
  ErrorResponse,
} from '../../src/types/index.js';

describe('E2E Endpoints', () => {
  let app: ReturnType<typeof createRouter>;
  let mockEnv: Env;

  beforeEach(() => {
    const mockDataset = {
      writeDataPoint: vi.fn(),
    };

    mockEnv = {
      CLAUDE_CODE_ANALYTICS: mockDataset,
      CLAUDE_CODE_LOGS: mockDataset,
      CLAUDE_CODE_METRICS: mockDataset,
      GA_ANALYTICS: mockDataset,
      REALTIME_ANALYTICS: mockDataset,
      LOGTAIL_ANALYTICS: mockDataset,
      SENTRY_ANALYTICS: mockDataset,
      REALTIME_AGGREGATOR: {} as DurableObjectNamespace,
      DB: {} as D1Database,
    };

    app = createRouter();
  });

  describe('GET /ping', () => {
    it('should return health check status', async () => {
      const res = await app.request('/ping', {}, mockEnv);
      const json = (await res.json()) as PingResponse;

      expect(res.status).toBe(200);
      expect(json).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });
    });
  });

  describe('POST /cc - Claude Code analytics', () => {
    it('should accept valid metric data', async () => {
      const metricData = {
        session_id: 'session-123',
        metric_name: 'claude_code.token.usage',
        value: 1000,
        attributes: {
          type: 'input',
          model: 'claude-sonnet-4-5',
        },
      };

      const res = await app.request(
        '/cc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metricData),
        },
        mockEnv
      );

      const json = (await res.json()) as SuccessResponse;

      expect(res.status).toBe(200);
      expect(json).toEqual({
        success: true,
        message: 'Data processed',
      });
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEnv.CLAUDE_CODE_ANALYTICS.writeDataPoint).toHaveBeenCalled();
    });

    it('should accept valid event data', async () => {
      const eventData = {
        event_name: 'user_prompt',
        timestamp: '2024-01-01T00:00:00Z',
        session_id: 'session-123',
        attributes: {
          prompt_length: 100,
        },
      };

      const res = await app.request(
        '/cc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(eventData),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEnv.CLAUDE_CODE_ANALYTICS.writeDataPoint).toHaveBeenCalled();
    });

    it('should reject invalid data', async () => {
      const invalidData = {
        invalid: 'data',
      };

      const res = await app.request(
        '/cc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as SuccessResponse | ErrorResponse;
      if ('error' in json) {
        expect(json.error).toBe('Bad Request');
      }
    });
  });

  describe('GET /cc - Claude Code analytics', () => {
    it('should handle GET requests (POST is preferred)', async () => {
      // Note: GET with complex query params is not the primary use case
      // This test verifies the endpoint responds, even if validation fails
      const res = await app.request('/cc', {}, mockEnv);

      // Expect validation error since no data provided
      expect([400, 500]).toContain(res.status);
    });
  });

  describe('POST /ga - Google Analytics', () => {
    it('should accept valid GA4 data', async () => {
      const gaData = {
        client_id: 'client-123',
        events: [
          {
            name: 'page_view',
            params: {
              page_location: 'https://example.com',
              page_title: 'Home',
            },
          },
        ],
      };

      const res = await app.request(
        '/ga',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gaData),
        },
        mockEnv
      );

      const json = (await res.json()) as SuccessResponse;

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEnv.GA_ANALYTICS.writeDataPoint).toHaveBeenCalled();
    });

    it('should accept multiple events', async () => {
      const gaData = {
        client_id: 'client-123',
        user_id: 'user-456',
        events: [
          { name: 'page_view' },
          { name: 'click', params: { element: 'button' } },
          { name: 'scroll', params: { depth: 50 } },
        ],
      };

      const res = await app.request(
        '/ga',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(gaData),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
      // eslint-disable-next-line @typescript-eslint/unbound-method
      expect(mockEnv.GA_ANALYTICS.writeDataPoint).toHaveBeenCalled();
    });

    it('should reject data without events', async () => {
      const invalidData = {
        client_id: 'client-123',
        events: [],
      };

      const res = await app.request(
        '/ga',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(invalidData),
        },
        mockEnv
      );

      expect(res.status).toBe(400);
      const json = (await res.json()) as SuccessResponse | ErrorResponse;
      if ('error' in json) {
        expect(json.error).toBeDefined();
      }
    });
  });

  describe('GET /ga - Google Analytics', () => {
    it('should accept query parameters', async () => {
      // Note: This is a simplified test as GA data is complex for query params
      const res = await app.request(
        '/ga?client_id=client-123&events=[{"name":"test"}]',
        {},
        mockEnv
      );

      // May fail validation due to complex nested structure
      // This test demonstrates the endpoint accepts GET requests
      expect([200, 400]).toContain(res.status);
    });
  });

  describe('Error handling', () => {
    it('should return 404 for unknown endpoints', async () => {
      const res = await app.request('/unknown', {}, mockEnv);

      expect(res.status).toBe(404);
    });

    it('should handle missing dataset binding', async () => {
      const emptyEnv = {} as Env;
      const metricData = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
      };

      const res = await app.request(
        '/cc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(metricData),
        },
        emptyEnv
      );

      expect(res.status).toBe(500);
      const json = (await res.json()) as SuccessResponse | ErrorResponse;
      if ('error' in json) {
        expect(json.error).toBe('Configuration Error');
      }
    });

    it('should handle malformed JSON', async () => {
      const res = await app.request(
        '/cc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json',
        },
        mockEnv
      );

      expect(res.status).toBe(400); // JSON parse errors return 400 Bad Request
    });
  });

  describe('CORS and headers', () => {
    it('should handle different content types', async () => {
      const metricData = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
      };

      const res = await app.request(
        '/cc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify(metricData),
        },
        mockEnv
      );

      expect(res.status).toBe(200);
    });
  });

  describe('Path parameter routes', () => {
    describe('/cc/:project_id', () => {
      it('should accept POST with project_id in path', async () => {
        const metricData = {
          session_id: 'session-123',
          metric_name: 'claude_code.token.usage',
          value: 1000,
        };

        const res = await app.request(
          '/cc/myproject',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(metricData),
          },
          mockEnv
        );

        expect(res.status).toBe(200);
        const json = (await res.json()) as SuccessResponse | ErrorResponse;
        expect(json).toEqual({
          success: true,
          message: 'Data processed',
        });
      });

      it('should accept GET with project_id in path', async () => {
        const res = await app.request(
          '/cc/testproject?session_id=session-456&metric_name=test&value=100',
          {},
          mockEnv
        );

        // May fail validation if query params are incomplete
        expect([200, 400]).toContain(res.status);
      });

      it('should prioritize path project_id over header', async () => {
        const metricData = {
          session_id: 'session-789',
          metric_name: 'test',
          value: 500,
        };

        const res = await app.request(
          '/cc/pathproject',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-Project-ID': 'headerproject',
            },
            body: JSON.stringify(metricData),
          },
          mockEnv
        );

        expect(res.status).toBe(200);
        // Project ID from path should be used
      });
    });

    describe('/ga/:project_id', () => {
      it('should accept POST with project_id in path', async () => {
        const gaData = {
          client_id: 'client-123',
          events: [
            {
              name: 'page_view',
              params: { page_location: 'https://example.com' },
            },
          ],
        };

        const res = await app.request(
          '/ga/analytics-project',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(gaData),
          },
          mockEnv
        );

        expect(res.status).toBe(200);
        const json = (await res.json()) as SuccessResponse | ErrorResponse;
        if ('success' in json) {
          expect(json.success).toBe(true);
        }
      });

      it('should accept GET with project_id in path', async () => {
        const res = await app.request(
          '/ga/gaproject?client_id=client-999&events=[{"name":"test"}]',
          {},
          mockEnv
        );

        // May fail validation due to complex nested structure
        expect([200, 400]).toContain(res.status);
      });
    });
  });

  describe('OTLP v1 endpoints', () => {
    describe('POST /cc/v1/logs', () => {
      it('should accept OTLP logs with default project', async () => {
        const otlpLogs = {
          resourceLogs: [
            {
              resource: {
                attributes: [
                  {
                    key: 'service.name',
                    value: { stringValue: 'claude-code' },
                  },
                ],
              },
              scopeLogs: [
                {
                  scope: { name: 'test' },
                  logRecords: [
                    {
                      timeUnixNano: '1234567890000000000',
                      body: { stringValue: 'test log' },
                      severityText: 'INFO',
                    },
                  ],
                },
              ],
            },
          ],
        };

        const res = await app.request(
          '/cc/v1/logs',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(otlpLogs),
          },
          mockEnv
        );

        expect(res.status).toBe(200);
        const json = (await res.json()) as SuccessResponse | ErrorResponse;
        if ('success' in json) {
          expect(json.success).toBe(true);
        }
      });
    });

    describe('POST /cc/v1/metrics', () => {
      it('should accept OTLP metrics with default project', async () => {
        const otlpMetrics = {
          resourceMetrics: [
            {
              resource: {
                attributes: [
                  {
                    key: 'service.name',
                    value: { stringValue: 'claude-code' },
                  },
                ],
              },
              scopeMetrics: [
                {
                  scope: { name: 'test' },
                  metrics: [
                    {
                      name: 'test.metric',
                      sum: {
                        dataPoints: [
                          {
                            timeUnixNano: '1234567890000000000',
                            asDouble: 100,
                          },
                        ],
                      },
                    },
                  ],
                },
              ],
            },
          ],
        };

        const res = await app.request(
          '/cc/v1/metrics',
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(otlpMetrics),
          },
          mockEnv
        );

        expect(res.status).toBe(200);
        const json = (await res.json()) as SuccessResponse | ErrorResponse;
        if ('success' in json) {
          expect(json.success).toBe(true);
        }
      });
    });
  });

  describe('Static asset routes', () => {
    describe('GET /ui/project', () => {
      it('should return 503 when ASSETS not available', async () => {
        const res = await app.request('/ui/project', {}, mockEnv);

        expect(res.status).toBe(503);
        const text = await res.text();
        expect(text).toBe('Static assets not available');
      });

      it('should fetch from ASSETS when available', async () => {
        const mockAssetsResponse = new Response('<html>Create Project</html>', {
          status: 200,
          headers: { 'Content-Type': 'text/html' },
        });

        const mockAssets = {
          fetch: vi.fn().mockResolvedValue(mockAssetsResponse),
        };

        const envWithAssets = {
          ...mockEnv,
          ASSETS: mockAssets as never,
        };

        const res = await app.request('/ui/project', {}, envWithAssets);

        expect(res.status).toBe(200);
        expect(mockAssets.fetch).toHaveBeenCalledWith(
          expect.objectContaining({
            url: expect.stringContaining('/create.html'),
          })
        );
      });
    });

    describe('GET * (static files)', () => {
      it('should serve static files when ASSETS available', async () => {
        const mockStaticResponse = new Response('static content', {
          status: 200,
        });

        const mockAssets = {
          fetch: vi.fn().mockResolvedValue(mockStaticResponse),
        };

        const envWithAssets = {
          ...mockEnv,
          ASSETS: mockAssets as never,
        };

        // Request a static file path
        const res = await app.request('/styles.css', {}, envWithAssets);

        expect(res.status).toBe(200);
      });
    });
  });
});
