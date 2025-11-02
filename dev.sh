#!/bin/bash

# Check if SERVER_ROLE is set in .env file
if [ -f .env ]; then
    # Only export simple variables, not complex ones like ADMINS
    export $(grep -v '^#' .env | grep -v "ADMINS" | xargs)
    # Manually set SERVER_ROLE if it exists in .env
    SERVER_ROLE=$(grep "SERVER_ROLE" .env | cut -d= -f2 | tr -d '"')
fi

# Default to public if not set
SERVER_ROLE=${SERVER_ROLE:-public}

# Validate required environment variables
if [ -z "$REDIS_PASSWORD" ]; then
    echo "Error: REDIS_PASSWORD not set in .env file"
    echo "Please add REDIS_PASSWORD=your_password to your .env file"
    exit 1
fi

echo "Starting development server in $SERVER_ROLE mode..."

# Check if Redis is already running on our dedicated port and stop it
ARCHIVE_REDIS_PORT=${REDIS_PORT:-6387}
if pgrep -f "redis-server.*${ARCHIVE_REDIS_PORT}" > /dev/null; then
    echo "Stopping existing Redis server on port ${ARCHIVE_REDIS_PORT}..."
    redis-cli -p ${ARCHIVE_REDIS_PORT} -a "${REDIS_PASSWORD}" shutdown 2>/dev/null || true
    sleep 2
fi

# Create temporary Redis config with password for this project
REDIS_CONF="/tmp/redis-archive-${ARCHIVE_REDIS_PORT}.conf"
echo "requirepass ${REDIS_PASSWORD}" > ${REDIS_CONF}
echo "port ${ARCHIVE_REDIS_PORT}" >> ${REDIS_CONF}
echo "databases 16" >> ${REDIS_CONF}
echo "save 900 1" >> ${REDIS_CONF}  # Basic persistence
redis-server ${REDIS_CONF} --daemonize yes

# Verify Redis connection
sleep 1
if ! redis-cli -p ${ARCHIVE_REDIS_PORT} -a "${REDIS_PASSWORD}" ping > /dev/null; then
    echo "Error: Could not connect to Redis on port ${ARCHIVE_REDIS_PORT}. Please check if Redis is running with the correct password."
    exit 1
fi

echo "✅ Redis running on port ${ARCHIVE_REDIS_PORT} for archive project"

# Set specific environment variables for development mode
export REDIS_HOST="localhost"
export REDIS_PORT="${ARCHIVE_REDIS_PORT}"
export REDIS_DB="0"
export DOCKER_CONTAINER="false"

# Fix for macOS fork() issues with Celery
export OBJC_DISABLE_INITIALIZE_FORK_SAFETY=YES
export PYTHONPATH=$(pwd)
export FORKED_BY_MULTIPROCESSING=1

# Change to the app directory
cd app

# Start Celery worker with appropriate queues
if [ "$SERVER_ROLE" = "public" ]; then
    # Use spawn method on macOS for Celery
    CELERY_WORKER_CONCURRENCY=${CELERY_WORKER_CONCURRENCY:-4}
    pipenv run celery -A archive worker -Q celery,public,common --loglevel=info --concurrency=$CELERY_WORKER_CONCURRENCY -P prefork &
    pipenv run celery -A archive beat --loglevel=info &
else
    # Use spawn method on macOS for Celery
    CELERY_WORKER_CONCURRENCY=${CELERY_WORKER_CONCURRENCY:-4}
    pipenv run celery -A archive worker -Q celery,private,common --loglevel=info --concurrency=$CELERY_WORKER_CONCURRENCY -P prefork &
    pipenv run celery -A archive beat --loglevel=info &
fi

# Start Django development server
pipenv run python manage.py runserver 8000

# Cleanup when the server is stopped
trap "pkill -f 'celery -A archive worker'; pkill -f 'celery -A archive beat'; redis-cli -p ${ARCHIVE_REDIS_PORT} -a '${REDIS_PASSWORD}' shutdown 2>/dev/null || true; echo 'Stopped archive project processes'" EXIT 