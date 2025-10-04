# Logs Tracking with Cloudflare + Hono

**Serverless logs tracking system built on Cloudflare edge network.**

Send logs from Claude Code, Google Analytics, or custom apps to Cloudflare Analytics Engine for storage and analysis.

🚀 **Live**: [logs.duyet.net](https://logs.duyet.net)

## Quick Start

### 1. Send Logs

```bash
# Claude Code
curl -X POST https://logs.duyet.net/cc/myproject \
  -H "Content-Type: application/json" \
  -d '{"session_id": "abc", "metric_name": "claude_code.token.usage", "value": 1000}'

# Google Analytics
curl -X POST https://logs.duyet.net/ga/myproject \
  -H "Content-Type: application/json" \
  -d '{"client_id": "123", "events": [{"name": "page_view"}]}'
```

### 2. Configure Claude Code

**VS Code `settings.json`** (with project ID):

```json
{
  "claude-code.env": {
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

**Or `~/.claude/settings.json`** (with project ID):

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

**Quick Start (no project ID, uses "default")**:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json"
  }
}
```

**That's it!** Projects are auto-created on first use.

## Features

- 🚀 **Serverless** - Zero infrastructure, runs on Cloudflare edge
- ⚡ **Fast** - <100ms p95 response time, 300+ global locations
- 🎯 **Simple** - Just POST your logs, no setup required
- 🏷️ **Organized** - Auto-create projects via URL path
- 📊 **Scalable** - 1M writes/day free tier
- 🔒 **Type-safe** - 100% TypeScript, full validation

## API Endpoints

### Analytics Data Ingestion

| Endpoint                     | Methods   | Purpose                              | Dataset               | Project ID         |
| ---------------------------- | --------- | ------------------------------------ | --------------------- | ------------------ |
| `/cc/:project_id`            | GET, POST | Claude Code telemetry (all formats)  | CLAUDE_CODE_ANALYTICS | From URL           |
| `/cc/:project_id/v1/logs`    | POST      | OTLP logs (recommended)              | CLAUDE_CODE_LOGS      | From URL           |
| `/cc/:project_id/v1/metrics` | POST      | OTLP metrics (recommended)           | CLAUDE_CODE_METRICS   | From URL           |
| `/cc/v1/logs`                | POST      | OTLP logs (default project)          | CLAUDE_CODE_LOGS      | `"default"` (auto) |
| `/cc/v1/metrics`             | POST      | OTLP metrics (default project)       | CLAUDE_CODE_METRICS   | `"default"` (auto) |
| `/ga/:project_id`            | GET, POST | Google Analytics events              | GA_ANALYTICS          | From URL           |
| `/logtail/:project_id`       | GET, POST | Logtail/Better Stack compatible logs | LOGTAIL_ANALYTICS     | From URL           |
| `/sentry/:project_id`        | GET, POST | Sentry error tracking events         | SENTRY_ANALYTICS      | From URL           |
| `/realtime/:project_id`      | POST      | Real-time website visitor tracking   | REALTIME_ANALYTICS    | From URL           |

### Analytics Insights & Query

| Endpoint                  | Method | Purpose                                    | Parameters                                       |
| ------------------------- | ------ | ------------------------------------------ | ------------------------------------------------ |
| `/api/analytics/insights` | GET    | Query analytics data and generate insights | `dataset`, `project_id`, `start`, `end`, `limit` |
| `/api/analytics/datasets` | GET    | List available Analytics Engine datasets   | None                                             |

### Real-time Analytics

| Endpoint                      | Method | Purpose                                  | Response                                   |
| ----------------------------- | ------ | ---------------------------------------- | ------------------------------------------ |
| `/realtime/:project_id/stats` | GET    | Get 5-minute window statistics           | Live visitor count, browsers, OS, devices  |
| `/realtime/:project_id/data`  | GET    | Get full aggregated data with event list | Complete analytics data with event details |

### Project Management

| Endpoint           | Method | Purpose                      | Request Body                             |
| ------------------ | ------ | ---------------------------- | ---------------------------------------- |
| `/api/project`     | POST   | Create new project           | `{"description": "Project description"}` |
| `/api/project`     | GET    | List all projects            | Query: `limit`, `offset`                 |
| `/api/project/:id` | GET    | Get specific project details | None                                     |

### Utility

| Endpoint | Method | Purpose                          |
| -------- | ------ | -------------------------------- |
| `/ping`  | GET    | Health check endpoint            |
| `/`      | GET    | API info and available endpoints |

### Configuration Examples by Service

<details>
<summary><b>Claude Code (OTLP)</b> - Recommended</summary>

**With project ID** (`~/.claude/settings.json`):

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc/myproject",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json"
  }
}
```

**Quick start (uses "default" project)**:

```json
{
  "env": {
    "CLAUDE_CODE_ENABLE_TELEMETRY": "1",
    "OTEL_METRICS_EXPORTER": "otlp",
    "OTEL_LOGS_EXPORTER": "otlp",
    "OTEL_EXPORTER_OTLP_ENDPOINT": "https://logs.duyet.net/cc",
    "OTEL_EXPORTER_OTLP_PROTOCOL": "http/json"
  }
}
```

</details>

<details>
<summary><b>Google Analytics (GA4)</b></summary>

```bash
curl -X POST https://logs.duyet.net/ga/myproject \
  -H "Content-Type: application/json" \
  -d '{
    "client_id": "123.456",
    "events": [{"name": "page_view", "params": {"page_title": "Home"}}]
  }'
