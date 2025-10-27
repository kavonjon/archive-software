#!/bin/bash

# TrueNAS Scale Database Restore Script for Archive Software
# Usage: ./deploy-restore-db-private.sh [dump_file.sql]
#
# If no dump file is specified, defaults to backup/initial_restore.sql
# (same location that init-db.sh uses for automatic restore)
#
# Examples:
#   ./deploy-restore-db-private.sh                           # Uses backup/initial_restore.sql
#   ./deploy-restore-db-private.sh backup/my-dump.sql        # Uses custom file
#   ./deploy-restore-db-private.sh ~/dev-backup.sql          # Uses absolute path
#
# This script restores a database dump to the running TrueNAS Scale application
# without requiring app deletion or volume recreation.

set -e  # Exit on any error

# Default to the same location that init-db.sh uses
DEFAULT_DUMP_FILE="backup/initial_restore.sql"
DUMP_FILE=${1:-$DEFAULT_DUMP_FILE}

echo "🗄️  Archive Software Database Restore for TrueNAS Scale"
echo ""

# Check if dump file was provided or using default
if [ -z "$1" ]; then
    echo "ℹ️  No dump file specified, using default: $DEFAULT_DUMP_FILE"
    echo ""
fi

# Check if dump file exists
if [ ! -f "$DUMP_FILE" ]; then
    echo "❌ Error: Dump file not found: $DUMP_FILE"
    exit 1
fi

echo "📋 Dump file: $DUMP_FILE"
echo "📊 File size: $(du -h "$DUMP_FILE" | cut -f1)"
echo ""

# Load database credentials from .env
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found in current directory"
    echo "Please run this script from the archive-software directory"
    exit 1
fi

source .env
DBNAME=${DBNAME}
DBUSER=${DBUSER}

echo "🔍 Finding TrueNAS containers..."
echo ""

# Find the PostgreSQL container
POSTGRES_CONTAINER=$(sudo docker ps --filter "name=postgres_django_private" --format "{{.Names}}" | head -1)

if [ -z "$POSTGRES_CONTAINER" ]; then
    echo "❌ Error: Could not find PostgreSQL container"
    echo "Searched for: postgres_django_private"
    echo ""
    echo "Available containers:"
    sudo docker ps --format "table {{.Names}}\t{{.Status}}"
    exit 1
fi

echo "✅ Found PostgreSQL container: $POSTGRES_CONTAINER"
echo ""

# Find the Django container
DJANGO_CONTAINER=$(sudo docker ps --filter "name=django_gunicorn_private" --format "{{.Names}}" | head -1)

if [ -z "$DJANGO_CONTAINER" ]; then
    echo "⚠️  Warning: Could not find Django container"
    echo "   Will skip Django restart step"
    DJANGO_CONTAINER=""
else
    echo "✅ Found Django container: $DJANGO_CONTAINER"
fi

echo ""

# Get file creation/modification time
if [[ "$OSTYPE" == "darwin"* ]]; then
    # macOS
    FILE_DATE=$(stat -f "%Sm" -t "%Y-%m-%d %H:%M:%S" "$DUMP_FILE")
    FILE_TIMESTAMP=$(stat -f "%m" "$DUMP_FILE")
else
    # Linux (TrueNAS)
    FILE_DATE=$(stat -c "%y" "$DUMP_FILE" | cut -d'.' -f1)
    FILE_TIMESTAMP=$(stat -c "%Y" "$DUMP_FILE")
fi

CURRENT_TIMESTAMP=$(date +%s)
AGE_HOURS=$(( (CURRENT_TIMESTAMP - FILE_TIMESTAMP) / 3600 ))

echo "📅 Dump file information:"
echo "   File: $DUMP_FILE"
echo "   Created/Modified: $FILE_DATE"
echo "   Age: $AGE_HOURS hours old"
echo ""

# Warn if file is older than 24 hours
if [ $AGE_HOURS -gt 24 ]; then
    echo "⚠️  WARNING: This dump file is MORE THAN 24 HOURS OLD!"
    echo "   Consider creating a fresh dump if this data may be stale."
    echo ""
fi

