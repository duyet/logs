import { describe, it, expect, beforeEach } from 'vitest';
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
    it('should return mock insights when credentials not provided', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result).toBeDefined();
      expect(result.summary).toBeDefined();
      expect(result.summary.dataset).toBe('CLAUDE_CODE_METRICS');
      expect(result.summary.totalEvents).toBeGreaterThan(0);
      expect(result.summary.topProjects).toHaveLength(5);
      expect(result.insights).toBeDefined();
      expect(result.insights.trends).toBeInstanceOf(Array);
      expect(result.insights.anomalies).toBeInstanceOf(Array);
      expect(result.insights.recommendations).toBeInstanceOf(Array);
      expect(result.data.timeseries).toBeInstanceOf(Array);
      expect(result.data.breakdown).toBeDefined();
    });

    it('should use default time range when not provided', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_LOGS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.summary.timeRange.start).toBeDefined();
      expect(result.summary.timeRange.end).toBeDefined();

      const start = new Date(result.summary.timeRange.start);
      const end = new Date(result.summary.timeRange.end);
      const diffHours = (end.getTime() - start.getTime()) / (1000 * 60 * 60);

      expect(diffHours).toBeCloseTo(24, 0);
    });

    it('should use provided time range', async () => {
      const start = '2024-01-01T00:00:00Z';
      const end = '2024-01-02T00:00:00Z';

      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_ANALYTICS',
        timeRange: { start, end },
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.summary.timeRange.start).toBe(start);
      expect(result.summary.timeRange.end).toBe(end);
    });

    it('should generate time series data', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.data.timeseries.length).toBeGreaterThan(0);

      result.data.timeseries.forEach((point) => {
        expect(point.timestamp).toBeDefined();
        expect(typeof point.value).toBe('number');
        expect(point.value).toBeGreaterThanOrEqual(0);
      });
    });

    it('should generate project breakdown', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'GA_ANALYTICS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.data.breakdown).toBeDefined();
      expect(Object.keys(result.data.breakdown).length).toBeGreaterThan(0);

      Object.values(result.data.breakdown).forEach((count) => {
        expect(typeof count).toBe('number');
        expect(count).toBeGreaterThan(0);
      });
    });

    it('should generate trends', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.insights.trends.length).toBeGreaterThan(0);

      result.insights.trends.forEach((trend) => {
        expect(trend.metric).toBeDefined();
        expect(typeof trend.change).toBe('number');
        expect(['up', 'down', 'stable']).toContain(trend.direction);
        expect(trend.description).toBeDefined();
      });
    });

    it('should generate anomalies', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_LOGS',
      };

      const result = await service.getInsights(mockEnv, params);

      result.insights.anomalies.forEach((anomaly) => {
        expect(anomaly.timestamp).toBeDefined();
        expect(anomaly.description).toBeDefined();
        expect(['low', 'medium', 'high']).toContain(anomaly.severity);
        expect(typeof anomaly.value).toBe('number');
      });
    });

    it('should generate recommendations', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_METRICS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.insights.recommendations.length).toBeGreaterThan(0);

      result.insights.recommendations.forEach((rec) => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });

    it('should handle all dataset types', async () => {
      const datasets: AnalyticsQueryParams['dataset'][] = [
        'CLAUDE_CODE_ANALYTICS',
        'CLAUDE_CODE_LOGS',
        'CLAUDE_CODE_METRICS',
        'GA_ANALYTICS',
      ];

      for (const dataset of datasets) {
        const params: AnalyticsQueryParams = { dataset };
        const result = await service.getInsights(mockEnv, params);

        expect(result.summary.dataset).toBe(dataset);
      }
    });

    it('should include top projects in summary', async () => {
      const params: AnalyticsQueryParams = {
        dataset: 'CLAUDE_CODE_ANALYTICS',
      };

      const result = await service.getInsights(mockEnv, params);

      expect(result.summary.topProjects).toBeInstanceOf(Array);
      expect(result.summary.topProjects.length).toBeLessThanOrEqual(5);

      result.summary.topProjects.forEach((project, index) => {
        expect(project.id).toBeDefined();
        expect(typeof project.count).toBe('number');

        // Should be sorted by count descending
        if (index > 0) {
          expect(project.count).toBeLessThanOrEqual(
            result.summary.topProjects[index - 1].count
          );
        }
      });
    });
  });
});
