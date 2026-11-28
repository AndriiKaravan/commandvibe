#!/usr/bin/env bash
# Runs every server gate; KS_SERVER_DIR and KS_CORE_DIR point at clean clones of the library tags.
set -uo pipefail
cd "$(dirname "$0")/.."
# Local clone paths live in the git-ignored .env.ks (KS_SERVER_DIR=..., KS_CORE_DIR=...).
if [ -f .env.ks ]; then
  set -a
  . ./.env.ks
  set +a
fi
log=${CHECK_LOG:-/tmp/commandvibe-server-check.log}
: > "$log"
status=0
run() {
  local name=$1
  shift
  if "$@" >> "$log" 2>&1; then
    echo "ok    $name"
  else
    echo "FAIL  $name"
    status=1
  fi
}
run unit npx jest
run e2e npx jest --config ./test/jest-e2e.json
run lint npx eslint "{src,test}/**/*.ts"
run typecheck npx tsc --noEmit -p tsconfig.json
run build npx tsc -p tsconfig.build.json
run sync-realtime npm run -s sync:realtime:check
run sync-push npm run -s sync:push:check
run sync-app-check npm run -s sync:app-check:check
grep -E "^Tests:" "$log"
exit $status
