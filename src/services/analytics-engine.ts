import type {
  AnalyticsEngineDataPoint,
  AnalyticsEngineDataset,
  DataAdapter,
  Env,
} from '../types/index.js';

/**
 * Service for writing data to Cloudflare Analytics Engine
 */
export class AnalyticsEngineService {
  /**
   * Write data point to Analytics Engine dataset
   */
  writeDataPoint<T>(
    env: Env,
    datasetName: keyof Env,
    adapter: DataAdapter<T>,
    rawData: unknown
  ): void {
    // Validate input data
    if (!adapter.validate(rawData)) {
      throw new Error('Invalid data format');
    }

    // Transform to Analytics Engine format
    const dataPoint: AnalyticsEngineDataPoint = adapter.transform(rawData);

    // Get dataset binding
    const dataset = env[datasetName] as AnalyticsEngineDataset;
    if (!dataset) {
      throw new Error(`Dataset binding not found: ${String(datasetName)}`);
    }

    // Write data point
    dataset.writeDataPoint(dataPoint);
  }
}
