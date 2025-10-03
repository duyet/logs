# Cloudflare Analytics Router - Developer Documentation

## Project Overview

A TypeScript-based analytics data router built on Cloudflare Pages using the Hono framework. Routes multiple analytics data formats to Cloudflare Analytics Engine datasets.

**Production**: [logs.duyet.net](https://logs.duyet.net)

## Architecture

### System Overview

```
┌─────────────┐
│   Client    │  (Claude Code, GA4, Custom Apps)
└──────┬──────┘
       │ HTTP POST
       ↓
┌─────────────────────┐
│  Cloudflare Pages   │  (Edge Network - 300+ locations)
│   + Hono Router     │
└──────────┬──────────┘
       │ Transform & Validate
       ↓
┌─────────────────────┐
│ Analytics Engine    │  (Time-series Storage)
│      + D1 DB        │  (Project Metadata)
└─────────────────────┘
```

### Core Components

1. **Pages Function** (`functions/[[path]].ts`)
   - Catch-all route handler for all requests
   - Hono app initialization and configuration
   - Request routing to appropriate handlers

2. **Adapters** (`src/adapters/`)
   - Base adapter interface with type guards
   - Claude Code OpenTelemetry adapter
   - Google Analytics GA4 adapter
   - Extensible pattern for adding new formats

3. **Services** (`src/services/`)
   - Analytics Engine client with error handling
   - Project management service (D1 integration)
   - Data validation and transformation

4. **Routes** (`src/routes/router.ts`)
   - `/ping` - Health check endpoint
   - `/cc`, `/cc/:project_id` - Claude Code OpenTelemetry data
   - `/ga`, `/ga/:project_id` - Google Analytics GA4 data
   - `/api/projects` - Project management API

5. **Middleware** (`src/middleware/`)
   - Global error handler with JSON responses
   - Request/response logger
   - Project ID extraction and validation
   - CORS handling (configurable)

### Data Flow

```
HTTP Request (GET/POST)
    ↓
Hono Router (/cc, /ga, /ping)
    ↓
Project ID Middleware (extract & validate)
    ↓
Format Adapter (validate & transform)
    ↓
Analytics Engine Service (write to dataset)
    ↓
Cloudflare Analytics Engine Dataset
```

## Project Structure

```
cloudflare-analytics-router/
├── functions/
│   ├── [[path]].ts              # Catch-all Pages Function (entry point)
│   ├── index.ts                 # Root page handler (Web UI)
│   ├── index.html               # Project management UI
│   └── api/
│       └── projects.ts          # Project management API
├── src/
│   ├── adapters/                # Data format transformers
│   │   ├── base.ts             # Base adapter with utilities
│   │   ├── claude-code.ts      # Claude Code → Analytics Engine
│   │   ├── google-analytics.ts # GA4 → Analytics Engine
│   │   └── realtime.ts         # Real-time events → Analytics Engine
│   ├── durable-objects/
│   │   └── realtime-aggregator.ts # 5-minute window aggregation
│   ├── services/
│   │   ├── analytics-engine.ts # Analytics Engine client
│   │   └── project.ts          # Project management (D1)
│   ├── middleware/
│   │   ├── error-handler.ts    # Global error handling
│   │   ├── logger.ts           # Request/response logging
│   │   └── project-id.ts       # Project ID extraction & validation
│   ├── routes/
│   │   ├── router.ts           # Main Hono router configuration
│   │   ├── projects.ts         # Projects API router
│   │   ├── analytics.ts        # Analytics insights API
│   │   └── realtime.ts         # Real-time tracking API
│   ├── utils/
│   │   ├── route-handler.ts    # Generic route handler factory
│   │   ├── validation.ts       # Data validation utilities
│   │   ├── user-agent-parser.ts # UA parsing (browser/OS/device)
│   │   ├── fingerprint.ts      # Privacy-first fingerprinting
│   │   └── bot-detection.ts    # Multi-layer bot detection
│   └── types/
│       ├── index.ts            # TypeScript types and interfaces
│       ├── hono.ts             # Hono context extensions
│       └── realtime.ts         # Real-time analytics types
├── migrations/
│   └── 0001_create_projects.sql # D1 database schema
├── test/
│   ├── unit/                   # Unit tests (100% coverage)
│   │   ├── adapters/
│   │   ├── services/
│   │   ├── middleware/
│   │   └── utils/
│   └── e2e/                    # End-to-end tests
│       ├── endpoints.test.ts
│       └── projects-api.test.ts
├── scripts/
│   ├── deploy.sh               # Deployment script
│   ├── seed-projects.ts        # Generate default projects
│   ├── backup-d1.sh            # Backup D1 database
│   ├── restore-d1.sh           # Restore D1 database
│   ├── generate-test-events.ts # Test event generator
│   └── README.md               # Scripts documentation
├── wrangler.toml               # Cloudflare configuration
├── CLAUDE.md                   # This file
└── README.md                   # User documentation
```

## Endpoints

### `/ping` - Health Check

- **Methods**: GET
- **Response**: `{ status: "ok", timestamp: ISO8601 }`
- **Use Case**: Monitoring, uptime checks

### `/cc` and `/cc/:project_id` - Claude Code Analytics (Legacy + Auto-detect)

- **Methods**: GET, POST
- **Input Format**: Simple format OR OTLP (auto-detected)
- **Dataset**: `CLAUDE_CODE_ANALYTICS`
- **Key Fields**:
  - Metrics: session_id, app_version, tokens, cost
  - Events: user_prompt, tool_result, api_request
- **Use Case**: Backward compatibility, auto-detection

### `/cc/:project_id/v1/logs` - OTLP Logs (Recommended)

- **Methods**: POST
- **Input Format**: OTLP/HTTP JSON (resourceLogs)
- **Dataset**: `CLAUDE_CODE_LOGS`
- **Key Fields**:
  - Resource: service.name, service.version, host.arch, os.type
  - Logs: timestamp, severity, body, attributes
  - User Context: user.id, session.id, organization.id
- **Use Case**: Claude Code event/log telemetry
- **Data Type**: `otlp_logs`

### `/cc/:project_id/v1/metrics` - OTLP Metrics (Recommended)

- **Methods**: POST
- **Input Format**: OTLP/HTTP JSON (resourceMetrics)
- **Dataset**: `CLAUDE_CODE_METRICS`
- **Key Fields**:
  - Resource: service.name, service.version, host.arch, os.type
  - Metrics: name, value, unit, timestamp, attributes
  - User Context: user.id, session.id, organization.id
- **Use Case**: Claude Code metrics telemetry (tokens, cost, etc.)
- **Data Type**: `otlp_metrics`

### `/cc/v1/logs` - OTLP Logs (Default Project)

- **Methods**: POST
- **Input Format**: OTLP/HTTP JSON (resourceLogs)
- **Dataset**: `CLAUDE_CODE_LOGS`
- **Project ID**: Automatically uses "default"
- **Use Case**: Quick setup without project configuration
- **Configuration**:
  ```json
  {
    "env": {
      "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc"
    }
  }
  ```

### `/cc/v1/metrics` - OTLP Metrics (Default Project)

- **Methods**: POST
- **Input Format**: OTLP/HTTP JSON (resourceMetrics)
- **Dataset**: `CLAUDE_CODE_METRICS`
- **Project ID**: Automatically uses "default"
- **Use Case**: Quick setup without project configuration
- **Configuration**:
  ```json
  {
    "env": {
      "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc"
    }
  }
  ```

### `/ga` and `/ga/:project_id` - Google Analytics

- **Methods**: GET, POST
- **Input Format**: GA4 Measurement Protocol
- **Dataset**: `GA_ANALYTICS`
- **Key Fields**: client_id, events, user_properties
- **Use Case**: Web analytics tracking

### `/realtime` and `/realtime/:project_id` - Real-Time Analytics (New)

- **Methods**: POST, GET
- **Purpose**: Track real-time website visitor events and retrieve live statistics
- **Dataset**: `REALTIME_ANALYTICS` (Analytics Engine) + `REALTIME_AGGREGATOR` (Durable Object)
- **Architecture**: Dual-write system - Analytics Engine for long-term storage, Durable Object for 5-minute window aggregation
- **Tracked Metrics**:
  - Live visitor count (5-minute sliding window)
  - Browser detection (Chrome, Firefox, Safari, Edge, Opera, etc.)
  - OS detection (Windows, macOS, Linux, iOS, Android)
  - Device type (mobile, desktop, tablet)
  - Bot classification (user, bot, ai-bot including GPTBot, ClaudeBot, etc.)
  - Event types (pageview, click, custom)
  - User fingerprinting (privacy-first FNV-1a hash)
  - Geographic data (IP, country, city, region, timezone)
- **POST /realtime** - Track event:
  ```json
  {
    "event_type": "pageview",
    "timestamp": 1704067200000,
    "url": "https://example.com/page",
    "referrer": "https://google.com",
    "user_agent": "Mozilla/5.0...",
    "fingerprint": {
      "hash": "a3f2b1c0",
      "components": {...},
      "confidence": 85
    },
    "session_id": "session-123",
    "visitor_id": "visitor-456"
  }
  ```
- **GET /realtime/stats** - Get current statistics:
  ```json
  {
    "timestamp": 1704067200000,
    "window_size": 300000,
    "total_events": 150,
    "unique_visitors": 45,
    "pageviews": 120,
    "clicks": 25,
    "custom_events": 5,
    "browsers": { "Chrome": 80, "Firefox": 40, "Safari": 30 },
    "operating_systems": { "Windows": 60, "macOS": 50, "Linux": 40 },
    "device_types": { "desktop": 90, "mobile": 60 },
    "bot_traffic": 10,
    "human_traffic": 140
  }
  ```
- **GET /realtime/data** - Get full aggregated data with event list

**Client Integration**:

- JavaScript tracking snippet: `https://logs.duyet.net/realtime.js` (TODO)
- Lightweight (< 5KB) browser-side tracking
- Privacy-first fingerprinting (no PII storage)
- Multi-layer bot detection

### `/api/projects` - Project Management

- **GET** - List all projects
- **POST** - Create new project
- **GET /:id** - Get project details

### `/api/analytics/insights` - Analytics Insights

- **Methods**: GET
- **Purpose**: Query Analytics Engine data and generate insights
- **Query Parameters**:
  - `dataset` (required): CLAUDE_CODE_ANALYTICS | CLAUDE_CODE_LOGS | CLAUDE_CODE_METRICS | GA_ANALYTICS
  - `project_id` (optional): Filter by project ID
  - `start` (optional): Start time in ISO 8601 format (default: 24h ago)
  - `end` (optional): End time in ISO 8601 format (default: now)
  - `limit` (optional): Max number of results (default: 10000)
- **Response Format**:
  ```json
  {
    "summary": {
      "totalEvents": 1150,
      "timeRange": {
        "start": "2024-01-01T00:00:00Z",
        "end": "2024-01-02T00:00:00Z"
      },
      "topProjects": [
        { "id": "default", "count": 450 },
        { "id": "duyet", "count": 320 }
      ],
      "dataset": "CLAUDE_CODE_METRICS"
    },
    "insights": {
      "trends": [
        {
          "metric": "event_volume",
          "change": 15.3,
          "direction": "up",
          "description": "Event volume is up by 15%"
        }
      ],
      "anomalies": [
        {
          "timestamp": "2024-01-01T15:30:00Z",
          "description": "Unusual spike detected: 120 events",
          "severity": "medium",
          "value": 120
        }
      ],
      "recommendations": [
        "Consider adding more projects to organize analytics data",
        "Review high-volume projects for optimization opportunities"
      ]
    },
    "data": {
      "timeseries": [
        { "timestamp": "2024-01-01T00:00:00Z", "value": 45 },
        { "timestamp": "2024-01-01T01:00:00Z", "value": 52 }
      ],
      "breakdown": {
        "default": 450,
        "duyet": 320,
        "blog": 180
      }
    }
  }
  ```
- **Use Case**: Dashboard insights, trend analysis, anomaly detection
- **Features**:
  - Automatic trend detection (up/down/stable)
  - Statistical anomaly detection (z-score based)
  - Project breakdown and top projects
  - Time series data for charting
  - Actionable recommendations

### `/api/analytics/datasets` - List Available Datasets (New)

- **Methods**: GET
- **Purpose**: List all available Analytics Engine datasets
- **Response**: Array of dataset names and descriptions

## Data Formats

### Claude Code OpenTelemetry Format

#### Metrics Format

```typescript
{
  session_id: string;
  app_version: string;
  organization_id?: string;
  user_account_uuid?: string;
  metric_name: string; // e.g., "claude_code.token.usage"
  value: number;
  attributes?: {
    type?: string; // "input", "output", "cacheRead"
    model?: string; // "claude-sonnet-4-5"
  };
}
```

**Available Metrics**:

- `claude_code.token.usage` - Token consumption by type
- `claude_code.cost` - API cost tracking
- `claude_code.session.duration` - Session duration

#### Events Format

```typescript
{
  event_name: string; // "user_prompt", "tool_result", "api_request"
  timestamp: string; // ISO 8601
  session_id: string;
  attributes: Record<string, any>;
}
```

**Available Events**:

- `user_prompt` - User prompts submitted
- `tool_result` - Tool execution results
- `api_request` - API requests made

### Google Analytics GA4 Format

```typescript
{
  client_id: string;
  events: [{
    name: string;
    params: Record<string, any>;
  }];
  user_properties?: Record<string, any>;
}
```

### Analytics Engine Data Format

Cloudflare Analytics Engine expects:

```typescript
{
  blobs?: string[];   // String values (max 5120 bytes each)
  doubles?: number[]; // Numeric values
  indexes?: string[]; // Indexed strings for filtering (max 1 index, max 96 bytes)
}
```

**Important Limitation**: Analytics Engine supports a **maximum of 1 indexed field** per data point. The adapters use `project_id` as the single index for filtering. All other metadata is stored in blobs as JSON.

## Project ID System

### Overview

The Project ID system allows you to organize and filter analytics data by project. Each analytics event can include an optional `project_id` to classify the data.

### Database Schema

#### Projects Table (D1)

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used INTEGER
);

CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

**Fields:**

- `id` - Project identifier (3-32 lowercase alphanumeric characters with hyphens)
- `description` - Human-readable project description
- `created_at` - Unix timestamp (milliseconds) when project was created
- `last_used` - Unix timestamp (milliseconds) of last analytics event

### Using Project IDs

Project IDs can be provided in **four ways** (in order of precedence):

#### 1. URL Path Parameter (Recommended)

```bash
curl -X POST https://logs.duyet.net/cc/myproject \
  -H "Content-Type: application/json" \
  -d '{"session_id": "...", "metric_name": "...", "value": 123}'
```

**Perfect for Claude Code** (`~/.claude/settings.json`):

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc/myproject",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json",
    "OTEL_EXPORTER_OTLP_LOGS_ENDPOINT": "https://logs.duyet.net/cc/myproject",
    "OTEL_EXPORTER_OTLP_LOGS_PROTOCOL": "http/json"
  }
}
```

#### 2. HTTP Header

```bash
curl -X POST https://logs.duyet.net/cc \
  -H "X-Project-ID: myproject" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "...", "value": 123}'
```

#### 3. Query Parameter

```bash
curl "https://logs.duyet.net/cc?project_id=myproject&session_id=..."
```

#### 4. Request Body

```bash
curl -X POST https://logs.duyet.net/cc \
  -H "Content-Type: application/json" \
  -d '{"project_id": "myproject", "session_id": "...", "value": 123}'
