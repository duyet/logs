# Cloudflare Analytics Router

A TypeScript-based analytics data router built on **Cloudflare Pages** using the **Hono** framework. Routes analytics data from multiple sources to Cloudflare Analytics Engine datasets.

**Deployment**: [logs.duyet.net](https://logs.duyet.net)

## Features

- 🚀 **Cloudflare Pages** deployment with edge performance
- ⚡ **Hono** framework for ultra-fast routing
- 📊 **Multiple data formats**: Claude Code OpenTelemetry, Google Analytics GA4
- 🏷️ **Project ID System**: Organize analytics by project with D1 database storage
- 🎨 **Web UI**: Beautiful interface for project management at [logs.duyet.net](https://logs.duyet.net)
- 🔄 **Extensible architecture**: Easy to add new endpoints and formats
- ✅ **100% TypeScript** with strict type safety
- 🧪 **Comprehensive testing**: Unit + E2E tests with 100% coverage
- 📦 **Analytics Engine**: Native Cloudflare Analytics Engine integration
- 🛠️ **Database Tools**: Migration, seeding, backup, restore, and query scripts

## Endpoints

### `GET /ping` - Health Check
```bash
curl https://logs.duyet.net/ping
```

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

### `POST /cc` - Claude Code Analytics
Send Claude Code OpenTelemetry metrics and events.

**Metric Example**:
```bash
curl -X POST https://logs.duyet.net/cc \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "session-123",
    "metric_name": "claude_code.token.usage",
    "value": 1000,
    "attributes": {
      "type": "input",
      "model": "claude-sonnet-4-5"
    }
  }'
```

**Event Example**:
```bash
curl -X POST https://logs.duyet.net/cc \
  -H "Content-Type: application/json" \
  -d '{
    "event_name": "user_prompt",
    "timestamp": "2024-01-01T00:00:00Z",
    "session_id": "session-123",
    "attributes": {
      "prompt_length": 100
    }
  }'
```

### `POST /ga` - Google Analytics
Send Google Analytics GA4 Measurement Protocol data.

**Example**:
```bash
curl -X POST https://logs.duyet.net/ga \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client-123",
    "events": [{
      "name": "page_view",
      "params": {
        "page_location": "https://example.com",
        "page_title": "Home"
      }
    }]
  }'
```

## Project ID System

Organize and filter analytics data by project using the built-in Project ID system.

### Web UI

Visit **[logs.duyet.net](https://logs.duyet.net)** to:
- ✨ Create new projects with custom or auto-generated IDs
- 📋 View all existing projects
- 📊 See creation time and last usage
- 📝 Copy-paste examples for API usage

### Using Project IDs

Include a `project_id` in your analytics requests to classify data. Three methods supported (in order of precedence):

#### 1. HTTP Header (Recommended)
```bash
curl -X POST https://logs.duyet.net/cc \
  -H "X-Project-ID: myproject" \
  -H "Content-Type: application/json" \
  -d '{"session_id": "...", "metric_name": "...", "value": 123}'
```

#### 2. Query Parameter
```bash
curl "https://logs.duyet.net/cc?project_id=myproject&session_id=..."
```

#### 3. Request Body
```bash
curl -X POST https://logs.duyet.net/cc \
  -H "Content-Type: application/json" \
  -d '{"project_id": "myproject", "session_id": "...", "value": 123}'
```

### Project Management API

#### Create Project
```bash
curl -X POST https://logs.duyet.net/api/projects \
  -H "Content-Type: application/json" \
  -d '{"id": "myproject", "description": "My analytics project"}'
```

#### List Projects
```bash
curl https://logs.duyet.net/api/projects
```

#### Get Project Details
```bash
curl https://logs.duyet.net/api/projects/myproject
```

### Default Projects

Six default projects are pre-configured:
- `debug` - Development and debugging
- `duyet` - duyet.net personal website analytics
- `blog` - Blog analytics and metrics
- `prod` - Production environment
- `staging` - Staging environment
- `test` - Testing and QA environment

### Database Management

```bash
# Run migrations
npm run db:migrate         # Local
npm run db:migrate:remote  # Production

# Seed default projects
npm run db:seed           # Local
npm run db:seed:remote    # Production

# Backup database
npm run db:backup         # Production → ./backups/
npm run db:backup:local   # Local → ./backups/

# Restore database
npm run db:restore latest              # Production (requires confirmation)
npm run db:restore latest --local      # Local
npm run db:restore ./backups/file.sql.gz --local

# Query database
npm run db:query "SELECT * FROM projects;"
npm run db:query:remote "SELECT COUNT(*) FROM projects;"
```

Backups are stored in `./backups/` with format:
- `duyet-logs_[prod|local]_YYYYMMDD_HHMMSS.sql.gz` - Compressed SQL dump
- `duyet-logs_[prod|local]_YYYYMMDD_HHMMSS.sql.projects.json` - JSON export

See **[scripts/README.md](./scripts/README.md)** for detailed documentation.

### Test Event Generator

Generate realistic test analytics events for debugging:

```bash
# Send to local dev server (http://localhost:8788)
npm run test:events

# Send to production (https://logs.duyet.net)
npm run test:events:remote

# With options
npx tsx scripts/generate-test-events.ts --count 50 --project debug
npx tsx scripts/generate-test-events.ts --endpoint http://localhost:3000 --count 100
```

Generates:
- 40% Claude Code metrics
- 40% Claude Code events
- 20% Google Analytics events

All with realistic random data.

## Development

### Prerequisites
- Node.js 20+
- npm or yarn
- Cloudflare account (for deployment)

### Setup
```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Check coverage
npm run coverage

# Type check
npm run type-check

# Local development
npm run dev
```

### Project Structure
```
cloudflare-analytics-router/
├── functions/
│   ├── [[path]].ts              # Catch-all Pages Function
│   ├── index.ts                 # Root page handler (Web UI)
│   ├── index.html               # Project management UI
│   └── api/
│       └── projects.ts          # Project management API
├── src/
│   ├── adapters/                # Data format adapters
│   │   ├── base.ts
│   │   ├── claude-code.ts
│   │   └── google-analytics.ts
│   ├── services/
│   │   ├── analytics-engine.ts  # Analytics Engine client
│   │   └── project.ts           # Project management service
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   ├── logger.ts
│   │   └── project-id.ts        # Project ID extraction & validation
│   ├── routes/
│   │   └── router.ts            # Main router
│   ├── config/
│   │   └── endpoints.ts         # Endpoint configuration
│   └── types/
│       ├── index.ts             # TypeScript types
│       └── hono.ts              # Hono context extensions
├── migrations/
│   └── 0001_create_projects.sql # D1 database schema
├── test/
│   ├── unit/                    # Unit tests (100% coverage)
│   └── e2e/                     # E2E tests
├── scripts/
│   ├── deploy.sh                # Deployment script
│   ├── seed-projects.ts         # Generate default projects
│   ├── backup-d1.sh             # Backup D1 database
│   ├── restore-d1.sh            # Restore D1 database
│   ├── generate-test-events.ts  # Test event generator
│   └── README.md                # Scripts documentation
├── wrangler.toml                # Cloudflare config (D1 + Analytics Engine)
├── CLAUDE.md                    # Project documentation
└── README.md
```

## Deployment

### Automated Deployment
```bash
./scripts/deploy.sh
```

This script will:
1. Build the TypeScript project
2. Run all tests
3. Type check the code
4. Deploy to Cloudflare Pages (duyet-logs project)

### Manual Deployment
```bash
# Build
npm run build

# Deploy
npm run deploy
```

### Configuration

**wrangler.toml**:
```toml
name = "duyet-logs"
compatibility_date = "2024-01-01"

# D1 Database for Project ID System
[[d1_databases]]
binding = "DB"
database_name = "duyet-logs"
database_id = "<your-database-id>"

# Analytics Engine Datasets
[[analytics_engine_datasets]]
binding = "CLAUDE_CODE_ANALYTICS"

[[analytics_engine_datasets]]
binding = "GA_ANALYTICS"
```

## Adding New Endpoints

### 1. Create an Adapter

```typescript
// src/adapters/custom.ts
import { BaseAdapter } from './base.js';
import type { AnalyticsEngineDataPoint } from '../types/index.js';

export class CustomAdapter extends BaseAdapter<CustomData> {
  validate(data: unknown): data is CustomData {
    // Validation logic
    return this.isObject(data) && 'required_field' in data;
  }

  transform(data: CustomData): AnalyticsEngineDataPoint {
    return {
      indexes: [this.toIndex(data.id)],
      doubles: [this.toDouble(data.value)],
      blobs: [this.toBlob(JSON.stringify(data))],
    };
  }
}
```

### 2. Add Analytics Engine Binding

```toml
# wrangler.toml
[[analytics_engine_datasets]]
binding = "CUSTOM_ANALYTICS"
```

### 3. Update Router

```typescript
// src/routes/router.ts
const customAdapter = new CustomAdapter();

app.post('/custom', async (c) => {
  const rawData = await c.req.json();
  await analyticsService.writeDataPoint(
    c.env,
    'CUSTOM_ANALYTICS',
    customAdapter,
    rawData
  );
  return c.json({ success: true });
});
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Check coverage (requires 100%)
npm run coverage
```

## Architecture

### Data Flow
```
HTTP Request (POST /cc, /ga)
    ↓
Hono Router
    ↓
Adapter (validate & transform)
    ↓
Analytics Engine Service
    ↓
Cloudflare Analytics Engine Dataset
```

### Adapters

Adapters transform incoming data formats to Analytics Engine format:

```typescript
interface AnalyticsEngineDataPoint {
  indexes?: string[];  // Max 96 bytes each
  blobs?: string[];    // Max 5120 bytes each
  doubles?: number[];  // Numeric values
}
```

**Base Adapter** provides:
- `toIndex()` - Convert & truncate to 96 bytes
- `toBlob()` - Convert & truncate to 5120 bytes
- `toDouble()` - Convert to number
- Type guards: `isObject()`, `isString()`, `isNumber()`

## Error Handling

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

## Monitoring

Request logs include:
- HTTP method and path
- Status code
- Response time (ms)

Example:
```
POST /cc 200 15ms
GET /ping 200 1ms
```

## Security

- Input validation for all endpoints
- Type-safe TypeScript throughout
- No sensitive data logged
- CORS support (can be configured)

## Performance

- Edge deployment via Cloudflare Pages
- Minimal overhead with Hono framework
- Efficient data transformation
- Target: <100ms p95 response time

## Documentation

See [CLAUDE.md](./CLAUDE.md) for comprehensive project documentation including:
- Detailed architecture
- Data formats (Claude Code OTel, GA4)
- Analytics Engine integration
- Development guidelines
- Testing strategy

## License

MIT

## Links

- **Production**: https://logs.duyet.net
- **Hono**: https://hono.dev
- **Cloudflare Pages**: https://pages.cloudflare.com
- **Analytics Engine**: https://developers.cloudflare.com/analytics/analytics-engine/
- **Claude Code Monitoring**: https://docs.anthropic.com/en/docs/claude-code/monitoring
