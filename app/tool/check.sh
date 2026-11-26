#!/usr/bin/env bash
# Runs every app gate: analyze, tests and the three builds (design 2а п. 10).
set -uo pipefail
cd "$(dirname "$0")/.."
log=${CHECK_LOG:-/tmp/commandvibe-app-check.log}
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
run analyze flutter analyze --fatal-infos
run test flutter test
run build-web flutter build web --release
run build-android flutter build apk --debug
run build-ios flutter build ios --simulator --debug
grep -E "All tests passed|tests? failed" "$log" | tail -1
exit $status