```

### Auto-Creation

Projects are **automatically created** when first used. No manual setup required.

When you send an analytics event with a project_id (via any method above), the project will be created automatically with a description like:

```
Auto-created from POST /cc/myproject
```

**Validation**:

- Valid format: 3-32 lowercase alphanumeric characters with hyphens
- Invalid IDs trigger a warning but don't reject the request
- Auto-creation is non-blocking

### Project ID Middleware

The middleware performs the following (all non-blocking):

1. **Extract** project_id from: path param → header → query → body
2. **Validate** project ID format (3-32 chars, lowercase alphanumeric + hyphens)
3. **Auto-create** project if it doesn't exist and format is valid
4. **Update** last_used timestamp asynchronously (fire-and-forget)
5. **Attach** project_id to context for adapters

**Non-blocking behavior:**

- Invalid or non-existent project IDs produce warnings but don't reject requests
- Project ID is completely optional
- Failed database operations don't block analytics recording

### Analytics Engine Storage

Project IDs are stored as the **only indexed field** in Analytics Engine:

- **Index**: Single index field (Analytics Engine limit: max 1 index)
- **Max Length**: 96 bytes (enforced by adapter)
- **Filtering**: Efficient queries by project_id
- **Metadata**: All other data stored in blobs as JSON

### Default Projects

Six default projects:

| Project ID | Description                          |
| ---------- | ------------------------------------ |
| `debug`    | Development and debugging            |
| `duyet`    | duyet.net personal website analytics |
| `blog`     | Blog analytics and metrics           |
| `prod`     | Production environment               |
| `staging`  | Staging environment                  |
| `test`     | Testing and QA environment           |

Create via seed script:

```bash
npm run db:seed          # Local
npm run db:seed:remote   # Production
```

## Development

### Prerequisites

- Node.js 20+
- npm or yarn
- Cloudflare account (for deployment)

### Local Development

```bash
npm install              # Install dependencies
npm run dev              # Start local server (http://localhost:8788)
npm test                 # Run tests (167 tests)
npm run test:watch       # Watch mode
npm run coverage         # Coverage report (100% required)
npm run build            # Build for production
npm run type-check       # TypeScript type checking
```

### Testing Strategy

**100% Code Coverage Required**

1. **Unit Tests** (`test/unit/`)
   - All adapters (base, claude-code, google-analytics, realtime)
   - All services (analytics-engine, project)
   - All middleware (logger, project-id, error-handler)
   - All utilities (validation, route-handler, user-agent-parser, fingerprint, bot-detection)
   - All Durable Objects (realtime-aggregator)

2. **E2E Tests** (`test/e2e/`)
   - All endpoints with mock Analytics Engine
   - Project management API
   - Error handling scenarios
   - Path parameter routes

3. **Test Framework**: Vitest with Cloudflare Workers integration

```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run coverage            # Coverage report

