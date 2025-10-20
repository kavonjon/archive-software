#!/bin/bash

# TrueNAS Scale Update Script for Archive Software
# Usage: ./update-truenas.sh [web|all]
# 
# web: Updates only the web container (for code changes)
# all: Updates all containers except database (for infrastructure changes)

set -e  # Exit on any error

COMPOSE_FILE="docker-compose.private.yml"
UPDATE_TYPE=${1:-web}

echo "🚀 Archive Software TrueNAS Update Script"
echo "📋 Update type: $UPDATE_TYPE"
echo ""

# Pull latest code
echo "📥 Pulling latest code from git..."
git pull origin main
echo ""

# Build React frontend
echo "⚛️  Building React frontend..."
cd frontend
npm ci --only=production
npm run build:django
cd ..
echo ""

case $UPDATE_TYPE in
    "web")
        echo "🏗️  Building web container only..."
        sudo docker compose -f $COMPOSE_FILE build --no-cache web
        
        echo "🏷️  Tagging for TrueNAS..."
        sudo docker tag archive-software-web:latest ix-archive-software-web:latest
        
        echo "🧹 Cleaning up original tag..."
        sudo docker rmi archive-software-web:latest
        
        echo "✅ Web container updated!"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Go to TrueNAS Scale UI"
        echo "   2. Apps → Your Archive App → Stop"
        echo "   3. Apps → Your Archive App → Start"
        echo ""
        echo "🎯 This update includes: Code changes, Django views, templates, etc."
        ;;
        
    "all")
        echo "🏗️  Building all application containers..."
        sudo docker compose -f $COMPOSE_FILE build --no-cache web celery-worker celery-beat nginx
        
        echo "🏷️  Tagging all containers for TrueNAS..."
        sudo docker tag archive-software-web:latest ix-archive-software-web:latest
        sudo docker tag archive-software-celery-worker:latest ix-archive-software-celery-worker:latest
        sudo docker tag archive-software-celery-beat:latest ix-archive-software-celery-beat:latest
        sudo docker tag archive-software-nginx:latest ix-archive-software-nginx:latest
        
        echo "🧹 Cleaning up original tags..."
        sudo docker rmi archive-software-web:latest
        sudo docker rmi archive-software-celery-worker:latest
        sudo docker rmi archive-software-celery-beat:latest
        sudo docker rmi archive-software-nginx:latest
        
        echo "✅ All containers updated!"
        echo ""
        echo "📋 Next steps:"
        echo "   1. Go to TrueNAS Scale UI"
        echo "   2. Apps → Your Archive App → Stop"
        echo "   3. Apps → Your Archive App → Start"
        echo ""
        echo "🎯 This update includes: Dockerfile changes, nginx config, celery config, dependencies, etc."
        ;;
        
    *)
        echo "❌ Invalid update type: $UPDATE_TYPE"
        echo ""
        echo "Usage: $0 [web|all]"
        echo ""
        echo "Options:"
        echo "  web  - Update only web container (for code changes)"
        echo "  all  - Update all containers except database (for infrastructure changes)"
        echo ""
        echo "Examples:"
        echo "  $0 web    # Most common - for Django code changes"
        echo "  $0 all    # For Dockerfile, nginx, or dependency changes"
        exit 1
        ;;
esac

echo "🧹 Cleaning up dangling images..."
sudo docker image prune -f

echo ""
echo "🎉 Update complete!"
echo "💾 Database and volumes preserved"
echo "⏱️  Total build time: $(date)"

# Show current image status
echo ""
echo "📊 Current TrueNAS images:"
sudo docker images | grep ix-archive-software
