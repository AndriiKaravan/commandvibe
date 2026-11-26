#!/usr/bin/env bash
# Runs the repository contract suite against the Firestore emulator on this machine.
# Needs Java 11+ on PATH; without it use the manual GitHub Actions workflow server-firestore-contract.
set -euo pipefail
cd "$(dirname "$0")/../server"

if ! java -version >/dev/null 2>&1; then
  echo "Java not found. Either install a JDK (owner's call) or run the GitHub Actions workflow" >&2
  echo "'server-firestore-contract' (Actions tab → Run workflow)." >&2
  exit 1
fi

# demo-* keeps the emulator offline: no real project or credentials are touched.
npx --yes firebase-tools@14 emulators:exec \
  --only firestore \
  --project demo-commandvibe \
  --config ../firebase.json \
  "npx jest src/data"
