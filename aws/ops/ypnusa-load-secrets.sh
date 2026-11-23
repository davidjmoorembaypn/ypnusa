#!/bin/bash
# Pull app secrets from SSM Parameter Store (/ypnusa/<NAME>, us-east-2) into
# /etc/ypnusa/app.env and restart the app only when something changed.
# Installed on the server as /usr/local/sbin/ypnusa-load-secrets. Never prints values.
# The instance role needs ssm:GetParameter (+ kms:Decrypt) on /ypnusa/*.
set -euo pipefail
ENV=/etc/ypnusa/app.env
REGION=us-east-2
changed=0
for name in ANTHROPIC_API_KEY STRIPE_WEBHOOK_SECRET RESEND_API_KEY TWILIO_ACCOUNT_SID TWILIO_AUTH_TOKEN TWILIO_FROM_NUMBER; do
  src="$name"
  # The Resend key was first saved as /ypnusa/RESEND_API_Key; accept either name.
  if [ "$name" = RESEND_API_KEY ] && ! aws ssm get-parameter --region "$REGION" --name /ypnusa/RESEND_API_KEY >/dev/null 2>&1; then
    src=RESEND_API_Key
  fi
  # The Twilio token was first saved as /ypnusa/twilio_AUTH_TOKEN; accept either name.
  if [ "$name" = TWILIO_AUTH_TOKEN ] && ! aws ssm get-parameter --region "$REGION" --name /ypnusa/TWILIO_AUTH_TOKEN >/dev/null 2>&1; then
    src=twilio_AUTH_TOKEN
  fi
  if val="$(aws ssm get-parameter --region "$REGION" --with-decryption --name "/ypnusa/$src" --query Parameter.Value --output text 2>/dev/null)"; then
    [ -n "$val" ] && [ "$val" != "None" ] || continue
    cur="$(grep -E "^$name=" "$ENV" | head -1 | cut -d= -f2- || true)"
    if [ "$cur" != "$val" ]; then
      tmp="$(mktemp)"; grep -v -E "^$name=" "$ENV" > "$tmp" || true
      printf '%s=%s\n' "$name" "$val" >> "$tmp"
      cat "$tmp" > "$ENV"; rm -f "$tmp"; changed=1
      echo "$name: updated"
    else
      echo "$name: unchanged"
    fi
  else
    echo "$name: not in Parameter Store (skipped)"
  fi
done
chmod 600 "$ENV"
if [ "$changed" = 1 ]; then systemctl restart ypnusa; echo "app restarted"; fi
