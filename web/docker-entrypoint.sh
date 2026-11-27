#!/bin/sh
# Keeps the named node_modules volume in step with package-lock.json.
# Runs `npm ci` only when the lockfile hash differs from the stamp, so a normal
# start needs no network.
set -eu
STAMP=/app/node_modules/.lockstamp
HASH=$(sha256sum /app/package-lock.json | cut -d' ' -f1)
if [ ! -f "$STAMP" ] || [ "$(cat "$STAMP")" != "$HASH" ]; then
  echo "[entrypoint] package-lock.json changed, running npm ci"
  npm ci
  echo "$HASH" > "$STAMP"
fi
exec "$@"