# Generate test events
npm run test:events         # Send to local server
npm run test:events:remote  # Send to production
```

## Adding New Log Sources

Complete guide to adding a custom log format.

### 1. Create Adapter (`src/adapters/custom.ts`)

```typescript
import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';

interface CustomData {
  id: string;
  value: number;
  metadata: Record<string, any>;
}

export class CustomAdapter extends BaseAdapter<CustomData> {
  validate(data: unknown): data is CustomData {
    // Use built-in type guards from BaseAdapter
    return (
      this.isObject(data) &&
      'id' in data &&
      'value' in data &&
      this.isString(data.id) &&
      this.isNumber(data.value)
    );
  }

  transform(data: CustomData): AnalyticsEngineDataPoint {
    // Get project_id from context (if provided)
    const projectId = this.getProjectId();

    return {
      // Max 1 index field - use project_id if available
      indexes: projectId ? [this.toIndex(projectId)] : [],

      // Numeric values
      doubles: [this.toDouble(data.value)],

      // String data as JSON
      blobs: [
        this.toBlob(
          JSON.stringify({
            id: data.id,
            metadata: data.metadata,
            timestamp: new Date().toISOString(),
          })
        ),
      ],
    };
  }
}
```

**BaseAdapter utilities:**

- `toIndex(value)` - Convert & truncate to 96 bytes
- `toBlob(value)` - Convert & truncate to 5120 bytes
- `toDouble(value)` - Convert to number
- `isObject(value)`, `isString(value)`, `isNumber(value)` - Type guards
- `getProjectId()` - Get project_id from context

### 2. Add Route (`src/routes/router.ts`)

```typescript
import { CustomAdapter } from '../adapters/custom.js';

