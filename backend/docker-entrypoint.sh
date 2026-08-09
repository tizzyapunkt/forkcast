#!/bin/sh
set -e
# The catalog is seeded by the application at boot, and only when the data volume
# has none — copying it here would overwrite the user's edits on every start.
mkdir -p /app/backend/data
exec "$@"