echo "⚠️  WARNING: This will replace ALL data in the production database!"
echo "   Database: $DBNAME"
echo "   User: $DBUSER"
echo "   Container: $POSTGRES_CONTAINER"
echo ""
read -p "Do you want to continue? (yes/no): " -r
echo ""

if [[ ! $REPLY =~ ^[Yy][Ee][Ss]$ ]]; then
    echo "❌ Restore cancelled"
    exit 0
fi

# Create safety backup
echo "💾 Creating safety backup of current production database..."
BACKUP_FILE="$HOME/production_backup_before_restore_$(date +%Y%m%d_%H%M%S).sql"

sudo docker exec "$POSTGRES_CONTAINER" pg_dump -U "$DBUSER" "$DBNAME" > "$BACKUP_FILE"

if [ -f "$BACKUP_FILE" ]; then
    echo "✅ Safety backup created: $BACKUP_FILE"
    echo "📊 Backup size: $(du -h "$BACKUP_FILE" | cut -f1)"
else
    echo "❌ Error: Failed to create safety backup"
    exit 1
fi

echo ""
echo "🔄 Restoring database from dump..."
echo ""

# Copy dump file to container
TEMP_DUMP="/tmp/restore_$(date +%Y%m%d_%H%M%S).sql"
sudo docker cp "$DUMP_FILE" "$POSTGRES_CONTAINER:$TEMP_DUMP"

# Restore database
echo "⏳ Restoring... (this may take a few minutes)"
sudo docker exec "$POSTGRES_CONTAINER" psql -U "$DBUSER" -d "$DBNAME" -f "$TEMP_DUMP" 2>&1 | tee restore_output.log

# Check if restore was successful
if [ ${PIPESTATUS[0]} -eq 0 ]; then
    echo ""
    echo "✅ Database restore completed successfully"
else
    echo ""
    echo "❌ Database restore encountered errors"
    echo "   Check restore_output.log for details"
    echo "   Your original data is backed up at: $BACKUP_FILE"
    exit 1
fi

# Cleanup temp file in container
sudo docker exec "$POSTGRES_CONTAINER" rm "$TEMP_DUMP"

echo ""
echo "🔍 Verifying restoration..."
echo ""

# Verify data
echo "📊 Record counts:"
sudo docker exec "$POSTGRES_CONTAINER" psql -U "$DBUSER" -d "$DBNAME" -c "SELECT 'Items: ' || COUNT(*) FROM metadata_item;" -t
sudo docker exec "$POSTGRES_CONTAINER" psql -U "$DBUSER" -d "$DBNAME" -c "SELECT 'Languoids: ' || COUNT(*) FROM metadata_languoid;" -t
sudo docker exec "$POSTGRES_CONTAINER" psql -U "$DBUSER" -d "$DBNAME" -c "SELECT 'Collaborators: ' || COUNT(*) FROM metadata_collaborator;" -t
sudo docker exec "$POSTGRES_CONTAINER" psql -U "$DBUSER" -d "$DBNAME" -c "SELECT 'Users: ' || COUNT(*) FROM auth_user;" -t

echo ""

# Restart Django container if found
if [ -n "$DJANGO_CONTAINER" ]; then
    echo "🔄 Restarting Django container to clear cached connections..."
    sudo docker restart "$DJANGO_CONTAINER"
    echo "✅ Django container restarted"
    echo ""
fi

# Run migrations
if [ -n "$DJANGO_CONTAINER" ]; then
    echo "🔄 Running Django migrations..."
    sleep 5  # Wait for container to fully start
    sudo docker exec "$DJANGO_CONTAINER" python manage.py migrate
    echo "✅ Migrations completed"
    echo ""
fi

echo "🎉 Database restore complete!"
echo ""
echo "📋 Summary:"
echo "   - Original backup: $BACKUP_FILE"
echo "   - Restore log: restore_output.log"
echo "   - Database: $DBNAME on $POSTGRES_CONTAINER"
if [ -n "$DJANGO_CONTAINER" ]; then
    echo "   - Django container: $DJANGO_CONTAINER (restarted)"
fi
echo ""
echo "🌐 Access your application at: http://<truenas-ip>:8081"
echo ""
echo "💡 Next steps:"
echo "   1. Log in and verify data appears correctly"
echo "   2. Verify user accounts and permissions"
echo ""

