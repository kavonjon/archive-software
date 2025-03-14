#!/bin/bash

set -e

# Environment variables are automatically loaded by Docker Compose
DB_NAME=${DBNAME}
DB_USER=${DBUSER}
DB_PASS=${DBPASS}
DB_PORT=5432

# Ensure required variables are set
if [[ -z "$DB_NAME" || -z "$DB_USER" || -z "$DB_PASS" || -z "$DB_PORT" ]]; then
  echo "Error: One or more required environment variables (DBNAME, DBUSER, DBPASS, DBPORT) are not set."
  exit 1
fi

# Wait for PostgreSQL to be ready
echo "Waiting for PostgreSQL to be ready on port $DB_PORT..."
until pg_isready -U postgres -p "$DB_PORT"; do
  echo "Waiting for PostgreSQL..."
  sleep 1
done
echo "PostgreSQL is ready."

# Ensure the database exists
echo "Checking if database $DB_NAME exists on port $DB_PORT..."
DB_EXISTS=$(psql -U postgres -p "$DB_PORT" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'")
if [[ "$DB_EXISTS" != "1" ]]; then
  echo "Database $DB_NAME does not exist. Initializing..."

  # Create user if it doesn't exist
  echo "Creating user $DB_USER..."
  psql -U postgres -p "$DB_PORT" -tAc "DO \$\$
  BEGIN
    IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '$DB_USER') THEN
      CREATE USER $DB_USER WITH PASSWORD '$DB_PASS';
    END IF;
  END
  \$\$;"

  # Create database
  echo "Creating database $DB_NAME..."
  psql -U postgres -p "$DB_PORT" -c "CREATE DATABASE $DB_NAME;"

  # Grant privileges
  echo "Granting privileges to user $DB_USER on database $DB_NAME..."
  psql -U postgres -p "$DB_PORT" -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

  # Configure user role
  echo "Configuring role $DB_USER..."
  psql -U postgres -p "$DB_PORT" -c "ALTER ROLE $DB_USER SET client_encoding TO 'utf8';"
  psql -U postgres -p "$DB_PORT" -c "ALTER ROLE $DB_USER SET default_transaction_isolation TO 'read committed';"
  psql -U postgres -p "$DB_PORT" -c "ALTER ROLE $DB_USER SET timezone TO 'UTC';"

  # Grant schema privileges
  echo "Granting schema privileges to user $DB_USER..."
  psql -U postgres -p "$DB_PORT" -d "$DB_NAME" -c "GRANT CREATE ON SCHEMA public TO $DB_USER;"

else
  echo "Database $DB_NAME already exists on port $DB_PORT. Skipping initialization."
fi

# Restore dump if database is empty
echo "Checking if database $DB_NAME is empty on port $DB_PORT..."
DB_EMPTY=$(psql -U postgres -p "$DB_PORT" -d "$DB_NAME" -tAc "SELECT COUNT(*) = 0 FROM pg_tables WHERE schemaname = 'public';")
if [[ "$DB_EMPTY" == "t" ]]; then
  echo "Database $DB_NAME is empty. Restoring from dump..."
  if [[ -f /backup/backup.sql ]]; then
    psql -U postgres -p "$DB_PORT" -d "$DB_NAME" < /backup/backup.sql
    echo "Restore completed."
  else
    echo "No dump file found at /backup/backup.sql. Skipping restore."
  fi
else
  echo "Database $DB_NAME is already populated on port $DB_PORT. Skipping restore."
fi
