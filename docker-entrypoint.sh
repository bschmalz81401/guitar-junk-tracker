#!/bin/sh
set -e

# Ensure the photo directory exists on the mounted volume.
mkdir -p "${PHOTOS_DIR:-/data/photos}"

# Apply any pending database migrations, then start.
# The first admin account is created through the web setup wizard on first run
# (open the app in a browser and follow /setup) — no admin env vars required.
npx prisma migrate deploy

exec npm run start
