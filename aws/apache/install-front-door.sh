#!/usr/bin/env bash
# Install the ypnus.com front door (Apache) on the AWS host WITHOUT sending it any
# traffic: ypnus.com's DNS still points at Hostinger until the owner changes it.
# Run ON THE SERVER as root:
#
#   sudo bash install-front-door.sh <wordpress-origin-ip>
#
# Uses the real Let's Encrypt certificate if one exists, otherwise generates a
# short-lived self-signed placeholder so the whole route table can be tested with
#   curl -k --resolve ypnus.com:443:127.0.0.1 https://ypnus.com/...
# before DNS moves. It also pins ypnus.com to the WordPress origin in /etc/hosts so the
# origin's TLS certificate (chain AND hostname) is fully verified. Validates with `apachectl configtest` and restores the previous
# config automatically if validation fails. app.ypnus.com is never touched.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 2; }

ORIGIN_IP="${1:-}"
[[ "$ORIGIN_IP" =~ ^[0-9]{1,3}(\.[0-9]{1,3}){3}$ ]] || { echo "usage: install-front-door.sh <wordpress-origin-ipv4>" >&2; exit 2; }

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONF=/etc/httpd/conf.d/zz-ypnus-com.conf
LIVE=/etc/letsencrypt/live/ypnus.com

for mod in proxy_module proxy_http_module ssl_module headers_module rewrite_module alias_module; do
  apachectl -M 2>/dev/null | grep -q "$mod" || { echo "ERROR: Apache module $mod is not loaded" >&2; exit 1; }
done

install -d /var/www/letsencrypt/.well-known/acme-challenge

if [ -f "$LIVE/fullchain.pem" ] && [ -f "$LIVE/privkey.pem" ]; then
  FULLCHAIN="$LIVE/fullchain.pem"; PRIVKEY="$LIVE/privkey.pem"
  echo "=== Using the Let's Encrypt certificate for ypnus.com"
else
  PH=/etc/pki/tls/ypnus-com-placeholder
  install -d -m 700 "$PH"
  if [ ! -f "$PH/cert.pem" ]; then
    openssl req -x509 -newkey rsa:2048 -nodes -days 30 -subj "/CN=ypnus.com" \
      -addext "subjectAltName=DNS:ypnus.com,DNS:www.ypnus.com" \
      -keyout "$PH/key.pem" -out "$PH/cert.pem" 2>/dev/null
    chmod 600 "$PH/key.pem"
  fi
  FULLCHAIN="$PH/cert.pem"; PRIVKEY="$PH/key.pem"
  echo "=== No Let's Encrypt certificate yet; using a SELF-SIGNED placeholder (testing only)"
fi

backup=""
if [ -f "$CONF" ]; then backup="$CONF.prev-$(date -u +%Y%m%dT%H%M%SZ)"; cp -p "$CONF" "$backup"; fi

# Pin the name ypnus.com to the WordPress origin on THIS host so Apache can connect by name and
# fully verify the origin's certificate. (Remove the marked line when WordPress is retired.)
HOSTS_MARK="# ypnusa-wp-origin"
cp -p /etc/hosts "/etc/hosts.prev-$(date -u +%Y%m%dT%H%M%SZ)"
grep -v "$HOSTS_MARK" /etc/hosts > /etc/hosts.new || true
echo "$ORIGIN_IP ypnus.com www.ypnus.com $HOSTS_MARK" >> /etc/hosts.new
cat /etc/hosts.new > /etc/hosts && rm -f /etc/hosts.new
getent hosts ypnus.com | grep -q "^$ORIGIN_IP " || { echo "ERROR: /etc/hosts pin did not take effect" >&2; exit 1; }

sed -e "s#@WP_ORIGIN_HOST@#ypnus.com#g" -e "s#@CERT_FULLCHAIN@#$FULLCHAIN#g" -e "s#@CERT_PRIVKEY@#$PRIVKEY#g" \
  "$SRC/zz-ypnus-com.conf.tmpl" > "$CONF"

if ! apachectl configtest 2>&1; then
  echo "ERROR: Apache config invalid; restoring the previous state" >&2
  if [ -n "$backup" ]; then cp -p "$backup" "$CONF"; else rm -f "$CONF"; fi
  exit 1
fi
systemctl reload httpd
echo "=== Front door installed (no DNS change made). Test it with:"
echo "    curl -ksI --resolve ypnus.com:443:127.0.0.1 https://ypnus.com/"
