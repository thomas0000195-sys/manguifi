#!/bin/sh
set -e

echo "Manguifi — applying database migrations..."
npx prisma migrate deploy

echo "Manguifi — starting server..."
exec node server.js
