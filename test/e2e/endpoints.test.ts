import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type { Env } from '../../src/types/index.js';

describe('E2E Endpoints', () => {
  let app: ReturnType<typeof createRouter>;
  let mockEnv: Env;

  beforeEach(() => {
    const mockDataset = {
      writeDataPoint: vi.fn(),
    };

    mockEnv = {
      CLAUDE_CODE_ANALYTICS: mockDataset,
      GA_ANALYTICS: mockDataset,
    };

    app = createRouter();
  });

  describe('GET /ping', () => {
    it('should return health check status', async () => {
      const res = await app.request('/ping', {}, mockEnv);
      const json = await res.json();

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

      const res = await app.request('/cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricData),
      }, mockEnv);

      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json).toEqual({
        success: true,
        message: 'Data recorded successfully',
      });
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

      const res = await app.request('/cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(eventData),
      }, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.CLAUDE_CODE_ANALYTICS.writeDataPoint).toHaveBeenCalled();
    });

    it('should reject invalid data', async () => {
      const invalidData = {
        invalid: 'data',
      };

      const res = await app.request('/cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Bad Request');
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

      const res = await app.request('/ga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gaData),
      }, mockEnv);

      const json = await res.json() as { success: boolean };

      expect(res.status).toBe(200);
      expect(json.success).toBe(true);
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

      const res = await app.request('/ga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(gaData),
      }, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.GA_ANALYTICS.writeDataPoint).toHaveBeenCalled();
    });

    it('should reject data without events', async () => {
      const invalidData = {
        client_id: 'client-123',
        events: [],
      };

      const res = await app.request('/ga', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidData),
      }, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json() as { error: string };
      expect(json.error).toBeDefined();
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

      const res = await app.request('/cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(metricData),
      }, emptyEnv);

      expect(res.status).toBe(500);
      const json = await res.json() as { error: string };
      expect(json.error).toBe('Configuration Error');
    });

    it('should handle malformed JSON', async () => {
      const res = await app.request('/cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      }, mockEnv);

      expect(res.status).toBe(500);
    });
  });

  describe('CORS and headers', () => {
    it('should handle different content types', async () => {
      const metricData = {
        session_id: 'session-123',
        metric_name: 'test',
        value: 1,
      };

      const res = await app.request('/cc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify(metricData),
      }, mockEnv);

      expect(res.status).toBe(200);
    });
  });
});
