#!/usr/bin/env bash
set -euo pipefail

# Starts Django via Gunicorn (production-ish).
# Assumptions:
# - You created/activated a virtualenv before running, OR you have gunicorn on PATH.
# - Your environment variables are in .env (loaded via load_env.sh).
#
# Typical usage:
#   chmod +x load_env.sh start_production.sh
#   source ./load_env.sh
#   ./start_production.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "${SCRIPT_DIR}"

source ./load_env.sh

# Use prod settings module selector used by your project.
export DJANGO_ENV="${DJANGO_ENV:-production}"

# Gunicorn bind: shared hosting usually only allows high ports.
HOST="${HOST:-127.0.0.1}"
PORT="${PORT:-8000}"
WORKERS="${WORKERS:-2}"

# WSGI entrypoint from your Django project
APP="${APP:-backend.wsgi:application}"

exec gunicorn \
  --bind "${HOST}:${PORT}" \
  --workers "${WORKERS}" \
  --access-logfile "-" \
  --error-logfile "-" \
  "${APP}"

