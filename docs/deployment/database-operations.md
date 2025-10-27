# TrueNAS Scale 25 Database Operations Guide

## Overview

This guide covers database dump and restore operations for the Archive Software deployed on TrueNAS Scale 25 via custom app YAML configuration.

## Architecture Context

**Deployment Method:**
- TrueNAS Scale Apps UI with custom YAML
- Compose file: `/home/truenas_admin/archive-software/docker-compose.private.yml`
- Containers managed by TrueNAS (prefixed with `ix-`)
- Database volume: Persistent Docker volume managed by TrueNAS

**Key Containers:**
- `ix-archive-software_postgres_django_private_*` - PostgreSQL database
- `ix-archive-software_django_gunicorn_private_*` - Django application
- `ix-archive-software_celery_worker_private_*` - Celery worker
- `ix-archive-software_celery_beat_private_*` - Celery beat scheduler
- `ix-archive-software_redis_private_*` - Redis cache
- `ix-archive-software_nginx_private_*` - Nginx reverse proxy

**Important:** TrueNAS adds suffixes to container names (e.g., `_1`, `_2`). Use `docker ps` to find exact names.

---

## Quick Start: Database Restore

### Prerequisites

1. SSH access to TrueNAS server
2. Database dump file from development environment
3. Archive software repository cloned at `~/archive-software`

### One-Command Restore

**Option 1: Using default location (recommended)**

```bash
# On TrueNAS server
cd ~/archive-software

# Place your dump file at backup/initial_restore.sql
cp backup/your-dump.sql backup/initial_restore.sql

# Run script (automatically uses backup/initial_restore.sql)
./deploy-restore-db-private.sh
```

**Option 2: Specify custom dump file**

```bash
# On TrueNAS server
cd ~/archive-software

# Run script with custom path
./deploy-restore-db-private.sh backup/my-dump.sql
./deploy-restore-db-private.sh ~/archive_dev_dump_20251027.sql
```

The script will:
1. Verify containers are running
2. Create safety backup of production data
3. Restore your dump file
4. Restart Django container
5. Run migrations
6. Verify data

---

## Detailed Procedures

### 1. Creating a Development Database Dump

On your Mac (development machine):

```bash
# Navigate to project
cd /Users/kavon/git/archive-software/app

# Check database credentials
cat ../.env | grep -E "DBNAME|DBUSER|DBHOST"

# Create dump with timestamp (includes flags for clean cross-instance restore)
pg_dump -h localhost -U postgres -d postgres \
  -F p --clean --if-exists \
  --no-owner \
  --no-privileges \
  -f ~/archive_dev_dump_$(date +%Y%m%d_%H%M%S).sql

# Verify dump file
ls -lh ~/archive_dev_dump_*.sql
head -n 20 ~/archive_dev_dump_*.sql  # Should show PostgreSQL dump header
```

**Flags Explanation:**
- `-F p` - Plain text SQL format (most portable)
- `--clean` - Include DROP statements before CREATE
- `--if-exists` - Use IF EXISTS clauses (prevents errors)
- `--no-owner` - Don't include SET ROLE or ALTER OWNER commands (prevents "role does not exist" errors)
- `--no-privileges` - Don't include GRANT/REVOKE commands (prevents permission warnings)

---

### 2. Transferring Dump to TrueNAS

```bash
# From your Mac
scp ~/archive_dev_dump_*.sql truenas_admin@<truenas-ip>:~/archive-software/backup/initial_restore.sql

# Example:
scp ~/archive_dev_dump_20251027_143022.sql truenas_admin@192.168.1.100:~/archive-software/backup/initial_restore.sql
```

**Note:** Naming it `initial_restore.sql` allows you to run the script without arguments.

---

### 3. Manual Restore (Without Script)

If you prefer to run commands manually:

