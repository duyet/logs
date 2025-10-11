/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/restrict-template-expressions */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type { Env } from '../../src/types/index.js';

describe('Logtail Endpoint E2E', () => {
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

  describe('POST /logtail', () => {
    it('should accept single event with message only', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test log message',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toEqual({ success: true, message: 'Data processed' });
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept single event with timestamp and level', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Error occurred',
          dt: '2022-12-31T13:45:59.123456Z',
          level: 'error',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept single event with metadata fields', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'User login',
          level: 'info',
          userId: 'user-123',
          requestId: 'req-456',
          statusCode: 200,
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept multiple events as array', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          { message: 'Event A' },
          { message: 'Event B', level: 'warn' },
          { message: 'Event C', dt: 1672490759 },
        ]),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept UNIX timestamp in seconds', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Log with timestamp',
          dt: 1672490759,
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should accept UNIX timestamp in milliseconds', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Log with timestamp',
          dt: 1672490759123,
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should accept UNIX timestamp in nanoseconds', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Log with timestamp',
          dt: 1672490759123456000,
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should reject event without message field', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dt: '2022-12-31T13:45:59Z',
          level: 'info',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
      const json = await res.json();
      expect((json as { error: string }).error).toBe('Bad Request');
    });

    it('should reject empty array', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([]),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
    });

    it('should reject invalid JSON', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid json',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(400);
    });
  });

  describe('POST /logtail/:project_id', () => {
    it('should accept event with project_id in path', async () => {
      const req = new Request('http://localhost/logtail/myproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test log',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);

      // Verify project_id was passed to adapter
      const writeDataPoint = mockEnv.LOGTAIL_ANALYTICS
        .writeDataPoint as ReturnType<typeof vi.fn>;
      const call = writeDataPoint.mock.calls[0]?.[0];
      expect(call?.indexes).toEqual(['myproject']);
    });

    it('should handle project_id with hyphens', async () => {
      const req = new Request('http://localhost/logtail/my-test-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'Test log',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should accept batch events with project_id', async () => {
      const req = new Request('http://localhost/logtail/batchproject', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ message: 'Event 1' }, { message: 'Event 2' }]),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const writeDataPoint = mockEnv.LOGTAIL_ANALYTICS
        .writeDataPoint as ReturnType<typeof vi.fn>;
      const call = writeDataPoint.mock.calls[0]?.[0];
      expect(call?.indexes).toEqual(['batchproject']);
    });
  });

  describe('GET /logtail', () => {
    it('should accept single event via query parameters', async () => {
      const params = new URLSearchParams({
        message: 'Test via GET',
      });
      const req = new Request(`http://localhost/logtail?${params}`, {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should accept event with timestamp via query', async () => {
      const params = new URLSearchParams({
        message: 'Test via GET',
        dt: '1672490759',
        level: 'warn',
      });
      const req = new Request(`http://localhost/logtail?${params}`, {
        method: 'GET',
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });
  });

  describe('GET /logtail/:project_id', () => {
    it('should accept event with project_id via GET', async () => {
      const params = new URLSearchParams({
        message: 'Test GET with project',
      });
      const req = new Request(
        `http://localhost/logtail/testproject?${params}`,
        {
          method: 'GET',
        }
      );

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);

      const writeDataPoint = mockEnv.LOGTAIL_ANALYTICS
        .writeDataPoint as ReturnType<typeof vi.fn>;
      const call = writeDataPoint.mock.calls[0]?.[0];
      expect(call?.indexes).toEqual(['testproject']);
    });
  });

  describe('Real-world usage scenarios', () => {
    it('should handle Better Stack compatible format', async () => {
      // Example from Better Stack documentation
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: 'Bearer SOURCE_TOKEN', // Not validated in our implementation
        },
        body: JSON.stringify({
          message: 'logs is ready',
          nested: { values: 123 },
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should handle multiple logs in single request', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([{ message: 'A' }, { message: 'B' }]),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should handle log with custom timestamp', async () => {
      const req = new Request('http://localhost/logtail', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: 'I have arrived on time',
          dt: '2023-08-09 07:03:30+00:00',
        }),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
    });

    it('should handle application logs with structured data', async () => {
      const req = new Request('http://localhost/logtail/production', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([
          {
            message: 'User authentication successful',
            level: 'info',
            dt: Date.now(),
            userId: 'user-12345',
            sessionId: 'session-67890',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0...',
          },
          {
            message: 'Database query executed',
            level: 'debug',
            dt: Date.now(),
            queryTime: 45.2,
            rowsAffected: 3,
            table: 'users',
          },
          {
            message: 'API rate limit exceeded',
            level: 'warn',
            dt: Date.now(),
            endpoint: '/api/v1/users',
            clientId: 'client-abc',
            requestsRemaining: 0,
          },
        ]),
      });

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(200);
      expect(mockEnv.LOGTAIL_ANALYTICS.writeDataPoint).toHaveBeenCalledTimes(1);
    });
  });
});
