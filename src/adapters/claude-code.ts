import { BaseAdapter } from './base.js';
import type {
	AnalyticsEngineDataPoint,
	ClaudeCodeData,
	ClaudeCodeMetric,
	ClaudeCodeEvent,
} from '../types/index.js';

/**
 * Adapter for Claude Code OpenTelemetry format
 */
export class ClaudeCodeAdapter extends BaseAdapter<ClaudeCodeData> {
	validate(data: unknown): data is ClaudeCodeData {
		if (!this.isObject(data)) {
			return false;
		}

		// Check if it's a metric
		if ('metric_name' in data && 'value' in data) {
			return (
				this.isString(data.session_id) &&
				this.isString(data.metric_name) &&
				this.isNumber(data.value)
			);
		}

		// Check if it's an event
		if ('event_name' in data) {
			return (
				this.isString(data.event_name) &&
				this.isString(data.timestamp) &&
				this.isString(data.session_id) &&
				this.isObject(data.attributes)
			);
		}

		return false;
	}

	transform(data: ClaudeCodeData): AnalyticsEngineDataPoint {
		if (this.isMetric(data)) {
			return this.transformMetric(data);
		}
		return this.transformEvent(data);
	}

	private isMetric(data: ClaudeCodeData): data is ClaudeCodeMetric {
		return 'metric_name' in data && 'value' in data;
	}

	private transformMetric(metric: ClaudeCodeMetric): AnalyticsEngineDataPoint {
		const indexes: string[] = [
			this.toIndex(metric.session_id),
			this.toIndex(metric.metric_name),
		];

		const blobs: string[] = [];
		const doubles: number[] = [metric.value];

		// Add project_id as first indexed field for filtering
		if (metric.project_id) {
			indexes.unshift(this.toIndex(metric.project_id));
		}

		if (metric.app_version) {
			indexes.push(this.toIndex(metric.app_version));
		}

		if (metric.organization_id) {
			indexes.push(this.toIndex(metric.organization_id));
		}

		if (metric.user_account_uuid) {
			indexes.push(this.toIndex(metric.user_account_uuid));
		}

		if (metric.timestamp) {
			blobs.push(this.toBlob(metric.timestamp));
		}

		if (metric.attributes) {
			if (metric.attributes.type) {
				indexes.push(this.toIndex(metric.attributes.type));
			}
			if (metric.attributes.model) {
				indexes.push(this.toIndex(metric.attributes.model));
			}
			if (metric.attributes.tool) {
				indexes.push(this.toIndex(metric.attributes.tool));
			}
			if (metric.attributes.decision) {
				indexes.push(this.toIndex(metric.attributes.decision));
			}
			if (metric.attributes.language) {
				indexes.push(this.toIndex(metric.attributes.language));
			}
		}

		return { indexes, blobs, doubles };
	}

	private transformEvent(event: ClaudeCodeEvent): AnalyticsEngineDataPoint {
		const indexes: string[] = [
			this.toIndex(event.session_id),
			this.toIndex(event.event_name),
		];

		const blobs: string[] = [
			this.toBlob(event.timestamp),
			this.toBlob(JSON.stringify(event.attributes)),
		];

		const doubles: number[] = [];

		// Add project_id as first indexed field for filtering
		if (event.project_id) {
			indexes.unshift(this.toIndex(event.project_id));
		}

		return { indexes, blobs, doubles };
	}
}
