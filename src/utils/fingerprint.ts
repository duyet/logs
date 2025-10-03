import type { FingerprintComponents, Fingerprint } from '../types/realtime';

/**
 * Generate a privacy-respecting fingerprint from browser components
 * Uses simple hashing to create a unique identifier without storing PII
 */
export function generateFingerprint(
  components: FingerprintComponents
): Fingerprint {
  const hash = hashComponents(components);
  const confidence = calculateConfidence(components);

  return {
    hash,
    components,
    confidence,
  };
}

/**
 * Create hash from fingerprint components
 * Simple FNV-1a hash implementation for consistent client fingerprinting
 */
export function hashComponents(components: FingerprintComponents): string {
  // Serialize components in deterministic order
  const serialized = JSON.stringify({
    screen: `${components.screen.width}x${components.screen.height}x${components.screen.colorDepth}`,
    timezone: components.timezone,
    language: components.language,
    platform: components.platform,
    cookie: components.cookieEnabled,
    dnt: components.doNotTrack,
  });

  // FNV-1a hash algorithm
  let hash = 2166136261; // FNV offset basis

  for (let i = 0; i < serialized.length; i++) {
    hash ^= serialized.charCodeAt(i);
    hash = Math.imul(hash, 16777619); // FNV prime
  }

  // Convert to hex and ensure positive
  const hashHex = (hash >>> 0).toString(16).padStart(8, '0');

  // Add timestamp-based salt for additional uniqueness
  const salt = Math.floor(Date.now() / 86400000); // Daily salt
  const saltHash = Math.imul(salt, 16777619);
  const saltHex = (saltHash >>> 0).toString(16).padStart(8, '0');

  return `${hashHex}${saltHex}`;
}

/**
 * Calculate confidence score based on component availability and uniqueness
 * Returns 0-100, higher = more unique/reliable fingerprint
 */
function calculateConfidence(components: FingerprintComponents): number {
  let score = 0;
  let maxScore = 0;

  // Screen resolution (20 points)
  maxScore += 20;
  if (
    components.screen.width > 0 &&
    components.screen.height > 0 &&
    components.screen.colorDepth > 0
  ) {
    score += 20;

    // Bonus for uncommon resolutions
    const resolution = `${components.screen.width}x${components.screen.height}`;
    const commonResolutions = [
      '1920x1080',
      '1366x768',
      '1440x900',
      '1536x864',
      '1280x720',
    ];
    if (!commonResolutions.includes(resolution)) {
      score += 5;
      maxScore += 5;
    }
  }

  // Timezone (20 points)
  maxScore += 20;
  if (components.timezone && components.timezone.length > 0) {
    score += 20;
  }

  // Language (15 points)
  maxScore += 15;
  if (components.language && components.language.length > 0) {
    score += 15;
  }

  // Platform (15 points)
  maxScore += 15;
  if (components.platform && components.platform.length > 0) {
    score += 15;
  }

  // Cookie enabled (10 points)
  maxScore += 10;
  score += 10; // Always counted as it's boolean

  // Do Not Track (10 points)
  maxScore += 10;
  if (components.doNotTrack) {
    score += 5; // Bonus for DNT enabled (less common)
  } else {
    score += 10;
  }

  // Color depth uniqueness (10 points)
  maxScore += 10;
  if (
    components.screen.colorDepth === 24 ||
    components.screen.colorDepth === 32
  ) {
    score += 10; // Common depths
  } else if (components.screen.colorDepth > 0) {
    score += 15; // Uncommon depth
    maxScore += 5;
  }

  // Calculate percentage
  const confidence = Math.round((score / maxScore) * 100);

  return Math.min(100, Math.max(0, confidence));
}
