#!/usr/bin/env bash
# Backup guitar-tracker persistent data (SQLite + photos).
#
# Usage (from repo root or any directory with ./data or DATA_DIR set):
#   ./scripts/backup.sh
#   DATA_DIR=/path/to/data BACKUP_DIR=/path/to/backups ./scripts/backup.sh
#   KEEP=14 ./scripts/backup.sh          # retain last 14 archives (default 30)
#
# Restoring:
#   docker compose stop
#   tar -xzf backups/guitar-tracker-data-YYYYMMDD-HHMMSS.tar.gz -C .
#   # ensures ./data/guitar-tracker.db and ./data/photos exist
#   docker compose start
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DATA_DIR="${DATA_DIR:-${ROOT}/data}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT}/backups}"
KEEP="${KEEP:-30}"
STAMP="$(date +%Y%m%d-%H%M%S)"
ARCHIVE="${BACKUP_DIR}/guitar-tracker-data-${STAMP}.tar.gz"

if [[ ! -d "$DATA_DIR" ]]; then
  echo "ERROR: data directory not found: $DATA_DIR" >&2
  echo "Set DATA_DIR or run from a checkout that has ./data after first boot." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up $DATA_DIR -> $ARCHIVE"
# Copy SQLite safely if possible (online backup via sqlite3), else tar with brief note.
TMP="$(mktemp -d)"
cleanup() { rm -rf "$TMP"; }
trap cleanup EXIT

mkdir -p "$TMP/data"

if command -v sqlite3 >/dev/null 2>&1 && [[ -f "${DATA_DIR}/guitar-tracker.db" ]]; then
  # Online-safe snapshot when sqlite3 CLI is available
  sqlite3 "${DATA_DIR}/guitar-tracker.db" ".backup ${TMP}/data/guitar-tracker.db"
  # photos + any other files under data/
  if [[ -d "${DATA_DIR}/photos" ]]; then
    cp -a "${DATA_DIR}/photos" "$TMP/data/photos"
  fi
  tar -czf "$ARCHIVE" -C "$TMP" data
else
  # Fallback: archive the whole data directory (stop the app first for safest SQLite consistency)
  echo "NOTE: sqlite3 CLI not found — archiving files directly."
  echo "      Prefer stopping the container first for a consistent DB snapshot:"
  echo "      docker compose stop && ./scripts/backup.sh && docker compose start"
  tar -czf "$ARCHIVE" -C "$(dirname "$DATA_DIR")" "$(basename "$DATA_DIR")"
fi

# prune old backups
if [[ "$KEEP" =~ ^[0-9]+$ ]] && [[ "$KEEP" -gt 0 ]]; then
  # shellcheck disable=SC2012
  ls -1t "${BACKUP_DIR}"/guitar-tracker-data-*.tar.gz 2>/dev/null | tail -n +$((KEEP + 1)) | while read -r old; do
    echo "Pruning $old"
    rm -f "$old"
  done
fi

echo "OK  $(du -h "$ARCHIVE" | awk '{print $1}')  $ARCHIVE"
