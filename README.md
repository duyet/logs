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

| Endpoint                          | Purpose                               | Dataset               |
| --------------------------------- | ------------------------------------- | --------------------- |
| `POST /cc/:project_id`            | Claude Code telemetry (all formats)   | CLAUDE_CODE_ANALYTICS |
| `POST /cc/:project_id/v1/logs`    | OTLP logs (recommended)               | CLAUDE_CODE_LOGS      |
| `POST /cc/:project_id/v1/metrics` | OTLP metrics (recommended)            | CLAUDE_CODE_METRICS   |
| `POST /cc/v1/logs`                | OTLP logs (uses "default" project)    | CLAUDE_CODE_LOGS      |
| `POST /cc/v1/metrics`             | OTLP metrics (uses "default" project) | CLAUDE_CODE_METRICS   |
| `POST /ga/:project_id`            | Google Analytics events               | GA_ANALYTICS          |
| `GET /ping`                       | Health check                          | -                     |
| `GET /api/projects`               | List projects                         | -                     |

**Data Classification**: All data includes `data_type` field for filtering:

- `otlp_logs` - OTLP logs in CLAUDE_CODE_LOGS dataset
- `otlp_metrics` - OTLP metrics in CLAUDE_CODE_METRICS dataset
- `legacy_metric` / `legacy_event` - Simple format in CLAUDE_CODE_ANALYTICS

**Project ID Methods** (priority order):

1. URL path: `/cc/myproject` or `/cc/myproject/v1/logs`
2. Header: `-H "X-Project-ID: myproject"`
3. Query: `?project_id=myproject`
4. Body: `{"project_id": "myproject"}`
5. Default: `/cc/v1/logs` and `/cc/v1/metrics` use "default" project

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
