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

**VS Code `settings.json`**:
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

**Or `~/.claude/settings.json`**:
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

**That's it!** Projects are auto-created on first use.

## Features

- 🚀 **Serverless** - Zero infrastructure, runs on Cloudflare edge
- ⚡ **Fast** - <100ms p95 response time, 300+ global locations
- 🎯 **Simple** - Just POST your logs, no setup required
- 🏷️ **Organized** - Auto-create projects via URL path
- 📊 **Scalable** - 1M writes/day free tier
- 🔒 **Type-safe** - 100% TypeScript, full validation

## API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /cc/:project_id` | Claude Code telemetry |
| `POST /ga/:project_id` | Google Analytics events |
| `GET /ping` | Health check |
| `GET /api/projects` | List projects |

**Project ID Methods** (priority order):
1. URL path: `/cc/myproject`
2. Header: `-H "X-Project-ID: myproject"`
3. Query: `?project_id=myproject`
4. Body: `{"project_id": "myproject"}`

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
