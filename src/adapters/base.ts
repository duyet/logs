import type { AnalyticsEngineDataPoint, DataAdapter } from '../types/index.js';
import {
	isValidObject,
	isValidNumber,
	sanitizeString,
} from '../utils/validation.js';

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
		const sanitized = sanitizeString(str);
		return sanitized.length > maxLength
			? sanitized.substring(0, maxLength)
			: sanitized;
	}

	/**
	 * Safely convert value to index string (max 96 bytes)
	 */
	protected toIndex(value: unknown): string {
		const str = String(value);
		const sanitized = sanitizeString(str);
		return sanitized.length > 96 ? sanitized.substring(0, 96) : sanitized;
	}

	/**
	 * Safely convert value to number
	 */
	protected toDouble(value: unknown): number {
		const num = Number(value);
		return isNaN(num) ? 0 : num;
	}

	/**
	 * Check if value is a non-null object (uses validation utility)
	 */
	protected isObject(value: unknown): value is Record<string, unknown> {
		return isValidObject(value);
	}

	/**
	 * Check if value is a string (allows empty strings for analytics data)
	 */
	protected isString(value: unknown): value is string {
		return typeof value === 'string';
	}

	/**
	 * Check if value is a number (uses validation utility)
	 */
	protected isNumber(value: unknown): value is number {
		return isValidNumber(value);
	}
}
