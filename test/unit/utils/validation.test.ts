import { describe, it, expect } from 'vitest';
import {
  isValidString,
  isValidNumber,
  isValidObject,
  isValidArray,
  isValidBoolean,
  isValidProjectId,
  isValidSessionId,
  isValidTimestamp,
  isValidUrl,
  isValidEmail,
  sanitizeString,
  hasOnlySafeKeys,
  isValidDeepObject,
  isValidJsonSize,
  isValidEnum,
} from '../../../src/utils/validation.js';

describe('validation utilities', () => {
  describe('isValidString', () => {
    it('should return true for valid non-empty strings', () => {
      expect(isValidString('hello')).toBe(true);
      expect(isValidString('a')).toBe(true);
      expect(isValidString('a'.repeat(10000))).toBe(true);
    });

    it('should return false for empty strings', () => {
      expect(isValidString('')).toBe(false);
    });

    it('should return false for strings exceeding max length', () => {
      expect(isValidString('a'.repeat(10001))).toBe(false);
    });

    it('should return false for non-strings', () => {
      expect(isValidString(123)).toBe(false);
      expect(isValidString(null)).toBe(false);
      expect(isValidString(undefined)).toBe(false);
      expect(isValidString({})).toBe(false);
      expect(isValidString([])).toBe(false);
    });
  });

  describe('isValidNumber', () => {
    it('should return true for valid numbers', () => {
      expect(isValidNumber(0)).toBe(true);
      expect(isValidNumber(123)).toBe(true);
      expect(isValidNumber(-456)).toBe(true);
      expect(isValidNumber(3.14)).toBe(true);
    });

    it('should return false for invalid numbers', () => {
      expect(isValidNumber(NaN)).toBe(false);
      expect(isValidNumber(Infinity)).toBe(false);
      expect(isValidNumber(-Infinity)).toBe(false);
    });

    it('should return false for non-numbers', () => {
      expect(isValidNumber('123')).toBe(false);
      expect(isValidNumber(null)).toBe(false);
      expect(isValidNumber(undefined)).toBe(false);
      expect(isValidNumber({})).toBe(false);
    });
  });

  describe('isValidObject', () => {
    it('should return true for valid objects', () => {
      expect(isValidObject({})).toBe(true);
      expect(isValidObject({ key: 'value' })).toBe(true);
      expect(isValidObject({ a: 1, b: 'test' })).toBe(true);
    });

    it('should return false for null', () => {
      expect(isValidObject(null)).toBe(false);
    });

    it('should return false for arrays', () => {
      expect(isValidObject([])).toBe(false);
      expect(isValidObject([1, 2, 3])).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isValidObject('string')).toBe(false);
      expect(isValidObject(123)).toBe(false);
      expect(isValidObject(undefined)).toBe(false);
    });
  });

  describe('isValidArray', () => {
    it('should return true for valid arrays', () => {
      expect(isValidArray([])).toBe(true);
      expect(isValidArray([1, 2, 3])).toBe(true);
      expect(isValidArray(['a', 'b'])).toBe(true);
    });

    it('should return false for non-arrays', () => {
      expect(isValidArray({})).toBe(false);
      expect(isValidArray('string')).toBe(false);
      expect(isValidArray(123)).toBe(false);
      expect(isValidArray(null)).toBe(false);
      expect(isValidArray(undefined)).toBe(false);
    });
  });

  describe('isValidBoolean', () => {
    it('should return true for booleans', () => {
      expect(isValidBoolean(true)).toBe(true);
      expect(isValidBoolean(false)).toBe(true);
    });

    it('should return false for non-booleans', () => {
      expect(isValidBoolean(1)).toBe(false);
      expect(isValidBoolean(0)).toBe(false);
      expect(isValidBoolean('true')).toBe(false);
      expect(isValidBoolean(null)).toBe(false);
      expect(isValidBoolean(undefined)).toBe(false);
    });
  });

  describe('isValidProjectId', () => {
    it('should return true for valid project IDs', () => {
      expect(isValidProjectId('abc')).toBe(true);
      expect(isValidProjectId('project123')).toBe(true);
      expect(isValidProjectId('a'.repeat(32))).toBe(true);
    });

    it('should return false for invalid project IDs', () => {
      expect(isValidProjectId('ab')).toBe(false); // too short
      expect(isValidProjectId('a'.repeat(33))).toBe(false); // too long
      expect(isValidProjectId('ABC')).toBe(false); // uppercase
      expect(isValidProjectId('test-id')).toBe(false); // has dash
      expect(isValidProjectId('test_id')).toBe(false); // has underscore
      expect(isValidProjectId(123)).toBe(false); // not string
    });
  });

  describe('isValidSessionId', () => {
    it('should return true for valid session IDs', () => {
      expect(isValidSessionId('session-123')).toBe(true);
      expect(isValidSessionId('abc123')).toBe(true);
      expect(isValidSessionId('a'.repeat(128))).toBe(true);
    });

    it('should return false for invalid session IDs', () => {
      expect(isValidSessionId('')).toBe(false); // empty
      expect(isValidSessionId('a'.repeat(129))).toBe(false); // too long
      expect(isValidSessionId(123)).toBe(false); // not string
    });
  });

  describe('isValidTimestamp', () => {
    it('should return true for valid timestamps', () => {
      expect(isValidTimestamp('2024-01-01T00:00:00Z')).toBe(true);
      expect(isValidTimestamp('2024-01-01T00:00:00.000Z')).toBe(true);
      expect(isValidTimestamp('2024-12-31T23:59:59Z')).toBe(true);
      expect(isValidTimestamp('2024-01-01')).toBe(true); // Date.parse accepts this
    });

    it('should return false for invalid timestamps', () => {
      expect(isValidTimestamp('not-a-timestamp')).toBe(false);
      expect(isValidTimestamp('invalid')).toBe(false);
      expect(isValidTimestamp(123)).toBe(false); // not string
    });
  });

  describe('isValidUrl', () => {
    it('should return true for valid URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
      expect(isValidUrl('http://localhost:8080')).toBe(true);
      expect(isValidUrl('https://example.com/path?query=value')).toBe(true);
      expect(isValidUrl('ftp://example.com')).toBe(true); // URL constructor accepts FTP
    });

    it('should return false for invalid URLs', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
      expect(isValidUrl('//example.com')).toBe(false); // no protocol
      expect(isValidUrl('invalid url with spaces')).toBe(false);
      expect(isValidUrl(123)).toBe(false); // not string
    });
  });

  describe('isValidEmail', () => {
    it('should return true for valid emails', () => {
      expect(isValidEmail('test@example.com')).toBe(true);
      expect(isValidEmail('user.name@domain.co.uk')).toBe(true);
      expect(isValidEmail('test+tag@example.com')).toBe(true);
    });

    it('should return false for invalid emails', () => {
      expect(isValidEmail('not-an-email')).toBe(false);
      expect(isValidEmail('@example.com')).toBe(false);
      expect(isValidEmail('test@')).toBe(false);
      expect(isValidEmail('test')).toBe(false);
      expect(isValidEmail(123)).toBe(false); // not string
    });
  });

  describe('sanitizeString', () => {
    it('should remove control characters and trim', () => {
      expect(sanitizeString('hello\x00world')).toBe('helloworld');
      expect(sanitizeString('test\x01\x02\x03')).toBe('test');
      expect(sanitizeString('  normal text  ')).toBe('normal text');
    });

    it('should remove control characters but preserve internal spaces', () => {
      expect(sanitizeString('hello world')).toBe('hello world');
      expect(sanitizeString('  hello world  ')).toBe('hello world');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
      expect(sanitizeString('   ')).toBe('');
    });
  });

  describe('hasOnlySafeKeys', () => {
    it('should return true for safe objects', () => {
      expect(hasOnlySafeKeys({})).toBe(true);
      expect(hasOnlySafeKeys({ key: 'value' })).toBe(true);
      expect(hasOnlySafeKeys({ a: 1, b: 2 })).toBe(true);
    });

    it('should return false for dangerous keys', () => {
      // Note: Using Object.defineProperty to actually create these keys
      const obj1 = Object.create(null);
      obj1.__proto__ = 'value';
      expect(hasOnlySafeKeys(obj1)).toBe(false);

      const obj2 = Object.create(null);
      obj2.constructor = 'value';
      expect(hasOnlySafeKeys(obj2)).toBe(false);

      const obj3 = Object.create(null);
      obj3.prototype = 'value';
      expect(hasOnlySafeKeys(obj3)).toBe(false);
    });
  });

  describe('isValidDeepObject', () => {
    it('should return true for valid nested objects', () => {
      expect(isValidDeepObject({ a: 1 }, 10)).toBe(true);
      expect(isValidDeepObject({ a: { b: { c: 1 } } }, 10)).toBe(true);
      expect(isValidDeepObject({ array: [1, 2, 3] }, 10)).toBe(true);
      expect(isValidDeepObject({ array: [{ nested: 'object' }] }, 10)).toBe(true);
      expect(isValidDeepObject({ array: [{ a: { b: 'deep' } }] }, 10)).toBe(true);
    });

    it('should return false for objects exceeding max depth', () => {
      const deep = { a: { b: { c: { d: { e: { f: 1 } } } } } };
      expect(isValidDeepObject(deep, 3)).toBe(false);
    });

    it('should return false for circular references', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(isValidDeepObject(circular, 10)).toBe(false);
    });

    it('should return false for non-objects', () => {
      expect(isValidDeepObject('string', 10)).toBe(false);
      expect(isValidDeepObject(123, 10)).toBe(false);
      expect(isValidDeepObject(null, 10)).toBe(false);
    });
  });

  describe('isValidEnum', () => {
    it('should return true for valid enum values', () => {
      expect(isValidEnum('apple', ['apple', 'banana', 'orange'])).toBe(true);
      expect(isValidEnum('banana', ['apple', 'banana', 'orange'])).toBe(true);
    });

    it('should return false for invalid enum values', () => {
      expect(isValidEnum('grape', ['apple', 'banana', 'orange'])).toBe(false);
      expect(isValidEnum('', ['apple', 'banana'])).toBe(false);
    });

    it('should return false for non-string values', () => {
      expect(isValidEnum(123, ['apple', 'banana'])).toBe(false);
      expect(isValidEnum(null, ['apple', 'banana'])).toBe(false);
      expect(isValidEnum(undefined, ['apple', 'banana'])).toBe(false);
    });
  });

  describe('isValidJsonSize', () => {
    it('should return true for valid JSON sizes', () => {
      expect(isValidJsonSize({ key: 'value' })).toBe(true);
      expect(isValidJsonSize([1, 2, 3])).toBe(true);
      expect(isValidJsonSize('short string')).toBe(true);
    });

    it('should return false for oversized JSON', () => {
      const large = { data: 'a'.repeat(2000000) };
      expect(isValidJsonSize(large, 1000000)).toBe(false);
    });

    it('should handle custom size limits', () => {
      expect(isValidJsonSize({ key: 'value' }, 10)).toBe(false);
      expect(isValidJsonSize({}, 10)).toBe(true);
    });

    it('should return false for non-JSON-serializable values', () => {
      const circular: Record<string, unknown> = {};
      circular.self = circular;
      expect(isValidJsonSize(circular)).toBe(false);
    });
  });
});
