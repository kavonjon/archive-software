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

echo "Starting development server in $SERVER_ROLE mode..."

# Check if Redis is already running and stop it
if pgrep redis-server > /dev/null; then
    echo "Stopping existing Redis server..."
    redis-cli shutdown
    sleep 2
fi

# Create temporary Redis config with password
echo "requirepass ${REDIS_PASSWORD}" > /tmp/redis.conf
echo "port 6379" >> /tmp/redis.conf
redis-server /tmp/redis.conf --daemonize yes

# Verify Redis connection
sleep 1
if ! redis-cli -a "${REDIS_PASSWORD}" ping > /dev/null; then
    echo "Error: Could not connect to Redis. Please check if Redis is running with the correct password."
    exit 1
fi

# Set specific environment variables for development mode
export REDIS_URL="redis://localhost:6379/0"
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
    celery -A archive worker -Q public,common --loglevel=info --concurrency=$CELERY_WORKER_CONCURRENCY -P prefork &
    celery -A archive beat --loglevel=info &
else
    # Use spawn method on macOS for Celery
    CELERY_WORKER_CONCURRENCY=${CELERY_WORKER_CONCURRENCY:-4}
    celery -A archive worker -Q private,common --loglevel=info --concurrency=$CELERY_WORKER_CONCURRENCY -P prefork &
    celery -A archive beat --loglevel=info &
fi

# Start Django development server
python manage.py runserver

# Cleanup when the server is stopped
trap "pkill -f 'celery worker'; pkill -f 'celery beat'; echo 'Stopped Celery processes'" EXIT 