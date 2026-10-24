#!/usr/bin/env bash
# Runs the scheduled borrower follow-up queue by calling the app's own
# POST /api/automation/process on localhost. Driven by ypnusa-followups.timer.
# The secret comes from the systemd EnvironmentFile (/etc/ypnusa/app.env) and is
# passed to curl on stdin so it never appears in the process list or the journal.
set -euo pipefail

SECRET="${CRON_SECRET:-${ADMIN_TOKEN:-}}"
if [ -z "$SECRET" ]; then
  echo "ERROR: neither CRON_SECRET nor ADMIN_TOKEN is set in /etc/ypnusa/app.env" >&2
  exit 1
fi

printf 'header = "Authorization: Bearer %s"\n' "$SECRET" \
  | curl -fsS --max-time 120 -K - -X POST -H "Content-Type: application/json" \
      http://127.0.0.1:3000/api/automation/process
echo
