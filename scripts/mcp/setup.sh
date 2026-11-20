#!/usr/bin/env bash
# Configure the YPN USA MCP endpoint (https://ypnus.com/api/mcp) on the production host.
# Run as root on the EC2 host (SSM Session Manager):
#   sudo bash setup.sh [--private] [--rotate] [--no-cerebro] [--hourly N] [--origins "https://a.example,https://b.example"] [--dry-run]
#
# With no flags the endpoint is public with the defaults (nothing is written). Flags write a managed block
# to /etc/ypnusa/app.env, restart ypnusa.service, wait for a healthy build and put the old file back if it
# does not come up. Safe to run again: it replaces its own block and never touches other lines.
#   --private       require "Authorization: Bearer <token>" (creates a token, or keeps the existing one)
#   --rotate        with --private: make a new token
#   --no-cerebro    remove the ask_cerebro tool (it spends a paid model call)
#   --hourly N      most ask_cerebro messages an hour across all callers (default 120)
#   --origins LIST  extra browser origins allowed to call the endpoint, comma separated, no spaces
set -euo pipefail

ENV_FILE="${ENV_FILE:-/etc/ypnusa/app.env}"
SERVICE="${SERVICE:-ypnusa.service}"
SYSTEMCTL="${SYSTEMCTL:-systemctl}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
HEALTH_TRIES="${HEALTH_TRIES:-30}"
LOCAL_MCP_URL="${LOCAL_MCP_URL:-http://127.0.0.1:3000/api/mcp}"
PUBLIC_URL="${PUBLIC_URL:-https://ypnus.com/api/mcp}"
BEGIN="# BEGIN ypnusa-mcp (managed by scripts/mcp/setup.sh)"
END="# END ypnusa-mcp"

private=0 rotate=0 no_cerebro=0 hourly="" origins="" dry=0
while [ $# -gt 0 ]; do
  case "$1" in
    --private) private=1 ;;
    --rotate) rotate=1 ;;
    --no-cerebro) no_cerebro=1 ;;
    --hourly) hourly="${2:?--hourly needs a number}"; shift ;;
    --origins) origins="${2:?--origins needs a list}"; shift ;;
    --dry-run) dry=1 ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Unknown option: $1" >&2; exit 2 ;;
  esac
  shift
done
case "$hourly" in ""|*[!0-9]*) [ -z "$hourly" ] || { echo "--hourly must be a whole number" >&2; exit 2; } ;; esac

[ -f "$ENV_FILE" ] || { echo "No $ENV_FILE. Run this on the production host." >&2; exit 1; }
[ "$dry" = 1 ] || [ "$(id -u)" = 0 ] || { echo "Run as root: sudo bash $0" >&2; exit 1; }

strip_block() { awk -v b="$BEGIN" -v e="$END" '$0==b{skip=1;next} $0==e{skip=0;next} !skip' "$1"; }

token=""
if [ "$private" = 1 ]; then
  existing="$(awk -F= '/^MCP_BEARER_TOKEN=/{print $2}' "$ENV_FILE" | tail -1)"
  if [ -n "$existing" ] && [ "$rotate" = 0 ]; then token="$existing"; else token="$(openssl rand -hex 32)"; fi
fi

block=""
[ -n "$token" ] && block="${block}MCP_BEARER_TOKEN=${token}"$'\n'
[ "$no_cerebro" = 1 ] && block="${block}MCP_CEREBRO_CHAT=off"$'\n'
[ -n "$hourly" ] && block="${block}MCP_CEREBRO_HOURLY_LIMIT=${hourly}"$'\n'
[ -n "$origins" ] && block="${block}MCP_ALLOWED_ORIGINS=${origins}"$'\n'

new="$(mktemp)"; trap 'rm -f "$new"' EXIT
{ strip_block "$ENV_FILE"; [ -z "$block" ] || printf '%s\n%s%s\n' "$BEGIN" "$block" "$END"; } > "$new"

if [ "$dry" = 1 ]; then
  echo "--- dry run: the managed block would be:"; [ -n "$block" ] && printf '%s\n%s%s\n' "$BEGIN" "${block/$token/<token hidden>}" "$END" || echo "(none: defaults)"
  exit 0
fi

if cmp -s "$new" "$ENV_FILE"; then
  echo "Settings already match; no restart needed."
else
  backup="$ENV_FILE.bak.$(date -u +%Y%m%dT%H%M%SZ)"
  cp -p "$ENV_FILE" "$backup"
  install -m 600 "$new" "$ENV_FILE"
  echo "Backed up to $backup; wrote the new settings; restarting $SERVICE..."
  "$SYSTEMCTL" restart "$SERVICE"
  ok=0
  for _ in $(seq 1 "$HEALTH_TRIES"); do
    if curl -fsS -m 5 "$HEALTH_URL" 2>/dev/null | grep -q '"ok":true'; then ok=1; break; fi
    sleep 2
  done
  if [ "$ok" != 1 ]; then
    echo "The site did not come back healthy. Restoring the previous settings." >&2
    install -m 600 "$backup" "$ENV_FILE"; "$SYSTEMCTL" restart "$SERVICE"
    exit 1
  fi
  echo "Healthy."
fi

code="$(curl -s -o /dev/null -m 10 -w '%{http_code}' -X POST "$LOCAL_MCP_URL" -H 'content-type: application/json' -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"setup","version":"1"}}}' || true)"
case "$code" in
  200) echo "MCP endpoint: answering (public)." ;;
  401) echo "MCP endpoint: answering and requiring the token (private)." ;;
  404) echo "WARNING: this build has no /api/mcp yet (needs commit c4e5ab7 or later). Settings are saved and take effect once it is deployed." ;;
  *) echo "WARNING: the MCP endpoint answered HTTP $code locally." ;;
esac

echo
echo "Connect Claude:"
echo "  URL: $PUBLIC_URL"
if [ -n "$token" ]; then
  echo "  Token (shown once; also in $ENV_FILE): $token"
  echo "  Claude Code: claude mcp add --transport http ypn-usa $PUBLIC_URL --header \"Authorization: Bearer $token\""
  echo "  Note: a connector added in claude.ai's web settings may offer only OAuth sign-in, not a static token. Use public mode there, or Claude Code with the header."
else
  echo "  Claude Code: claude mcp add --transport http ypn-usa $PUBLIC_URL"
  echo "  claude.ai: Settings > Connectors > Add custom connector > paste the URL."
fi
echo "Next: bash action.sh   (checks the live tools)"
