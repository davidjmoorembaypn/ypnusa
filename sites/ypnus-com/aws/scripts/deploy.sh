#!/usr/bin/env bash
# Publish ypnus.com: build static pages -> upload to S3 -> update edge redirects -> refresh CloudFront cache.
# Run from the repo root (AWS CloudShell or GitHub Actions):   bash aws/scripts/deploy.sh
# Settings: STACK_NAME (default ypnus-site), AWS_REGION (default us-east-1), SKIP_BUILD=1 to reuse aws/dist.
set -euo pipefail
STACK="${STACK_NAME:-ypnus-site}"
REGION="${AWS_REGION:-us-east-1}"
cd "$(dirname "$0")/../.."

out() { aws cloudformation describe-stacks --region "$REGION" --stack-name "$STACK" \
          --query "Stacks[0].Outputs[?OutputKey=='$1'].OutputValue" --output text; }
BUCKET="$(out BucketName)"; DIST="$(out DistributionId)"; KVS="$(out RedirectStoreArn)"
[ -n "$BUCKET" ] && [ "$BUCKET" != "None" ] || { echo "Stack $STACK not found in $REGION"; exit 1; }

if [ "${SKIP_BUILD:-0}" != "1" ]; then
  [ -d node_modules ] || npm ci --omit=dev --no-audit --no-fund
  node aws/scripts/build-static.js
fi
SRC=aws/dist/site
HTML_CC="public, max-age=300, s-maxage=86400, stale-while-revalidate=86400"

echo "== Uploading to s3://$BUCKET/site"
# 1) versioned assets: cache for a year (CloudFront is refreshed below on every deploy)
aws s3 sync "$SRC/assets" "s3://$BUCKET/site/assets" --delete --only-show-errors \
  --cache-control "public, max-age=31536000, immutable"
# 2) HTML pages, with an explicit UTF-8 content type
aws s3 sync "$SRC" "s3://$BUCKET/site" --delete --only-show-errors --exclude "*" --include "*.html" \
  --content-type "text/html; charset=utf-8" --cache-control "$HTML_CC"
# 3) everything else (sitemaps, feed, robots, favicon, other files from public/)
aws s3 sync "$SRC" "s3://$BUCKET/site" --delete --only-show-errors --exclude "*.html" --exclude "assets/*" \
  --cache-control "public, max-age=3600"

echo "== Updating redirects at the edge"
python3 aws/scripts/kvs-sync.py "$KVS" aws/dist/kvs.json

echo "== Refreshing CloudFront"
aws cloudfront create-invalidation --distribution-id "$DIST" --paths "/*" --query 'Invalidation.Id' --output text
echo "Done: https://$(out DistributionDomain)/  (live within ~1 minute)"