// Create adapter instance
const customAdapter = new CustomAdapter();

// Create handler
const customHandler = createAnalyticsHandler(
  'CUSTOM_ANALYTICS',
  customAdapter,
  analyticsService
);

// Add routes
app.use('/custom', projectIdMiddleware);
app.use('/custom/:project_id', projectIdMiddleware);
app.get('/custom', customHandler.handleGet);
app.post('/custom', customHandler.handlePost);
app.get('/custom/:project_id', customHandler.handleGet);
app.post('/custom/:project_id', customHandler.handlePost);
```

### 3. Configure Binding (`wrangler.toml`)

```toml
[[analytics_engine_datasets]]
binding = "CUSTOM_ANALYTICS"
```

### 4. Add TypeScript Types (`src/types/index.ts`)

```typescript
export interface Env {
  // ... existing bindings
  CLAUDE_CODE_ANALYTICS: AnalyticsEngineDataset; // Legacy + auto-detect
  CLAUDE_CODE_LOGS: AnalyticsEngineDataset; // OTLP Logs
  CLAUDE_CODE_METRICS: AnalyticsEngineDataset; // OTLP Metrics
  CUSTOM_ANALYTICS: AnalyticsEngineDataset;
}
```

### 5. Write Tests

```typescript
// test/unit/adapters/custom.test.ts
import { describe, it, expect } from 'vitest';
import { CustomAdapter } from '../../../src/adapters/custom.js';

