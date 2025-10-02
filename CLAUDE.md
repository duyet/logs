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
      blobs: [data.metadata],
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

- `id` - Project identifier (3-32 lowercase alphanumeric characters)
- `description` - Human-readable project description
- `created_at` - Unix timestamp (milliseconds) when project was created
- `last_used` - Unix timestamp (milliseconds) of last analytics event with this project_id

### Project Management

#### Web UI

Access the web interface at: `https://logs.duyet.net/`

Features:

- Create new projects with custom or auto-generated IDs
- View all existing projects
- See project creation time and last usage
- Copy-paste examples for using project IDs

#### API Endpoints

**POST `/api/projects`** - Create new project

```bash
curl -X POST https://logs.duyet.net/api/projects \
  -H "Content-Type: application/json" \
  -d '{"id": "myproject", "description": "My analytics project"}'
```

**GET `/api/projects`** - List all projects

```bash
curl https://logs.duyet.net/api/projects
```

**GET `/api/projects/:id`** - Get specific project

```bash
curl https://logs.duyet.net/api/projects/myproject
```

### Using Project IDs

Project IDs can be provided in three ways (in order of precedence):

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
  -d '{"project_id": "myproject", "session_id": "...", "metric_name": "...", "value": 123}'
```

### Project ID in Analytics Data

When a project_id is provided, it's automatically added as the **first indexed field** in Analytics Engine data, allowing efficient filtering:

#### Claude Code Metrics with Project ID

```typescript
{
  session_id: "session-123",
  metric_name: "claude_code.token.usage",
  value: 1000,
  project_id: "myproject",  // ← Added
  attributes: {
    type: "input",
    model: "claude-sonnet-4-5"
  }
}
```

#### Google Analytics with Project ID

```typescript
{
  client_id: "client-123",
  project_id: "myproject",  // ← Added
  events: [{
    name: "page_view",
    params: {...}
  }]
}
```

### Default Projects

Six default projects are created via seed script:

| Project ID | Description                          |
| ---------- | ------------------------------------ |
| `debug`    | Development and debugging project    |
| `duyet`    | duyet.net personal website analytics |
| `blog`     | Blog analytics and metrics           |
| `prod`     | Production environment               |
| `staging`  | Staging environment                  |
| `test`     | Testing and QA environment           |

Create default projects:

```bash
npm run db:seed          # Seed via local API (http://localhost:8788)
npm run db:seed:remote   # Seed via production API (https://logs.duyet.net)
```

The seed script uses the Projects API to create projects, ensuring proper validation and error handling.

### Database Management Scripts

#### Migrations

```bash
npm run db:migrate         # Run migrations locally
npm run db:migrate:remote  # Run migrations on production
```

#### Seeding

```bash
npm run db:seed           # Seed local database with default projects
npm run db:seed:remote    # Seed production database
```

#### Backup

```bash
npm run db:backup         # Backup production database
npm run db:backup:local   # Backup local database
```

Backups are stored in `./backups/` directory with timestamp:

- `duyet-logs_[local|prod]_YYYYMMDD_HHMMSS.sql.gz` - Compressed SQL dump
- `duyet-logs_[local|prod]_YYYYMMDD_HHMMSS.sql.projects.json` - JSON export

#### Restore

```bash
npm run db:restore latest              # Restore latest backup to production (with confirmation)
npm run db:restore latest --local      # Restore latest backup to local
npm run db:restore ./backups/file.sql.gz --local
```

#### Query

```bash
npm run db:query "SELECT * FROM projects;"         # Query local
npm run db:query:remote "SELECT COUNT(*) FROM projects;"  # Query production
```

See `scripts/README.md` for comprehensive database script documentation.

### Test Event Generation

Generate test analytics events for debugging:

```bash
npm run test:events                    # Send to local dev server (http://localhost:8788)
npm run test:events:remote             # Send to production (https://logs.duyet.net)

# With options
npx tsx scripts/generate-test-events.ts --count 50 --project debug
npx tsx scripts/generate-test-events.ts --endpoint http://localhost:3000 --count 100
```

The script generates:

- 40% Claude Code metrics
- 40% Claude Code events
- 20% Google Analytics events

All with realistic random data.

### Project ID Middleware

The project ID middleware:

- Extracts `project_id` from header → query → body (in that order)
- Validates project existence in D1 (non-blocking, warnings only)
- Updates `last_used` timestamp asynchronously
- Attaches project_id to context for adapters

**Non-blocking behavior:**

- Invalid or non-existent project IDs produce warnings but don't reject requests
- Project ID is completely optional
- Failed database lookups don't block analytics recording

### Analytics Engine Storage

Project IDs are stored as indexed strings in Analytics Engine:

- **Position**: First element in `indexes` array
- **Max Length**: 96 bytes (enforced by adapter)
- **Filtering**: Efficient queries by project_id

This allows Cloudflare Analytics Engine to efficiently filter and aggregate data by project.
