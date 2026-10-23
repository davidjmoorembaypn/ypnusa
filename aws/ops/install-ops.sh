#!/usr/bin/env bash
# Install the YPN USA operations layer on the production host: hourly data
# backups, the 5-minute follow-up scheduler, and the restore tool.
# Run ON THE SERVER as root. Idempotent: safe to re-run after every release.
# It does not touch /etc/ypnusa/app.env, the app, Apache or the data itself.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 2; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE=/etc/ypnusa/app.env
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -n1 | tr -d "\"'" ; }
DATA_DIR="$(env_value LOANPILOT_DATA_DIR)"; DATA_DIR="${DATA_DIR:-/var/lib/ypnusa}"

install -m 755 "$SRC/ypnusa-backup.sh"    /usr/local/sbin/ypnusa-backup
install -m 755 "$SRC/ypnusa-restore.sh"   /usr/local/sbin/ypnusa-restore
install -m 755 "$SRC/ypnusa-followups.sh" /usr/local/sbin/ypnusa-followups
install -d -m 700 /var/backups/ypnusa

# The backup unit must be allowed to read wherever the data really lives.
sed "s#^ReadOnlyPaths=.*#ReadOnlyPaths=$DATA_DIR /etc/ypnusa#" \
  "$SRC/systemd/ypnusa-backup.service" > /etc/systemd/system/ypnusa-backup.service
install -m 644 "$SRC/systemd/ypnusa-backup.timer"       /etc/systemd/system/ypnusa-backup.timer
install -m 644 "$SRC/systemd/ypnusa-followups.service"  /etc/systemd/system/ypnusa-followups.service
install -m 644 "$SRC/systemd/ypnusa-followups.timer"    /etc/systemd/system/ypnusa-followups.timer
systemctl daemon-reload

# The scheduler needs a secret; say so plainly (names only, never values).
if ! grep -qE '^(CRON_SECRET|ADMIN_TOKEN)=.+' "$ENV_FILE" 2>/dev/null; then
  echo "NOTE: neither CRON_SECRET nor ADMIN_TOKEN is set in $ENV_FILE; the follow-up timer is installed but DISABLED until one is." >&2
  systemctl disable --now ypnusa-followups.timer 2>/dev/null || true
  systemctl enable --now ypnusa-backup.timer
else
  systemctl enable --now ypnusa-backup.timer ypnusa-followups.timer
fi

echo "=== First backup (proves the pipeline end to end)"
/usr/local/sbin/ypnusa-backup scheduled
echo "=== Timers"
systemctl list-timers 'ypnusa-*' --no-pager
