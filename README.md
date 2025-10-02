# Logs Tracking with Cloudflare + Hono

**A serverless logs tracking system built on Cloudflare infrastructure with Hono framework.**

Send logs and analytics from any source (Claude Code, Google Analytics, custom apps) to Cloudflare Analytics Engine for storage and analysis.

🚀 **Live**: [logs.duyet.net](https://logs.duyet.net)

## Why This Project?

**Problem**: Need a simple, fast, and cost-effective way to track logs and analytics without managing infrastructure.

**Solution**: Leverage Cloudflare's edge network + Hono's ultra-fast routing to collect, transform, and store logs at scale.

### Key Technologies

- **[Cloudflare Pages](https://pages.cloudflare.com)** - Zero-config serverless deployment
- **[Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)** - Time-series data storage (1M writes/day free)
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Serverless SQL database for metadata
- **[Hono](https://hono.dev)** - Ultra-fast web framework (~11KB, faster than Express)
- **TypeScript** - Type-safe development with 100% test coverage

### Architecture

```
┌─────────────┐
│   Client    │  (Claude Code, GA4, Custom Apps)
└──────┬──────┘
       │ HTTP POST
       ↓
┌─────────────────────┐
│  Cloudflare Pages   │  (Edge Network)
│   + Hono Router     │
└──────────┬──────────┘
       │ Transform & Validate
       ↓
┌─────────────────────┐
│ Analytics Engine    │  (Time-series Storage)
│      + D1 DB        │  (Project Metadata)
└─────────────────────┘
```

## Quick Start

### 1. Send Logs via HTTP

```bash
# Claude Code metrics
curl -X POST https://logs.duyet.net/cc/myproject \
  -H "Content-Type: application/json" \
  -d '{
    "session_id": "abc123",
    "metric_name": "claude_code.token.usage",
    "value": 1000,
    "attributes": {"model": "claude-sonnet-4-5"}
  }'

# Google Analytics events
curl -X POST https://logs.duyet.net/ga/myproject \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "client-123",
    "events": [{"name": "page_view", "params": {...}}]
  }'

# Health check
curl https://logs.duyet.net/ping
```

### 2. Configure Claude Code

**Option 1: VS Code Settings**

Add to VS Code `settings.json`:

```json
{
  "claude-code.env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc/myproject",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json"
  }
}
```

**Option 2: Global Claude Settings**

Add to `~/.claude/settings.json`:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc/myproject",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json"
  }
}
```

**That's it!** Logs start flowing immediately. Projects are auto-created on first use.

## Features

### 🎯 Core Features

- **Multiple Log Sources** - Claude Code OpenTelemetry, Google Analytics GA4, custom formats
- **Auto-Create Projects** - Projects created automatically when first used
- **Edge Performance** - Global edge deployment with <100ms p95 latency
- **Type-Safe** - 100% TypeScript with strict validation
- **Extensible** - Easy to add new log formats and endpoints

### 🏷️ Project Organization

Organize logs by project using 4 methods (in priority order):

```bash
# 1. URL path (recommended for Claude Code)
POST https://logs.duyet.net/cc/myproject

# 2. HTTP header
-H "X-Project-ID: myproject"

# 3. Query parameter
?project_id=myproject

# 4. Request body
{"project_id": "myproject", ...}
```

### 🎨 Web UI

Visit [logs.duyet.net](https://logs.duyet.net) to:
- View all projects
- See creation time and last usage
- Get configuration examples
- Copy-paste code snippets

## API Endpoints

### Analytics Endpoints

| Endpoint | Method | Purpose | Example |
|----------|--------|---------|---------|
| `/cc` | POST/GET | Claude Code logs | [OpenTelemetry format](#claude-code-format) |
| `/cc/:project_id` | POST/GET | Claude Code with project | `/cc/myproject` |
| `/ga` | POST/GET | Google Analytics logs | [GA4 format](#google-analytics-format) |
| `/ga/:project_id` | POST/GET | GA with project | `/ga/mywebsite` |
| `/ping` | GET | Health check | Returns `{"status": "ok"}` |

### Project Management

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/projects` | GET | List all projects |
| `/api/projects` | POST | Create project |
| `/api/projects/:id` | GET | Get project details |

## Log Formats

### Claude Code Format

**Metrics**:
```json
{
  "session_id": "session-123",
  "metric_name": "claude_code.token.usage",
  "value": 1000,
  "attributes": {
    "type": "input",
    "model": "claude-sonnet-4-5"
  }
}
```

**Events**:
```json
{
  "event_name": "user_prompt",
  "timestamp": "2024-01-01T00:00:00Z",
  "session_id": "session-123",
  "attributes": {"prompt_length": 100}
}
```

Collected metrics:
- `claude_code.token.usage` - Token consumption
- `claude_code.cost` - API costs
- `claude_code.session.duration` - Session time
- Events: `user_prompt`, `tool_result`, `api_request`

### Google Analytics Format

GA4 Measurement Protocol:
```json
{
  "client_id": "client-123",
  "events": [{
    "name": "page_view",
    "params": {
      "page_location": "https://example.com",
      "page_title": "Home"
    }
  }]
}
```

## Development

### Setup

```bash
npm install          # Install dependencies
npm run dev          # Start local dev server (http://localhost:8788)
npm test             # Run tests (167 tests, 100% coverage)
npm run build        # Build for production
```

### Project Structure

```
├── functions/[[path]].ts        # Cloudflare Pages Function (entry point)
├── src/
│   ├── routes/router.ts         # Hono router configuration
│   ├── adapters/                # Log format transformers
│   │   ├── claude-code.ts       # Claude Code → Analytics Engine
│   │   └── google-analytics.ts  # GA4 → Analytics Engine
│   ├── services/
│   │   ├── analytics-engine.ts  # Analytics Engine client
│   │   └── project.ts           # Project management (D1)
│   └── middleware/
│       ├── project-id.ts        # Project ID extraction
│       └── logger.ts            # Request logging
├── test/                        # Unit + E2E tests (100% coverage)
└── wrangler.toml                # Cloudflare configuration
```

### Adding New Log Sources

1. **Create Adapter** (`src/adapters/custom.ts`):
```typescript
export class CustomAdapter extends BaseAdapter<CustomData> {
  validate(data: unknown): data is CustomData {
    return this.isObject(data) && 'field' in data;
  }

  transform(data: CustomData): AnalyticsEngineDataPoint {
    return {
      indexes: [this.toIndex(data.id)],
      doubles: [this.toDouble(data.value)],
      blobs: [this.toBlob(JSON.stringify(data))]
    };
  }
}
```

2. **Add Route** (`src/routes/router.ts`):
```typescript
app.post('/custom/:project_id', customHandler.handlePost);
```

3. **Configure Binding** (`wrangler.toml`):
```toml
[[analytics_engine_datasets]]
binding = "CUSTOM_ANALYTICS"
```

## Deployment

### Cloudflare Pages

```bash
npm run build        # Build TypeScript
npm run deploy       # Deploy to Cloudflare Pages
```

Or use the automated script:
```bash
./scripts/deploy.sh  # Build + Test + Deploy
```

### Configuration

**wrangler.toml**:
```toml
name = "duyet-logs"
compatibility_date = "2024-01-01"

# D1 Database (project metadata)
[[d1_databases]]
binding = "DB"
database_name = "duyet-logs"
database_id = "<your-db-id>"

# Analytics Engine (log storage)
[[analytics_engine_datasets]]
binding = "CLAUDE_CODE_ANALYTICS"

[[analytics_engine_datasets]]
binding = "GA_ANALYTICS"
```

## Database Management

```bash
# Migrations
npm run db:migrate              # Run migrations locally
npm run db:migrate:remote       # Run migrations on production

# Seed default projects
npm run db:seed                 # Seed local
npm run db:seed:remote          # Seed production

# Backup & Restore
npm run db:backup               # Backup production → ./backups/
npm run db:restore latest       # Restore from latest backup

# Query
npm run db:query "SELECT * FROM projects;"
```

Default projects: `debug`, `duyet`, `blog`, `prod`, `staging`, `test`

## Testing

```bash
npm test                    # Run all tests (167 tests)
npm run test:watch          # Watch mode
npm run coverage            # Coverage report (100% required)

# Generate test events
npm run test:events         # Send to local server
npm run test:events:remote  # Send to production
```

## Performance & Limits

| Metric | Value |
|--------|-------|
| **Response Time** | <100ms p95 |
| **Analytics Engine** | 1M writes/day (free tier) |
| **D1 Database** | 5GB storage (free tier) |
| **Global Edge** | 300+ locations |
| **Payload Size** | Max 5KB per event |

### Analytics Engine Format

```typescript
interface AnalyticsEngineDataPoint {
  indexes?: string[];   // Max 1 index, 96 bytes
  blobs?: string[];     // Max 5120 bytes each
  doubles?: number[];   // Numeric values
}
```

## Error Handling

All endpoints return JSON:

```json
{
  "error": "Bad Request",
  "message": "Invalid data format",
  "status": 400
}
```

Status codes: `200` (success), `400` (bad request), `404` (not found), `500` (server error)

## Monitoring

Request logs format:
```
POST /cc/myproject 200 15ms
GET /ping 200 1ms
```

## Why Cloudflare + Hono?

**Cloudflare**:
- ✅ Global edge network (300+ locations)
- ✅ Free tier: 100K requests/day
- ✅ Zero cold starts
- ✅ Built-in DDoS protection
- ✅ Integrated storage (D1, Analytics Engine)

**Hono**:
- ✅ Ultra-fast (~11KB, faster than Express)
- ✅ Web Standard API (Request/Response)
- ✅ TypeScript-first design
- ✅ Middleware support
- ✅ Zero dependencies

## Links

- 🌐 **Production**: https://logs.duyet.net
- 📚 **Hono Docs**: https://hono.dev
- ☁️ **Cloudflare Pages**: https://pages.cloudflare.com
- 📊 **Analytics Engine**: https://developers.cloudflare.com/analytics/analytics-engine/
- 🤖 **Claude Code Monitoring**: https://docs.anthropic.com/en/docs/claude-code/monitoring

## License

MIT

---

**Built with ❤️ using Cloudflare's edge infrastructure and Hono's blazing-fast routing.**
