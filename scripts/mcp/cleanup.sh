#!/usr/bin/env bash
# Undo scripts/mcp/setup.sh on the production host. Run as root:
#   sudo bash cleanup.sh [--lockdown] [--prune-backups] [--dry-run]
#
# Default: remove the managed block from /etc/ypnusa/app.env (back to the defaults: public endpoint,
# ask_cerebro on, standard limits), restart ypnusa.service and wait for a healthy build.
#   --lockdown       instead close the endpoint to everyone without a redeploy: set a random bearer token that
#                    nobody is given, so every call gets 401. Run the default cleanup to reopen it.
#   --prune-backups  delete app.env.bak.* files older than 14 days
# This never touches lines outside its own block. To remove the endpoint entirely, revert its pull request
# and let the release pipeline deploy that.
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/ypnusa/app.env}"
SERVICE="${SERVICE:-ypnusa.service}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_TRIES="${HEALTH_TRIES:-30}"
BEGIN="# BEGIN ypnusa-mcp (managed by scripts/mcp/setup.sh)"
END="# END ypnusa-mcp"

lockdown=0 prune=0 dry=0
for arg in "$@"; do
  case "$arg" in
    --lockdown) lockdown=1 ;;
    --prune-backups) prune=1 ;;
    --dry-run) dry=1 ;;
    -h|--help) sed -n '2,13p' "$0"; exit 0 ;;
    *) echo "Unknown option: $arg" >&2; exit 2 ;;
  esac
done

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE. Run this on the production host." >&2; exit 1; }
[ "$dry" = 1 ] || [ "$(id -u)" = 0 ] || [ "${ALLOW_NON_ROOT:-0}" = 1 ] || { echo "Run as root: sudo bash $0" >&2; exit 1; }   # ALLOW_NON_ROOT is for the automated tests

wait_healthy() {
  for _ in $(seq 1 "$HEALTH_TRIES"); do
    if curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'; then return 0; fi
    sleep 2
  done
  return 1
}
# A failed restart counts the same as an unhealthy site: both put the old settings back.
restart_healthy() { "$SYSTEMCTL" restart "$SERVICE" && wait_healthy; }
gen_token() {
  local t
  t="$(openssl rand -hex 32 2>/dev/null)" || return 1
  [[ "$t" =~ ^[0-9a-f]{64}$ ]] || return 1
  printf '%s' "$t"
}

new="$(mktemp)"; trap 'rm -f "$new"' EXIT
awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$ENV_FILE" > "$new"
if [ "$lockdown" = 1 ]; then
  # Never write an empty token: the endpoint treats an empty MCP_BEARER_TOKEN as "no token", i.e. public.
  locktoken="$(gen_token)" || { echo "Could not generate a token (is openssl installed?). Nothing was changed." >&2; exit 1; }
  printf '%s\nMCP_BEARER_TOKEN=%s\n%s\n' "$BEGIN" "$locktoken" "$END" >> "$new"
fi

if [ "$dry" = 1 ]; then
  if [ "$lockdown" = 1 ]; then echo "dry run: would close the endpoint (random token, never shown)."; else echo "dry run: would remove the managed block."; fi
  [ "$prune" = 1 ] && find "$(dirname "$ENV_FILE")" -maxdepth 1 -name "$(basename "$ENV_FILE").bak.*" -mtime +14 -print
  exit 0
fi

if cmp -s "$new" "$ENV_FILE"; then
  echo "Nothing to change; no restart needed."
else
  backup="$ENV_FILE.bak.$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "$ENV_FILE" "$backup"
  install -m 600 "$new" "$ENV_FILE"
  echo "Backed up to $backup; restarting $SERVICE..."
  if ! restart_healthy; then
    echo "The site did not restart healthy. Restoring the previous settings." >&2
    install -m 600 "$backup" "$ENV_FILE"
    if restart_healthy; then echo "The previous settings are back and the site is healthy again." >&2
    else echo "WARNING: the site is still not healthy after restoring. Check: journalctl -u $SERVICE -n 50" >&2; fi
    exit 1
  fi
  echo "Healthy."
fi
if [ "$lockdown" = 1 ]; then echo "The MCP endpoint now answers 401 to everyone."; else echo "MCP settings are back to the defaults."; fi

if [ "$prune" = 1 ]; then
  find "$(dirname "$ENV_FILE")" -maxdepth 1 -name "$(basename "$ENV_FILE").bak.*" -mtime +14 -print -delete
fi