```

</details>

<details>
<summary><b>Logtail/Better Stack</b></summary>

```bash
curl -X POST https://logs.duyet.net/logtail/myproject \
  -H "Content-Type: application/json" \
  -d '{
    "message": "Application started",
    "level": "info",
    "dt": "2024-01-01T00:00:00.000Z"
  }'
```

</details>

<details>
<summary><b>Sentry Error Tracking</b></summary>

```bash
curl -X POST https://logs.duyet.net/sentry/myproject \
  -H "Content-Type: application/json" \
  -d '{
    "event_id": "fc6d8c0c43fc4630ad850ee518f1b9d0",
    "timestamp": "2024-01-01T12:00:00Z",
    "platform": "javascript",
    "level": "error",
    "exception": {
      "values": [{
        "type": "ReferenceError",
        "value": "foo is not defined",
        "stacktrace": {
          "frames": [{
            "filename": "app.js",
            "function": "handleClick",
            "lineno": 42,
            "colno": 10
          }]
        }
      }]
    },
    "user": {
      "id": "user-123",
      "email": "user@example.com"
    },
    "tags": {
      "environment": "production"
    }
  }'
```

</details>

<details>
<summary><b>Real-time Analytics</b></summary>

**Track event**:

```bash
curl -X POST https://logs.duyet.net/realtime/myproject \
  -H "Content-Type: application/json" \
  -d '{
    "event_type": "pageview",
    "url": "https://example.com/page",
    "user_agent": "Mozilla/5.0..."
  }'
```

**Get live stats**:

```bash
curl https://logs.duyet.net/realtime/myproject/stats
```

</details>

### Project ID Methods

Projects can be specified in multiple ways (priority order):

1. **URL path**: `/cc/myproject` or `/cc/myproject/v1/logs` ✨ Recommended
2. **Header**: `-H "X-Project-ID: myproject"`
3. **Query parameter**: `?project_id=myproject`
4. **Request body**: `{"project_id": "myproject", ...}`
5. **Auto-default**: Endpoints like `/cc/v1/logs` automatically use `"default"` project

**Auto-creation**: Projects are automatically created on first use with format validation (3-32 chars, lowercase alphanumeric + hyphens).

## Tech Stack

- **[Cloudflare Pages](https://pages.cloudflare.com)** - Edge deployment
- **[Cloudflare Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)** - Time-series storage (1M writes/day free)
- **[Cloudflare D1](https://developers.cloudflare.com/d1/)** - Project metadata (5GB free)
- **[Hono](https://hono.dev)** - Ultra-fast web framework
- **TypeScript** - Type-safe with 100% test coverage

## Development

```bash
npm install    # Install dependencies
npm run dev    # Local dev server (http://localhost:8788)
npm test       # Run tests (167 tests, 100% coverage)
npm run build  # Build for production
npm run deploy # Deploy to Cloudflare Pages
```

See **[CLAUDE.md](./CLAUDE.md)** for detailed documentation.

## Links

- 🌐 **Production**: https://logs.duyet.net
- 📚 **Documentation**: [CLAUDE.md](./CLAUDE.md)
- 🔧 **Hono**: https://hono.dev
- ☁️ **Cloudflare**: https://pages.cloudflare.com

## License

MIT
