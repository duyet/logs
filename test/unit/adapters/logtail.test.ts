/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach } from 'vitest';
import { LogtailAdapter } from '../../../src/adapters/logtail.js';
import type {
  LogtailEvent,
  LogtailData,
} from '../../../src/adapters/logtail.js';

describe('LogtailAdapter', () => {
  let adapter: LogtailAdapter;

  beforeEach(() => {
    adapter = new LogtailAdapter();
  });

  describe('validate', () => {
    describe('single event validation', () => {
      it('should accept valid single event with message only', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept valid event with message and timestamp (string)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: '2022-12-31T13:45:59.123456Z',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept valid event with message and timestamp (number seconds)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: 1672490759,
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept valid event with message and timestamp (number milliseconds)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: 1672490759123,
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept valid event with message and timestamp (number nanoseconds)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: 1672490759123456000,
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept valid event with message, timestamp, and level', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: '2022-12-31T13:45:59Z',
          level: 'info',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept valid event with additional metadata fields', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: '2022-12-31T13:45:59Z',
          level: 'error',
          userId: 'user-123',
          requestId: 'req-456',
          statusCode: 500,
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject event without message field', () => {
        const data = {
          dt: '2022-12-31T13:45:59Z',
          level: 'info',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event with non-string message', () => {
        const data = {
          message: 123,
          dt: '2022-12-31T13:45:59Z',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event with invalid dt type', () => {
        const data = {
          message: 'Test log message',
          dt: { invalid: true },
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event with non-string level', () => {
        const data = {
          message: 'Test log message',
          level: 123,
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should accept event with empty string message', () => {
        const data: LogtailEvent = {
          message: '',
        };
        expect(adapter.validate(data)).toBe(true);
      });
    });

    describe('multiple events validation', () => {
      it('should accept array of valid events', () => {
        const data: LogtailData = [
          { message: 'Event A' },
          { message: 'Event B', level: 'warn' },
          { message: 'Event C', dt: 1672490759 },
        ];
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject empty array', () => {
        const data: unknown[] = [];
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject array with invalid event', () => {
        const data = [
          { message: 'Valid event' },
          { dt: '2022-12-31T13:45:59Z' }, // Missing message
        ];
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject array with non-object element', () => {
        const data = [{ message: 'Valid event' }, 'Invalid string'];
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('invalid data types', () => {
      it('should reject null', () => {
        expect(adapter.validate(null)).toBe(false);
      });

      it('should reject undefined', () => {
        expect(adapter.validate(undefined)).toBe(false);
      });

      it('should reject string', () => {
        expect(adapter.validate('test')).toBe(false);
      });

      it('should reject number', () => {
        expect(adapter.validate(123)).toBe(false);
      });

      it('should reject boolean', () => {
        expect(adapter.validate(true)).toBe(false);
      });
    });
  });

  describe('transform', () => {
    describe('single event transformation', () => {
      it('should transform single event with message only', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
        };

        const result = adapter.transform(data);

        expect(result.indexes).toEqual([]);
        expect(result.doubles).toHaveLength(1);
        expect(result.doubles![0]).toBeGreaterThan(0);
        expect(result.blobs).toHaveLength(1);

        const blob = JSON.parse(result.blobs![0]) as {
          message: string;
          level: string;
          event_count: number;
          timestamp: string;
        };
        expect(blob.message).toBe('Test log message');
        expect(blob.level).toBe('info');
        expect(blob.event_count).toBe(1);
        expect(blob.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      });

      it('should transform single event with project_id', () => {
        adapter.setProjectId('test-project');
        const data: LogtailEvent = {
          message: 'Test log message',
        };

        const result = adapter.transform(data);

        expect(result.indexes).toEqual(['test-project']);
        expect(result.doubles).toHaveLength(1);
        expect(result.blobs).toHaveLength(1);
      });

      it('should transform event with RFC 3339 timestamp', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: '2022-12-31T13:45:59.123456Z',
        };

        const result = adapter.transform(data);

        expect(result.doubles).toHaveLength(1);
        expect(result.blobs).toHaveLength(1);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.timestamp).toBe('2022-12-31T13:45:59.123Z');
      });

      it('should transform event with UNIX timestamp (seconds)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: 1672490759, // Seconds
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        // UNIX timestamp is already in UTC
        expect(blob.timestamp).toBe(new Date(1672490759 * 1000).toISOString());
      });

      it('should transform event with UNIX timestamp (milliseconds)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: 1672490759123, // Milliseconds
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.timestamp).toBe(new Date(1672490759123).toISOString());
      });

      it('should transform event with UNIX timestamp (nanoseconds)', () => {
        const data: LogtailEvent = {
          message: 'Test log message',
          dt: 1672490759123456000, // Nanoseconds
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.timestamp).toBe(
          new Date(Math.floor(1672490759123456000 / 1000000)).toISOString()
        );
      });

      it('should transform event with custom level', () => {
        const data: LogtailEvent = {
          message: 'Error occurred',
          level: 'error',
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.level).toBe('error');
      });

      it('should transform event with metadata fields', () => {
        const data: LogtailEvent = {
          message: 'User action',
          level: 'info',
          userId: 'user-123',
          action: 'login',
          statusCode: 200,
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.metadata).toEqual({
          userId: 'user-123',
          action: 'login',
          statusCode: 200,
        });
      });

      it('should not include metadata when no extra fields', () => {
        const data: LogtailEvent = {
          message: 'Simple log',
          level: 'info',
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.metadata).toBeUndefined();
      });

      it('should truncate large blob to 5120 bytes', () => {
        const largeMessage = 'A'.repeat(10 * 1024); // 10 KiB message
        const data: LogtailEvent = {
          message: largeMessage,
        };

        const result = adapter.transform(data);

        // Blob itself is truncated at 5120 bytes, not the message inside
        expect(result.blobs![0].length).toBeLessThanOrEqual(5120);
      });
    });

    describe('multiple events transformation', () => {
      it('should transform array of events as batch', () => {
        const data: LogtailData = [
          { message: 'Event A' },
          { message: 'Event B', level: 'warn' },
          { message: 'Event C', dt: 1672490759 },
        ];

        const result = adapter.transform(data);

        expect(result.indexes).toEqual([]);
        expect(result.doubles).toHaveLength(2);
        expect(result.doubles![1]).toBe(3); // Event count
        expect(result.blobs).toHaveLength(1);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.batch).toBe(true);
        expect(blob.event_count).toBe(3);
        expect(blob.events).toHaveLength(3);
        expect(blob.events[0].message).toBe('Event A');
        expect(blob.events[1].message).toBe('Event B');
        expect(blob.events[1].level).toBe('warn');
        expect(blob.events[2].message).toBe('Event C');
      });

      it('should transform batch with project_id', () => {
        adapter.setProjectId('batch-project');
        const data: LogtailData = [
          { message: 'Event A' },
          { message: 'Event B' },
        ];

        const result = adapter.transform(data);

        expect(result.indexes).toEqual(['batch-project']);
      });

      it('should preserve event timestamps in batch', () => {
        const data: LogtailData = [
          { message: 'Event A', dt: '2022-12-31T13:45:59Z' },
          { message: 'Event B', dt: 1672490759 },
        ];

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.events[0].timestamp).toBe('2022-12-31T13:45:59.000Z');
        expect(blob.events[1].timestamp).toBe(
          new Date(1672490759 * 1000).toISOString()
        );
      });

      it('should preserve event metadata in batch', () => {
        const data: LogtailData = [
          { message: 'Event A', userId: 'user-1' },
          { message: 'Event B', requestId: 'req-2' },
        ];

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.events[0].metadata).toEqual({ userId: 'user-1' });
        expect(blob.events[1].metadata).toEqual({ requestId: 'req-2' });
      });

      it('should truncate batch blob to 5120 bytes', () => {
        const largeMessage = 'B'.repeat(5 * 1024); // 5 KiB each
        const data: LogtailData = [
          { message: largeMessage },
          { message: largeMessage },
        ];

        const result = adapter.transform(data);

        // Entire blob is truncated at 5120 bytes
        expect(result.blobs![0].length).toBeLessThanOrEqual(5120);
      });
    });

    describe('edge cases', () => {
      it('should handle empty string message', () => {
        const data: LogtailEvent = {
          message: '',
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.message).toBe('');
      });

      it('should handle invalid timestamp string gracefully', () => {
        const data: LogtailEvent = {
          message: 'Test',
          dt: 'invalid-timestamp',
        };

        const result = adapter.transform(data);

        // Should use current time as fallback
        expect(result.doubles![0]).toBeGreaterThan(Date.now() - 1000);
      });

      it('should truncate long project_id to 96 bytes', () => {
        const longProjectId = 'p'.repeat(150);
        adapter.setProjectId(longProjectId);
        const data: LogtailEvent = {
          message: 'Test',
        };

        const result = adapter.transform(data);

        expect(result.indexes![0].length).toBe(96);
      });

      it('should handle nested objects in metadata', () => {
        const data: LogtailEvent = {
          message: 'Test',
          nested: {
            level1: {
              level2: 'deep value',
            },
          },
        };

        const result = adapter.transform(data);

        const blob = JSON.parse(result.blobs![0]);
        expect(blob.metadata.nested).toEqual({
          level1: {
            level2: 'deep value',
          },
        });
      });
    });
  });
});
