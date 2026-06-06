/// <reference lib="deno.ns" />

import type { EventData } from "./types.ts";

// Documentation content structure interfaces
export interface CodeExample {
  title: string;
  language: string;
  code: string;
  description?: string;
}

export interface ApiEndpoint {
  method: string;
  path: string;
  description: string;
  requestBody?: any;
  responseBody?: any;
  statusCodes: { code: number; description: string }[];
  headers?: { name: string; required: boolean; description: string }[];
}

export interface ErrorCode {
  code: number;
  message: string;
  description: string;
  solution: string;
}

export interface TroubleshootingItem {
  problem: string;
  solution: string;
  codeExample?: string;
}

export interface DocumentationContent {
  title: string;
  description: string;
  quickStart: CodeExample[];
  apiEndpoints: ApiEndpoint[];
  integrationExamples: CodeExample[];
  errorCodes: ErrorCode[];
  troubleshooting: TroubleshootingItem[];
}

// Helper function to get dynamic host URL
export function getHostUrl(): string {
  try {
    return Deno.env.get("HOST_URL") || "http://localhost:8000";
  } catch {
    return "http://localhost:8000";
  }
}

// Function to generate API examples with dynamic host URL
export function getQuickStartExamples(hostUrl?: string): CodeExample[] {
  const baseUrl = hostUrl || getHostUrl();

  return [
    {
      title: "Single Event Tracking",
      language: "bash",
      code: `curl -X POST ${baseUrl}/api/track \\
  -H "Content-Type: application/json" \\
  -H "x-user-id: your-user-id" \\
  -d '{
    "event": "page_view",
    "properties": {
      "page": "/home",
      "title": "Home Page",
      "timestamp": "2024-01-15T10:30:00Z"
    }
  }'`,
      description:
        "Track a single event with user context and custom properties",
    },
    {
      title: "Batch Event Tracking",
      language: "bash",
      code: `curl -X POST ${baseUrl}/api/track \\
  -H "Content-Type: application/json" \\
  -H "x-user-id: your-user-id" \\
  -d '[
    {
      "event": "button_click",
      "properties": {
        "button_id": "signup",
        "page": "/landing"
      }
    },
    {
      "event": "form_submit",
      "properties": {
        "form_id": "newsletter",
        "email": "user@example.com"
      }
    }
  ]'`,
      description:
        "Track multiple events in a single request for better performance",
    },
    {
      title: "Success Response",
      language: "json",
      code: `{
  "success": true,
  "processed": 1,
  "userId": "your-user-id"
}`,
      description: "Expected response format for successful event tracking",
    },
    {
      title: "Error Response",
      language: "json",
      code: `{
  "error": "Bad Request",
  "message": "Invalid event data format",
  "statusCode": 400
}`,
      description: "Example error response when request format is invalid",
    },
  ];
}

// Constants for API examples and documentation content
export const API_EXAMPLES: CodeExample[] = getQuickStartExamples();

