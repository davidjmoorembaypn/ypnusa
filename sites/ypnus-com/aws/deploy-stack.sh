#!/usr/bin/env bash
# Create or update the AWS infrastructure for ypnus.com (CloudFormation via AWS SAM).
# First run: copies stack.env.example -> stack.env and asks you to fill it in. Re-run any time; it only changes what changed.
#   bash aws/deploy-stack.sh
set -euo pipefail
cd "$(dirname "$0")"
if [ ! -f stack.env ]; then
  cp stack.env.example stack.env
  echo "Created aws/stack.env. Open it (nano aws/stack.env), fill in ALERT_EMAIL, save, then run this again."; exit 1
fi
# shellcheck disable=SC1091
source ./stack.env
: "${ALERT_EMAIL:?set ALERT_EMAIL in aws/stack.env}"
if [ -z "${ORIGIN_SECRET:-}" ]; then
  ORIGIN_SECRET="$(openssl rand -hex 24)"
  echo "ORIGIN_SECRET=$ORIGIN_SECRET" >> stack.env   # kept only in this file (git-ignored)
fi
sam deploy \
  --template-file template.yaml \
  --stack-name "${STACK_NAME:-ypnus-site}" \
  --region us-east-1 \
  --resolve-s3 \
  --capabilities CAPABILITY_IAM CAPABILITY_AUTO_EXPAND \
  --no-fail-on-empty-changeset \
  ${CONFIRM:+--confirm-changeset} \
  --parameter-overrides \
    "ApexDomain=${APEX_DOMAIN:-ypnus.com}" \
    "UseCustomDomain=${USE_CUSTOM_DOMAIN:-false}" \
    "HostedZoneId=${HOSTED_ZONE_ID:-}" \
    "AppUrl=${APP_URL:-https://app.ypnus.com}" \
    "AlertEmail=${ALERT_EMAIL}" \
    "NotifyEmail=${NOTIFY_EMAIL:-support@ypnus.com}" \
    "FromEmail=${FROM_EMAIL:-no-reply@ypnus.com}" \
    "OriginVerifySecret=${ORIGIN_SECRET}" \
    "EnableWaf=${ENABLE_WAF:-true}" \
    "SetUpSesDomain=${SET_UP_SES:-true}" \
    "MonthlyBudgetUsd=${MONTHLY_BUDGET_USD:-30}" \
    "GitHubRepo=${GITHUB_REPO:-}" \
    "CreateGitHubOidcProvider=${CREATE_GITHUB_OIDC:-true}"
aws cloudformation describe-stacks --region us-east-1 --stack-name "${STACK_NAME:-ypnus-site}" \
  --query 'Stacks[0].Outputs[].[OutputKey,OutputValue]' --output table
