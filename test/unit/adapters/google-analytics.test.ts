import { describe, it, expect } from 'vitest';
import { GoogleAnalyticsAdapter } from '../../../src/adapters/google-analytics.js';
import type { GoogleAnalyticsData } from '../../../src/types/index.js';

describe('GoogleAnalyticsAdapter', () => {
  const adapter = new GoogleAnalyticsAdapter();

  describe('validate', () => {
    it('should validate correct GA4 format', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'page_view' }],
      };
      expect(adapter.validate(data)).toBe(true);
    });

    it('should validate with optional fields', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        user_id: 'user-123',
        timestamp_micros: '1640000000000000',
        user_properties: {
          plan: { value: 'premium' },
        },
        events: [
          {
            name: 'purchase',
            params: { value: 99.99, currency: 'USD' },
          },
        ],
      };
      expect(adapter.validate(data)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate({})).toBe(false);
      expect(adapter.validate({ client_id: 'test' })).toBe(false);
      expect(adapter.validate({ client_id: 'test', events: [] })).toBe(false);
      expect(adapter.validate({ client_id: 'test', events: [{ name: 123 }] })).toBe(false);
    });

    it('should reject events without name', () => {
      const data = {
        client_id: 'client-123',
        events: [{ params: { test: 'value' } }],
      };
      expect(adapter.validate(data)).toBe(false);
    });
  });

  describe('transform', () => {
    it('should transform basic GA4 data', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'page_view' }],
      };

      const result = adapter.transform(data);

      expect(result.indexes).toContain('client-123');
      expect(result.indexes).toContain('page_view');
      expect(result.doubles).toEqual([1]);
    });

    it('should include user_id when present', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        user_id: 'user-456',
        events: [{ name: 'login' }],
      };

      const result = adapter.transform(data);

      expect(result.indexes).toContain('client-123');
      expect(result.indexes).toContain('user-456');
      expect(result.indexes).toContain('login');
    });

    it('should include timestamp when present', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        timestamp_micros: '1640000000000000',
        events: [{ name: 'event' }],
      };

      const result = adapter.transform(data);

      expect(result.blobs).toContain('1640000000000000');
    });

    it('should serialize user_properties as JSON blob', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        user_properties: {
          plan: { value: 'premium' },
          country: { value: 'US' },
        },
        events: [{ name: 'event' }],
      };

      const result = adapter.transform(data);

      const userPropsBlob = result.blobs?.find((blob) => blob.includes('plan'));
      expect(userPropsBlob).toBeDefined();
      if (userPropsBlob) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        const parsed = JSON.parse(userPropsBlob);
        // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
        expect(parsed.plan.value).toBe('premium');
      }
    });

    it('should handle multiple events', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'page_view' }, { name: 'click' }, { name: 'scroll' }],
      };

      const result = adapter.transform(data);

      expect(result.indexes).toContain('page_view');
      expect(result.indexes).toContain('click');
      expect(result.indexes).toContain('scroll');
      expect(result.doubles).toEqual([3]);
    });

    it('should serialize event params as JSON blobs', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [
          {
            name: 'purchase',
            params: { value: 99.99, currency: 'USD', items: 3 },
          },
        ],
      };

      const result = adapter.transform(data);

      const paramsBlob = result.blobs?.find((blob) => blob.includes('currency'));
      expect(paramsBlob).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      const parsed = JSON.parse(paramsBlob!);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed.value).toBe(99.99);
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed.currency).toBe('USD');
      // eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
      expect(parsed.items).toBe(3);
    });

    it('should handle events without params', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'event1' }, { name: 'event2', params: {} }],
      };

      const result = adapter.transform(data);

      expect(result.indexes).toContain('event1');
      expect(result.indexes).toContain('event2');
    });
  });

  describe('edge cases', () => {
    it('should handle very long client_id', () => {
      const longId = 'a'.repeat(200);
      const data: GoogleAnalyticsData = {
        client_id: longId,
        events: [{ name: 'test' }],
      };

      const result = adapter.transform(data);
      const firstIndex = result.indexes?.[0];
      expect(firstIndex).toBeDefined();
      if (firstIndex) {
        expect(firstIndex.length).toBeLessThanOrEqual(96);
      }
    });

    it('should handle complex nested params', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [
          {
            name: 'complex_event',
            params: {
              nested: JSON.stringify({ deeply: { value: 'test' } }),
              array: 3,
              boolean: true,
            },
          },
        ],
      };

      const result = adapter.transform(data);
      expect(result.blobs?.some((blob) => blob.includes('deeply'))).toBe(true);
    });
  });

  describe('project_id support', () => {
    it('should include project_id in indexes as first element', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        project_id: 'proj789',
        events: [{ name: 'page_view' }],
      };

      const result = adapter.transform(data);

      expect(result.indexes?.[0]).toBe('proj789');
      expect(result.indexes).toContain('client-123');
      expect(result.indexes).toContain('page_view');
    });

    it('should work without project_id', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'event' }],
      };

      const result = adapter.transform(data);

      expect(result.indexes?.[0]).toBe('client-123');
      expect(result.indexes).not.toContain(undefined);
    });

    it('should include project_id with multiple events', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        project_id: 'projmulti',
        events: [{ name: 'event1' }, { name: 'event2' }, { name: 'event3' }],
      };

      const result = adapter.transform(data);

      expect(result.indexes?.[0]).toBe('projmulti');
      expect(result.doubles).toEqual([3]);
    });
  });
});
