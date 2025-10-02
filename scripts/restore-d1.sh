#!/bin/bash

# Restore Cloudflare D1 Database from backup
# Usage:
#   ./scripts/restore-d1.sh <backup-file>                    # Restore to production
#   ./scripts/restore-d1.sh <backup-file> --local            # Restore to local
#   ./scripts/restore-d1.sh latest                           # Restore latest backup
#   ./scripts/restore-d1.sh latest --local                   # Restore latest to local

set -e

# Configuration
DATABASE_NAME="duyet-logs"
BACKUP_DIR="./backups"

# Parse arguments
BACKUP_FILE="$1"
LOCAL_FLAG=""

if [ "$2" = "--local" ]; then
  LOCAL_FLAG="--local"
  echo "🔄 Restoring to LOCAL D1 database..."
else
  echo "🔄 Restoring to PRODUCTION D1 database..."
fi

# Validate backup file argument
if [ -z "$BACKUP_FILE" ]; then
  echo "❌ Error: No backup file specified"
  echo "Usage: $0 <backup-file> [--local]"
  echo ""
  echo "Available backups:"
  ls -lh "$BACKUP_DIR" | grep -E "${DATABASE_NAME}.*\.sql\.gz$"
  exit 1
fi

# Handle 'latest' keyword
if [ "$BACKUP_FILE" = "latest" ]; then
  BACKUP_FILE="${BACKUP_DIR}/${DATABASE_NAME}_latest.sql.gz"
  if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Error: No latest backup found"
    exit 1
  fi
  echo "📁 Using latest backup: $(readlink "$BACKUP_FILE")"
fi

# Check if backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
  echo "❌ Error: Backup file not found: $BACKUP_FILE"
  exit 1
fi

# Extract if gzipped
if [[ "$BACKUP_FILE" == *.gz ]]; then
  echo "🗜️  Extracting backup..."
  TEMP_FILE="${BACKUP_FILE%.gz}"
  gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
  BACKUP_FILE="$TEMP_FILE"
  CLEANUP_TEMP=true
fi

# Confirm restore (skip for local)
if [ -z "$LOCAL_FLAG" ]; then
  echo "⚠️  WARNING: This will restore the PRODUCTION database!"
  echo "📁 Backup file: $BACKUP_FILE"
  read -p "Continue? (yes/no): " confirm
  if [ "$confirm" != "yes" ]; then
    echo "❌ Restore cancelled"
    [ "$CLEANUP_TEMP" = true ] && rm -f "$TEMP_FILE"
    exit 1
  fi
fi

# Restore database
echo "📥 Restoring database from backup..."
wrangler d1 execute "$DATABASE_NAME" $LOCAL_FLAG --file="$BACKUP_FILE"

# Cleanup temporary file
[ "$CLEANUP_TEMP" = true ] && rm -f "$TEMP_FILE"

# Verify restore
echo "✅ Restore complete"
echo ""
echo "📊 Verifying restored data:"
wrangler d1 execute "$DATABASE_NAME" $LOCAL_FLAG --command "SELECT COUNT(*) as project_count FROM projects;"

echo ""
echo "✨ Database restored successfully!"
