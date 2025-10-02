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
  });
});
