/**
 * Test utilities for adapter tests
 * Reduces duplication and improves test maintainability
 */

import { expect } from 'vitest';
import type { AnalyticsEngineDataPoint } from '../../src/types/index.js';

/**
 * Parse metadata from Analytics Engine data point blob
 * Eliminates repetitive JSON.parse(result.blobs![0]!) pattern
 */
export function parseMetadata<T = Record<string, unknown>>(
  result: AnalyticsEngineDataPoint
): T {
  if (!result.blobs || result.blobs.length === 0) {
    throw new Error('No blobs found in result');
  }
  return JSON.parse(result.blobs[0]!) as T;
}

/**
 * Assert indexes match expected values
 * Common pattern across all adapter tests
 */
export function assertIndexes(
  result: AnalyticsEngineDataPoint,
  expected: string[]
): void {
  expect(result.indexes).toEqual(expected);
}

/**
 * Assert doubles match expected values
 */
export function assertDoubles(
  result: AnalyticsEngineDataPoint,
  expected: number[]
): void {
  expect(result.doubles).toEqual(expected);
}

/**
 * Assert metadata fields match expected values
 * Reduces repetitive metadata.field assertions
 */
export function assertMetadataFields<T = Record<string, unknown>>(
  result: AnalyticsEngineDataPoint,
  assertions: Partial<T>
): void {
  const metadata = parseMetadata<T>(result);

  Object.entries(assertions).forEach(([key, value]) => {
    expect(metadata[key as keyof T]).toEqual(value);
  });
}

/**
 * Assert blob exists and is valid JSON
 */
export function assertBlobExists(result: AnalyticsEngineDataPoint): void {
  expect(result.blobs).toBeDefined();
  expect(result.blobs?.length).toBeGreaterThan(0);

  // Ensure it's valid JSON
  expect(() => parseMetadata(result)).not.toThrow();
}

/**
 * Combined assertion for common adapter test pattern
 * Checks indexes, doubles, and specific metadata fields
 */
export function assertAdapterResult<T = Record<string, unknown>>(
  result: AnalyticsEngineDataPoint,
  expected: {
    indexes?: string[];
    doubles?: number[];
    metadata?: Partial<T>;
  }
): void {
  if (expected.indexes !== undefined) {
    assertIndexes(result, expected.indexes);
  }

  if (expected.doubles !== undefined) {
    assertDoubles(result, expected.doubles);
  }

  if (expected.metadata !== undefined) {
    assertMetadataFields<T>(result, expected.metadata);
  }

  // Always ensure blob is valid
  assertBlobExists(result);
}
