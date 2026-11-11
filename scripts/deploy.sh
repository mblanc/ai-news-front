#!/bin/bash

# Configuration
PROJECT_ID="svc-demo-vertex"
REGION="us-central1"
SERVICE="ai-news-front"
IMAGE_URI="us-central1-docker.pkg.dev/$PROJECT_ID/vertexai/$SERVICE:latest"

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"
PROJECT_ROOT="$( dirname "$SCRIPT_DIR" )"

# Read environment variables from .env.local if present
if [ -f "$PROJECT_ROOT/.env.local" ]; then
  echo "Loading variables from .env.local..."
  # Export non-comment lines
  export $(grep -v '^#' "$PROJECT_ROOT/.env.local" | xargs)
fi

# Set default values if not defined in .env.local
GOOGLE_CLOUD_PROJECT_ID=${GOOGLE_CLOUD_PROJECT_ID:-$PROJECT_ID}
FIRESTORE_DATABASE_ID=${FIRESTORE_DATABASE_ID:-"ai-news-db"}
GOOGLE_CLOUD_LOCATION=${GOOGLE_CLOUD_LOCATION:-"global"}
INGEST_MODEL=${INGEST_MODEL:-"gemini-3.5-flash-lite"}
EMBEDDING_MODEL=${EMBEDDING_MODEL:-"gemini-embedding-2"}
TTL_DAYS=${TTL_DAYS:-"14"}
SMTP_HOST=${SMTP_HOST:-"smtp.resend.com"}
SMTP_PORT=${SMTP_PORT:-"465"}
SMTP_USER=${SMTP_USER:-"resend"}
EMAIL_FROM=${EMAIL_FROM:-"onboarding@resend.dev"}
DIGEST_RECIPIENTS=${DIGEST_RECIPIENTS:-"mblanc@google.com"}
ADMIN_EMAILS=${ADMIN_EMAILS:-"mblanc@google.com"}
VIDEO_GCS_BUCKET=${VIDEO_GCS_BUCKET:-"ai-news-front-videos-$GOOGLE_CLOUD_PROJECT_ID"}
VIDEO_JOB_REGION=${VIDEO_JOB_REGION:-"$REGION"}
VIDEO_WORKER_JOB_NAME=${VIDEO_WORKER_JOB_NAME:-"ai-news-video-worker"}
GCP_SIGNING_SERVICE_ACCOUNT=${GCP_SIGNING_SERVICE_ACCOUNT:-"125188993477-compute@developer.gserviceaccount.com"}

# 1. Build the container image using Cloud Build
echo "Building container image using Cloud Build..."
gcloud builds submit --tag $IMAGE_URI "$PROJECT_ROOT"

# 2. Deploy to Cloud Run
echo "Deploying to Cloud Run..."

# Reset the SECONDS variable to measure just the deploy step
SECONDS=0

gcloud run deploy $SERVICE \
  --image $IMAGE_URI \
  --cpu 1 \
  --memory 2G \
  --timeout=10m \
  --region $REGION \
  --project $GOOGLE_CLOUD_PROJECT_ID \
  --set-env-vars GOOGLE_CLOUD_PROJECT_ID="$GOOGLE_CLOUD_PROJECT_ID",FIRESTORE_DATABASE_ID="$FIRESTORE_DATABASE_ID",GOOGLE_CLOUD_LOCATION="$GOOGLE_CLOUD_LOCATION",INGEST_MODEL="$INGEST_MODEL",EMBEDDING_MODEL="$EMBEDDING_MODEL",TTL_DAYS="$TTL_DAYS",SMTP_HOST="$SMTP_HOST",SMTP_PORT="$SMTP_PORT",SMTP_USER="$SMTP_USER",EMAIL_FROM="$EMAIL_FROM",DIGEST_RECIPIENTS="$DIGEST_RECIPIENTS",ADMIN_EMAILS="$ADMIN_EMAILS",VIDEO_GCS_BUCKET="$VIDEO_GCS_BUCKET",VIDEO_JOB_REGION="$VIDEO_JOB_REGION",VIDEO_WORKER_JOB_NAME="$VIDEO_WORKER_JOB_NAME",GCP_SIGNING_SERVICE_ACCOUNT="$GCP_SIGNING_SERVICE_ACCOUNT" \
  --update-secrets=REDDIT_CLIENT_ID=REDDIT_CLIENT_ID:latest,REDDIT_CLIENT_SECRET=REDDIT_CLIENT_SECRET:latest,CRON_SECRET=CRON_SECRET:latest,SMTP_PASS=SMTP_PASS:latest


duration=$SECONDS
echo "----------------------------------------------------------------"
echo "Deployment complete."
echo "Time taken for deployment: $(($duration / 60)) minutes and $(($duration % 60)) seconds."
echo "----------------------------------------------------------------"
