import { describe, it, expect } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type { Env, ErrorResponse } from '../../src/types/index.js';

describe('Sentry Debug Endpoint E2E', () => {
  const mockEnv: Env = {
    CLAUDE_CODE_ANALYTICS: {
      writeDataPoint: () => {},
    },
    CLAUDE_CODE_LOGS: {
      writeDataPoint: () => {},
    },
    CLAUDE_CODE_METRICS: {
      writeDataPoint: () => {},
    },
    GA_ANALYTICS: {
      writeDataPoint: () => {},
    },
    REALTIME_ANALYTICS: {
      writeDataPoint: () => {},
    },
    LOGTAIL_ANALYTICS: {
      writeDataPoint: () => {},
    },
    SENTRY_ANALYTICS: {
      writeDataPoint: () => {},
    },
    DB: {} as D1Database,
  };

  describe('GET /debug-sentry', () => {
    it('should trigger a test error for Sentry integration testing', async () => {
      const app = createRouter();
      const req = new Request('http://localhost/debug-sentry');

      const res = await app.fetch(req, mockEnv);

      // The endpoint should throw an error, which will be caught by Hono's error handler
      expect(res.status).toBe(500);

      const json = await res.json();
      expect(json).toHaveProperty('error');
      expect((json as ErrorResponse).error).toContain('Internal Server Error');
    });

    it('should return 404 for non-existent routes', async () => {
      const app = createRouter();
      const req = new Request('http://localhost/non-existent');

      const res = await app.fetch(req, mockEnv);

      expect(res.status).toBe(404);
      const data = await res.json();
      expect(data).toEqual({
        error: 'Not Found',
        message: 'Endpoint not found',
      });
    });
  });
});
