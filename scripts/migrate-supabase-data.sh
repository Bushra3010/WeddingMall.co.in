#!/usr/bin/env bash
#
# Copy the data of one Supabase project into another.
#
# The schema is NOT copied here: it comes from supabase/migrations, applied to
# the target first with `npm run db:apply` (migrations are the schema truth).
# This script then moves every row of `public`, plus `auth.users` and
# `auth.identities` (password hashes included), so people keep their logins.
# Files are copied separately by scripts/copy-storage.mjs.
#
# Usage:
#   SRC_REF=cbkggpptjylhkziostbv SRC_PGPASSWORD='...' \
#   DST_REF=<new ref>            DST_PGPASSWORD='...' \
#   bash scripts/migrate-supabase-data.sh [--dump-only] [--load-only]
#
# Optional: SRC_DB_HOST / DST_DB_HOST to use the session pooler
# (aws-0-<region>.pooler.supabase.com, user postgres.<ref>) when the direct
# host is unreachable (it is IPv6-only). Dumps land in ./tmp/migration/.
#
set -euo pipefail

: "${SRC_REF:?SRC_REF (source project ref) is required}"
: "${DST_REF:?DST_REF (target project ref) is required}"
: "${SRC_PGPASSWORD:?SRC_PGPASSWORD is required}"
: "${DST_PGPASSWORD:?DST_PGPASSWORD is required}"

SRC_HOST="${SRC_DB_HOST:-db.${SRC_REF}.supabase.co}"
DST_HOST="${DST_DB_HOST:-db.${DST_REF}.supabase.co}"
SRC_USER="postgres"; DST_USER="postgres"
[[ "$SRC_HOST" == *pooler* ]] && SRC_USER="postgres.${SRC_REF}"
[[ "$DST_HOST" == *pooler* ]] && DST_USER="postgres.${DST_REF}"

OUT="$(cd "$(dirname "$0")/.." && pwd)/tmp/migration"
mkdir -p "$OUT"
PUBLIC_DUMP="$OUT/public-data.sql"
AUTH_DUMP="$OUT/auth-data.sql"

mode="${1:-}"

if [[ "$mode" != "--load-only" ]]; then
  echo "▶ Dumping public data from $SRC_REF ($SRC_HOST)"
  PGPASSWORD="$SRC_PGPASSWORD" pg_dump \
    --host "$SRC_HOST" --port 5432 --username "$SRC_USER" --dbname postgres \
    --data-only --no-owner --no-privileges --quote-all-identifiers \
    --schema public \
    --file "$PUBLIC_DUMP"

  echo "▶ Dumping auth users and identities"
  PGPASSWORD="$SRC_PGPASSWORD" pg_dump \
    --host "$SRC_HOST" --port 5432 --username "$SRC_USER" --dbname postgres \
    --data-only --no-owner --no-privileges --quote-all-identifiers \
    --table auth.users --table auth.identities --table auth.mfa_factors \
    --file "$AUTH_DUMP"

  echo "  public: $(du -h "$PUBLIC_DUMP" | cut -f1), auth: $(du -h "$AUTH_DUMP" | cut -f1)"
fi

[[ "$mode" == "--dump-only" ]] && { echo "✔ Dump only; nothing loaded."; exit 0; }

psql_dst() {
  PGPASSWORD="$DST_PGPASSWORD" psql \
    --host "$DST_HOST" --port 5432 --username "$DST_USER" --dbname postgres \
    --quiet --set ON_ERROR_STOP=1 "$@"
}

echo "▶ Checking that the target schema is already applied"
tables=$(psql_dst --tuples-only --no-align -c "select count(*) from pg_tables where schemaname = 'public'")
if [[ "${tables// /}" -lt 10 ]]; then
  echo "✖ Target has only $tables public tables. Run 'npm run db:apply' against $DST_REF first." >&2
  exit 1
fi

echo "▶ Emptying target public tables and loading the dump (one transaction)"
# `session_replication_role = replica` silences every trigger, so lifecycle
# guards, notification fan-out and search-text triggers do not fire on rows
# that already went through them once. Foreign keys are still enforced.
truncate_sql=$(psql_dst --tuples-only --no-align -c \
  "select 'truncate table ' || string_agg(format('%I.%I', schemaname, tablename), ', ') || ' cascade;'
     from pg_tables where schemaname = 'public'")
psql_dst --single-transaction \
  --command "set session_replication_role = replica" \
  --command "$truncate_sql" \
  --command "truncate table auth.identities, auth.mfa_factors; delete from auth.users;" \
  --file "$AUTH_DUMP" \
  --file "$PUBLIC_DUMP"

echo "▶ Refreshing vendor search text (triggers were silent during the load)"
psql_dst -c "select count(public.refresh_vendor_search_text(id)) from public.vendors"

echo "▶ Row counts on the target"
psql_dst -c "select 'auth.users' as t, count(*) from auth.users
  union all select 'vendors', count(*) from public.vendors
  union all select 'enquiries', count(*) from public.enquiries
  union all select 'categories', count(*) from public.categories"

echo "✔ Data copied. Now run: node scripts/copy-storage.mjs"
