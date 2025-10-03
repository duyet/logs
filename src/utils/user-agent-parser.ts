import type {
  ParsedUserAgent,
  BrowserInfo,
  OSInfo,
  DeviceInfo,
} from '../types/realtime';

/**
 * Parse User-Agent string to extract browser, OS, and device information
 */
export function parseUserAgent(userAgent: string): ParsedUserAgent {
  const ua = userAgent.toLowerCase();

  const browser = parseBrowser(userAgent, ua);
  const os = parseOS(userAgent, ua);
  const device = parseDevice(userAgent, ua, browser, os);

  return {
    browser,
    os,
    device,
    raw: userAgent,
  };
}

/**
 * Parse browser information from User-Agent
 */
function parseBrowser(userAgent: string, ua: string): BrowserInfo {
  // Bot detection
  const botPatterns = [
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
    'bot',
    'crawler',
    'spider',
    'curl',
    'wget',
    'python',
    'java',
    'apache',
  ];

  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      const version = extractVersion(userAgent, pattern);
      return {
        name:
          pattern === 'curl' || pattern === 'wget'
            ? pattern
            : capitalizeFirst(pattern),
        version: version || '1.0',
        engine: 'Bot',
      };
    }
  }

  // Edge (must be checked before Chrome)
  if (ua.includes('edg/') || ua.includes('edge/')) {
    return {
      name: 'Edge',
      version: extractVersion(userAgent, 'Edg') || '0.0',
      engine: 'Blink',
    };
  }

  // Chrome
  if (ua.includes('chrome/') && !ua.includes('edg')) {
    return {
      name: 'Chrome',
      version: extractVersion(userAgent, 'Chrome') || '0.0',
      engine: 'Blink',
    };
  }

  // Safari (must be checked after Chrome)
  if (ua.includes('safari/') && !ua.includes('chrome')) {
    return {
      name: 'Safari',
      version: extractVersion(userAgent, 'Version') || '0.0',
      engine: 'WebKit',
    };
  }

  // Firefox
  if (ua.includes('firefox/')) {
    return {
      name: 'Firefox',
      version: extractVersion(userAgent, 'Firefox') || '0.0',
      engine: 'Gecko',
    };
  }

  // Opera
  if (ua.includes('opera/') || ua.includes('opr/')) {
    return {
      name: 'Opera',
      version: extractVersion(userAgent, 'OPR') || '0.0',
      engine: 'Blink',
    };
  }

  // Internet Explorer
  if (ua.includes('msie') || ua.includes('trident/')) {
    return {
      name: 'Internet Explorer',
      version: extractVersion(userAgent, 'MSIE') || '11.0',
      engine: 'Trident',
    };
  }

  return {
    name: 'Unknown',
    version: '0.0',
    engine: 'Unknown',
  };
}

/**
 * Parse operating system information from User-Agent
 */
function parseOS(userAgent: string, ua: string): OSInfo {
  // iOS (check FIRST before macOS since iOS user agents contain 'Mac OS X')
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ipod')) {
    const version = extractiOSVersion(userAgent);
    return {
      name: 'iOS',
      version,
    };
  }

  // Windows
  if (ua.includes('windows')) {
    const version = extractWindowsVersion(userAgent);
    return {
      name: 'Windows',
      version,
    };
  }

  // macOS
  if (ua.includes('mac os x') || ua.includes('macos')) {
    const version = extractMacVersion(userAgent);
    return {
      name: 'macOS',
      version,
    };
  }

  // Android
  if (ua.includes('android')) {
    const version = extractVersion(userAgent, 'Android') || '0.0';
    return {
      name: 'Android',
      version,
    };
  }

  // Linux
  if (ua.includes('linux')) {
    return {
      name: 'Linux',
      version: '0.0',
    };
  }

  // Chrome OS
  if (ua.includes('cros')) {
    return {
      name: 'Chrome OS',
      version: '0.0',
    };
  }

  return {
    name: 'Unknown',
    version: '0.0',
  };
}

/**
 * Parse device information from User-Agent
 */
