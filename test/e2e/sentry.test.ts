/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/unbound-method */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type { Env } from '../../src/types/index.js';

describe('Sentry Endpoint E2E', () => {
  let app: ReturnType<typeof createRouter>;
  let mockEnv: Env;

  beforeEach(() => {
    // Mock Analytics Engine dataset
    const mockDataset = {
      writeDataPoint: vi.fn(),
    };

    // Mock D1 database
    const mockDB = {
      prepare: vi.fn(() => ({
        bind: vi.fn(() => ({
          first: vi.fn(() => Promise.resolve(null)),
          all: vi.fn(() => Promise.resolve({ results: [] })),
          run: vi.fn(() => Promise.resolve({ success: true })),
        })),
        first: vi.fn(() => Promise.resolve(null)),
        all: vi.fn(() => Promise.resolve({ results: [] })),
        run: vi.fn(() => Promise.resolve({ success: true })),
      })),
    } as unknown as D1Database;

    mockEnv = {
      CLAUDE_CODE_ANALYTICS: mockDataset,
      CLAUDE_CODE_LOGS: mockDataset,
      CLAUDE_CODE_METRICS: mockDataset,
      GA_ANALYTICS: mockDataset,
      LOGTAIL_ANALYTICS: mockDataset,
      SENTRY_ANALYTICS: mockDataset,
      DB: mockDB,
    };

    app = createRouter();
  });

  describe('POST /sentry', () => {
    it('should accept minimal Sentry event (event_id only)', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true, message: 'Data processed' });
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept full Sentry event with exception', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'bb78c1407cea4519aa397afc059c793d',
          timestamp: '2024-01-01T12:00:00Z',
          platform: 'javascript',
          level: 'error',
          exception: {
            values: [
              {
                type: 'ReferenceError',
                value: 'foo is not defined',
              },
            ],
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with stacktrace', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'e4874d664c3540c1a32eab185f12c5ab',
          exception: {
            values: [
              {
                type: 'Error',
                value: 'Something went wrong',
                stacktrace: {
                  frames: [
                    {
                      filename: 'app.js',
                      function: 'handleClick',
                      lineno: 42,
                      colno: 10,
                      in_app: true,
                    },
                  ],
                },
              },
            ],
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with breadcrumbs', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            values: [
              {
                timestamp: '2024-01-01T11:59:00Z',
                message: 'User clicked button',
                category: 'ui.click',
              },
              {
                timestamp: '2024-01-01T11:59:30Z',
                message: 'User navigated',
                category: 'navigation',
              },
            ],
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with tags and extra', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          tags: {
            environment: 'production',
            version: '1.0.0',
          },
          extra: {
            userId: 'user-123',
            requestId: 'req-456',
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with user context', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            id: 'user-123',
            email: 'user@example.com',
            ip_address: '192.168.1.1',
            name: 'John Doe',
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with request context', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          request: {
            url: 'https://example.com/api/users',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with contexts (browser, os)', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          contexts: {
            browser: {
              name: 'Chrome',
              version: '120.0.0',
            },
            os: {
              name: 'macOS',
              version: '14.2',
            },
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should reject missing event_id', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform: 'javascript',
          level: 'error',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
    });

    it('should reject invalid event_id format', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'invalid-event-id',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
    });

    it('should reject invalid JSON', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).not.toHaveBeenCalled();
    });

    it('should handle missing SENTRY_ANALYTICS binding', async () => {
      const envWithoutSentry = { ...mockEnv };
      delete (envWithoutSentry as Partial<Env>).SENTRY_ANALYTICS;

      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        }),
      });

      const res = await app.fetch(req, envWithoutSentry);

      expect(res.status).toBe(500);
    });
  });

  describe('POST /sentry/:project_id', () => {
    it('should accept event with project_id in path', async () => {
      const req = new Request('http://localhost/sentry/myproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with hyphens in project_id', async () => {
      const req = new Request('http://localhost/sentry/my-sentry-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should verify project auto-creation', async () => {
      const req = new Request('http://localhost/sentry/newproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      // Verify project creation was attempted
      expect(mockEnv.DB.prepare).toHaveBeenCalled();
    });

    it('should include project_id in Analytics Engine index', async () => {
      const req = new Request('http://localhost/sentry/testproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const mockFn = mockEnv.SENTRY_ANALYTICS.writeDataPoint as ReturnType<
        typeof vi.fn
      >;
      const writeCall = mockFn.mock.calls[0];
      expect(writeCall).toBeDefined();
      expect(writeCall![0].indexes).toContain('testproject');
    });
  });

  describe('GET /sentry', () => {
    it('should accept query parameters (event_id, timestamp, level)', async () => {
      const req = new Request(
        'http://localhost/sentry?event_id=fc6d8c0c43fc4630ad850ee518f1b9d0&timestamp=2024-01-01T12:00:00Z&level=error'
      );

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should handle URL encoding', async () => {
      const req = new Request(
        'http://localhost/sentry?event_id=fc6d8c0c43fc4630ad850ee518f1b9d0&transaction=%2Fapi%2Fusers'
      );

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });
  });

  describe('Real-world scenarios', () => {
    it('should handle browser JavaScript error (ReferenceError)', async () => {
      const req = new Request('http://localhost/sentry/frontend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'bb78c1407cea4519aa397afc059c793d',
          timestamp: '2024-01-01T12:00:00Z',
          platform: 'javascript',
          level: 'error',
          logger: '',
          transaction: '/app',
          exception: {
            values: [
              {
                type: 'ReferenceError',
                value: 'blooopy is not defined',
                mechanism: {
                  type: 'onerror',
                  handled: false,
                },
                stacktrace: {
                  frames: [
                    {
                      filename: '/runner',
                      function: null,
                      lineno: 3,
                      colno: 5,
                      in_app: false,
                    },
                  ],
                },
              },
            ],
          },
          contexts: {
            browser: {
              name: 'Chrome',
              type: 'browser',
              version: '120.0.0',
            },
            os: {
              name: 'macOS',
              type: 'os',
              version: '14.2',
            },
          },
          user: {
            ip_address: '192.168.1.1',
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should handle server error with stacktrace', async () => {
      const req = new Request('http://localhost/sentry/backend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'e4874d664c3540c1a32eab185f12c5ab',
          timestamp: 1704110400,
          platform: 'python',
          level: 'error',
          server_name: 'api-server-1',
          environment: 'production',
          release: '2.0.0',
          exception: {
            values: [
              {
                type: 'ValueError',
                value: 'Invalid input parameter',
                module: 'api.handlers',
                stacktrace: {
                  frames: [
                    {
                      filename: 'handlers.py',
                      function: 'process_request',
                      lineno: 125,
                      in_app: true,
                    },
                    {
                      filename: 'validators.py',
                      function: 'validate_input',
                      lineno: 42,
                      in_app: true,
                    },
                  ],
                },
              },
            ],
          },
          request: {
            url: 'https://api.example.com/users',
            method: 'POST',
          },
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should handle unhandled promise rejection', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          platform: 'javascript',
          level: 'error',
          exception: {
            values: [
              {
                type: 'UnhandledRejection',
                value: 'Non-Error promise rejection captured with value: Error',
                mechanism: {
                  type: 'onunhandledrejection',
                  handled: false,
                },
              },
            ],
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should handle production error with release tag', async () => {
      const req = new Request('http://localhost/sentry/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          platform: 'javascript',
          level: 'error',
          environment: 'production',
          release: 'frontend@1.0.0',
          tags: {
            environment: 'production',
            version: '1.0.0',
          },
          exception: {
            values: [
              {
                type: 'TypeError',
                value: "Cannot read property 'map' of undefined",
              },
            ],
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should handle error with user identification', async () => {
      const req = new Request('http://localhost/sentry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          platform: 'javascript',
          level: 'warning',
          user: {
            id: 'user-123',
            username: 'john_doe',
            email: 'john@example.com',
          },
          exception: {
            values: [
              {
                type: 'ValidationError',
                value: 'Invalid email format',
              },
            ],
          },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.SENTRY_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });
  });
});
