#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
HOST_PORT="${PORT:-}"
if [ -f .env ]; then set -a; . ./.env; set +a; fi
if [ -n "$HOST_PORT" ]; then PORT="$HOST_PORT"; export PORT; fi
exec uvicorn backend.main:app --host 0.0.0.0 --port "${PORT:-8000}" --no-access-log
