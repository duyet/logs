# Database Scripts

This directory contains scripts for managing the Cloudflare D1 database.

## Prerequisites

- Node.js 20+
- Cloudflare Wrangler CLI installed
- Database configured in `wrangler.toml`

## Available Scripts

### Migration Scripts

#### Run migrations locally
```bash
npm run db:migrate
```

#### Run migrations on production
```bash
npm run db:migrate:remote
```

### Seed Default Projects

Create default projects (debug, duyet.net, blog, prod, staging, test) in the database.

#### Seed local database
```bash
npm run db:seed
```

#### Seed production database
```bash
npm run db:seed:remote
```

### Backup Database

Backup the entire D1 database to `./backups/` directory.

#### Backup local database
```bash
npm run db:backup:local
```

#### Backup production database
```bash
npm run db:backup
```

**Output files:**
- `duyet-logs_[local|prod]_YYYYMMDD_HHMMSS.sql.gz` - Compressed SQL dump
- `duyet-logs_[local|prod]_YYYYMMDD_HHMMSS.sql.projects.json` - JSON export of projects
- `duyet-logs_latest.sql.gz` - Symlink to latest backup

### Restore Database

Restore database from a backup file.

#### Restore latest backup to local
```bash
npm run db:restore latest --local
```

#### Restore specific backup to production
```bash
npm run db:restore ./backups/duyet-logs_prod_20240101_120000.sql.gz
```

**⚠️ Warning:** Restoring to production requires confirmation.

### Query Database

Execute SQL queries directly.

#### Query local database
```bash
npm run db:query "SELECT * FROM projects;"
```

#### Query production database
```bash
npm run db:query:remote "SELECT * FROM projects;"
```

## Database Schema

### Projects Table

```sql
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  description TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_used INTEGER
);

CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
```

**Columns:**
- `id` - Project identifier (3-32 alphanumeric characters)
- `description` - Project description
- `created_at` - Unix timestamp when project was created
- `last_used` - Unix timestamp of last analytics event (NULL if never used)

## Default Projects

The seed script creates these default projects:

| ID | Description |
|----|-------------|
| `debug` | Development and debugging project |
| `duyet` | duyet.net personal website analytics |
| `blog` | Blog analytics and metrics |
| `prod` | Production environment |
| `staging` | Staging environment |
| `test` | Testing and QA environment |

## Backup Strategy

### Recommended Backup Schedule

- **Production**: Daily backups (automated via cron/CI)
- **Local**: Before major changes

### Backup Retention

Keep backups for:
- Daily: 7 days
- Weekly: 4 weeks
- Monthly: 12 months

### Example Automated Backup (Cron)

```bash
# Daily backup at 2 AM
0 2 * * * cd /path/to/project && npm run db:backup > /dev/null 2>&1

# Weekly cleanup (keep last 30 backups)
0 3 * * 0 cd /path/to/project && ls -t ./backups/*.gz | tail -n +31 | xargs rm -f
```

## Manual Database Operations

### Connect to local database
```bash
wrangler d1 execute duyet-logs --local --command "SELECT * FROM projects;"
```

### Create new project manually
```bash
wrangler d1 execute duyet-logs --local --command "
  INSERT INTO projects (id, description, created_at, last_used)
  VALUES ('myproject', 'My custom project', $(date +%s)000, NULL);
"
```

### List all projects
```bash
wrangler d1 execute duyet-logs --local --command "
  SELECT id, description,
         datetime(created_at/1000, 'unixepoch') as created,
         datetime(last_used/1000, 'unixepoch') as last_used
  FROM projects
  ORDER BY created_at DESC;
"
```

### Update project description
```bash
wrangler d1 execute duyet-logs --local --command "
  UPDATE projects
  SET description = 'New description'
  WHERE id = 'myproject';
"
```

### Delete project
```bash
wrangler d1 execute duyet-logs --local --command "
  DELETE FROM projects WHERE id = 'myproject';
"
```

## Troubleshooting

### Error: "Database not found"

Ensure database is created and bound in `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "duyet-logs"
database_id = "your-database-id"
```

Create database if needed:
```bash
wrangler d1 create duyet-logs
```

### Error: "Table doesn't exist"

Run migrations:
```bash
npm run db:migrate
```

### Backup fails with permission error

Make scripts executable:
```bash
chmod +x scripts/*.sh
```

### Restore hangs or fails

1. Check backup file integrity:
   ```bash
   gunzip -t ./backups/backup-file.sql.gz
   ```

2. Manually extract and inspect:
   ```bash
   gunzip -c ./backups/backup-file.sql.gz | head -n 20
   ```

3. Try restoring to local first:
   ```bash
   ./scripts/restore-d1.sh ./backups/backup-file.sql.gz --local
   ```

## Security Notes

- **Never commit backup files** to version control
- Add `backups/` to `.gitignore`
- Backup files may contain sensitive project data
- Restrict production database access
- Use environment-specific credentials
- Rotate database credentials regularly

## See Also

- [Cloudflare D1 Documentation](https://developers.cloudflare.com/d1/)
- [Wrangler D1 Commands](https://developers.cloudflare.com/workers/wrangler/commands/#d1)
- Project main README: [../README.md](../README.md)
