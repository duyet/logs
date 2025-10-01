# Cloudflare Analytics Router

A TypeScript-based analytics data router built on **Cloudflare Pages** using the **Hono** framework. Routes analytics data from multiple sources to Cloudflare Analytics Engine datasets.

**Deployment**: [logs.duyet.net](https://logs.duyet.net)

## Features

- 🚀 **Cloudflare Pages** deployment with edge performance
- ⚡ **Hono** framework for ultra-fast routing
- 📊 **Multiple data formats**: Claude Code OpenTelemetry, Google Analytics GA4
- 🔄 **Extensible architecture**: Easy to add new endpoints and formats
- ✅ **100% TypeScript** with strict type safety
- 🧪 **Comprehensive testing**: Unit + E2E tests with high coverage
- 📦 **Analytics Engine**: Native Cloudflare Analytics Engine integration

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
│   └── [[path]].ts              # Catch-all Pages Function
├── src/
│   ├── adapters/                # Data format adapters
│   │   ├── base.ts
│   │   ├── claude-code.ts
│   │   └── google-analytics.ts
│   ├── services/
│   │   └── analytics-engine.ts  # Analytics Engine client
│   ├── middleware/
│   │   ├── error-handler.ts
│   │   └── logger.ts
│   ├── routes/
│   │   └── router.ts            # Main router
│   ├── config/
│   │   └── endpoints.ts         # Endpoint configuration
│   └── types/
│       └── index.ts             # TypeScript types
├── test/
│   ├── unit/                    # Unit tests
│   └── e2e/                     # E2E tests
├── scripts/
│   └── deploy.sh                # Deployment script
├── wrangler.toml                # Cloudflare config
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
