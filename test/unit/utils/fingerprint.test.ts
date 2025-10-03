import { describe, it, expect } from 'vitest';
import {
  generateFingerprint,
  hashComponents,
} from '../../../src/utils/fingerprint';
import type { FingerprintComponents } from '../../../src/types/realtime';

describe('generateFingerprint', () => {
  const sampleComponents: FingerprintComponents = {
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
    },
    timezone: 'America/New_York',
    language: 'en-US',
    platform: 'MacIntel',
    cookieEnabled: true,
    doNotTrack: false,
  };

  describe('fingerprint generation', () => {
    it('should generate consistent hash for same components', () => {
      const result1 = generateFingerprint(sampleComponents);
      const result2 = generateFingerprint(sampleComponents);

      expect(result1.hash).toBe(result2.hash);
      expect(result1.hash).toBeTruthy();
      expect(result1.hash.length).toBeGreaterThan(0);
    });

    it('should generate different hash for different components', () => {
      const components1: FingerprintComponents = {
        ...sampleComponents,
        screen: { width: 1920, height: 1080, colorDepth: 24 },
      };

      const components2: FingerprintComponents = {
        ...sampleComponents,
        screen: { width: 1366, height: 768, colorDepth: 24 },
      };

      const result1 = generateFingerprint(components1);
      const result2 = generateFingerprint(components2);

      expect(result1.hash).not.toBe(result2.hash);
    });

    it('should store components in result', () => {
      const result = generateFingerprint(sampleComponents);

      expect(result.components).toEqual(sampleComponents);
    });

    it('should calculate confidence score', () => {
      const result = generateFingerprint(sampleComponents);

      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(100);
    });
  });

  describe('confidence calculation', () => {
    it('should have high confidence for complete components', () => {
      const result = generateFingerprint(sampleComponents);

      // All components provided = high confidence
      expect(result.confidence).toBeGreaterThanOrEqual(80);
    });

    it('should have lower confidence for minimal components', () => {
      const minimalComponents: FingerprintComponents = {
        screen: {
          width: 1920,
          height: 1080,
          colorDepth: 24,
        },
        timezone: '',
        language: '',
        platform: '',
        cookieEnabled: false,
        doNotTrack: false,
      };

      const result = generateFingerprint(minimalComponents);

      // Missing components = lower confidence
      expect(result.confidence).toBeLessThan(80);
    });

    it('should consider screen resolution in confidence', () => {
      const commonResolution: FingerprintComponents = {
        ...sampleComponents,
        screen: { width: 1920, height: 1080, colorDepth: 24 },
      };

      const uncommonResolution: FingerprintComponents = {
        ...sampleComponents,
        screen: { width: 2560, height: 1440, colorDepth: 32 },
      };

      const result1 = generateFingerprint(commonResolution);
      const result2 = generateFingerprint(uncommonResolution);

      // Both should have confidence, but uncommon resolution may have higher uniqueness
      expect(result1.confidence).toBeGreaterThan(0);
      expect(result2.confidence).toBeGreaterThan(0);
    });

    it('should consider timezone in confidence', () => {
      const withTimezone: FingerprintComponents = {
        ...sampleComponents,
        timezone: 'America/New_York',
      };

      const withoutTimezone: FingerprintComponents = {
        ...sampleComponents,
        timezone: '',
      };

      const result1 = generateFingerprint(withTimezone);
      const result2 = generateFingerprint(withoutTimezone);

      expect(result1.confidence).toBeGreaterThan(result2.confidence);
    });
  });

  describe('edge cases', () => {
    it('should handle zero screen dimensions', () => {
      const components: FingerprintComponents = {
        ...sampleComponents,
        screen: { width: 0, height: 0, colorDepth: 0 },
      };

      const result = generateFingerprint(components);

      expect(result.hash).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle empty string values', () => {
      const components: FingerprintComponents = {
        screen: { width: 1920, height: 1080, colorDepth: 24 },
        timezone: '',
        language: '',
        platform: '',
        cookieEnabled: false,
        doNotTrack: false,
      };

      const result = generateFingerprint(components);

      expect(result.hash).toBeTruthy();
      expect(result.confidence).toBeGreaterThanOrEqual(0);
    });

    it('should handle very large screen dimensions', () => {
      const components: FingerprintComponents = {
        ...sampleComponents,
        screen: { width: 7680, height: 4320, colorDepth: 48 },
      };

      const result = generateFingerprint(components);

      expect(result.hash).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle special characters in strings', () => {
      const components: FingerprintComponents = {
        ...sampleComponents,
        timezone: 'America/São_Paulo',
        language: 'zh-CN',
        platform: 'Linux x86_64',
      };

      const result = generateFingerprint(components);

      expect(result.hash).toBeTruthy();
      expect(result.confidence).toBeGreaterThan(0);
    });
  });

  describe('privacy considerations', () => {
    it('should not expose raw component values in hash', () => {
      const result = generateFingerprint(sampleComponents);

      // Hash should not contain obvious component values
      expect(result.hash).not.toContain('1920');
      expect(result.hash).not.toContain('1080');
      expect(result.hash).not.toContain('America/New_York');
    });

    it('should generate reasonable hash length', () => {
      const result = generateFingerprint(sampleComponents);

      // Hash should be reasonable length (not too short, not too long)
      expect(result.hash.length).toBeGreaterThanOrEqual(16);
      expect(result.hash.length).toBeLessThanOrEqual(128);
    });
  });
});

describe('hashComponents', () => {
  const sampleComponents: FingerprintComponents = {
    screen: {
      width: 1920,
      height: 1080,
      colorDepth: 24,
    },
    timezone: 'America/New_York',
    language: 'en-US',
    platform: 'MacIntel',
    cookieEnabled: true,
    doNotTrack: false,
  };

  describe('hash generation', () => {
    it('should generate consistent hash', () => {
      const hash1 = hashComponents(sampleComponents);
      const hash2 = hashComponents(sampleComponents);

      expect(hash1).toBe(hash2);
    });

    it('should generate different hashes for different inputs', () => {
      const components1 = sampleComponents;
      const components2 = {
        ...sampleComponents,
        language: 'fr-FR',
      };

      const hash1 = hashComponents(components1);
      const hash2 = hashComponents(components2);

      expect(hash1).not.toBe(hash2);
    });

    it('should return non-empty string', () => {
      const hash = hashComponents(sampleComponents);

      expect(hash).toBeTruthy();
      expect(typeof hash).toBe('string');
      expect(hash.length).toBeGreaterThan(0);
    });
  });

  describe('hash properties', () => {
    it('should be deterministic', () => {
      const hashes = Array.from({ length: 10 }, () =>
        hashComponents(sampleComponents)
      );

      // All hashes should be identical
      expect(new Set(hashes).size).toBe(1);
    });

    it('should be sensitive to all component changes', () => {
      const baseHash = hashComponents(sampleComponents);

      // Test each component change
      const variants = [
        {
          ...sampleComponents,
          screen: { width: 1366, height: 768, colorDepth: 24 },
        },
        { ...sampleComponents, timezone: 'Europe/London' },
        { ...sampleComponents, language: 'de-DE' },
        { ...sampleComponents, platform: 'Win32' },
        { ...sampleComponents, cookieEnabled: false },
        { ...sampleComponents, doNotTrack: true },
      ];

      for (const variant of variants) {
        const hash = hashComponents(variant);
        expect(hash).not.toBe(baseHash);
      }
    });
  });
});
