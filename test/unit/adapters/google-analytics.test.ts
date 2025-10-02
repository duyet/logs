/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
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
      expect(
        adapter.validate({ client_id: 'test', events: [{ name: 123 }] })
      ).toBe(false);
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([1]);

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.client_id).toBe('client-123');
      expect(metadata.events).toEqual([{ name: 'page_view' }]);
    });

    it('should include user_id when present', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        user_id: 'user-456',
        events: [{ name: 'login' }],
      };

      const result = adapter.transform(data);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // All metadata is in blobs[0] as JSON
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.client_id).toBe('client-123');
      expect(metadata.user_id).toBe('user-456');
      expect(metadata.events).toEqual([{ name: 'login' }]);
    });

    it('should include timestamp when present', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        timestamp_micros: '1640000000000000',
        events: [{ name: 'event' }],
      };

      const result = adapter.transform(data);

      // All metadata is in blobs[0] as JSON
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.timestamp_micros).toBe('1640000000000000');
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

      // All metadata is in blobs[0] as JSON
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.user_properties.plan.value).toBe('premium');
      expect(metadata.user_properties.country.value).toBe('US');
    });

    it('should handle multiple events', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'page_view' }, { name: 'click' }, { name: 'scroll' }],
      };

      const result = adapter.transform(data);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);
      expect(result.doubles).toEqual([3]);

      // All events are in metadata
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.events).toHaveLength(3);
      expect(metadata.events[0].name).toBe('page_view');
      expect(metadata.events[1].name).toBe('click');
      expect(metadata.events[2].name).toBe('scroll');
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

      // All metadata including event params is in blobs[0]
      expect(result.blobs).toBeDefined();
      expect(result.blobs?.length).toBe(1);
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.events[0].params.value).toBe(99.99);
      expect(metadata.events[0].params.currency).toBe('USD');
      expect(metadata.events[0].params.items).toBe(3);
    });

    it('should handle events without params', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'event1' }, { name: 'event2', params: {} }],
      };

      const result = adapter.transform(data);

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // Events are in metadata
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.events).toHaveLength(2);
      expect(metadata.events[0].name).toBe('event1');
      expect(metadata.events[1].name).toBe('event2');
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

      // No project_id means indexes should be empty
      expect(result.indexes).toEqual([]);

      // Client ID is in metadata, not truncated
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.client_id).toBe(longId);
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

      // Only project_id in indexes
      expect(result.indexes).toEqual(['proj789']);

      // Other fields are in metadata
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.client_id).toBe('client-123');
      expect(metadata.events).toEqual([{ name: 'page_view' }]);
    });

    it('should work without project_id', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        events: [{ name: 'event' }],
      };

      const result = adapter.transform(data);

      // No project_id means empty indexes
      expect(result.indexes).toEqual([]);

      // Data is in metadata
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.client_id).toBe('client-123');
    });

    it('should include project_id with multiple events', () => {
      const data: GoogleAnalyticsData = {
        client_id: 'client-123',
        project_id: 'projmulti',
        events: [{ name: 'event1' }, { name: 'event2' }, { name: 'event3' }],
      };

      const result = adapter.transform(data);

      // Only project_id in indexes
      expect(result.indexes).toEqual(['projmulti']);
      expect(result.doubles).toEqual([3]);

      // Events are in metadata
      const metadata = JSON.parse(result.blobs![0]);
      expect(metadata.events).toHaveLength(3);
    });
  });
});