```bash
# SSH into TrueNAS
ssh truenas_admin@<truenas-ip>
cd ~/archive-software

# Find container names
sudo docker ps | grep postgres_django_private

# Create safety backup
sudo docker exec <postgres-container> pg_dump -U postgres postgres \
  > ~/production_backup_$(date +%Y%m%d_%H%M%S).sql

# Copy dump into container
sudo docker cp backup/<your-dump>.sql <postgres-container>:/tmp/restore.sql

# Restore database
sudo docker exec <postgres-container> \
  psql -U postgres -d postgres -f /tmp/restore.sql

# Verify restoration
sudo docker exec <postgres-container> \
  psql -U postgres -d postgres -c "SELECT COUNT(*) FROM metadata_languoid;"

# Restart Django
sudo docker restart <django-container>

# Run migrations
sudo docker exec <django-container> python manage.py migrate
```

---

### 4. Verify Restoration

```bash
# Connect to database
sudo docker exec -it <postgres-container> psql -U postgres -d postgres

# Inside psql, check data:
\dt                                          -- List all tables

SELECT COUNT(*) FROM metadata_item;          -- Item count
SELECT COUNT(*) FROM metadata_languoid;      -- Should show 2418+ (after Oct 2025 import)
SELECT COUNT(*) FROM metadata_collaborator;  -- Collaborator count
SELECT COUNT(*) FROM metadata_collection;    -- Collection count
SELECT COUNT(*) FROM auth_user;              -- User accounts

-- Check recent languoid import
SELECT COUNT(*) FROM metadata_languoid WHERE glottocode LIKE '%0123';  -- Pseudo-glottocodes

-- Check for specific data
SELECT name, glottocode FROM metadata_languoid LIMIT 10;

\q  -- Exit
```

---

## Creating Production Database Backups

### Manual Backup

```bash
# SSH into TrueNAS
ssh truenas_admin@<truenas-ip>

# Create timestamped backup
sudo docker exec <postgres-container> \
  pg_dump -U postgres postgres \
  > ~/archive-software/backup/dumps/production_backup_$(date +%Y%m%d_%H%M%S).sql

# Compress for storage
gzip ~/archive-software/backup/dumps/production_backup_*.sql
```

### Automated Backups

The system has automated daily backups configured via Celery Beat (see `backup/README.md`):
- **Schedule:** Daily at 3:00 AM
- **Location:** `~/archive-software/backup/dumps/`
- **Retention:** Tiered (30 days daily, 6 months weekly, 2 years monthly)

---

## Troubleshooting

### Container Names Not Found

**Problem:** Script can't find containers

**Solution:**
```bash
# List all running containers
sudo docker ps

# Look for containers with these patterns:
# - ix-*postgres_django_private*
# - ix-*django_gunicorn_private*

# Update script or commands with exact container names
```

### Restore Fails with Permission Errors

**Problem:** Permission denied during restore

**Solution:**
```bash
# Ensure dump file is readable
chmod 644 ~/archive-software/backup/<dump-file>.sql

# Run restore as root via sudo
sudo docker exec <postgres-container> psql -U postgres -d postgres -f /tmp/restore.sql
```

### Database Already Has Data

**Problem:** Restore conflicts with existing data

**Solution:**
```bash
# Use --clean flag when creating dump (recommended)
pg_dump -h localhost -U postgres -d postgres --clean --if-exists -f dump.sql

# Or manually drop/recreate database (DESTRUCTIVE):
sudo docker exec <postgres-container> psql -U postgres -c "DROP DATABASE postgres;"
sudo docker exec <postgres-container> psql -U postgres -c "CREATE DATABASE postgres;"
sudo docker exec <postgres-container> psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE postgres TO postgres;"
```

### Migrations Fail After Restore

**Problem:** Django migrations out of sync

**Solution:**
```bash
# Check migration status
sudo docker exec <django-container> python manage.py showmigrations

# If migrations conflict, fake them (CAREFUL):
sudo docker exec <django-container> python manage.py migrate --fake

# Or run specific app migrations:
sudo docker exec <django-container> python manage.py migrate metadata
```

