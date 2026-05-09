#!/bin/sh
set -e
mkdir -p /app/backend/data
cp /app/backend/foods.json.img /app/backend/data/foods.json
exec "$@"
