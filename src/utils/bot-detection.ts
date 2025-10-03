import type {
  ParsedUserAgent,
  Fingerprint,
  BotDetectionResult,
} from '../types/realtime';

/**
 * Detect if traffic is from a bot using multi-layer scoring
 * Combines User-Agent analysis with behavioral signals
 */
export function detectBot(
  userAgent: ParsedUserAgent,
  fingerprint: Fingerprint
): BotDetectionResult {
  let score = 0;
  const reasons: string[] = [];

  // Layer 1: User-Agent string analysis (most reliable)
  const uaScore = analyzeUserAgent(userAgent, reasons);
  score += uaScore;

  // Layer 2: Fingerprint analysis (behavioral signals)
  const fpScore = analyzeFingerprint(fingerprint, reasons);
  score += fpScore;

  // Layer 3: Combined signals
  const combinedScore = analyzeCombinedSignals(userAgent, fingerprint, reasons);
  score += combinedScore;

  // Normalize score to 0-100 range
  score = Math.min(100, Math.max(0, score));

  // Determine detection method
  let detectionMethod: BotDetectionResult['detectionMethod'];
  if (uaScore >= 80) {
    detectionMethod = 'ua-string';
  } else if (fpScore >= 40 && uaScore < 20) {
    detectionMethod = 'fingerprint';
  } else {
    detectionMethod = 'combined';
  }

  return {
    isBot: score >= 50,
    score,
    reasons,
    detectionMethod,
  };
}

/**
 * Analyze User-Agent string for bot indicators
 * Returns score 0-100, higher = more likely bot
 */
function analyzeUserAgent(
  userAgent: ParsedUserAgent,
  reasons: string[]
): number {
  let score = 0;

  // Check if device type is already identified as bot
  if (userAgent.device.type === 'bot') {
    score += 80;
    reasons.push('Bot detected in User-Agent');
    return score;
  }

  // Known bot browsers
  const knownBots = [
    'googlebot',
    'bingbot',
    'slurp',
    'duckduckbot',
    'baiduspider',
    'yandexbot',
    'facebookexternalhit',
    'twitterbot',
    'linkedinbot',
    'whatsapp',
    'telegram',
  ];

  const browserName = userAgent.browser.name.toLowerCase();
  if (knownBots.includes(browserName)) {
    score += 90;
    reasons.push('Known search engine or social media bot');
    return score;
  }

  // Command-line tools
  const cliTools = [
    'curl',
    'wget',
    'python',
    'java',
    'go-http-client',
    'apache',
  ];
  if (cliTools.includes(browserName)) {
    score += 70;
    reasons.push('Command-line tool or script detected');
    return score;
  }

  // Unknown browser
  if (browserName === 'unknown' || userAgent.browser.version === '0.0') {
    score += 30;
    reasons.push('Unknown or malformed User-Agent');
  }

  // Check for suspicious OS
  if (userAgent.os.name === 'Unknown') {
    score += 10;
  }

  return score;
}

/**
 * Analyze fingerprint for bot-like characteristics
 * Returns score 0-100, higher = more likely bot
 */
function analyzeFingerprint(
  fingerprint: Fingerprint,
  reasons: string[]
): number {
  let score = 0;

  // Very low confidence suggests incomplete browser environment
  if (fingerprint.confidence < 30) {
    score += 40;
    reasons.push('Low fingerprint confidence');
  } else if (fingerprint.confidence < 50) {
    score += 20;
    reasons.push('Below average fingerprint confidence');
  }

  // Check for suspicious component combinations
  const components = fingerprint.components;

  // Missing timezone is suspicious
  if (!components.timezone || components.timezone.length === 0) {
    score += 15;
    reasons.push('Missing timezone information');
  }

  // Missing language is suspicious
  if (!components.language || components.language.length === 0) {
    score += 15;
    reasons.push('Missing language information');
  }

  // Zero screen dimensions
  if (
    components.screen.width === 0 ||
    components.screen.height === 0 ||
    components.screen.colorDepth === 0
  ) {
    score += 25;
    reasons.push('Invalid screen dimensions');
  }

  // Cookies disabled is slightly suspicious
  if (!components.cookieEnabled) {
    score += 5;
    reasons.push('Cookies disabled');
  }

  return score;
}

/**
 * Analyze combined signals for additional bot indicators
 */
function analyzeCombinedSignals(
  userAgent: ParsedUserAgent,
  fingerprint: Fingerprint,
  reasons: string[]
): number {
  let score = 0;

  // Known browser but very low fingerprint confidence
  const knownBrowsers = ['chrome', 'safari', 'firefox', 'edge', 'opera'];
  const browserName = userAgent.browser.name.toLowerCase();

  if (knownBrowsers.includes(browserName) && fingerprint.confidence < 40) {
    score += 15;
    reasons.push('Known browser with suspicious fingerprint');
  }

  // Unknown browser with high confidence is less suspicious
  if (browserName === 'unknown' && fingerprint.confidence > 70) {
    score -= 10; // Reduce suspicion
  }

  // Desktop device with missing platform
  if (
    userAgent.device.type === 'desktop' &&
    (!fingerprint.components.platform ||
      fingerprint.components.platform.length === 0)
  ) {
    score += 10;
    reasons.push('Desktop device missing platform information');
  }

  return score;
}
