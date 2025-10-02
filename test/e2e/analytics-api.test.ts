/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRouter } from '../../src/routes/router.js';
import type { Env } from '../../src/types/index.js';

describe('Analytics API E2E', () => {
  let app: ReturnType<typeof createRouter>;
  let env: Env;

  beforeEach(() => {
    app = createRouter();
    env = {
      CLAUDE_CODE_ANALYTICS: {
        writeDataPoint: () => {},
      } as any,
      CLAUDE_CODE_LOGS: {
        writeDataPoint: () => {},
      } as any,
      CLAUDE_CODE_METRICS: {
        writeDataPoint: () => {},
      } as any,
      GA_ANALYTICS: {
        writeDataPoint: () => {},
      } as any,
      DB: {
        prepare: () => ({
          bind: () => ({
            first: () => Promise.resolve(null),
            all: () => Promise.resolve({ results: [] }),
            run: () => Promise.resolve({ success: true }),
          }),
        }),
      } as any,
    };
  });

  describe('GET /api/analytics/insights', () => {
    it('should return 503 when credentials not configured', async () => {
      const req = new Request(
        'http://localhost/api/analytics/insights?dataset=CLAUDE_CODE_METRICS'
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(503);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Service Unavailable');
      expect(data.message).toContain('credentials not configured');
    });

    it('should return 400 for missing dataset parameter', async () => {
      const req = new Request('http://localhost/api/analytics/insights');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('dataset');
    });

    it('should return 400 for invalid dataset', async () => {
      const req = new Request(
        'http://localhost/api/analytics/insights?dataset=INVALID_DATASET'
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('Invalid dataset');
    });

    it('should handle all valid datasets', async () => {
      const datasets = [
        'CLAUDE_CODE_ANALYTICS',
        'CLAUDE_CODE_LOGS',
        'CLAUDE_CODE_METRICS',
        'GA_ANALYTICS',
      ];

      for (const dataset of datasets) {
        const req = new Request(
          `http://localhost/api/analytics/insights?dataset=${dataset}`
        );
        const res = await app.fetch(req, env);

        expect(res.status).toBe(503);

        const data = (await res.json()) as any;
        expect(data.error).toBe('Service Unavailable');
      }
    });

    it('should return 503 when credentials missing even with time range', async () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-02T00:00:00Z';
      const req = new Request(
        `http://localhost/api/analytics/insights?dataset=CLAUDE_CODE_LOGS&start=${start}&end=${end}`
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(503);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Service Unavailable');
      expect(data.message).toContain('credentials not configured');
    });

    it('should return 400 for invalid time format', async () => {
      const req = new Request(
        'http://localhost/api/analytics/insights?dataset=CLAUDE_CODE_METRICS&start=invalid&end=invalid'
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(400);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Bad Request');
      expect(data.message).toContain('time format');
    });

    it('should return 503 for any query without credentials', async () => {
      const req = new Request(
        'http://localhost/api/analytics/insights?dataset=CLAUDE_CODE_ANALYTICS'
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(503);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Service Unavailable');
      expect(data.message).toContain('credentials not configured');
    });

    it('should return 503 even with project_id filter', async () => {
      const req = new Request(
        'http://localhost/api/analytics/insights?dataset=CLAUDE_CODE_METRICS&project_id=duyet'
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(503);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Service Unavailable');
    });

    it('should return 503 even with limit parameter', async () => {
      const req = new Request(
        'http://localhost/api/analytics/insights?dataset=GA_ANALYTICS&limit=100'
      );
      const res = await app.fetch(req, env);

      expect(res.status).toBe(503);

      const data = (await res.json()) as any;
      expect(data.error).toBe('Service Unavailable');
    });
  });

  describe('GET /api/analytics/datasets', () => {
    it('should list all available datasets', async () => {
      const req = new Request('http://localhost/api/analytics/datasets');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.datasets).toBeInstanceOf(Array);
      expect(data.datasets.length).toBe(4);

      const datasetNames = data.datasets.map((d: any) => d.name);
      expect(datasetNames).toContain('CLAUDE_CODE_ANALYTICS');
      expect(datasetNames).toContain('CLAUDE_CODE_LOGS');
      expect(datasetNames).toContain('CLAUDE_CODE_METRICS');
      expect(datasetNames).toContain('GA_ANALYTICS');
    });

    it('should include descriptions for each dataset', async () => {
      const req = new Request('http://localhost/api/analytics/datasets');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);

      const data = (await res.json()) as any;

      data.datasets.forEach((dataset: any) => {
        expect(dataset.name).toBeDefined();
        expect(dataset.description).toBeDefined();
        expect(typeof dataset.description).toBe('string');
        expect(dataset.description.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Root endpoint', () => {
    it('should include analytics API in endpoint list', async () => {
      const req = new Request('http://localhost/');
      const res = await app.fetch(req, env);

      expect(res.status).toBe(200);

      const data = (await res.json()) as any;
      expect(data.endpoints.api.analytics).toBe('/api/analytics/insights');
    });
  });
});
