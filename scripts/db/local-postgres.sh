#!/usr/bin/env bash
# Local development PostgreSQL (no Docker needed): a throwaway cluster in .local/postgres.
#
#   npm run db:local -- start    initialise (first time) and start on 127.0.0.1:${PGPORT:-54329}
#   npm run db:local -- stop     stop the cluster
#   npm run db:local -- status   show whether it is running
#   npm run db:local -- reset    stop and delete all local data
#
# Requires PostgreSQL 15+ server binaries (e.g. apt install postgresql-16, brew install postgresql@16).
# Development only: trust authentication on the loopback interface, no password, never exposed.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
DIR="$ROOT/.local/postgres"
PORT="${PGPORT:-54329}"
DB="code_dungeon_dev"

find_bin() {
  if command -v pg_config >/dev/null 2>&1 && [ -x "$(pg_config --bindir)/initdb" ]; then pg_config --bindir; return; fi
  for d in /usr/lib/postgresql/*/bin /opt/homebrew/opt/postgresql@*/bin /usr/local/opt/postgresql@*/bin; do
    [ -x "$d/initdb" ] && { echo "$d"; return; }
  done
  echo "PostgreSQL server binaries (initdb, pg_ctl) not found; install PostgreSQL 15 or newer." >&2
  exit 1
}
BIN="$(find_bin)"

# PostgreSQL refuses to run as root; in containers run it as the postgres user.
as_pg() {
  if [ "$(id -u)" = "0" ]; then runuser -u postgres -- "$@"; else "$@"; fi
}

url() { echo "postgresql://postgres@127.0.0.1:$PORT/$DB"; }

case "${1:-}" in
  start)
    mkdir -p "$DIR"
    [ "$(id -u)" = "0" ] && chown -R postgres:postgres "$DIR"
    if [ ! -f "$DIR/data/PG_VERSION" ]; then
      as_pg "$BIN/initdb" -D "$DIR/data" -U postgres -A trust --auth-host=trust >/dev/null
    fi
    if ! as_pg "$BIN/pg_ctl" -D "$DIR/data" status >/dev/null 2>&1; then
      as_pg "$BIN/pg_ctl" -D "$DIR/data" -l "$DIR/server.log" -w \
        -o "-p $PORT -k $DIR -c listen_addresses=127.0.0.1" start >/dev/null
    fi
    psql "postgresql://postgres@127.0.0.1:$PORT/postgres" -tAc "SELECT 1 FROM pg_database WHERE datname = '$DB'" | grep -q 1 \
      || psql "postgresql://postgres@127.0.0.1:$PORT/postgres" -qc "CREATE DATABASE $DB" >/dev/null
    echo "PostgreSQL running. Add to .env.local (never commit it):"
    echo "  DATABASE_URL=$(url)"
    echo "  TEST_DATABASE_URL=postgresql://postgres@127.0.0.1:$PORT/postgres"
    ;;
  stop)
    as_pg "$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 && echo "stopped" || echo "not running"
    ;;
  status)
    as_pg "$BIN/pg_ctl" -D "$DIR/data" status 2>/dev/null | head -1 || echo "not running"
    ;;
  reset)
    as_pg "$BIN/pg_ctl" -D "$DIR/data" stop -m fast >/dev/null 2>&1 || true
    rm -rf "$DIR"
    echo "local database deleted"
    ;;
  *)
    echo "usage: $0 start|stop|status|reset" >&2
    exit 2
    ;;
esac
