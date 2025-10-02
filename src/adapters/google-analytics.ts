import { BaseAdapter } from './base.js';
import type {
	AnalyticsEngineDataPoint,
	GoogleAnalyticsData,
} from '../types/index.js';

/**
 * Adapter for Google Analytics GA4 Measurement Protocol format
 */
export class GoogleAnalyticsAdapter extends BaseAdapter<GoogleAnalyticsData> {
	validate(data: unknown): data is GoogleAnalyticsData {
		if (!this.isObject(data)) {
			return false;
		}

		return (
			this.isString(data.client_id) &&
			Array.isArray(data.events) &&
			data.events.length > 0 &&
			data.events.every(
				(event) =>
					this.isObject(event) &&
					this.isString(event.name) &&
					(event.params === undefined || this.isObject(event.params))
			)
		);
	}

	transform(data: GoogleAnalyticsData): AnalyticsEngineDataPoint {
		const indexes: string[] = [this.toIndex(data.client_id)];

		// Add project_id as first indexed field for filtering
		if (data.project_id) {
			indexes.unshift(this.toIndex(data.project_id));
		}

		if (data.user_id) {
			indexes.push(this.toIndex(data.user_id));
		}

		// Add event names as indexes
		data.events.forEach((event) => {
			indexes.push(this.toIndex(event.name));
		});

		const blobs: string[] = [];

		if (data.timestamp_micros) {
			blobs.push(this.toBlob(data.timestamp_micros));
		}

		if (data.user_properties) {
			blobs.push(this.toBlob(JSON.stringify(data.user_properties)));
		}

		// Store event params as JSON blobs
		data.events.forEach((event) => {
			if (event.params) {
				blobs.push(this.toBlob(JSON.stringify(event.params)));
			}
		});

		const doubles: number[] = [data.events.length];

		return { indexes, blobs, doubles };
	}
}