describe('CustomAdapter', () => {
  const adapter = new CustomAdapter();

  describe('validate', () => {
    it('should accept valid custom data', () => {
      const data = {
        id: 'test-123',
        value: 100,
        metadata: { foo: 'bar' },
      };
      expect(adapter.validate(data)).toBe(true);
    });

    it('should reject invalid data', () => {
      expect(adapter.validate({})).toBe(false);
      expect(adapter.validate({ id: 'test' })).toBe(false);
    });
  });

  describe('transform', () => {
    it('should transform data correctly', () => {
      const data = {
        id: 'test-123',
        value: 100,
        metadata: { foo: 'bar' },
      };

      const result = adapter.transform(data);

      expect(result.doubles).toEqual([100]);
      expect(result.blobs?.[0]).toContain('test-123');
    });
  });
});
```

## Deployment

### Cloudflare Pages

**Automated Deployment**:

```bash
./scripts/deploy.sh  # Build + Test + Type-check + Deploy
```

**Manual Deployment**:

```bash
npm run build        # Build TypeScript
npm test             # Run all tests
npm run deploy       # Deploy to Cloudflare Pages
```

### Configuration

**wrangler.toml**:

```toml
name = "duyet-logs"
compatibility_date = "2024-01-01"
pages_build_output_dir = "dist"

# D1 Database for project metadata
[[d1_databases]]
binding = "DB"
database_name = "duyet-logs"
database_id = "<your-database-id>"

# Analytics Engine datasets
[[analytics_engine_datasets]]
binding = "CLAUDE_CODE_ANALYTICS"  # Legacy + auto-detect
dataset = "duyet_logs_claude_code_analytics"

[[analytics_engine_datasets]]
binding = "CLAUDE_CODE_LOGS"  # OTLP Logs
dataset = "duyet_logs_claude_code_logs"

[[analytics_engine_datasets]]
binding = "CLAUDE_CODE_METRICS"  # OTLP Metrics
dataset = "duyet_logs_claude_code_metrics"

[[analytics_engine_datasets]]
binding = "GA_ANALYTICS"
dataset = "duyet_logs_ga_analytics"

[[analytics_engine_datasets]]
binding = "REALTIME_ANALYTICS"  # Real-time analytics
dataset = "duyet_logs_realtime_analytics"

# Note: Durable Objects bindings for Pages must be configured via Cloudflare Pages dashboard
# The RealtimeAggregator Durable Object is exported from functions/[[path]].ts
# To configure:
# 1. Go to Cloudflare Pages dashboard → Settings → Functions
# 2. Add Durable Object binding:
#    - Variable name: REALTIME_AGGREGATOR
#    - Durable Object class: RealtimeAggregator

# Environment Variables (for Analytics Insights API)
[vars]
DATASET_CLAUDE_CODE_ANALYTICS = "duyet_logs_claude_code_analytics"
DATASET_CLAUDE_CODE_LOGS = "duyet_logs_claude_code_logs"
DATASET_CLAUDE_CODE_METRICS = "duyet_logs_claude_code_metrics"
DATASET_GA_ANALYTICS = "duyet_logs_ga_analytics"
DATASET_REALTIME_ANALYTICS = "duyet_logs_realtime_analytics"
```

### Environment Setup

1. **Create D1 Database**:

```bash
wrangler d1 create duyet-logs
# Copy database_id to wrangler.toml
```

2. **Run Migrations**:

```bash
npm run db:migrate:remote
```

3. **Seed Default Projects**:

```bash
npm run db:seed:remote
```

4. **Configure Durable Objects** (for Real-time Analytics):

For Cloudflare Pages, Durable Objects must be configured via the dashboard:
- Go to Cloudflare Pages dashboard → Settings → Functions
- Add Durable Object binding:
  - Variable name: `REALTIME_AGGREGATOR`
  - Durable Object class: `RealtimeAggregator`

5. **Set Up Secrets Store** (for Analytics Insights API):

The Analytics Insights API requires Cloudflare credentials to query Analytics Engine via GraphQL. Use Secrets Store for secure credential management.

**Create secrets**:

```bash
# Get your store ID
npx wrangler secrets-store store list