### Can't Access Application After Restore

**Problem:** Application won't start or shows errors

**Checklist:**
1. Check Django logs: `sudo docker logs <django-container> --tail 100`
2. Check database connection: `sudo docker exec <postgres-container> pg_isready`
3. Verify migrations: `sudo docker exec <django-container> python manage.py showmigrations`
4. Check Redis: `sudo docker exec <redis-container> redis-cli ping`
5. Restart all application containers (not database):
   ```bash
   sudo docker restart <django-container>
   sudo docker restart <celery-worker-container>
   sudo docker restart <celery-beat-container>
   sudo docker restart <nginx-container>
   ```

---

## Nuclear Option: Complete App Reinstall

If everything else fails, you can delete and recreate the app:

### Step 1: Prepare Restore File

```bash
# On TrueNAS
cd ~/archive-software
cp backup/<your-dump>.sql backup/initial_restore.sql
```

### Step 2: Delete App in TrueNAS UI

1. Navigate to Apps → Your Archive App
2. Click Delete App
3. Confirm deletion (this removes ALL data and volumes)

### Step 3: Reinstall App

1. Apps → Discover Apps → Custom App
2. **Application Name:** `archive-software`
3. **Compose File Path:** `/home/truenas_admin/archive-software/docker-compose.private.yml`
4. Click Install

### Step 4: Wait for Automatic Restore

The `init-db.sh` script will automatically:
- Create database and user from `.env` variables
- Detect empty database
- Restore from `/backup/initial_restore.sql`

### Step 5: Verify

```bash
# Check app status in TrueNAS UI
# Access application at http://<truenas-ip>:8081
# Verify data loaded correctly
```

---

## Important Notes

### Environment Variables

Ensure `.env` file in `~/archive-software/` contains production values:

```bash
SERVER_ROLE="private"
DBNAME="postgres"
DBUSER="postgres"
DBPASS="<secure-production-password>"
DBHOST="db"
DBPORT="5432"
HOST_STORAGE_PATH="/mnt/your-pool/archive-data"
PUBLIC_SERVER_URL="http://public-server-ip:8081"
PUBLIC_REDIS_URL="redis://:password@public-server-ip:6379/0"
REDIS_PASSWORD="<secure-redis-password>"
```

### Data Included in Restore

When you restore from your dev database, you're copying:
- All Items, Collections, Collaborators, Languoids
- User accounts and permissions (including your dev superuser)
- OAuth2 applications and tokens
- All metadata and relationships
- **Recent languoid import** (2,418 records with Glottolog data)

**You are NOT copying:**
- Actual files (those are in host storage volumes)
- Redis cache data (ephemeral)
- Celery task history (ephemeral)

### Files and Storage Volumes

The database contains metadata about files, but actual file content is stored in:
- `/mnt/<pool>/archive-data/main_storage/files/` (on host)
- `/mnt/<pool>/archive-data/sequestered_incoming/` (on host)

These are mounted into containers via `${HOST_STORAGE_PATH}` in docker-compose.

---

## Best Practices

1. **Always create safety backup** before restore
2. **Test restore on dev environment** first if possible
3. **Schedule downtimes** for production restores
4. **Document your process** for future reference
5. **Keep multiple backup copies** in different locations
6. **Verify data integrity** after restore
7. **Check application logs** after restore

---

## Related Documentation

- `backup/README.md` - Automated backup system
- `deploy-update-private.sh` - Code update process
- `docker-compose.private.yml` - Container configuration
- `init-db.sh` - Database initialization script

---

## Questions or Issues?

If you encounter problems:
1. Check container logs: `sudo docker logs <container-name>`
2. Verify container health: `sudo docker ps`
3. Check database connectivity: `sudo docker exec <postgres-container> pg_isready`
4. Review this documentation
5. Check the project's context memory in `context/` directory

