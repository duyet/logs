import { describe, it, expect } from 'vitest';
import { parseUserAgent } from '../../../src/utils/user-agent-parser';
import type { ParsedUserAgent } from '../../../src/types/realtime';

describe('parseUserAgent', () => {
  describe('Chrome browser', () => {
    it('should parse Chrome on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Chrome');
      expect(result.browser.version).toBe('120.0.0.0');
      expect(result.browser.engine).toBe('Blink');
      expect(result.os.name).toBe('Windows');
      expect(result.os.version).toBe('10.0');
      expect(result.device.type).toBe('desktop');
      expect(result.raw).toBe(ua);
    });

    it('should parse Chrome on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Chrome');
      expect(result.os.name).toBe('macOS');
      expect(result.os.version).toBe('10.15.7');
      expect(result.device.type).toBe('desktop');
    });

    it('should parse Chrome on Android', () => {
      const ua =
        'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Chrome');
      expect(result.os.name).toBe('Android');
      expect(result.os.version).toBe('13');
      expect(result.device.type).toBe('mobile');
      expect(result.device.vendor).toBe('Google');
      expect(result.device.model).toBe('Pixel 7');
    });
  });

  describe('Safari browser', () => {
    it('should parse Safari on macOS', () => {
      const ua =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Safari');
      expect(result.browser.version).toBe('17.0');
      expect(result.browser.engine).toBe('WebKit');
      expect(result.os.name).toBe('macOS');
      expect(result.device.type).toBe('desktop');
    });

    it('should parse Safari on iOS', () => {
      const ua =
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Safari');
      expect(result.os.name).toBe('iOS');
      expect(result.os.version).toBe('17.0');
      expect(result.device.type).toBe('mobile');
      expect(result.device.vendor).toBe('Apple');
      expect(result.device.model).toBe('iPhone');
    });

    it('should parse Safari on iPad', () => {
      const ua =
        'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Safari');
      expect(result.os.name).toBe('iOS');
      expect(result.device.type).toBe('tablet');
      expect(result.device.vendor).toBe('Apple');
      expect(result.device.model).toBe('iPad');
    });
  });

  describe('Firefox browser', () => {
    it('should parse Firefox on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Firefox');
      expect(result.browser.version).toBe('121.0');
      expect(result.browser.engine).toBe('Gecko');
      expect(result.os.name).toBe('Windows');
      expect(result.device.type).toBe('desktop');
    });

    it('should parse Firefox on Linux', () => {
      const ua =
        'Mozilla/5.0 (X11; Linux x86_64; rv:121.0) Gecko/20100101 Firefox/121.0';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Firefox');
      expect(result.os.name).toBe('Linux');
      expect(result.device.type).toBe('desktop');
    });
  });

  describe('Edge browser', () => {
    it('should parse Edge on Windows', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Edge');
      expect(result.browser.version).toBe('120.0.0.0');
      expect(result.browser.engine).toBe('Blink');
      expect(result.os.name).toBe('Windows');
      expect(result.device.type).toBe('desktop');
    });
  });

  describe('Bot detection', () => {
    it('should detect Googlebot', () => {
      const ua =
        'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Googlebot');
      expect(result.device.type).toBe('bot');
    });

    it('should detect Bingbot', () => {
      const ua =
        'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Bingbot');
      expect(result.device.type).toBe('bot');
    });

    it('should detect generic bot by keywords', () => {
      const ua = 'curl/7.68.0';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('curl');
      expect(result.device.type).toBe('bot');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty User-Agent', () => {
      const result = parseUserAgent('');

      expect(result.browser.name).toBe('Unknown');
      expect(result.os.name).toBe('Unknown');
      expect(result.device.type).toBe('unknown');
      expect(result.raw).toBe('');
    });

    it('should handle malformed User-Agent', () => {
      const ua = 'invalid-user-agent-string';
      const result = parseUserAgent(ua);

      expect(result.browser.name).toBe('Unknown');
      expect(result.os.name).toBe('Unknown');
      expect(result.device.type).toBe('unknown');
      expect(result.raw).toBe(ua);
    });

    it('should handle very long User-Agent', () => {
      const ua = 'A'.repeat(1000);
      const result = parseUserAgent(ua);

      expect(result).toBeDefined();
      expect(result.raw).toBe(ua);
    });
  });

  describe('Type validation', () => {
    it('should return ParsedUserAgent type', () => {
      const ua =
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
      const result: ParsedUserAgent = parseUserAgent(ua);

      // TypeScript compilation validates the type
      expect(result.browser).toBeDefined();
      expect(result.os).toBeDefined();
      expect(result.device).toBeDefined();
      expect(result.raw).toBeDefined();
    });
  });
});
