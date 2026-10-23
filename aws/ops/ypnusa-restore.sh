#!/usr/bin/env bash
# Restore store.json from a backup made by ypnusa-backup. Run as root, ON THE SERVER.
#
#   ypnusa-restore /var/backups/ypnusa/daily/store-20261023.json.gz
#
# The current store is kept as store.json.pre-restore-<timestamp> first, the
# service is stopped while the file is swapped, and if the app does not come
# back healthy the previous store is put back automatically.
set -euo pipefail

SRC="${1:-}"
[ -n "$SRC" ] && [ -f "$SRC" ] || { echo "usage: ypnusa-restore <backup .json.gz file>" >&2; exit 2; }
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 2; }

ENV_FILE="${YPNUSA_ENV_FILE:-/etc/ypnusa/app.env}"
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -n1 | tr -d "\"'" ; }
DATA_DIR="$(env_value LOANPILOT_DATA_DIR)"; DATA_DIR="${DATA_DIR:-/var/lib/ypnusa}"
STORE="$DATA_DIR/store.json"
HEALTH_URL="http://127.0.0.1:3000/api/health"

if [ -f "$SRC.sha256" ]; then
  [ "$(sha256sum "$SRC" | awk '{print $1}')" = "$(cat "$SRC.sha256")" ] || { echo "ERROR: checksum mismatch for $SRC" >&2; exit 1; }
fi

work="$(mktemp -d)"; trap 'rm -rf "$work"' EXIT
gunzip -c "$SRC" > "$work/store.json"
node -e 'JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))' "$work/store.json" \
  || { echo "ERROR: backup is not valid JSON" >&2; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
echo "=== Stopping ypnusa"
systemctl stop ypnusa
if [ -f "$STORE" ]; then cp -p "$STORE" "$STORE.pre-restore-$stamp"; fi
install -o ypnusa -g ypnusa -m 600 "$work/store.json" "$STORE"
rm -f "$STORE.lock" "$STORE.bak"
echo "=== Starting ypnusa"
systemctl start ypnusa

for _ in $(seq 1 20); do
  body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
  if printf '%s' "$body" | grep -q '"persistent":true' && printf '%s' "$body" | grep -q '"degraded":false'; then
    echo "=== RESTORE OK (previous store kept at $STORE.pre-restore-$stamp)"; exit 0
  fi
  sleep 2
done

echo "ERROR: app not healthy after restore; putting the previous store back" >&2
systemctl stop ypnusa
if [ -f "$STORE.pre-restore-$stamp" ]; then cp -p "$STORE.pre-restore-$stamp" "$STORE"; fi
systemctl start ypnusa
exit 1
