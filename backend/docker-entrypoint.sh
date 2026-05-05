#!/bin/sh
set -e
mkdir -p /app/backend/data
cp /app/backend/bls.json.img /app/backend/data/bls.json
exec "$@"
