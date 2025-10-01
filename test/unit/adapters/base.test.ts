import { describe, it, expect } from 'vitest';
import { BaseAdapter } from '../../../src/adapters/base.js';
import type { AnalyticsEngineDataPoint } from '../../../src/types/index.js';

class TestAdapter extends BaseAdapter<{ value: string }> {
  transform(data: { value: string }): AnalyticsEngineDataPoint {
    return {
      indexes: [this.toIndex(data.value)],
      blobs: [this.toBlob(data.value)],
      doubles: [this.toDouble(data.value)],
    };
  }

  validate(data: unknown): data is { value: string } {
    return this.isObject(data) && this.isString((data as Record<string, unknown>).value);
  }
}

describe('BaseAdapter', () => {
  const adapter = new TestAdapter();

  describe('toBlob', () => {
    it('should convert value to string', () => {
      expect(adapter['toBlob'](123)).toBe('123');
      expect(adapter['toBlob']('test')).toBe('test');
      expect(adapter['toBlob'](true)).toBe('true');
    });

    it('should truncate strings longer than maxLength', () => {
      const longString = 'a'.repeat(6000);
      const result = adapter['toBlob'](longString);
      expect(result.length).toBe(5120);
    });

    it('should respect custom maxLength', () => {
      const longString = 'a'.repeat(200);
      const result = adapter['toBlob'](longString, 100);
      expect(result.length).toBe(100);
    });
  });

  describe('toIndex', () => {
    it('should convert value to string', () => {
      expect(adapter['toIndex'](123)).toBe('123');
      expect(adapter['toIndex']('test')).toBe('test');
    });

    it('should truncate strings longer than 96 bytes', () => {
      const longString = 'a'.repeat(200);
      const result = adapter['toIndex'](longString);
      expect(result.length).toBe(96);
    });
  });

  describe('toDouble', () => {
    it('should convert value to number', () => {
      expect(adapter['toDouble'](123)).toBe(123);
      expect(adapter['toDouble']('456')).toBe(456);
      expect(adapter['toDouble']('123.45')).toBe(123.45);
    });

    it('should return 0 for NaN values', () => {
      expect(adapter['toDouble']('invalid')).toBe(0);
      expect(adapter['toDouble'](undefined)).toBe(0);
    });
  });

  describe('isObject', () => {
    it('should return true for objects', () => {
      expect(adapter['isObject']({})).toBe(true);
      expect(adapter['isObject']({ key: 'value' })).toBe(true);
    });

    it('should return false for non-objects', () => {
      expect(adapter['isObject'](null)).toBe(false);
      expect(adapter['isObject']([])).toBe(false);
      expect(adapter['isObject']('string')).toBe(false);
      expect(adapter['isObject'](123)).toBe(false);
    });
  });

  describe('isString', () => {
    it('should return true for strings', () => {
      expect(adapter['isString']('test')).toBe(true);
      expect(adapter['isString']('')).toBe(true);
    });

    it('should return false for non-strings', () => {
      expect(adapter['isString'](123)).toBe(false);
      expect(adapter['isString'](null)).toBe(false);
      expect(adapter['isString']({})).toBe(false);
    });
  });

  describe('isNumber', () => {
    it('should return true for numbers', () => {
      expect(adapter['isNumber'](123)).toBe(true);
      expect(adapter['isNumber'](0)).toBe(true);
      expect(adapter['isNumber'](-123.45)).toBe(true);
    });

    it('should return false for NaN and non-numbers', () => {
      expect(adapter['isNumber'](NaN)).toBe(false);
      expect(adapter['isNumber']('123')).toBe(false);
      expect(adapter['isNumber'](null)).toBe(false);
    });
  });

  describe('TestAdapter integration', () => {
    it('should validate correct data', () => {
      expect(adapter.validate({ value: 'test' })).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate({ value: 123 })).toBe(false);
      expect(adapter.validate('string')).toBe(false);
    });

    it('should transform data correctly', () => {
      const result = adapter.transform({ value: 'test' });
      expect(result.indexes).toEqual(['test']);
      expect(result.blobs).toEqual(['test']);
      expect(result.doubles).toEqual([0]);
    });
  });
});
