#!/bin/sh
set -e

# ---------------------------------------------------------------------------
# Ensure data directories exist before Prisma/Next touch them.
#
# Compose bind-mounts ./data -> /data. On first boot that mount can be empty
# (or the host path may have just been created). Bare `docker run` without a
# volume has no /data at all. Either way we create the paths we need.
# ---------------------------------------------------------------------------

PHOTOS_DIR="${PHOTOS_DIR:-/data/photos}"
DB_URL="${DATABASE_URL:-file:/data/guitar-tracker.db}"

# Resolve SQLite path from DATABASE_URL (file:/path, file:///path, or relative).
db_file="${DB_URL#file:}"
# file:///abs/path -> ///abs/path; collapse leading double-slash pairs once.
case "$db_file" in
  //*) db_file="${db_file#//}" ;;
esac
# Absolute path should start with /; if not, treat as relative to /app.
case "$db_file" in
  /*) ;;
  *) db_file="/app/${db_file}" ;;
esac
db_dir=$(dirname "$db_file")

echo "guitar-tracker: ensuring data dirs (db_dir=${db_dir} photos=${PHOTOS_DIR})"
mkdir -p "$db_dir" "$PHOTOS_DIR"

# Sanity check: directories must be writable (clear error if a bind mount is RO).
if ! touch "${db_dir}/.write-test" 2>/dev/null; then
  echo "guitar-tracker: ERROR: cannot write to database directory: ${db_dir}" >&2
  echo "guitar-tracker: check that the volume mount for /data exists and is writable." >&2
  exit 1
fi
rm -f "${db_dir}/.write-test"

if ! touch "${PHOTOS_DIR}/.write-test" 2>/dev/null; then
  echo "guitar-tracker: ERROR: cannot write to photos directory: ${PHOTOS_DIR}" >&2
  exit 1
fi
rm -f "${PHOTOS_DIR}/.write-test"

# Apply any pending database migrations, then start.
# The first admin account is created through the web setup wizard on first run
# (open the app in a browser and follow /setup) — no admin env vars required.
npx prisma migrate deploy

exec npm run start
