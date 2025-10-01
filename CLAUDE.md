# Cloudflare Analytics Router

## Project Overview

A TypeScript-based analytics data router built on Cloudflare Pages using the Hono framework. Routes multiple analytics data formats to Cloudflare Analytics Engine datasets.

## Deployment Configuration

- **Platform**: Cloudflare Pages
- **Project Name**: `duyet-logs`
- **Custom Domain**: `logs.duyet.net`
- **Framework**: Hono (ultra-fast web framework)
- **Runtime**: Cloudflare Pages Functions

## Architecture

### Core Components

1. **Pages Function** (`functions/[[path]].ts`)
   - Catch-all route handler
   - Hono app initialization
   - Request routing

2. **Adapters** (`src/adapters/`)
   - Base adapter interface
   - Claude Code OpenTelemetry adapter
   - Google Analytics adapter
   - Extensible pattern for future formats

3. **Services** (`src/services/`)
   - Analytics Engine client
   - Data validation
   - Error handling with retries

4. **Routes**
   - `/ping` - Health check endpoint
   - `/cc` - Claude Code OpenTelemetry data → `CLAUDE_CODE_ANALYTICS` dataset
   - `/ga` - Google Analytics format → `GA_ANALYTICS` dataset

5. **Middleware**
   - Global error handler
   - Request/response logging
   - CORS handling

## Data Flow

```
HTTP Request (GET/POST)
    ↓
Hono Router (/cc, /ga, /ping)
    ↓
Format Adapter (transform data)
    ↓
Analytics Engine Service (validate & write)
    ↓
Cloudflare Analytics Engine Dataset
```

## Endpoints

### `/ping` - Health Check
- **Methods**: GET
- **Response**: `{ status: "ok", timestamp: ISO8601 }`
- **Use Case**: Monitoring, uptime checks

### `/cc` - Claude Code Analytics
- **Methods**: GET, POST
- **Input Format**: OpenTelemetry metrics/logs format
- **Dataset**: `CLAUDE_CODE_ANALYTICS`
- **Key Fields**:
  - Metrics: session.id, app.version, tokens, cost
  - Events: user_prompt, tool_result, api_request
- **Use Case**: Claude Code telemetry monitoring

### `/ga` - Google Analytics
- **Methods**: GET, POST
- **Input Format**: GA4 Measurement Protocol
- **Dataset**: `GA_ANALYTICS`
- **Key Fields**: client_id, events, user_properties
- **Use Case**: Web analytics tracking

## Claude Code OpenTelemetry Format

### Metrics Format
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

### Events Format
```typescript
{
  event_name: string; // "user_prompt", "tool_result", "api_request"
  timestamp: string; // ISO 8601
  session_id: string;
  attributes: Record<string, any>;
}
```

## Google Analytics Format

### GA4 Measurement Protocol
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

## Analytics Engine Data Format

Cloudflare Analytics Engine expects:
```typescript
{
  blobs?: string[];   // String values (max 5120 bytes each)
  doubles?: number[]; // Numeric values
  indexes?: string[]; // Indexed strings for filtering (max 96 bytes each)
}
```

## Technical Requirements

### Code Quality
- **Language**: TypeScript (strict mode)
- **Test Coverage**: 100% required
- **Testing Framework**: Vitest
- **Code Style**: ESLint + Prettier
- **Type Safety**: No `any` types without justification

### Performance
- **Response Time**: < 100ms p95
- **Error Rate**: < 0.1%
- **Availability**: > 99.9%

### Security
- CORS configuration
- Input validation
- Rate limiting (future)
- API key authentication (future)

## Development Workflow

### Local Development
```bash
npm install
npm run dev          # Start local server with wrangler
npm test            # Run tests
npm run coverage    # Check 100% coverage
```

### Testing Strategy
1. **Unit Tests**: All adapters, services, middleware (100% coverage)
2. **E2E Tests**: All endpoints with mock Analytics Engine
3. **Integration Tests**: Real Analytics Engine (optional)

### Deployment
```bash
npm run build       # TypeScript compilation
npm test           # Verify tests pass
npm run deploy     # Deploy to Cloudflare Pages
```

## Cloudflare Analytics Engine Bindings

Configure in `wrangler.toml`:
```toml
[[analytics_engine_datasets]]
binding = "CLAUDE_CODE_ANALYTICS"

[[analytics_engine_datasets]]
binding = "GA_ANALYTICS"
```

## Extensibility

### Adding New Endpoints
1. Create adapter in `src/adapters/`
2. Implement `DataAdapter` interface
3. Add endpoint config in `src/config/endpoints.ts`
4. Add Analytics Engine binding in `wrangler.toml`
5. Write tests (100% coverage)

### Example: Custom Format
```typescript
// src/adapters/custom.ts
export class CustomAdapter implements DataAdapter {
  transform(data: CustomFormat): AnalyticsData {
    return {
      indexes: [data.id],
      doubles: [data.value],
      blobs: [data.metadata]
    };
  }
}
```

## Project Tasks

### Phase 1: Setup ✅
- [x] Create CLAUDE.md
- [ ] Initialize TypeScript project
- [ ] Setup Vitest with 100% coverage
- [ ] Configure wrangler.toml

### Phase 2: Core Implementation
- [ ] Implement TypeScript types
- [ ] Create base adapter interface
- [ ] Implement Claude Code adapter
- [ ] Implement Google Analytics adapter
- [ ] Build Analytics Engine service
- [ ] Create middleware (error, logging)
- [ ] Build Hono router
- [ ] Create Pages Function handler

### Phase 3: Testing
- [ ] Unit tests for all modules (100%)
- [ ] E2E tests for all endpoints
- [ ] Verify 100% coverage
- [ ] Performance testing

### Phase 4: Deployment
- [ ] Create deployment script
- [ ] Deploy to Cloudflare Pages
- [ ] Configure custom domain
- [ ] Verify production deployment
- [ ] Write README documentation

## Resources

### Cloudflare Documentation
- [Pages Functions](https://developers.cloudflare.com/pages/functions/)
- [Analytics Engine](https://developers.cloudflare.com/analytics/analytics-engine/)
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