export const INTEGRATION_EXAMPLES: CodeExample[] = [
  {
    title: "JavaScript Fetch API - Single Event",
    language: "javascript",
    code: `// Single event tracking with error handling
async function trackEvent(eventData, userId) {
  try {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(eventData)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(\`HTTP \${response.status}: \${errorData.message || errorData.error}\`);
    }
    
    const result = await response.json();
    console.log('Event tracked successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to track event:', error);
    throw error;
  }
}

// Usage example
trackEvent({
  event: 'page_view',
  properties: {
    page: '/dashboard',
    title: 'User Dashboard',
    referrer: document.referrer,
    timestamp: new Date().toISOString()
  }
}, 'user-123');`,
    description: "Basic client-side event tracking with proper error handling",
  },
  {
    title: "JavaScript Fetch API - Batch Events",
    language: "javascript",
    code: `// Batch event tracking for better performance
async function trackBatchEvents(events, userId) {
  try {
    const response = await fetch('/api/track', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': userId
      },
      body: JSON.stringify(events)
    });
    
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(\`HTTP \${response.status}: \${errorData.message || errorData.error}\`);
    }
    
    const result = await response.json();
    console.log(\`Successfully tracked \${result.processed} events\`);
    return result;
  } catch (error) {
    console.error('Failed to track batch events:', error);
    throw error;
  }
}

// Usage example - tracking multiple user interactions
const userEvents = [
  {
    event: 'button_click',
    properties: {
      button_id: 'cta-signup',
      page: '/landing',
      position: 'header'
    }
  },
  {
    event: 'form_view',
    properties: {
      form_id: 'signup-form',
      step: 1
    }
  },
  {
    event: 'form_submit',
    properties: {
      form_id: 'signup-form',
      success: true,
      email: 'user@example.com'
    }
  }
];

trackBatchEvents(userEvents, 'user-456');`,
    description:
      "Batch event tracking for improved performance and reduced network requests",
  },
  {
    title: "Browser Client-side with Retry Logic",
    language: "javascript",
    code: `class BrowserEventTracker {
  constructor(userId, options = {}) {
    this.userId = userId;
    this.baseUrl = options.baseUrl || '';
    this.maxRetries = options.maxRetries || 3;
    this.retryDelay = options.retryDelay || 1000;
    this.eventQueue = [];
    this.isOnline = navigator.onLine;
    
    // Listen for online/offline events
    window.addEventListener('online', () => {
      this.isOnline = true;
      this.flushQueue();
    });
    
    window.addEventListener('offline', () => {
      this.isOnline = false;
    });
  }
  
  async track(eventData) {
    if (!this.isOnline) {
      this.eventQueue.push(eventData);
      console.log('Offline: Event queued for later');
      return;
    }
    
    return this.trackWithRetry(eventData);
  }
  
  async trackWithRetry(eventData, attempt = 1) {
    try {
      const response = await fetch(\`\${this.baseUrl}/api/track\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId
        },
        body: JSON.stringify(eventData)
      });
      
      if (!response.ok) {
        throw new Error(\`HTTP \${response.status}\`);
      }
      
      return await response.json();
    } catch (error) {
      if (attempt < this.maxRetries) {
        console.log(\`Retry attempt \${attempt} failed, retrying...\`);
        await this.delay(this.retryDelay * Math.pow(2, attempt - 1));
        return this.trackWithRetry(eventData, attempt + 1);
      } else {
        console.error('Max retries exceeded:', error);
        // Queue for later if all retries failed
        this.eventQueue.push(eventData);
        throw error;
      }
    }
  }
  
  async flushQueue() {
    if (this.eventQueue.length === 0) return;
    
    const events = [...this.eventQueue];
    this.eventQueue = [];
    
    try {
      await this.trackWithRetry(events);
      console.log(\`Flushed \${events.length} queued events\`);
    } catch (error) {
      // Re-queue events if flush fails
      this.eventQueue.unshift(...events);
    }
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage
const tracker = new BrowserEventTracker('user-789', {
  maxRetries: 5,
  retryDelay: 500
});

// Track events with automatic retry and offline queueing
tracker.track({
  event: 'user_interaction',
  properties: {
    action: 'scroll',
    position: window.scrollY,
    timestamp: Date.now()
  }
});`,
    description:
      "Browser-optimized tracker with offline support, retry logic, and event queueing",
  },
  {
    title: "Node.js Server-side Implementation",
    language: "javascript",
    code: `const https = require('https');
const http = require('http');

class ServerEventTracker {
  constructor(baseUrl, userId, options = {}) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    this.maxRetries = options.maxRetries || 3;
    this.timeout = options.timeout || 5000;
    this.isHttps = baseUrl.startsWith('https');
  }
  
  async track(eventData) {
    return this.makeRequest(eventData);
  }
  
  async trackBatch(events) {
    return this.makeRequest(events);
  }
  
  makeRequest(data) {
    const postData = JSON.stringify(data);
    const url = new URL(\`\${this.baseUrl}/api/track\`);
    
    const options = {
      hostname: url.hostname,
      port: url.port || (this.isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-user-id': this.userId,
        'Content-Length': Buffer.byteLength(postData)
      },
      timeout: this.timeout
    };
    
    return new Promise((resolve, reject) => {
      const client = this.isHttps ? https : http;
      
      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', chunk => body += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(body);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              resolve(result);
            } else {
              reject(new Error(\`HTTP \${res.statusCode}: \${result.message || result.error}\`));
            }
          } catch (error) {
            reject(new Error(\`Invalid JSON response: \${body}\`));
          }
        });
      });
      
      req.on('error', reject);
      req.on('timeout', () => {
        req.destroy();
        reject(new Error('Request timeout'));
      });
      
      req.write(postData);
      req.end();
    });
  }
  
  async trackWithRetry(eventData) {
    let lastError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        return await this.track(eventData);
      } catch (error) {
        lastError = error;
        if (attempt < this.maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 10000);
          console.log(\`Attempt \${attempt} failed, retrying in \${delay}ms...\`);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError;
  }
}

// Usage examples
const tracker = new ServerEventTracker('http://localhost:8000', 'server-user-123', {
  maxRetries: 5,
  timeout: 10000
});

// Track single server-side event
tracker.trackWithRetry({
  event: 'api_request',
  properties: {
    endpoint: '/api/users',
    method: 'GET',
    response_time: 150,
    status_code: 200,
    user_agent: req.headers['user-agent']
  }
}).catch(console.error);

// Track batch of server events
const serverEvents = [
  {
    event: 'database_query',
    properties: {
      query_type: 'SELECT',
      table: 'users',
      duration: 45
    }
  },
  {
    event: 'cache_hit',
    properties: {
      key: 'user:123',
      ttl: 3600
    }
  }
];

tracker.trackBatch(serverEvents).catch(console.error);`,
    description:
      "Production-ready Node.js server-side implementation with timeout handling and retry logic",
  },
  {
    title: "TypeScript with Advanced Error Handling",
    language: "typescript",
    code: `interface TrackingEvent {
  event: string;
  properties: Record<string, any>;
  timestamp?: string;
}

interface TrackingResponse {
  success: boolean;
  processed: number;
  userId: string;
}

interface TrackerOptions {
  maxRetries?: number;
  retryDelay?: number;
  timeout?: number;
  onError?: (error: Error, event: TrackingEvent | TrackingEvent[]) => void;
  onSuccess?: (response: TrackingResponse) => void;
}

class TypeScriptEventTracker {
  private baseUrl: string;
  private userId: string;
  private options: Required<TrackerOptions>;
  
  constructor(baseUrl: string, userId: string, options: TrackerOptions = {}) {
    this.baseUrl = baseUrl;
    this.userId = userId;
    this.options = {
      maxRetries: options.maxRetries ?? 3,
      retryDelay: options.retryDelay ?? 1000,
      timeout: options.timeout ?? 5000,
      onError: options.onError ?? (() => {}),
      onSuccess: options.onSuccess ?? (() => {})
    };
  }
  
  async track(event: TrackingEvent): Promise<TrackingResponse> {
    return this.trackWithRetry(event);
  }
  
  async trackBatch(events: TrackingEvent[]): Promise<TrackingResponse> {
    if (events.length === 0) {
      throw new Error('Cannot track empty event batch');
    }
    return this.trackWithRetry(events);
  }
  
  private async trackWithRetry(
    data: TrackingEvent | TrackingEvent[]
  ): Promise<TrackingResponse> {
    let lastError: Error;
    
    for (let attempt = 1; attempt <= this.options.maxRetries; attempt++) {
      try {
        const response = await this.makeRequest(data);
        this.options.onSuccess(response);
        return response;
      } catch (error) {
        lastError = error as Error;
        
        if (attempt < this.options.maxRetries && this.isRetryableError(error as Error)) {
          const delay = this.options.retryDelay * Math.pow(2, attempt - 1);
          await this.delay(delay);
          continue;
        }
        
        this.options.onError(lastError, data);
        throw lastError;
      }
    }
    
    throw lastError!;
  }
  
  private async makeRequest(data: TrackingEvent | TrackingEvent[]): Promise<TrackingResponse> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.options.timeout);
    
    try {
      const response = await fetch(\`\${this.baseUrl}/api/track\`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-id': this.userId
        },
        body: JSON.stringify(data),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(\`HTTP \${response.status}: \${errorData.message || errorData.error || 'Unknown error'}\`);
      }
      
      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      if (error.name === 'AbortError') {
        throw new Error('Request timeout');
      }
      throw error;
    }
  }
  
  private isRetryableError(error: Error): boolean {
    // Retry on network errors, timeouts, and 5xx server errors
    return error.message.includes('timeout') ||
           error.message.includes('network') ||
           error.message.includes('fetch') ||
           /HTTP 5\d\d/.test(error.message);
  }
  
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Usage examples
const tracker = new TypeScriptEventTracker('http://localhost:8000', 'ts-user-456', {
  maxRetries: 5,
  retryDelay: 500,
  timeout: 8000,
  onError: (error, event) => {
    console.error('Tracking failed:', error.message);
    // Could send to error reporting service
  },
  onSuccess: (response) => {
    console.log(\`Successfully tracked \${response.processed} events\`);
  }
});

// Single event with type safety
const userEvent: TrackingEvent = {
  event: 'feature_used',
  properties: {
    feature_name: 'advanced_search',
    user_tier: 'premium',
    search_query: 'typescript event tracking',
    results_count: 42
  },
  timestamp: new Date().toISOString()
};

tracker.track(userEvent);

// Batch events with type safety
const analyticsEvents: TrackingEvent[] = [
  {
    event: 'page_load',
    properties: {
      page: '/analytics',
      load_time: 1250,
      user_agent: navigator.userAgent
    }
  },
  {
    event: 'widget_interaction',
    properties: {
      widget_type: 'chart',
      action: 'filter_applied',
      filter_value: 'last_30_days'
    }
  }
];

tracker.trackBatch(analyticsEvents);`,
    description:
      "Enterprise-grade TypeScript implementation with comprehensive error handling, timeouts, and type safety",
  },
];

