import { describe, it, expect, beforeEach } from 'vitest';
import { RealtimeAdapter } from '../../../src/adapters/realtime';
import type { RealtimeEvent, ServerContext } from '../../../src/types/realtime';

describe('RealtimeAdapter', () => {
  let adapter: RealtimeAdapter;

  beforeEach(() => {
    adapter = new RealtimeAdapter();
  });

  const createValidEvent = (): RealtimeEvent => ({
    event_type: 'pageview',
    timestamp: Date.now(),
    url: 'https://example.com/page',
    referrer: 'https://google.com',
    user_agent:
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    fingerprint: {
      hash: 'abc123def456',
      components: {
        screen: { width: 1920, height: 1080, colorDepth: 24 },
        timezone: 'America/New_York',
        language: 'en-US',
        platform: 'Win32',
        cookieEnabled: true,
        doNotTrack: false,
      },
      confidence: 85,
    },
  });

  const createServerContext = (): ServerContext => ({
    ip: '203.0.113.42',
    country: 'US',
    city: 'San Francisco',
    region: 'California',
    timezone: 'America/Los_Angeles',
    asn: 15169,
    isp: 'Google LLC',
    cf_ray: '123456789abcdef-SFO',
    cf_connecting_ip: '203.0.113.42',
  });

  describe('validate', () => {
    it('should accept valid pageview event', () => {
      const event = createValidEvent();
      expect(adapter.validate(event)).toBe(true);
    });

    it('should accept valid click event', () => {
      const event: RealtimeEvent = {
        ...createValidEvent(),
        event_type: 'click',
        click_target: '#button-submit',
        click_text: 'Submit',
      };
      expect(adapter.validate(event)).toBe(true);
    });

    it('should accept valid custom event', () => {
      const event: RealtimeEvent = {
        ...createValidEvent(),
        event_type: 'custom',
        custom_data: { action: 'video_play', video_id: '123' },
      };
      expect(adapter.validate(event)).toBe(true);
    });

    it('should reject event without event_type', () => {
      const event = createValidEvent();
      delete (event as Partial<RealtimeEvent>).event_type;
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject event with invalid event_type', () => {
      const event = { ...createValidEvent(), event_type: 'invalid' };
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject event without timestamp', () => {
      const event = createValidEvent();
      delete (event as Partial<RealtimeEvent>).timestamp;
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject event with non-numeric timestamp', () => {
      const event = { ...createValidEvent(), timestamp: 'invalid' };
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject event without url', () => {
      const event = createValidEvent();
      delete (event as Partial<RealtimeEvent>).url;
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject event without user_agent', () => {
      const event = createValidEvent();
      delete (event as Partial<RealtimeEvent>).user_agent;
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject event without fingerprint', () => {
      const event = createValidEvent();
      delete (event as Partial<RealtimeEvent>).fingerprint;
      expect(adapter.validate(event)).toBe(false);
    });

    it('should reject non-object input', () => {
      expect(adapter.validate(null)).toBe(false);
      expect(adapter.validate(undefined)).toBe(false);
      expect(adapter.validate('string')).toBe(false);
      expect(adapter.validate(123)).toBe(false);
      expect(adapter.validate([])).toBe(false);
    });

    it('should accept event with optional project_id', () => {
      const event = { ...createValidEvent(), project_id: 'my-project' };
      expect(adapter.validate(event)).toBe(true);
    });

    it('should accept event with optional session_id', () => {
      const event = { ...createValidEvent(), session_id: 'sess_123' };
      expect(adapter.validate(event)).toBe(true);
    });

    it('should accept event with optional visitor_id', () => {
      const event = { ...createValidEvent(), visitor_id: 'visitor_456' };
      expect(adapter.validate(event)).toBe(true);
    });
  });

  describe('transform', () => {
    it('should transform basic pageview event', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      expect(result).toBeDefined();
      expect(result.blobs).toBeDefined();
      expect(result.doubles).toBeDefined();
      expect(result.indexes).toBeDefined();
    });

    it('should include project_id in indexes when provided in event', () => {
      const event = { ...createValidEvent(), project_id: 'test-project' };
      const result = adapter.transform(event);

      expect(result.indexes).toBeDefined();
      expect(result.indexes?.length).toBe(1);
      expect(result.indexes?.[0]).toBe('test-project');
    });

    it('should include project_id from context when not in event', () => {
      const event = createValidEvent();
      // Simulate context setting project_id
      adapter.setProjectId('context-project');
      const result = adapter.transform(event);

      expect(result.indexes).toBeDefined();
      expect(result.indexes?.[0]).toBe('context-project');
    });

    it('should include server context in blobs when provided', () => {
      const event = createValidEvent();
      const context = createServerContext();
      const result = adapter.transform(event, context);

      expect(result.blobs).toBeDefined();
      const blob = result.blobs?.[0];
      expect(blob).toContain('US'); // country
      expect(blob).toContain('203.0.113.42'); // IP
    });

    it('should include parsed user agent data', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toBeDefined();
      expect(blob).toContain('Chrome'); // browser
      expect(blob).toContain('Windows'); // OS
    });

    it('should include bot detection results', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toBeDefined();
      // Should have bot detection data
      expect(blob).toContain('isBot');
    });

    it('should detect known bots correctly', () => {
      const event = {
        ...createValidEvent(),
        user_agent: 'Googlebot/2.1 (+http://www.google.com/bot.html)',
      };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('"isBot":true');
    });

    it('should include fingerprint data', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toBeDefined();
      expect(blob).toContain('fingerprint');
      expect(blob).toContain('abc123def456'); // hash
    });

    it('should include event metadata in blobs', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('pageview'); // event_type
      expect(blob).toContain('https://example.com/page'); // url
      expect(blob).toContain('https://google.com'); // referrer
    });

    it('should include timestamp in doubles', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      expect(result.doubles).toBeDefined();
      expect(result.doubles?.length).toBeGreaterThan(0);
      expect(result.doubles?.[0]).toBe(event.timestamp);
    });

    it('should handle click events with target data', () => {
      const event: RealtimeEvent = {
        ...createValidEvent(),
        event_type: 'click',
        click_target: '#submit-button',
        click_text: 'Submit Form',
      };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('click');
      expect(blob).toContain('#submit-button');
      expect(blob).toContain('Submit Form');
    });

    it('should handle custom events with custom data', () => {
      const event: RealtimeEvent = {
        ...createValidEvent(),
        event_type: 'custom',
        custom_data: {
          action: 'video_play',
          video_id: 'abc123',
          duration: 120,
        },
      };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('custom');
      expect(blob).toContain('video_play');
      expect(blob).toContain('abc123');
    });

    it('should truncate project_id to 96 bytes for indexes', () => {
      const longProjectId = 'a'.repeat(200);
      const event = { ...createValidEvent(), project_id: longProjectId };
      const result = adapter.transform(event);

      expect(result.indexes).toBeDefined();
      const index = result.indexes?.[0];
      expect(index).toBeDefined();
      expect(Buffer.byteLength(index!, 'utf8')).toBeLessThanOrEqual(96);
    });

    it('should truncate blobs to 5120 bytes', () => {
      const largeCustomData = { data: 'x'.repeat(10000) };
      const event: RealtimeEvent = {
        ...createValidEvent(),
        event_type: 'custom',
        custom_data: largeCustomData,
      };
      const result = adapter.transform(event);

      expect(result.blobs).toBeDefined();
      const blob = result.blobs?.[0];
      expect(blob).toBeDefined();
      expect(Buffer.byteLength(blob!, 'utf8')).toBeLessThanOrEqual(5120);
    });

    it('should include session_id when provided', () => {
      const event = { ...createValidEvent(), session_id: 'sess_abc123' };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('sess_abc123');
    });

    it('should include visitor_id when provided', () => {
      const event = { ...createValidEvent(), visitor_id: 'visitor_xyz789' };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('visitor_xyz789');
    });

    it('should handle missing referrer gracefully', () => {
      const event = createValidEvent();
      delete (event as Partial<RealtimeEvent>).referrer;
      const result = adapter.transform(event);

      expect(result.blobs).toBeDefined();
      expect(result.blobs?.[0]).toBeDefined();
    });

    it('should include device type from parsed UA', () => {
      const event = createValidEvent();
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('desktop'); // device type
    });

    it('should detect mobile devices correctly', () => {
      const event = {
        ...createValidEvent(),
        user_agent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Safari/604.1',
      };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('mobile');
      expect(blob).toContain('iOS');
      expect(blob).toContain('iPhone');
    });
  });

  describe('edge cases', () => {
    it('should handle empty referrer string', () => {
      const event = { ...createValidEvent(), referrer: '' };
      const result = adapter.transform(event);

      expect(result.blobs).toBeDefined();
    });

    it('should handle very long URLs', () => {
      const longUrl = 'https://example.com/' + 'a'.repeat(2000);
      const event = { ...createValidEvent(), url: longUrl };
      const result = adapter.transform(event);

      expect(result.blobs).toBeDefined();
      const blob = result.blobs?.[0];
      expect(Buffer.byteLength(blob!, 'utf8')).toBeLessThanOrEqual(5120);
    });

    it('should handle special characters in URLs', () => {
      const event = {
        ...createValidEvent(),
        url: 'https://example.com/page?q=test&lang=日本語',
      };
      const result = adapter.transform(event);

      expect(result.blobs).toBeDefined();
    });

    it('should handle low confidence fingerprints', () => {
      const event = {
        ...createValidEvent(),
        fingerprint: {
          hash: 'low_confidence',
          components: {
            screen: { width: 0, height: 0, colorDepth: 0 },
            timezone: '',
            language: '',
            platform: '',
            cookieEnabled: false,
            doNotTrack: false,
          },
          confidence: 15,
        },
      };
      const result = adapter.transform(event);

      const blob = result.blobs?.[0];
      expect(blob).toContain('low_confidence');
      expect(blob).toContain('"confidence":15');
    });
  });
});
