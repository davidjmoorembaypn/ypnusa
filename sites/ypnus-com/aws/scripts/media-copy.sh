#!/usr/bin/env bash
# Copy WordPress media (wp-content/uploads) into S3 so every /wp-content/uploads/... URL keeps working.
#
#   Option A (complete, recommended): download uploads as a zip from Hostinger hPanel File Manager
#             (public_html/wp-content/uploads -> Compress -> Download), upload the zip to CloudShell, then:
#               unzip -q uploads.zip -d ~/media && bash aws/scripts/media-copy.sh ~/media/uploads
#   Option B (quick, only files the pages reference): fetch them from the live site BEFORE the DNS cutover:
#               bash aws/scripts/media-copy.sh --from-live
set -euo pipefail
STACK="${STACK_NAME:-ypnus-site}"; REGION="${AWS_REGION:-us-east-1}"
cd "$(dirname "$0")/../.."
BUCKET="$(aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" --query "Stacks[0].Outputs[?OutputKey=='BucketName'].OutputValue" --output text)"
CC="public, max-age=2592000"

if [ "${1:-}" = "--from-live" ]; then
  TMP="$(mktemp -d)"; ok=0; miss=0
  while IFS= read -r p; do
    [ -z "$p" ] && continue
    mkdir -p "$TMP$(dirname "$p")"
    if curl -fsSL --retry 2 "https://ypnus.com$p" -o "$TMP$p"; then ok=$((ok+1)); else miss=$((miss+1)); echo "missing: $p"; fi
  done < data/media-manifest.txt
  aws s3 sync "$TMP/wp-content" "s3://$BUCKET/media/wp-content" --only-show-errors --cache-control "$CC"
  echo "copied $ok files, $miss missing"
elif [ -d "${1:-}" ]; then
  aws s3 sync "$1" "s3://$BUCKET/media/wp-content/uploads" --only-show-errors --cache-control "$CC" \
    --exclude "*.php" --exclude ".htaccess" --exclude "*/cache/*"
  echo "uploaded $(find "$1" -type f | wc -l) files"
else
  echo "usage: media-copy.sh <path-to-uploads-folder> | --from-live"; exit 1
fi
