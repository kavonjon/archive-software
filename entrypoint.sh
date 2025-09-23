#!/bin/sh

# Run migrations and collect static files for all services
python manage.py migrate --no-input
python manage.py collectstatic --no-input

# Execute the command passed as arguments
exec "$@"
