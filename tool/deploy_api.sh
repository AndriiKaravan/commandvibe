#!/usr/bin/env bash
# Deploys the API as a no-traffic revision tagged `candidate` (CLAUDE.md: candidate → checks → traffic).
# The very first deploy creates the service and needs the owner's "yes"; run it with FIRST_DEPLOY=1.
set -euo pipefail
cd "$(dirname "$0")/.."

project=commandvibe-ks
region=europe-central2
service=commandvibe-api
origins=https://commandvibe.karavanstudio.dev,https://commandvibe-ks.web.app
# The Scheduler job's token audience is the service's stable URL; the invoker is its service account.
tick_audience=https://commandvibe-api-889388170734.europe-central2.run.app
tick_invoker=commandvibe-scheduler@commandvibe-ks.iam.gserviceaccount.com

traffic_flag=(--no-traffic --tag candidate)
if [ "${FIRST_DEPLOY:-0}" = "1" ]; then
  # A new service cannot start without traffic; the owner approves this run.
  traffic_flag=(--tag candidate)
fi

gcloud run deploy "$service" \
  --project "$project" \
  --region "$region" \
  --source server \
  "${traffic_flag[@]}" \
  --timeout=3600 \
  --concurrency=1000 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=1 \
  --max-instances=1 \
  --allow-unauthenticated \
  --set-secrets SESSION_SIGNING_KEY=session-signing-key:latest \
  --set-env-vars "^#^STORAGE=firestore#APP_CHECK_MODE=monitor#FIRESTORE_DATABASE=commandvibe#PHOTOS_BUCKET=commandvibe-ks-photos#ALLOWED_ORIGINS=$origins#PUBLIC_APP_URL=https://commandvibe.karavanstudio.dev#TICK_AUDIENCE=$tick_audience#TICK_INVOKER=$tick_invoker" \
  --quiet

url=$(gcloud run services describe "$service" --project "$project" --region "$region" \
  --format='value(status.traffic.filter(tag=candidate).url)' 2>/dev/null || true)
echo "candidate: ${url:-see the Cloud Run console}"
echo "check: curl \"\$url/health\"; send traffic only after checks and approval."
