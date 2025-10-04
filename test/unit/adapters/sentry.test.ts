/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
import { describe, it, expect, beforeEach } from 'vitest';
import { SentryAdapter } from '../../../src/adapters/sentry.js';
import type { SentryEvent } from '../../../src/adapters/sentry.js';

describe('SentryAdapter', () => {
  let adapter: SentryAdapter;

  beforeEach(() => {
    adapter = new SentryAdapter();
  });

  describe('validate', () => {
    describe('event_id validation', () => {
      it('should accept valid 32-char lowercase hex event_id', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject missing event_id', () => {
        const data = {
          platform: 'javascript',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event_id with uppercase letters', () => {
        const data = {
          event_id: 'FC6D8C0C43FC4630AD850EE518F1B9D0',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event_id with dashes (UUID format)', () => {
        const data = {
          event_id: 'fc6d8c0c-43fc-4630-ad85-0ee518f1b9d0',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event_id that is too short', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event_id that is too long', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0extra',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject event_id with non-hex characters', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9xy',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject non-string event_id', () => {
        const data = {
          event_id: 123456,
        };
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('timestamp validation', () => {
      it('should accept RFC 3339 string timestamp', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: '2024-01-01T12:00:00Z',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept Unix epoch seconds timestamp', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: 1704110400,
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept Unix epoch milliseconds timestamp', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: 1704110400000,
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject invalid timestamp type (object)', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: { invalid: true },
        };
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('level validation', () => {
      it('should accept "fatal" level', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 'fatal',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept "error" level', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 'error',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept "warning" level', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 'warning',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept "info" level', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 'info',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept "debug" level', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 'debug',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject invalid level value', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 'invalid',
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject non-string level', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          level: 123,
        };
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('exception validation', () => {
      it('should accept valid exception with type and value', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'ReferenceError',
                value: 'foo is not defined',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept exception with stacktrace', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'Error',
                value: 'Something went wrong',
                stacktrace: {
                  frames: [
                    {
                      filename: 'app.js',
                      function: 'handleClick',
                      lineno: 42,
                      colno: 10,
                    },
                  ],
                },
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept chained exceptions', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'Error',
                value: 'Initial error',
              },
              {
                type: 'ValueError',
                value: 'Chained error',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject exception without values array', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            type: 'Error',
            value: 'Something went wrong',
          },
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject exception with missing type', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                value: 'Something went wrong',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject exception with missing value', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'Error',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('user validation', () => {
      it('should accept user with id', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            id: 'user-123',
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept user with email', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            email: 'user@example.com',
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept user with ip_address', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            ip_address: '192.168.1.1',
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept user with name', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            name: 'John Doe',
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept user with multiple fields', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            id: 'user-123',
            email: 'user@example.com',
            name: 'John Doe',
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject empty user object', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {},
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject user with non-string fields', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            id: 123,
          },
        };
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('breadcrumbs validation', () => {
      it('should accept breadcrumbs with timestamp', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            values: [
              {
                timestamp: '2024-01-01T12:00:00Z',
                message: 'User clicked button',
                category: 'ui.click',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept breadcrumbs with numeric timestamp', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            values: [
              {
                timestamp: 1704110400,
                message: 'Navigation',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept multiple breadcrumbs', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            values: [
              {
                timestamp: '2024-01-01T12:00:00Z',
                message: 'First action',
              },
              {
                timestamp: '2024-01-01T12:01:00Z',
                message: 'Second action',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject breadcrumbs without timestamp', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            values: [
              {
                message: 'User clicked button',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(false);
      });

      it('should reject breadcrumbs without values array', () => {
        const data = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            timestamp: '2024-01-01T12:00:00Z',
          },
        };
        expect(adapter.validate(data)).toBe(false);
      });
    });

    describe('full event validation', () => {
      it('should accept minimal valid event', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should accept full event with all fields', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: '2024-01-01T12:00:00Z',
          platform: 'javascript',
          level: 'error',
          logger: 'javascript',
          transaction: '/api/users',
          server_name: 'web-1',
          environment: 'production',
          release: '1.0.0',
          exception: {
            values: [
              {
                type: 'ReferenceError',
                value: 'foo is not defined',
                stacktrace: {
                  frames: [
                    {
                      filename: 'app.js',
                      function: 'handleClick',
                      lineno: 42,
                    },
                  ],
                },
              },
            ],
          },
          tags: {
            environment: 'prod',
            version: '1.0.0',
          },
          user: {
            id: 'user-123',
            email: 'user@example.com',
          },
          breadcrumbs: {
            values: [
              {
                timestamp: '2024-01-01T11:59:00Z',
                message: 'User navigated',
              },
            ],
          },
        };
        expect(adapter.validate(data)).toBe(true);
      });

      it('should reject non-object input', () => {
        expect(adapter.validate('invalid')).toBe(false);
        expect(adapter.validate(123)).toBe(false);
        expect(adapter.validate(null)).toBe(false);
        expect(adapter.validate(undefined)).toBe(false);
        expect(adapter.validate([])).toBe(false);
      });
    });
  });

  describe('transform', () => {
    describe('basic transformation', () => {
      it('should transform minimal event correctly', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        };

        const result = adapter.transform(data);

        expect(result.indexes).toEqual([]);
        expect(result.doubles).toHaveLength(1);
        expect(result.blobs).toHaveLength(1);

        const blob = JSON.parse(result.blobs![0]!);
        expect(blob.event_id).toBe('fc6d8c0c43fc4630ad850ee518f1b9d0');
        expect(blob.level).toBe('error'); // Default level
      });

      it('should include project_id in index when provided', () => {
        adapter.setProjectId('test-project');

        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        };

        const result = adapter.transform(data);

        expect(result.indexes).toEqual(['test-project']);
      });

      it('should store timestamp in doubles', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: '2024-01-01T12:00:00Z',
        };

        const result = adapter.transform(data);

        expect(result.doubles).toHaveLength(1);
        expect(result.doubles![0]).toBe(1704110400000); // Unix ms
      });
    });

    describe('timestamp parsing', () => {
      it('should parse RFC 3339 timestamp', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: '2024-01-01T12:00:00Z',
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.timestamp).toBe('2024-01-01T12:00:00.000Z');
      });

      it('should parse Unix epoch seconds', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: 1704110400,
        };

        const result = adapter.transform(data);

        expect(result.doubles![0]).toBe(1704110400000);
      });

      it('should parse Unix epoch milliseconds', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          timestamp: 1704110400000,
        };

        const result = adapter.transform(data);

        expect(result.doubles![0]).toBe(1704110400000);
      });

      it('should default to current time when timestamp missing', () => {
        const before = Date.now();

        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        };

        const result = adapter.transform(data);
        const after = Date.now();

        expect(result.doubles![0]).toBeGreaterThanOrEqual(before);
        expect(result.doubles![0]).toBeLessThanOrEqual(after);
      });
    });

    describe('exception transformation', () => {
      it('should extract exception summary', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'ReferenceError',
                value: 'foo is not defined',
                module: 'app',
              },
            ],
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.exception).toEqual({
          type: 'ReferenceError',
          value: 'foo is not defined',
          module: 'app',
        });
      });

      it('should extract first stack frame', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'Error',
                value: 'Test error',
                stacktrace: {
                  frames: [
                    {
                      filename: 'app.js',
                      function: 'handleClick',
                      lineno: 42,
                      colno: 10,
                      in_app: true,
                    },
                  ],
                },
              },
            ],
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.first_frame).toEqual({
          filename: 'app.js',
          function: 'handleClick',
          lineno: 42,
          colno: 10,
          in_app: true,
        });
      });

      it('should truncate stacktrace to 10 frames', () => {
        const frames = Array.from({ length: 20 }, (_, i) => ({
          filename: `file${i}.js`,
          function: `func${i}`,
          lineno: i + 1,
        }));

        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          exception: {
            values: [
              {
                type: 'Error',
                value: 'Test error',
                stacktrace: { frames },
              },
            ],
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.stacktrace).toHaveLength(10);
        expect(blob.stacktrace[0].filename).toBe('file0.js');
        expect(blob.stacktrace[9].filename).toBe('file9.js');
      });
    });

    describe('breadcrumbs transformation', () => {
      it('should truncate breadcrumbs to last 5', () => {
        const breadcrumbs = Array.from({ length: 10 }, (_, i) => ({
          timestamp: `2024-01-01T12:${String(i).padStart(2, '0')}:00Z`,
          message: `Action ${i}`,
        }));

        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: { values: breadcrumbs },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.breadcrumbs).toHaveLength(5);
        expect(blob.breadcrumbs[0].message).toBe('Action 5');
        expect(blob.breadcrumbs[4].message).toBe('Action 9');
      });

      it('should compact breadcrumb data', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          breadcrumbs: {
            values: [
              {
                timestamp: '2024-01-01T12:00:00Z',
                message: 'User action',
                category: 'ui.click',
                level: 'info',
                data: { extra: 'data' },
              },
            ],
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.breadcrumbs[0]).toEqual({
          timestamp: '2024-01-01T12:00:00Z',
          message: 'User action',
          category: 'ui.click',
          level: 'info',
        });
        expect(blob.breadcrumbs[0].data).toBeUndefined();
      });
    });

    describe('context and metadata transformation', () => {
      it('should include all core fields', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          platform: 'javascript',
          level: 'warning',
          transaction: '/api/users',
          logger: 'frontend',
          server_name: 'web-1',
          environment: 'staging',
          release: '2.0.0',
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.platform).toBe('javascript');
        expect(blob.level).toBe('warning');
        expect(blob.transaction).toBe('/api/users');
        expect(blob.logger).toBe('frontend');
        expect(blob.server_name).toBe('web-1');
        expect(blob.environment).toBe('staging');
        expect(blob.release).toBe('2.0.0');
      });

      it('should include user context', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          user: {
            id: 'user-123',
            email: 'user@example.com',
            ip_address: '192.168.1.1',
            name: 'John Doe',
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.user).toEqual({
          id: 'user-123',
          email: 'user@example.com',
          ip_address: '192.168.1.1',
          name: 'John Doe',
        });
      });

      it('should include tags', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          tags: {
            environment: 'production',
            version: '1.0.0',
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.tags).toEqual({
          environment: 'production',
          version: '1.0.0',
        });
      });

      it('should include compact request context', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          request: {
            url: 'https://example.com/api/users',
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            data: { user: 'test' },
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.request).toEqual({
          url: 'https://example.com/api/users',
          method: 'POST',
        });
        // headers and data should be omitted for compactness
        expect(blob.request.headers).toBeUndefined();
        expect(blob.request.data).toBeUndefined();
      });

      it('should include compact SDK info', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          sdk: {
            name: 'sentry.javascript.browser',
            version: '7.0.0',
            integrations: ['BrowserTracing', 'Replay'],
            packages: [
              {
                name: '@sentry/browser',
                version: '7.0.0',
              },
            ],
          },
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.sdk).toEqual({
          name: 'sentry.javascript.browser',
          version: '7.0.0',
        });
        // integrations and packages omitted for compactness
        expect(blob.sdk.integrations).toBeUndefined();
        expect(blob.sdk.packages).toBeUndefined();
      });

      it('should limit extra data to 10 keys', () => {
        const extraData = Object.fromEntries(
          Array.from({ length: 20 }, (_, i) => [`key${i}`, `value${i}`])
        );

        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          extra: extraData,
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!) as {
          extra?: Record<string, unknown>;
        };

        expect(Object.keys(blob.extra ?? {})).toHaveLength(10);
        expect(blob.extra).toBeDefined();
        expect(blob.extra!.key0).toBe('value0');
        expect(blob.extra!.key9).toBe('value9');
        expect(blob.extra!.key10).toBeUndefined();
      });

      it('should remove undefined fields from output', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
        };

        const result = adapter.transform(data);
        const blob = JSON.parse(result.blobs![0]!);

        expect(blob.exception).toBeUndefined();
        expect(blob.first_frame).toBeUndefined();
        expect(blob.stacktrace).toBeUndefined();
        expect(blob.breadcrumbs).toBeUndefined();
        expect(blob.request).toBeUndefined();
        expect(blob.sdk).toBeUndefined();
      });
    });

    describe('blob size limit handling', () => {
      it('should apply 5120 byte blob limit', () => {
        const data: SentryEvent = {
          event_id: 'fc6d8c0c43fc4630ad850ee518f1b9d0',
          platform: 'javascript',
        };

        const result = adapter.transform(data);

        expect(result.blobs![0]!.length).toBeLessThanOrEqual(5120);
      });
    });
  });
});
