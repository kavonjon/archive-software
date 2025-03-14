#!/bin/bash

# Check if SERVER_ROLE is set in .env file
if [ -f .env ]; then
    # Only export simple variables, not complex ones like ADMINS
    export $(grep -v '^#' .env | grep -v "ADMINS" | xargs)
    # Manually set SERVER_ROLE if it exists in .env
    SERVER_ROLE=$(grep "SERVER_ROLE" .env | cut -d= -f2 | tr -d '"')
fi

# Check if SERVER_ROLE is set
if [ -z "$SERVER_ROLE" ]; then
    echo "Error: SERVER_ROLE environment variable is not set."
    echo "Please set SERVER_ROLE to 'public' or 'private'."
    exit 1
fi

# Validate SERVER_ROLE value
if [ "$SERVER_ROLE" != "public" ] && [ "$SERVER_ROLE" != "private" ]; then
    echo "Error: SERVER_ROLE must be either 'public' or 'private'."
    exit 1
fi

# If private, check for required environment variables
if [ "$SERVER_ROLE" = "private" ]; then
    if [ -z "$PUBLIC_SERVER_URL" ] || [ -z "$PUBLIC_REDIS_URL" ]; then
        echo "Error: For private server, PUBLIC_SERVER_URL and PUBLIC_REDIS_URL must be set."
        exit 1
    fi
fi

# Deploy the appropriate configuration
if [ "$SERVER_ROLE" = "public" ]; then
    echo "Deploying public server configuration..."
    docker-compose -f docker-compose.public.yml up -d
else
    echo "Deploying private server configuration..."
    docker-compose -f docker-compose.private.yml up -d
fi

echo "Deployment complete for $SERVER_ROLE server." 