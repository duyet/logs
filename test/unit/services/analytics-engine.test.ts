import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AnalyticsEngineService } from '../../../src/services/analytics-engine.js';
import type {
  Env,
  DataAdapter,
  AnalyticsEngineDataPoint,
} from '../../../src/types/index.js';

describe('AnalyticsEngineService', () => {
  let service: AnalyticsEngineService;
  let mockAdapter: DataAdapter;
  let mockDataset: { writeDataPoint: ReturnType<typeof vi.fn> };
  let mockEnv: Env;

  beforeEach(() => {
    service = new AnalyticsEngineService();

    mockAdapter = {
      validate(data: unknown): data is unknown {
        return typeof data === 'object' && data !== null && 'test' in data;
      },
      transform(_data: unknown): AnalyticsEngineDataPoint {
        return {
          indexes: ['test-index'],
          blobs: ['test-blob'],
          doubles: [123],
        };
      },
    };

    mockDataset = {
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

    // Reset mocks before each test
    mockDataset.writeDataPoint.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('writeDataPoint', () => {
    it('should write valid data to Analytics Engine', async () => {
      const rawData = { test: 'value' };
      const validateSpy = vi.spyOn(mockAdapter, 'validate');
      const transformSpy = vi.spyOn(mockAdapter, 'transform');

      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        rawData
      );

      expect(result.success).toBe(true);
      expect(result.error).toBeUndefined();
      expect(validateSpy).toHaveBeenCalledWith(rawData);
      expect(transformSpy).toHaveBeenCalledWith(rawData);
      expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
        indexes: ['test-index'],
        blobs: ['test-blob'],
        doubles: [123],
      });
      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);

      validateSpy.mockRestore();
      transformSpy.mockRestore();
    });

    it('should return error for invalid data', async () => {
      const invalidAdapter: DataAdapter = {
        validate(_data: unknown): _data is unknown {
          return false;
        },
        transform() {
          return { indexes: [], blobs: [], doubles: [] };
        },
      };

      const validateSpy = vi.spyOn(invalidAdapter, 'validate');
      const transformSpy = vi.spyOn(invalidAdapter, 'transform');

      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        invalidAdapter,
        { invalid: 'data' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid data format');
      expect(validateSpy).toHaveBeenCalled();
      expect(transformSpy).not.toHaveBeenCalled();
      expect(mockDataset.writeDataPoint).not.toHaveBeenCalled();

      validateSpy.mockRestore();
      transformSpy.mockRestore();
    });

    it('should return error for missing dataset binding', async () => {
      const emptyEnv = {} as Env;

      const result = await service.writeDataPoint(
        emptyEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        { test: 'value' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Dataset binding not found: CLAUDE_CODE_ANALYTICS'
      );
    });

    it('should handle GA_ANALYTICS dataset', async () => {
      const rawData = { test: 'value' };

      const result = await service.writeDataPoint(
        mockEnv,
        'GA_ANALYTICS',
        mockAdapter,
        rawData
      );

      expect(result.success).toBe(true);
      expect(mockDataset.writeDataPoint).toHaveBeenCalled();
    });

    it('should validate before transforming', async () => {
      const callOrder: string[] = [];

      const orderedAdapter: DataAdapter = {
        validate(_data: unknown): _data is unknown {
          callOrder.push('validate');
          return true;
        },
        transform(_data: unknown) {
          callOrder.push('transform');
          return { indexes: [], blobs: [], doubles: [] };
        },
      };

      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        orderedAdapter,
        { test: 'value' }
      );

      expect(result.success).toBe(true);
      expect(callOrder).toEqual(['validate', 'transform']);
    });

    it('should retry on write failure with exponential backoff', async () => {
      vi.useFakeTimers();

      // Mock writeDataPoint to fail twice then succeed
      mockDataset.writeDataPoint
        .mockImplementationOnce(() => {
          throw new Error('Temporary failure 1');
        })
        .mockImplementationOnce(() => {
          throw new Error('Temporary failure 2');
        })
        .mockImplementationOnce(() => {
          // Success on third attempt
        });

      const rawData = { test: 'value' };
      const result = service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        rawData
      );

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      const awaitedResult = await result;

      expect(awaitedResult.success).toBe(true);
      expect(awaitedResult.error).toBeUndefined();
      // Should be called 3 times (2 failures + 1 success)
      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(3);
    });

    it('should return error after max retries exhausted', async () => {
      vi.useFakeTimers();

      // Mock writeDataPoint to always fail
      mockDataset.writeDataPoint.mockImplementation(() => {
        throw new Error('Persistent failure');
      });

      const rawData = { test: 'value' };
      const result = service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        rawData
      );

      // Fast-forward through all retry delays
      await vi.runAllTimersAsync();
      const awaitedResult = await result;

      expect(awaitedResult.success).toBe(false);
      expect(awaitedResult.error).toBe('Persistent failure');
      // Should be called 3 times (max 2 retries + initial attempt)
      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(3);
    });

    it('should handle non-Error exceptions', async () => {
      // Mock writeDataPoint to throw non-Error object
      mockDataset.writeDataPoint.mockImplementation(() => {
        // eslint-disable-next-line @typescript-eslint/only-throw-error
        throw 'String error';
      });

      const rawData = { test: 'value' };
      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        rawData
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('String error');
    });

    it('should catch unexpected errors during validation', async () => {
      const faultyAdapter: DataAdapter = {
        validate(_data: unknown): _data is unknown {
          throw new Error('Validation crashed');
        },
        transform() {
          return { indexes: [], blobs: [], doubles: [] };
        },
      };

      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        faultyAdapter,
        { test: 'value' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Validation crashed');
      expect(mockDataset.writeDataPoint).not.toHaveBeenCalled();
    });

    it('should catch unexpected errors during transformation', async () => {
      const faultyAdapter: DataAdapter = {
        validate(_data: unknown): _data is unknown {
          return true;
        },
        transform() {
          throw new Error('Transform crashed');
        },
      };

      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        faultyAdapter,
        { test: 'value' }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Transform crashed');
      expect(mockDataset.writeDataPoint).not.toHaveBeenCalled();
    });

    it('should succeed on first attempt without retries', async () => {
      const rawData = { test: 'value' };
      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        rawData
      );

      expect(result.success).toBe(true);
      // Should only be called once (no retries needed)
      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);
    });

    it('should retry exactly once before succeeding', async () => {
      // Mock writeDataPoint to fail once then succeed
      mockDataset.writeDataPoint
        .mockImplementationOnce(() => {
          throw new Error('Temporary failure');
        })
        .mockImplementationOnce(() => {
          // Success on second attempt
        });

      const rawData = { test: 'value' };
      const result = await service.writeDataPoint(
        mockEnv,
        'CLAUDE_CODE_ANALYTICS',
        mockAdapter,
        rawData
      );

      expect(result.success).toBe(true);
      // Should be called 2 times (1 failure + 1 success)
      expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(2);
    });

    it('should handle all dataset types', async () => {
      const datasets: Array<keyof Env> = [
        'CLAUDE_CODE_ANALYTICS',
        'CLAUDE_CODE_LOGS',
        'CLAUDE_CODE_METRICS',
        'GA_ANALYTICS',
        'REALTIME_ANALYTICS',
        'LOGTAIL_ANALYTICS',
        'SENTRY_ANALYTICS',
      ];

      for (const dataset of datasets) {
        mockDataset.writeDataPoint.mockClear();

        const result = await service.writeDataPoint(
          mockEnv,
          dataset,
          mockAdapter,
          {
            test: 'value',
          }
        );

        expect(result.success).toBe(true);
        expect(mockDataset.writeDataPoint).toHaveBeenCalledTimes(1);
      }
    });
  });
});
