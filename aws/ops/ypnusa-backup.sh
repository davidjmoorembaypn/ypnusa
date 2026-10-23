#!/usr/bin/env bash
# Snapshot the app's data store (store.json) with integrity checks and rotation.
# Installed as /usr/local/sbin/ypnusa-backup by aws/ops/install-ops.sh.
#
#   ypnusa-backup            # scheduled run (hourly timer)
#   ypnusa-backup pre-deploy # run by aws-install-release.sh before every deploy
#
# Safe to run while the app is serving: the app replaces store.json atomically
# (write temp file + fsync + rename), so a copy is always a complete snapshot.
# Never prints secrets. Never deletes anything outside the backup directory.
set -euo pipefail

LABEL="${1:-scheduled}"
ENV_FILE="${YPNUSA_ENV_FILE:-/etc/ypnusa/app.env}"
BACKUP_DIR="${YPNUSA_BACKUP_DIR:-/var/backups/ypnusa}"

# Read only the two settings we need from the env file, without sourcing it.
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -n1 | tr -d "\"'" ; }
DATA_DIR="$(env_value LOANPILOT_DATA_DIR)"
DATA_DIR="${DATA_DIR:-/var/lib/ypnusa}"
S3_URI="$(env_value YPNUSA_BACKUP_S3_URI)"
STORE="$DATA_DIR/store.json"

if [ ! -f "$STORE" ]; then
  echo "ERROR: $STORE does not exist; nothing to back up." >&2
  exit 1
fi

umask 077
mkdir -p "$BACKUP_DIR/hourly" "$BACKUP_DIR/daily" "$BACKUP_DIR/pre-deploy"
ts="$(date -u +%Y%m%dT%H%M%SZ)"
work="$(mktemp -d "$BACKUP_DIR/.work-XXXXXX")"
trap 'rm -rf "$work"' EXIT

cp "$STORE" "$work/store.json"

# Refuse to keep a snapshot that is not valid JSON or that looks emptied out.
node -e '
const fs = require("fs");
const db = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (typeof db !== "object" || db === null || Array.isArray(db)) throw new Error("store is not an object");
const counts = Object.fromEntries(Object.entries(db).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
console.log("snapshot ok: " + JSON.stringify(counts));
' "$work/store.json"

gzip -9 "$work/store.json"
out="$BACKUP_DIR/hourly/store-$ts-$LABEL.json.gz"
[ "$LABEL" = "pre-deploy" ] && out="$BACKUP_DIR/pre-deploy/store-$ts.json.gz"
mv "$work/store.json.gz" "$out"
sha256sum "$out" | awk '{print $1}' > "$out.sha256"
echo "backup written: $out ($(stat -c %s "$out") bytes)"

# Keep one snapshot per UTC day as the long-term copy.
day="$(date -u +%Y%m%d)"
if ! ls "$BACKUP_DIR/daily/store-$day"*.json.gz >/dev/null 2>&1; then
  cp "$out" "$BACKUP_DIR/daily/store-$day.json.gz"
fi

# Rotation: hourly copies for 3 days, pre-deploy copies for 30 days, daily copies for 90 days.
find "$BACKUP_DIR/hourly"     -type f -mtime +3  -delete
find "$BACKUP_DIR/pre-deploy" -type f -mtime +30 -delete
find "$BACKUP_DIR/daily"      -type f -mtime +90 -delete

# Optional off-host copy: only when YPNUSA_BACKUP_S3_URI is set in the env file.
if [ -n "$S3_URI" ]; then
  if command -v aws >/dev/null 2>&1; then
    if aws s3 cp "$out" "${S3_URI%/}/$(basename "$out")" --sse AES256 --only-show-errors; then
      echo "off-host copy: ${S3_URI%/}/$(basename "$out")"
    else
      echo "WARNING: off-host copy to S3 failed (local backup is intact)." >&2
    fi
  else
    echo "WARNING: YPNUSA_BACKUP_S3_URI is set but the aws CLI is not installed." >&2
  fi
fi
