import { describe, it, expect } from 'vitest';
import { detectBot } from '../../../src/utils/bot-detection';
import type {
  ParsedUserAgent,
  Fingerprint,
  FingerprintComponents,
} from '../../../src/types/realtime';

describe('detectBot', () => {
  const createUserAgent = (
    name: string,
    deviceType: 'desktop' | 'mobile' | 'tablet' | 'bot' | 'unknown' = 'desktop'
  ): ParsedUserAgent => ({
    browser: { name, version: '1.0', engine: 'Unknown' },
    os: { name: 'Unknown', version: '0.0' },
    device: { type: deviceType, vendor: 'Unknown', model: 'Unknown' },
    raw: `${name}/1.0`,
  });

  const createFingerprint = (confidence: number): Fingerprint => {
    const components: FingerprintComponents = {
      screen: { width: 1920, height: 1080, colorDepth: 24 },
      timezone: 'America/New_York',
      language: 'en-US',
      platform: 'MacIntel',
      cookieEnabled: true,
      doNotTrack: false,
    };

    return {
      hash: 'test-hash',
      components,
      confidence,
    };
  };

  describe('User-Agent based detection', () => {
    it('should detect Googlebot as bot', () => {
      const ua = createUserAgent('Googlebot', 'bot');
      const fp = createFingerprint(90);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.reasons).toContain('Bot detected in User-Agent');
      expect(result.detectionMethod).toBe('ua-string');
    });

    it('should detect Bingbot as bot', () => {
      const ua = createUserAgent('Bingbot', 'bot');
      const fp = createFingerprint(90);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.reasons).toContain('Bot detected in User-Agent');
    });

    it('should detect curl as bot', () => {
      const ua = createUserAgent('curl', 'bot');
      const fp = createFingerprint(50);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('should detect wget as bot', () => {
      const ua = createUserAgent('wget', 'bot');
      const fp = createFingerprint(50);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });

    it('should detect Python as bot', () => {
      const ua = createUserAgent('Python', 'bot');
      const fp = createFingerprint(50);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(70);
    });
  });

  describe('Fingerprint-based detection', () => {
    it('should flag low confidence fingerprint', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(20);

      const result = detectBot(ua, fp);

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons).toContain('Low fingerprint confidence');
    });

    it('should flag very low confidence fingerprint as bot', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(10);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(50);
      expect(result.detectionMethod).toBe('fingerprint');
    });

    it('should accept high confidence fingerprint', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(90);

      const result = detectBot(ua, fp);

      expect(result.score).toBeLessThan(50);
      expect(result.isBot).toBe(false);
    });
  });

  describe('Combined detection', () => {
    it('should combine UA and fingerprint signals', () => {
      const ua = createUserAgent('Unknown', 'unknown');
      const fp = createFingerprint(30);

      const result = detectBot(ua, fp);

      expect(result.score).toBeGreaterThan(0);
      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.detectionMethod).toBe('combined');
    });

    it('should have higher score for multiple bot signals', () => {
      const ua = createUserAgent('curl', 'bot');
      const fp = createFingerprint(15);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
      expect(result.reasons.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('Human detection', () => {
    it('should recognize Chrome as likely human', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(85);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(false);
      expect(result.score).toBeLessThan(50);
      expect(result.detectionMethod).toBe('combined');
    });

    it('should recognize Safari as likely human', () => {
      const ua = createUserAgent('Safari');
      const fp = createFingerprint(80);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(false);
      expect(result.score).toBeLessThan(50);
    });

    it('should recognize Firefox as likely human', () => {
      const ua = createUserAgent('Firefox');
      const fp = createFingerprint(85);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(false);
      expect(result.score).toBeLessThan(50);
    });

    it('should recognize Edge as likely human', () => {
      const ua = createUserAgent('Edge');
      const fp = createFingerprint(80);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(false);
      expect(result.score).toBeLessThan(50);
    });
  });

  describe('Edge cases', () => {
    it('should handle Unknown browser with high confidence', () => {
      const ua = createUserAgent('Unknown', 'unknown');
      const fp = createFingerprint(90);

      const result = detectBot(ua, fp);

      // High confidence suggests real browser despite unknown name
      expect(result.score).toBeLessThan(60);
    });

    it('should handle known browser with low confidence', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(25);

      const result = detectBot(ua, fp);

      // Low confidence raises suspicion despite known browser
      expect(result.score).toBeGreaterThan(20);
      expect(result.reasons).toContain('Low fingerprint confidence');
    });

    it('should handle bot with medium confidence', () => {
      const ua = createUserAgent('Googlebot', 'bot');
      const fp = createFingerprint(50);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(80);
    });
  });

  describe('Score boundaries', () => {
    it('should have score between 0 and 100', () => {
      const testCases = [
        { ua: createUserAgent('Chrome'), fp: createFingerprint(90) },
        { ua: createUserAgent('Googlebot', 'bot'), fp: createFingerprint(10) },
        {
          ua: createUserAgent('Unknown', 'unknown'),
          fp: createFingerprint(50),
        },
      ];

      for (const { ua, fp } of testCases) {
        const result = detectBot(ua, fp);
        expect(result.score).toBeGreaterThanOrEqual(0);
        expect(result.score).toBeLessThanOrEqual(100);
      }
    });

    it('should determine isBot correctly from score', () => {
      const ua1 = createUserAgent('Chrome');
      const fp1 = createFingerprint(90);
      const result1 = detectBot(ua1, fp1);
      expect(result1.score).toBeLessThan(50);
      expect(result1.isBot).toBe(false);

      const ua2 = createUserAgent('Googlebot', 'bot');
      const fp2 = createFingerprint(10);
      const result2 = detectBot(ua2, fp2);
      expect(result2.score).toBeGreaterThanOrEqual(50);
      expect(result2.isBot).toBe(true);
    });
  });

  describe('Detection methods', () => {
    it('should use ua-string method for obvious bots', () => {
      const ua = createUserAgent('Googlebot', 'bot');
      const fp = createFingerprint(90);

      const result = detectBot(ua, fp);

      expect(result.detectionMethod).toBe('ua-string');
    });

    it('should use fingerprint method for low confidence', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(10);

      const result = detectBot(ua, fp);

      expect(result.detectionMethod).toBe('fingerprint');
    });

    it('should use combined method for mixed signals', () => {
      const ua = createUserAgent('Unknown', 'unknown');
      const fp = createFingerprint(50);

      const result = detectBot(ua, fp);

      expect(result.detectionMethod).toBe('combined');
    });
  });

  describe('Reasons array', () => {
    it('should provide clear reasons for detection', () => {
      const ua = createUserAgent('Googlebot', 'bot');
      const fp = createFingerprint(20);

      const result = detectBot(ua, fp);

      expect(result.reasons.length).toBeGreaterThan(0);
      expect(result.reasons.every((r) => typeof r === 'string')).toBe(true);
      expect(result.reasons.every((r) => r.length > 0)).toBe(true);
    });

    it('should have at least one reason for bots', () => {
      const ua = createUserAgent('curl', 'bot');
      const fp = createFingerprint(50);

      const result = detectBot(ua, fp);

      expect(result.isBot).toBe(true);
      expect(result.reasons.length).toBeGreaterThan(0);
    });

    it('should have reasons for suspicious behavior', () => {
      const ua = createUserAgent('Chrome');
      const fp = createFingerprint(15);

      const result = detectBot(ua, fp);

      expect(result.reasons.length).toBeGreaterThan(0);
    });
  });
});
