import type { AnalyticsEngineDataPoint, DataAdapter } from '../types/index.js';

/**
 * Base adapter class with common functionality
 */
export abstract class BaseAdapter<T> implements DataAdapter<T> {
  abstract transform(data: T): AnalyticsEngineDataPoint;
  abstract validate(data: unknown): data is T;

  /**
   * Safely convert value to string, truncating if needed
   */
  protected toBlob(value: unknown, maxLength = 5120): string {
    const str = String(value);
    return str.length > maxLength ? str.substring(0, maxLength) : str;
  }

  /**
   * Safely convert value to index string (max 96 bytes)
   */
  protected toIndex(value: unknown): string {
    const str = String(value);
    return str.length > 96 ? str.substring(0, 96) : str;
  }

  /**
   * Safely convert value to number
   */
  protected toDouble(value: unknown): number {
    const num = Number(value);
    return isNaN(num) ? 0 : num;
  }

  /**
   * Check if value is a non-null object
   */
  protected isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }

  /**
   * Check if value is a string
   */
  protected isString(value: unknown): value is string {
    return typeof value === 'string';
  }

  /**
   * Check if value is a number
   */
  protected isNumber(value: unknown): value is number {
    return typeof value === 'number' && !isNaN(value);
  }
}
