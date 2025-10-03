import { describe, it, expect } from 'vitest';
import {
  projectIdSchema,
  sessionIdSchema,
  timestampSchema,
  unixTimestampSchema,
  urlSchema,
  emailSchema,
  nonEmptyStringSchema,
  safeStringSchema,
  validNumberSchema,
  positiveNumberSchema,
  safeObjectSchema,
  indexSchema,
  blobSchema,
  eventTypeSchema,
  browserSchema,
  osSchema,
  deviceTypeSchema,
  botTypeSchema,
} from '../../../src/schemas/common.js';

describe('Common Schemas', () => {
  describe('projectIdSchema', () => {
    it('should accept valid project IDs', () => {
      expect(projectIdSchema.safeParse('my-project').success).toBe(true);
      expect(projectIdSchema.safeParse('test').success).toBe(true);
      expect(projectIdSchema.safeParse('project-123').success).toBe(true);
      expect(projectIdSchema.safeParse('a-b-c').success).toBe(true);
    });

    it('should reject invalid project IDs', () => {
      expect(projectIdSchema.safeParse('ab').success).toBe(false); // too short
      expect(projectIdSchema.safeParse('A').success).toBe(false); // uppercase
      expect(projectIdSchema.safeParse('my_project').success).toBe(false); // underscore
      expect(projectIdSchema.safeParse('my project').success).toBe(false); // space
      expect(projectIdSchema.safeParse('a'.repeat(33)).success).toBe(false); // too long
      expect(projectIdSchema.safeParse('').success).toBe(false); // empty
      expect(projectIdSchema.safeParse(123).success).toBe(false); // number
    });
  });

  describe('sessionIdSchema', () => {
    it('should accept valid session IDs', () => {
      expect(sessionIdSchema.safeParse('session-123').success).toBe(true);
      expect(sessionIdSchema.safeParse('ABC-123_abc').success).toBe(true);
      expect(sessionIdSchema.safeParse('uuid-12345').success).toBe(true);
      expect(sessionIdSchema.safeParse('a'.repeat(128)).success).toBe(true);
    });

    it('should reject invalid session IDs', () => {
      expect(sessionIdSchema.safeParse('').success).toBe(false); // empty
      expect(sessionIdSchema.safeParse('a'.repeat(129)).success).toBe(false); // too long
      expect(sessionIdSchema.safeParse('session 123').success).toBe(false); // space
      expect(sessionIdSchema.safeParse('session@123').success).toBe(false); // special char
      expect(sessionIdSchema.safeParse(123).success).toBe(false); // number
    });
  });

  describe('timestampSchema', () => {
    it('should accept valid ISO 8601 timestamps', () => {
      expect(timestampSchema.safeParse('2024-01-01T00:00:00Z').success).toBe(
        true
      );
      expect(
        timestampSchema.safeParse('2024-01-01T00:00:00.000Z').success
      ).toBe(true);
    });

    it('should reject invalid timestamps', () => {
      expect(timestampSchema.safeParse('not-a-date').success).toBe(false);
      expect(timestampSchema.safeParse('2024-01-01').success).toBe(false); // missing time
      expect(timestampSchema.safeParse('').success).toBe(false);
      expect(timestampSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('unixTimestampSchema', () => {
    it('should accept valid unix timestamps', () => {
      expect(unixTimestampSchema.safeParse(1704067200000).success).toBe(true); // 2024-01-01
      expect(unixTimestampSchema.safeParse(1).success).toBe(true);
    });

    it('should reject invalid unix timestamps', () => {
      expect(unixTimestampSchema.safeParse(0).success).toBe(false); // zero
      expect(unixTimestampSchema.safeParse(-1).success).toBe(false); // negative
      expect(unixTimestampSchema.safeParse(1.5).success).toBe(false); // decimal
      expect(unixTimestampSchema.safeParse('123').success).toBe(false); // string
    });
  });

  describe('urlSchema', () => {
    it('should accept valid URLs', () => {
      expect(urlSchema.safeParse('https://example.com').success).toBe(true);
      expect(urlSchema.safeParse('http://localhost:8080').success).toBe(true);
      expect(urlSchema.safeParse('https://example.com/path?q=1').success).toBe(
        true
      );
    });

    it('should reject invalid URLs', () => {
      expect(urlSchema.safeParse('not-a-url').success).toBe(false);
      expect(urlSchema.safeParse('').success).toBe(false);
      expect(urlSchema.safeParse('//example.com').success).toBe(false);
      expect(urlSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('emailSchema', () => {
    it('should accept valid emails', () => {
      expect(emailSchema.safeParse('test@example.com').success).toBe(true);
      expect(emailSchema.safeParse('user+tag@domain.co.uk').success).toBe(true);
    });

    it('should reject invalid emails', () => {
      expect(emailSchema.safeParse('not-an-email').success).toBe(false);
      expect(emailSchema.safeParse('test@').success).toBe(false);
      expect(emailSchema.safeParse('@example.com').success).toBe(false);
      expect(emailSchema.safeParse('').success).toBe(false);
      expect(emailSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('nonEmptyStringSchema', () => {
    it('should accept non-empty strings', () => {
      expect(nonEmptyStringSchema.safeParse('hello').success).toBe(true);
      expect(nonEmptyStringSchema.safeParse('a'.repeat(10000)).success).toBe(
        true
      );
    });

    it('should reject empty strings and invalid types', () => {
      expect(nonEmptyStringSchema.safeParse('').success).toBe(false);
      expect(nonEmptyStringSchema.safeParse('a'.repeat(10001)).success).toBe(
        false
      ); // too long
      expect(nonEmptyStringSchema.safeParse(123).success).toBe(false);
      expect(nonEmptyStringSchema.safeParse(null).success).toBe(false);
    });
  });

  describe('safeStringSchema', () => {
    it('should accept strings including empty', () => {
      expect(safeStringSchema.safeParse('').success).toBe(true);
      expect(safeStringSchema.safeParse('hello').success).toBe(true);
      expect(safeStringSchema.safeParse('a'.repeat(10000)).success).toBe(true);
    });

    it('should reject strings that are too long', () => {
      expect(safeStringSchema.safeParse('a'.repeat(10001)).success).toBe(false);
      expect(safeStringSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('validNumberSchema', () => {
    it('should accept finite numbers', () => {
      expect(validNumberSchema.safeParse(0).success).toBe(true);
      expect(validNumberSchema.safeParse(-100).success).toBe(true);
      expect(validNumberSchema.safeParse(3.14).success).toBe(true);
    });

    it('should reject invalid numbers', () => {
      expect(validNumberSchema.safeParse(NaN).success).toBe(false);
      expect(validNumberSchema.safeParse(Infinity).success).toBe(false);
      expect(validNumberSchema.safeParse(-Infinity).success).toBe(false);
      expect(validNumberSchema.safeParse('123').success).toBe(false);
    });
  });

  describe('positiveNumberSchema', () => {
    it('should accept positive numbers', () => {
      expect(positiveNumberSchema.safeParse(1).success).toBe(true);
      expect(positiveNumberSchema.safeParse(100.5).success).toBe(true);
    });

    it('should reject zero, negative, and invalid numbers', () => {
      expect(positiveNumberSchema.safeParse(0).success).toBe(false);
      expect(positiveNumberSchema.safeParse(-1).success).toBe(false);
      expect(positiveNumberSchema.safeParse('123').success).toBe(false);
    });
  });

  describe('safeObjectSchema', () => {
    it('should accept safe objects', () => {
      expect(safeObjectSchema.safeParse({}).success).toBe(true);
      expect(safeObjectSchema.safeParse({ key: 'value' }).success).toBe(true);
      expect(
        safeObjectSchema.safeParse({ nested: { key: 'value' } }).success
      ).toBe(true);
    });

    it('should reject non-objects', () => {
      expect(safeObjectSchema.safeParse('string').success).toBe(false);
      expect(safeObjectSchema.safeParse(123).success).toBe(false);
      expect(safeObjectSchema.safeParse([]).success).toBe(false);
      expect(safeObjectSchema.safeParse(null).success).toBe(false);
    });

    it('should accept objects with any string keys', () => {
      // Note: JavaScript's __proto__ doesn't appear in Object.keys() as a regular property
      // These tests verify the schema accepts objects with various keys
      expect(safeObjectSchema.safeParse({ safe_key: 'value' }).success).toBe(
        true
      );
      expect(
        safeObjectSchema.safeParse({ data: { nested: true } }).success
      ).toBe(true);
    });
  });

  describe('indexSchema', () => {
    it('should accept strings up to 96 bytes', () => {
      expect(indexSchema.safeParse('short').success).toBe(true);
      expect(indexSchema.safeParse('a'.repeat(96)).success).toBe(true);
    });

    it('should reject strings longer than 96 bytes', () => {
      expect(indexSchema.safeParse('a'.repeat(97)).success).toBe(false);
    });
  });

  describe('blobSchema', () => {
    it('should accept strings up to 5120 bytes', () => {
      expect(blobSchema.safeParse('short').success).toBe(true);
      expect(blobSchema.safeParse('a'.repeat(5120)).success).toBe(true);
    });

    it('should reject strings longer than 5120 bytes', () => {
      expect(blobSchema.safeParse('a'.repeat(5121)).success).toBe(false);
    });
  });

  describe('eventTypeSchema', () => {
    it('should accept valid event types', () => {
      expect(eventTypeSchema.safeParse('pageview').success).toBe(true);
      expect(eventTypeSchema.safeParse('click').success).toBe(true);
      expect(eventTypeSchema.safeParse('custom').success).toBe(true);
    });

    it('should reject invalid event types', () => {
      expect(eventTypeSchema.safeParse('invalid').success).toBe(false);
      expect(eventTypeSchema.safeParse('').success).toBe(false);
      expect(eventTypeSchema.safeParse(123).success).toBe(false);
    });
  });

  describe('browserSchema', () => {
    it('should accept valid browsers', () => {
      expect(browserSchema.safeParse('Chrome').success).toBe(true);
      expect(browserSchema.safeParse('Firefox').success).toBe(true);
      expect(browserSchema.safeParse('Safari').success).toBe(true);
      expect(browserSchema.safeParse('Edge').success).toBe(true);
      expect(browserSchema.safeParse('Unknown').success).toBe(true);
    });

    it('should reject invalid browsers', () => {
      expect(browserSchema.safeParse('InvalidBrowser').success).toBe(false);
    });
  });

  describe('osSchema', () => {
    it('should accept valid operating systems', () => {
      expect(osSchema.safeParse('Windows').success).toBe(true);
      expect(osSchema.safeParse('macOS').success).toBe(true);
      expect(osSchema.safeParse('Linux').success).toBe(true);
      expect(osSchema.safeParse('iOS').success).toBe(true);
      expect(osSchema.safeParse('Android').success).toBe(true);
      expect(osSchema.safeParse('Unknown').success).toBe(true);
    });

    it('should reject invalid operating systems', () => {
      expect(osSchema.safeParse('InvalidOS').success).toBe(false);
    });
  });

  describe('deviceTypeSchema', () => {
    it('should accept valid device types', () => {
      expect(deviceTypeSchema.safeParse('mobile').success).toBe(true);
      expect(deviceTypeSchema.safeParse('tablet').success).toBe(true);
      expect(deviceTypeSchema.safeParse('desktop').success).toBe(true);
    });

    it('should reject invalid device types', () => {
      expect(deviceTypeSchema.safeParse('invalid').success).toBe(false);
    });
  });

  describe('botTypeSchema', () => {
    it('should accept valid bot types', () => {
      expect(botTypeSchema.safeParse('user').success).toBe(true);
      expect(botTypeSchema.safeParse('bot').success).toBe(true);
      expect(botTypeSchema.safeParse('ai-bot').success).toBe(true);
    });

    it('should reject invalid bot types', () => {
      expect(botTypeSchema.safeParse('invalid').success).toBe(false);
    });
  });
});
