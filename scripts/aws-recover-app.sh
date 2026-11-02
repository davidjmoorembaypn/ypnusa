#!/usr/bin/env bash
# Run on the existing EC2 host through SSM. Default is read-only diagnosis.
# --restart restarts the existing installed release; it never downloads a build,
# edits secrets, changes DNS, or deletes data. Output deliberately omits logs/env.
set -euo pipefail
mode="${1:---check}"
case "$mode" in --check|--restart) ;; *) echo "Usage: $0 [--check|--restart]" >&2; exit 2 ;; esac
service=ypnusa.service
health=http://127.0.0.1:3000/api/health
command -v systemctl >/dev/null
command -v python3 >/dev/null

check_health() {
  curl --silent --show-error --fail --max-time 5 "$health" | python3 -c '
import json,sys
d=json.load(sys.stdin)
s=d.get("storage", {})
ok=d.get("ok") is True and s.get("persistent") is True and s.get("degraded") is False
print("Health:", "healthy" if ok else "unhealthy", "build:",d.get("build",{}).get("commit", "unknown"))
sys.exit(0 if ok else 1)
'
}

echo "Current app service"
systemctl show "$service" --property=LoadState,ActiveState,SubState,Result,NRestarts,MemoryCurrent
echo "Installed release"
readlink -f /opt/ypnusa/current || true
echo "Disk space"
df -h /opt/ypnusa
echo "Memory"
free -m
if check_health; then echo "App is healthy locally. Investigate Apache/TLS if the public URL still returns 503."; exit 0; fi
if [ "$mode" = "--check" ]; then echo "App health failed. No changes made."; exit 1; fi
if [ "$(id -u)" -ne 0 ]; then echo "Restart requires root (SSM or sudo)." >&2; exit 1; fi
[ -f /opt/ypnusa/current/server.js ] || { echo "Current release is missing; refusing restart." >&2; exit 1; }
[ -s /etc/ypnusa/app.env ] || { echo "Server environment file is missing; refusing restart." >&2; exit 1; }
echo "Restarting the installed release once"
systemctl restart "$service"
for attempt in $(seq 1 10); do
  if check_health; then echo "Recovery succeeded. Verify https://app.ypnus.com/api/health next."; exit 0; fi
  sleep 3
done
echo "Recovery failed. No configuration or release was changed. Inspect server logs privately before proceeding." >&2
exit 1