export const ERROR_CODES: ErrorCode[] = [
  {
    code: 400,
    message: "Bad Request",
    description: "The request body is malformed or missing required fields",
    solution:
      "Ensure your request body is valid JSON and includes all required event properties",
  },
  {
    code: 401,
    message: "Unauthorized",
    description: "Missing or invalid user identification",
    solution:
      "Include a valid x-user-id, user-id, x-api-key, or authorization header",
  },
  {
    code: 405,
    message: "Method Not Allowed",
    description: "HTTP method not supported for this endpoint",
    solution: "Use POST method for /api/track endpoint",
  },
  {
    code: 500,
    message: "Internal Server Error",
    description: "Server encountered an error processing the request",
    solution:
      "Check your request format and try again. Contact support if the issue persists",
  },
];

export const TROUBLESHOOTING_ITEMS: TroubleshootingItem[] = [
  {
    problem: "CORS errors when tracking from browser",
    solution:
      "The API supports CORS for all origins. Ensure you're making the request to the correct endpoint and include proper headers.",
    codeExample: `// Ensure proper headers are included
fetch('/api/track', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-user-id': 'your-user-id'
  },
  body: JSON.stringify(eventData)
});`,
  },
  {
    problem: "401 Unauthorized error",
    solution:
      "User identification is required. Include one of the supported user ID headers.",
    codeExample: `// Any of these headers will work:
headers: {
  'x-user-id': 'user-123',        // Preferred
  'user-id': 'user-123',          // Alternative
  'x-api-key': 'api-key-456',     // For API keys
  'authorization': 'Bearer token' // For JWT tokens
}`,
  },
  {
    problem: "Events not appearing in dashboard",
    solution:
      "Ensure you're using the same user ID for tracking and dashboard viewing. Events are user-specific.",
    codeExample: `// Make sure the user ID is consistent
const userId = 'user-123';
// Use the same userId for both tracking and dashboard access`,
  },
  {
    problem: "Large payload errors",
    solution:
      "Break large batches into smaller chunks. The API supports batch processing but has size limits.",
    codeExample: `// Process events in batches of 100
const batchSize = 100;
for (let i = 0; i < events.length; i += batchSize) {
  const batch = events.slice(i, i + batchSize);
  await trackEvents(batch);
}`,
  },
  {
    problem: "Network timeout issues",
    solution:
      "Implement retry logic with exponential backoff for network resilience.",
    codeExample: `async function trackWithRetry(eventData, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await trackEvent(eventData);
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      await new Promise(resolve => 
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
}`,
  },
];

