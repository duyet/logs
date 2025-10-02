#!/bin/bash

# Backup Cloudflare D1 Database
# Usage:
#   ./scripts/backup-d1.sh              # Backup production database
#   ./scripts/backup-d1.sh --local      # Backup local database

set -e

# Configuration
DATABASE_NAME="duyet-logs"
BACKUP_DIR="./backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
LOCAL_FLAG=""

# Parse arguments
if [ "$1" = "--local" ]; then
  LOCAL_FLAG="--local"
  BACKUP_FILE="${BACKUP_DIR}/${DATABASE_NAME}_local_${TIMESTAMP}.sql"
  echo "📦 Backing up LOCAL D1 database..."
else
  BACKUP_FILE="${BACKUP_DIR}/${DATABASE_NAME}_prod_${TIMESTAMP}.sql"
  echo "📦 Backing up PRODUCTION D1 database..."
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

# Export database schema
echo "📋 Exporting database schema..."
wrangler d1 execute "$DATABASE_NAME" $LOCAL_FLAG --command ".schema" > "${BACKUP_FILE}.schema"

# Export all data from projects table
echo "📊 Exporting projects data..."
wrangler d1 execute "$DATABASE_NAME" $LOCAL_FLAG --command "SELECT * FROM projects;" --json > "${BACKUP_FILE}.projects.json"

# Generate SQL dump for restore
echo "🔄 Generating SQL dump..."
cat > "$BACKUP_FILE" << EOF
-- D1 Database Backup
-- Database: ${DATABASE_NAME}
-- Timestamp: ${TIMESTAMP}
-- Type: $([ -n "$LOCAL_FLAG" ] && echo "LOCAL" || echo "PRODUCTION")

-- Schema
$(cat "${BACKUP_FILE}.schema")

-- Data
$(wrangler d1 execute "$DATABASE_NAME" $LOCAL_FLAG --command "SELECT 'INSERT INTO projects (id, description, created_at, last_used) VALUES ' || '(' || quote(id) || ', ' || quote(description) || ', ' || created_at || ', ' || COALESCE(last_used, 'NULL') || ');' FROM projects;")
EOF

# Clean up temporary files
rm -f "${BACKUP_FILE}.schema"

# Compress backup
echo "🗜️  Compressing backup..."
gzip "$BACKUP_FILE"

# Create latest symlink
LATEST_LINK="${BACKUP_DIR}/${DATABASE_NAME}_latest.sql.gz"
rm -f "$LATEST_LINK"
ln -s "$(basename "${BACKUP_FILE}.gz")" "$LATEST_LINK"

echo "✅ Backup complete: ${BACKUP_FILE}.gz"
echo "📁 Projects JSON: ${BACKUP_FILE}.projects.json"
echo "🔗 Latest link: $LATEST_LINK"

# List recent backups
echo ""
echo "📚 Recent backups:"
ls -lh "$BACKUP_DIR" | grep -E "${DATABASE_NAME}.*\.sql\.gz$" | tail -5
