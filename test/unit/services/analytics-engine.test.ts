import { describe, it, expect, vi } from 'vitest';
import { AnalyticsEngineService } from '../../../src/services/analytics-engine.js';
import type { Env, DataAdapter, AnalyticsEngineDataPoint } from '../../../src/types/index.js';

describe('AnalyticsEngineService', () => {
  const service = new AnalyticsEngineService();

  const mockAdapter: DataAdapter = {
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

  const mockDataset = {
    writeDataPoint: vi.fn(),
  };

  const mockEnv: Env = {
    CLAUDE_CODE_ANALYTICS: mockDataset,
    GA_ANALYTICS: mockDataset,
  };

  it('should write valid data to Analytics Engine', async () => {
    const rawData = { test: 'value' };
    const validateSpy = vi.spyOn(mockAdapter, 'validate');
    const transformSpy = vi.spyOn(mockAdapter, 'transform');

    await service.writeDataPoint(mockEnv, 'CLAUDE_CODE_ANALYTICS', mockAdapter, rawData);

    expect(validateSpy).toHaveBeenCalledWith(rawData);
    expect(transformSpy).toHaveBeenCalledWith(rawData);
    expect(mockDataset.writeDataPoint).toHaveBeenCalledWith({
      indexes: ['test-index'],
      blobs: ['test-blob'],
      doubles: [123],
    });

    validateSpy.mockRestore();
    transformSpy.mockRestore();
  });

  it('should throw error for invalid data', async () => {
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

    await expect(
      service.writeDataPoint(mockEnv, 'CLAUDE_CODE_ANALYTICS', invalidAdapter, { invalid: 'data' })
    ).rejects.toThrow('Invalid data format');

    expect(validateSpy).toHaveBeenCalled();
    expect(transformSpy).not.toHaveBeenCalled();

    validateSpy.mockRestore();
    transformSpy.mockRestore();
  });

  it('should throw error for missing dataset binding', async () => {
    const emptyEnv = {} as Env;

    await expect(
      service.writeDataPoint(emptyEnv, 'CLAUDE_CODE_ANALYTICS', mockAdapter, { test: 'value' })
    ).rejects.toThrow('Dataset binding not found: CLAUDE_CODE_ANALYTICS');
  });

  it('should handle GA_ANALYTICS dataset', async () => {
    const rawData = { test: 'value' };

    await service.writeDataPoint(mockEnv, 'GA_ANALYTICS', mockAdapter, rawData);

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

    await service.writeDataPoint(mockEnv, 'CLAUDE_CODE_ANALYTICS', orderedAdapter, { test: 'value' });

    expect(callOrder).toEqual(['validate', 'transform']);
  });
});
