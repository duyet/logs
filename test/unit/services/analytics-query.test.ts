/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  AnalyticsQueryService,
  type AnalyticsQueryParams,
} from '../../../src/services/analytics-query.js';
import type { Env } from '../../../src/types/index.js';

describe('AnalyticsQueryService', () => {
  let service: AnalyticsQueryService;
  let mockEnv: Env;

  beforeEach(() => {
    service = new AnalyticsQueryService();
    mockEnv = {
      CLAUDE_CODE_ANALYTICS: {} as any,
      CLAUDE_CODE_LOGS: {} as any,
      CLAUDE_CODE_METRICS: {} as any,
      GA_ANALYTICS: {} as any,
      DB: {} as any,
    };
  });

  describe('getInsights', () => {
    it('should throw error when credentials not provided', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      await expect(service.getInsights(mockEnv, params)).rejects.toThrow(
        'Analytics Engine credentials not configured'
      );
    });

    it('should throw error for any dataset without credentials', async () => {
      const datasets: AnalyticsQueryParams['dataset'][] = [
        'CLAUDE_CODE_ANALYTICS',
        'CLAUDE_CODE_LOGS',
        'CLAUDE_CODE_METRICS',
        'GA_ANALYTICS',
      ];

      for (const dataset of datasets) {
        const params: AnalyticsQueryParams = { dataset };
        await expect(service.getInsights(mockEnv, params)).rejects.toThrow(
          'Analytics Engine credentials not configured'
        );
      }
    });

    it('should accept Secrets Store binding for credentials', async () => {
      const mockEnvWithSecrets = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: {
          get: vi.fn().mockResolvedValue('test-account-id'),
        },
        CLOUDFLARE_API_TOKEN: {
          get: vi.fn().mockResolvedValue('test-api-token'),
        },
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      // Mock fetch to return valid response
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });

      const result = await service.getInsights(
        mockEnvWithSecrets as any,
        params
      );

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.insights).toBeDefined();
      expect(result.data).toBeDefined();
    });

    it('should accept plain string credentials from env vars', async () => {
      const mockEnvWithStrings = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account-id',
        CLOUDFLARE_API_TOKEN: 'test-api-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });

      const result = await service.getInsights(
        mockEnvWithStrings as any,
        params
      );

      expect(result).toBeDefined();
    });

    it('should use default time range when not provided', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });
      global.fetch = mockFetch;

      await service.getInsights(mockEnvWithCreds as any, params);

      expect(mockFetch).toHaveBeenCalled();
      const callArgs = mockFetch.mock.calls[0];
      expect(callArgs).toBeDefined();
      expect(callArgs![1].body).toContain('NOW() - INTERVAL');
    });

    it('should use custom time range when provided', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
        timeRange: {
          start: '2024-01-01T00:00:00Z',
          end: '2024-01-02T00:00:00Z',
        },
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });
      global.fetch = mockFetch;

      await service.getInsights(mockEnvWithCreds as any, params);

      expect(mockFetch).toHaveBeenCalled();
      const query = mockFetch.mock.calls[0]![1].body;
      expect(query).toContain("INTERVAL '24' HOUR");
    });

    it('should add project filter when project_id provided', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
        projectId: 'my-project',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });
      global.fetch = mockFetch;

      await service.getInsights(mockEnvWithCreds as any, params);

      const query = mockFetch.mock.calls[0]![1].body;
      expect(query).toContain("AND index1 = 'my-project'");
    });

    it('should use custom limit when provided', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
        limit: 500,
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });
      global.fetch = mockFetch;

      await service.getInsights(mockEnvWithCreds as any, params);

      const query = mockFetch.mock.calls[0]![1].body;
      expect(query).toContain('LIMIT 500');
    });

    it('should use dataset name from environment variables', async () => {
      const mockEnvWithDataset = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
        DATASET_CLAUDE_CODE_METRICS: 'custom_dataset_name',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });
      global.fetch = mockFetch;

      await service.getInsights(mockEnvWithDataset as any, params);

      const query = mockFetch.mock.calls[0]![1].body;
      expect(query).toContain('FROM custom_dataset_name');
    });

    it('should use default dataset mapping when env var not set', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });
      global.fetch = mockFetch;

      await service.getInsights(mockEnvWithCreds as any, params);

      const query = mockFetch.mock.calls[0]![1].body;
      expect(query).toContain('FROM duyet_logs_claude_code_metrics');
    });

    it('should throw error when SQL API returns error', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        text: vi.fn().mockResolvedValue('Internal Server Error'),
      });

      await expect(
        service.getInsights(mockEnvWithCreds as any, params)
      ).rejects.toThrow('SQL API query failed: 500 Internal Server Error');
    });

    it('should parse JSONEachRow format correctly', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const mockData = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          index1: 'project1',
          blob1: '{}',
          double1: 100,
          _sample_interval: 1,
        },
        {
          timestamp: '2024-01-01T01:00:00Z',
          index1: 'project1',
          blob1: '{}',
          double1: 150,
          _sample_interval: 1,
        },
        {
          timestamp: '2024-01-01T02:00:00Z',
          index1: 'project2',
          blob1: '{}',
          double1: 200,
          _sample_interval: 2,
        },
      ];

      const mockResponse = mockData.map((d) => JSON.stringify(d)).join('\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      expect(result.summary.totalEvents).toBe(4); // 1 + 1 + 2 (accounting for sample intervals)
      expect(result.summary.topProjects).toHaveLength(2);
      expect(result.data.timeseries).toHaveLength(3);
    });

    it('should calculate trends correctly', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      // Create data with increasing trend
      const mockData = Array.from({ length: 20 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        index1: 'project1',
        blob1: '{}',
        double1: 100 + i * 10, // Increasing values
        _sample_interval: 1,
      }));

      const mockResponse = mockData.map((d) => JSON.stringify(d)).join('\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      expect(result.insights.trends).toHaveLength(1);
      expect(result.insights.trends[0]?.direction).toBe('up');
      expect(result.insights.trends[0]?.metric).toBe('event_volume');
    });

    it('should detect anomalies correctly', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      // Create data with an anomaly
      const baseValue = 100;
      const mockData = Array.from({ length: 15 }, (_, i) => ({
        timestamp: new Date(Date.now() + i * 60000).toISOString(),
        index1: 'project1',
        blob1: '{}',
        double1: i === 10 ? 1000 : baseValue, // Anomaly at index 10
        _sample_interval: 1,
      }));

      const mockResponse = mockData.map((d) => JSON.stringify(d)).join('\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      expect(result.insights.anomalies.length).toBeGreaterThan(0);
      expect(result.insights.anomalies[0]?.severity).toBeDefined();
    });

    it('should generate recommendations for CLAUDE_CODE_METRICS dataset', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      // Need at least 2 data points to generate insights
      const mockData = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          index1: 'project1',
          blob1: '{}',
          double1: 100,
          _sample_interval: 1,
        },
        {
          timestamp: '2024-01-01T01:00:00Z',
          index1: 'project1',
          blob1: '{}',
          double1: 110,
          _sample_interval: 1,
        },
      ];

      const mockResponse = mockData.map((d) => JSON.stringify(d)).join('\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      expect(result.insights.recommendations).toContain(
        'Monitor token usage trends to optimize costs'
      );
    });

    it('should handle empty results gracefully', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(''),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      expect(result.summary.totalEvents).toBe(0);
      expect(result.summary.topProjects).toHaveLength(0);
      expect(result.data.timeseries).toHaveLength(0);
      expect(result.insights.trends).toHaveLength(0);
      expect(result.insights.anomalies).toHaveLength(0);
    });

    it('should account for sampling intervals in project counts', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const mockData = [
        {
          timestamp: '2024-01-01T00:00:00Z',
          index1: 'project1',
          blob1: '{}',
          double1: 100,
          _sample_interval: 5,
        },
        {
          timestamp: '2024-01-01T01:00:00Z',
          index1: 'project2',
          blob1: '{}',
          double1: 50,
          _sample_interval: 10,
        },
      ];

      const mockResponse = mockData.map((d) => JSON.stringify(d)).join('\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      // project1: 100 * 5 = 500
      // project2: 50 * 10 = 500
      expect(result.data.breakdown.project1).toBe(500);
      expect(result.data.breakdown.project2).toBe(500);
    });

    it('should limit top projects to 5', async () => {
      const mockEnvWithCreds = {
        ...mockEnv,
        CLOUDFLARE_ACCOUNT_ID: 'test-account',
        CLOUDFLARE_API_TOKEN: 'test-token',
      };

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const mockData = Array.from({ length: 10 }, (_, i) => ({
        timestamp: '2024-01-01T00:00:00Z',
        index1: `project${i}`,
        blob1: '{}',
        double1: 100 - i * 5,
        _sample_interval: 1,
      }));

      const mockResponse = mockData.map((d) => JSON.stringify(d)).join('\n');

      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        text: vi.fn().mockResolvedValue(mockResponse),
      });

      const result = await service.getInsights(mockEnvWithCreds as any, params);

      expect(result.summary.topProjects).toHaveLength(5);
    });
  });
});