function parseDevice(
  userAgent: string,
  ua: string,
  browser: BrowserInfo,
  os: OSInfo
): DeviceInfo {
  // Bot detection
  const botPatterns = [
    'bot',
    'crawler',
    'spider',
    'curl',
    'wget',
    'python',
    'java',
    'apache',
  ];
  for (const pattern of botPatterns) {
    if (ua.includes(pattern)) {
      return {
        type: 'bot',
        vendor: 'Unknown',
        model: 'Unknown',
      };
    }
  }

  // Tablet detection
  if (ua.includes('ipad')) {
    return {
      type: 'tablet',
      vendor: 'Apple',
      model: 'iPad',
    };
  }

  if (ua.includes('tablet') || ua.includes('kindle')) {
    return {
      type: 'tablet',
      vendor: extractVendor(userAgent),
      model: 'Tablet',
    };
  }

  // Mobile detection
  if (
    ua.includes('mobile') ||
    ua.includes('android') ||
    ua.includes('iphone') ||
    ua.includes('ipod')
  ) {
    let vendor = 'Unknown';
    let model = 'Mobile';

    if (ua.includes('iphone')) {
      vendor = 'Apple';
      model = 'iPhone';
    } else if (ua.includes('android')) {
      vendor = extractAndroidVendor(userAgent);
      model = extractAndroidModel(userAgent);
    }

    return {
      type: 'mobile',
      vendor,
      model,
    };
  }

  // Unknown (not clearly a desktop if we can't identify anything)
  // Check if userAgent string is empty or very simple
  // Also check if browser and OS are unknown
  if (
    !userAgent ||
    userAgent.trim().length === 0 ||
    (browser.name === 'Unknown' && os.name === 'Unknown')
  ) {
    return {
      type: 'unknown',
      vendor: 'Unknown',
      model: 'Unknown',
    };
  }

  // Desktop (default for non-mobile/tablet/bot)
  return {
    type: 'desktop',
    vendor: 'Unknown',
    model: 'Desktop',
  };
}

/**
 * Extract version number from User-Agent string
 */
function extractVersion(userAgent: string, pattern: string): string | null {
  const regex = new RegExp(`${pattern}[/\\s]([\\d.]+)`, 'i');
  const match = userAgent.match(regex);
  return match ? match[1] : null;
}

/**
 * Extract Windows version
 */
function extractWindowsVersion(userAgent: string): string {
  if (userAgent.includes('Windows NT 10.0')) return '10.0';
  if (userAgent.includes('Windows NT 6.3')) return '8.1';
  if (userAgent.includes('Windows NT 6.2')) return '8.0';
  if (userAgent.includes('Windows NT 6.1')) return '7.0';
  if (userAgent.includes('Windows NT 6.0')) return 'Vista';
  if (userAgent.includes('Windows NT 5.1')) return 'XP';
  return '0.0';
}

/**
 * Extract macOS version
 */
function extractMacVersion(userAgent: string): string {
  const match = userAgent.match(/Mac OS X (\d+)[._](\d+)[._]?(\d+)?/i);
  if (match) {
    const major = match[1];
    const minor = match[2];
    const patch = match[3] || '0';
    return `${major}.${minor}.${patch}`;
  }
  return '0.0';
}

/**
 * Extract iOS version
 */
function extractiOSVersion(userAgent: string): string {
  const match = userAgent.match(/OS (\d+)[._](\d+)[._]?(\d+)?/i);
  if (match) {
    const major = match[1];
    const minor = match[2];
    return `${major}.${minor || '0'}`;
  }
  return '0.0';
}

/**
 * Extract vendor from User-Agent
 */
function extractVendor(userAgent: string): string {
  const vendors = [
    'Samsung',
    'Huawei',
    'Xiaomi',
    'OnePlus',
    'Google',
    'LG',
    'Sony',
    'Motorola',
    'Nokia',
    'Apple',
  ];

  for (const vendor of vendors) {
    if (userAgent.includes(vendor)) {
      return vendor;
    }
  }

  return 'Unknown';
}

/**
 * Extract Android device vendor
 */
function extractAndroidVendor(userAgent: string): string {
  // Common Android device manufacturers
  const vendors: Record<string, string> = {
    samsung: 'Samsung',
    sm: 'Samsung', // Samsung model prefix
    huawei: 'Huawei',
    xiaomi: 'Xiaomi',
    oneplus: 'OnePlus',
    pixel: 'Google',
    lg: 'LG',
    sony: 'Sony',
    motorola: 'Motorola',
    nokia: 'Nokia',
    oppo: 'OPPO',
    vivo: 'Vivo',
  };

  const ua = userAgent.toLowerCase();
  for (const [key, value] of Object.entries(vendors)) {
    if (ua.includes(key)) {
      return value;
    }
  }

  return 'Unknown';
}

/**
 * Extract Android device model
 */
function extractAndroidModel(userAgent: string): string {
  // Try to extract model from common patterns
  // Pattern: (Linux; Android X.X; MODEL)
  const match = userAgent.match(/Android [^;]+; ([^)]+)\)/i);
  if (match && match[1]) {
    return match[1].trim();
  }

  return 'Android Device';
}

/**
 * Capitalize first letter of string
 */
function capitalizeFirst(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
