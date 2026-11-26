#!/usr/bin/env bash
# Builds the web app against an API URL and deploys it to a Hosting preview channel (never the live site).
set -euo pipefail
cd "$(dirname "$0")/.."

api=${API:?set API to the candidate URL of commandvibe-api}
channel=${CHANNEL:-candidate}

(cd app && flutter build web --release --dart-define=API="$api")
firebase hosting:channel:deploy "$channel" --expires 7d --project commandvibe-ks
