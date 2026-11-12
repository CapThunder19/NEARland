#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/../.env.local}"

if [[ ! -f "$ENV_FILE" ]]; then
  echo ".env not found at $ENV_FILE"
  exit 1
fi

DATABASE_URL=$(grep -m1 '^DATABASE_URL=' "$ENV_FILE" | sed 's/^DATABASE_URL=//; s/\r$//; s/^"//; s/"$//')

if [[ -z "$DATABASE_URL" ]]; then
  echo "DATABASE_URL not found in .env"
  exit 1
fi

DATABASE_URL=$(echo "$DATABASE_URL" | sed -e 's/?pgbouncer=true&/?/g' -e 's/&pgbouncer=true&/&/g' -e 's/&pgbouncer=true//g' -e 's/?pgbouncer=true//g')

if [[ "$DATABASE_URL" != *\?* ]]; then
  DATABASE_URL="$DATABASE_URL?sslmode=require"
elif [[ "$DATABASE_URL" != *sslmode=* ]]; then
  DATABASE_URL="$DATABASE_URL&sslmode=require"
fi

psql "$DATABASE_URL" -c "\dt"
