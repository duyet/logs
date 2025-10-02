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
    // Debug: log what we're validating
    console.log('[DEBUG] Analytics Service - validating data...');
    console.log('[DEBUG] Data keys:', Object.keys(rawData as object));

    // Validate input data
    if (!adapter.validate(rawData)) {
      console.error(
        '[ERROR] Validation failed for data:',
        JSON.stringify(rawData).substring(0, 500)
      );
      throw new Error('Invalid data format');
    }

    console.log('[DEBUG] Validation passed, transforming...');

    // Transform to Analytics Engine format
    const dataPoint: AnalyticsEngineDataPoint = adapter.transform(rawData);

    // Get dataset binding
    const dataset = env[datasetName] as AnalyticsEngineDataset;
    if (!dataset) {
      throw new Error(`Dataset binding not found: ${String(datasetName)}`);
    }

    console.log('[DEBUG] Writing to Analytics Engine...');

    // Write data point
    dataset.writeDataPoint(dataPoint);

    console.log('[DEBUG] Successfully written to Analytics Engine');
  }
}