export const API_ENDPOINTS: ApiEndpoint[] = [
  {
    method: "POST",
    path: "/api/track",
    description: "Track single or multiple events for a specific user",
    requestBody: {
      single: {
        event: "string",
        properties: "Record<string, any>",
        timestamp: "string (optional)",
      },
      batch: [
        {
          event: "string",
          properties: "Record<string, any>",
          timestamp: "string (optional)",
        },
      ],
    },
    responseBody: {
      success: true,
      processed: "number",
      userId: "string",
    },
    statusCodes: [
      { code: 200, description: "Events successfully processed" },
      { code: 400, description: "Invalid request body or user ID" },
      { code: 401, description: "Missing user identification" },
      { code: 500, description: "Server error during processing" },
    ],
    headers: [
      {
        name: "x-user-id",
        required: true,
        description: "User identifier (preferred)",
      },
      {
        name: "user-id",
        required: false,
        description: "Alternative user identifier",
      },
      {
        name: "x-api-key",
        required: false,
        description: "API key as user identifier",
      },
      {
        name: "authorization",
        required: false,
        description: "Bearer token as user identifier",
      },
      {
        name: "Content-Type",
        required: true,
        description: "Must be application/json",
      },
    ],
  },
];

// Main documentation content structure
export const DOCUMENTATION_CONTENT: DocumentationContent = {
  title: "Event Tracking API Documentation",
  description:
    "A high-performance event tracking and analytics service built with Fresh and ClickHouse. Track user events, analyze behavior, and monitor your application in real-time.",
  quickStart: API_EXAMPLES,
  apiEndpoints: API_ENDPOINTS,
  integrationExamples: INTEGRATION_EXAMPLES,
  errorCodes: ERROR_CODES,
  troubleshooting: TROUBLESHOOTING_ITEMS,
};