# Create secrets (you'll be prompted for values)
npx wrangler secrets-store secret create <STORE_ID> --name CLOUDFLARE_ACCOUNT_ID --scopes workers --remote
npx wrangler secrets-store secret create <STORE_ID> --name CLOUDFLARE_API_TOKEN --scopes workers --remote
```

**Configure bindings in `wrangler.toml`**:

```toml
[[secrets_store_secrets]]
binding = "CLOUDFLARE_ACCOUNT_ID"
store_id = "<YOUR_STORE_ID>"
secret_name = "CLOUDFLARE_ACCOUNT_ID"

[[secrets_store_secrets]]
binding = "CLOUDFLARE_API_TOKEN"
store_id = "<YOUR_STORE_ID>"
secret_name = "CLOUDFLARE_API_TOKEN"
```

**Note**: Without these secrets, the Analytics Insights API will return mock data. The bindings support both Secrets Store (recommended) and environment variables (fallback).

6. **Deploy**:

```bash
npm run deploy
```

## Database Management

### Migrations

```bash
npm run db:migrate              # Run migrations locally
npm run db:migrate:remote       # Run migrations on production
```

### Seeding

```bash
npm run db:seed                 # Seed local database
npm run db:seed:remote          # Seed production database
```

### Backup & Restore

```bash
# Backup
npm run db:backup               # Backup production → ./backups/
npm run db:backup:local         # Backup local → ./backups/

# Restore
npm run db:restore latest              # Restore to production (with confirmation)
npm run db:restore latest --local      # Restore to local
npm run db:restore ./backups/file.sql.gz --local
```

**Backup formats**:

- `duyet-logs_[prod|local]_YYYYMMDD_HHMMSS.sql.gz` - Compressed SQL dump
- `duyet-logs_[prod|local]_YYYYMMDD_HHMMSS.sql.projects.json` - JSON export

### Query

```bash
npm run db:query "SELECT * FROM projects;"                      # Local
npm run db:query:remote "SELECT COUNT(*) FROM projects;"        # Production
```

See `scripts/README.md` for comprehensive documentation.

## Performance & Limits

| Metric               | Value                     |
| -------------------- | ------------------------- |
| **Response Time**    | <100ms p95                |
| **Analytics Engine** | 1M writes/day (free tier) |
| **D1 Database**      | 5GB storage (free tier)   |
| **Global Edge**      | 300+ locations            |
| **Payload Size**     | Max 5KB per event         |
| **Blob Size**        | Max 5120 bytes each       |
| **Index Size**       | Max 96 bytes              |
| **Index Count**      | Max 1 per data point      |

### Error Handling

All endpoints return JSON error responses:

```json
{
  "error": "Bad Request",
  "message": "Invalid data format",
  "status": 400
}
```

**Status Codes**:

- `200` - Success
- `400` - Bad Request (invalid data format)
- `404` - Not Found (unknown endpoint)
- `500` - Internal Server Error / Configuration Error

### Request Logging

Format: `{METHOD} {PATH} {STATUS} {TIME}ms`

Example:

```
POST /cc/myproject 200 15ms
GET /ping 200 1ms
```

## Technical Requirements

### Code Quality

- **Language**: TypeScript (strict mode enabled)
- **Test Coverage**:
  - **100% coverage required** for all new code
  - Write tests BEFORE or ALONGSIDE implementation
  - Cover all code paths, edge cases, and error scenarios
  - Unit tests for functions, integration tests for workflows
- **Testing Framework**: Vitest
- **Code Style**: ESLint + Prettier
- **Type Safety**:
  - **100% TypeScript typing required** - No implicit `any`
  - **NEVER use `any` or `unknown` types** - Always use specific types
  - **NEVER import `.js` files** - Use `.ts` imports only (TypeScript will resolve)
  - Use proper type guards and assertions
  - Prefer `interface` over `type` for object shapes
  - All function parameters and return types must be explicitly typed
- **Documentation**: JSDoc for all public APIs
- **Development Workflow**:
  - When adding new functions/code: Write tests first or simultaneously
  - Verify 100% test coverage before committing
  - Ensure all TypeScript strict mode checks pass
  - **MANDATORY pre-commit checks** (ALL must pass):
    - `npx prettier --write .` - Format code
    - `npm run lint` - Zero errors
    - `npm test` - All tests passing
    - `npm run type-check` - TypeScript compilation success
  - **Post-push workflow**:
    - Monitor build status on Cloudflare Pages
    - If build fails, immediately investigate and fix
    - Continue fixing until build succeeds
    - Never leave failing builds unattended
- **Git Workflow**:
  - **Auto-commit when changes have impact or add new features**
  - Commit after completing any of:
    - New feature implementation
    - Bug fixes that affect functionality
    - Performance improvements
    - Breaking changes or API modifications
    - Test coverage improvements
    - Documentation updates for technical requirements
  - Use semantic commit messages: `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `perf:`
  - Do NOT auto-commit for: minor typos, formatting-only changes, work-in-progress
  - **Pre-commit validation sequence**:
    1. Format code with Prettier
    2. Run linter and fix issues
    3. Run all tests
    4. Run type-check
    5. Only commit if all checks pass

