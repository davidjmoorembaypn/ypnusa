#!/usr/bin/env bash
# Obtain the Let's Encrypt certificate for ypnus.com + www AFTER their DNS points
# at this host (HTTP-01 validation requires that), then re-render the front door
# to use it. Run ON THE SERVER as root:  sudo bash issue-cert.sh <wordpress-origin-ip>
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 2; }
ORIGIN_IP="${1:?usage: issue-cert.sh <wordpress-origin-ip>}"
SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

command -v certbot >/dev/null || { echo "ERROR: certbot is not installed" >&2; exit 1; }
certbot certonly --webroot -w /var/www/letsencrypt -d ypnus.com -d www.ypnus.com \
  --non-interactive --agree-tos --keep-until-expiring \
  --deploy-hook "systemctl reload httpd"
bash "$SRC/install-front-door.sh" "$ORIGIN_IP"
