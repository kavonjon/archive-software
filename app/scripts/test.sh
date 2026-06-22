#!/usr/bin/env bash
# Non-interactive Django test runner for humans and agents.
#
# Default: --keepdb (no prompt if test DB already exists).
# TEST_FRESH=1: recreate test DB non-interactively (yes piped to destroy prompt).
#
# Usage (from repo root or app/):
#   ./app/scripts/test.sh
#   ./app/scripts/test.sh metadata.tests.test_collection_item_collaborators -v 2
#   TEST_FRESH=1 ./app/scripts/test.sh metadata.tests.test_collection_item_collaborators

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$APP_DIR"

if [[ "${TEST_FRESH:-}" == "1" ]]; then
  yes | pipenv run python manage.py test "$@"
else
  pipenv run python manage.py test --keepdb "$@"
fi