### Performance Targets

- **Response Time**: < 100ms p95
- **Error Rate**: < 0.1%
- **Availability**: > 99.9%
- **Cold Start**: None (Cloudflare Pages)

### Security

- Input validation for all endpoints
- Type-safe TypeScript throughout
- No sensitive data logged
- CORS support (configurable)
- Rate limiting (planned)
- API key authentication (planned)

## Why Cloudflare + Hono?

### Cloudflare Advantages

- ✅ **Global Edge Network** - 300+ locations worldwide
- ✅ **Free Tier** - 100K requests/day, 1M Analytics Engine writes/day
- ✅ **Zero Cold Starts** - Always ready, no warmup needed
- ✅ **Built-in DDoS Protection** - Automatic threat mitigation
- ✅ **Integrated Storage** - D1 SQL database + Analytics Engine
- ✅ **No Infrastructure Management** - Fully serverless

### Hono Framework Benefits

- ✅ **Ultra-Fast** - ~11KB bundle, faster than Express
- ✅ **Web Standard API** - Uses native Request/Response
- ✅ **TypeScript-First** - Excellent type inference
- ✅ **Middleware Support** - Composable request handling
- ✅ **Zero Dependencies** - Minimal attack surface
- ✅ **Cloudflare Optimized** - Built for edge runtime

### Cost Comparison

**Cloudflare (This Project)**:

- 100K requests/day: **$0/month**
- 1M Analytics Engine writes: **$0/month**
- 5GB D1 storage: **$0/month**

**Traditional Stack (AWS)**:

- Lambda + API Gateway: **~$20/month**
- RDS database: **~$15/month**
- CloudWatch logs: **~$5/month**
- Total: **~$40/month** vs **$0/month**

## Resources

### Cloudflare Documentation

- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
- [D1 Database](https://developers.cloudflare.com/d1/)
- [Hono on Cloudflare](https://hono.dev/docs/getting-started/cloudflare-workers)

### Claude Code Monitoring

- [OpenTelemetry Format](https://docs.anthropic.com/en/docs/claude-code/monitoring)
- [Metrics & Events](https://docs.anthropic.com/en/docs/claude-code/monitoring#available-metrics-and-events)

### Google Analytics

- [GA4 Measurement Protocol](https://developers.google.com/analytics/devguides/collection/protocol/ga4)

## Notes

- All HTTP methods (GET, POST) supported per endpoint
- GET requests use query parameters
- POST requests use JSON body
- Error responses follow standard HTTP status codes
- All timestamps use ISO 8601 format
- Analytics Engine has size limits: blobs (5120 bytes), indexes (96 bytes)
- Project IDs are auto-created on first use
- Database operations are non-blocking for analytics recording
