#!/bin/bash
# YPN USA: turn a fresh Amazon Linux 2023 EC2 instance into the server for
# app.ypnus.com AND ypnus.com, with no shell access needed.
#
# How to use: paste this whole file into "Advanced details -> User data" when
# launching the instance (see aws/bootstrap/README.md). It runs once, as root,
# on first boot. Progress log: /var/log/ypnusa-bootstrap.log
#
# What it does:
#   1. Installs Node 20 (checksum-pinned), Apache + mod_ssl, certbot, 1 GB swap.
#   2. Creates the ypnusa user, /opt/ypnusa, /var/lib/ypnusa (data) and
#      /etc/ypnusa/app.env (generated SESSION_SECRET / ADMIN_TOKEN / CRON_SECRET).
#   3. Installs the systemd unit and the app.ypnus.com Apache vhost.
#   4. Installs the latest GitHub release with scripts/aws-install-release.sh.
#   5. Installs the ops layer (backups, follow-ups) and the ypnus.com front door.
#   6. Installs a 5-minute timer that issues the Let's Encrypt certificates on
#      its own as soon as app.ypnus.com / ypnus.com DNS points at this server.
#
# Before DNS moves, http://<server-ip>/api/health answers from the app.
# Idempotent: safe to re-run (sudo bash new-server.sh).
set -euo pipefail
exec > >(tee -a /var/log/ypnusa-bootstrap.log) 2>&1
echo "=== ypnusa bootstrap start $(date -u +%FT%TZ)"

REPO_RAW="https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/main"
WP_ORIGIN_IP="${WP_ORIGIN_IP:-82.29.85.227}"   # Hostinger WordPress (ypnus.com A record on 2026-11-06)
NODE_VERSION="v20.18.0"
NODE_SHA_X64="4543670b589593f8fa5f106111fd5139081da42bb165a9239f05195e405f240a"
NODE_SHA_ARM64="a9ce85675ba33f00527f6234d90000946c0936fb4fca605f1891bb5f4fe6fb0a"

# ---------------------------------------------------------------- packages
dnf install -y httpd mod_ssl bind-utils tar xz openssl jq python3 python3-pip
if ! dnf install -y certbot; then
  echo "certbot not in dnf; installing it in a venv"
  python3 -m venv /opt/certbot
  /opt/certbot/bin/pip install --quiet --upgrade pip certbot
  ln -sf /opt/certbot/bin/certbot /usr/local/bin/certbot
fi
CERTBOT="$(command -v certbot)"

# ---------------------------------------------------------------- swap (t3.micro has 1 GB RAM)
if ! swapon --show | grep -q /swapfile; then
  fallocate -l 1G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  grep -q '^/swapfile' /etc/fstab || echo '/swapfile none swap defaults 0 0' >> /etc/fstab
fi

# ---------------------------------------------------------------- node
case "$(uname -m)" in
  x86_64) NARCH=x64; NSHA="$NODE_SHA_X64" ;;
  aarch64) NARCH=arm64; NSHA="$NODE_SHA_ARM64" ;;
  *) echo "unsupported arch $(uname -m)"; exit 1 ;;
esac
if [ "$(/opt/node/bin/node -v 2>/dev/null || true)" != "$NODE_VERSION" ]; then
  tmp="$(mktemp -d)"
  curl -fsSL --retry 3 -o "$tmp/node.tar.xz" "https://nodejs.org/dist/$NODE_VERSION/node-$NODE_VERSION-linux-$NARCH.tar.xz"
  echo "$NSHA  $tmp/node.tar.xz" | sha256sum -c -
  rm -rf /opt/node && mkdir -p /opt/node
  tar -xJf "$tmp/node.tar.xz" -C /opt/node --strip-components=1
  rm -rf "$tmp"
fi
ln -sf /opt/node/bin/node /usr/local/bin/node
ln -sf /opt/node/bin/npm /usr/local/bin/npm

# ---------------------------------------------------------------- user, dirs, env
id ypnusa >/dev/null 2>&1 || useradd --system --home-dir /opt/ypnusa --shell /sbin/nologin ypnusa
install -d -o root -g root -m 755 /opt/ypnusa /opt/ypnusa/releases
install -d -o ypnusa -g ypnusa -m 750 /var/lib/ypnusa
install -d -o root -g root -m 755 /etc/ypnusa
if [ ! -f /etc/ypnusa/app.env ]; then
  umask 077
  cat > /etc/ypnusa/app.env <<EOF
NODE_ENV=production
PORT=3000
HOSTNAME=127.0.0.1
LOANPILOT_DATA_DIR=/var/lib/ypnusa
SESSION_SECRET=$(openssl rand -hex 32)
ADMIN_TOKEN=$(openssl rand -hex 24)
CRON_SECRET=$(openssl rand -hex 24)
# Add by hand later (never commit values): ANTHROPIC_API_KEY, YPNUS_SSO_SHARED_SECRET
EOF
  umask 022
fi
chmod 600 /etc/ypnusa/app.env

# ---------------------------------------------------------------- systemd unit
cat > /etc/systemd/system/ypnusa.service <<'EOF'
[Unit]
Description=YPN USA Next.js app (app.ypnus.com + ypnus.com)
After=network-online.target
Wants=network-online.target

[Service]
User=ypnusa
Group=ypnusa
WorkingDirectory=/opt/ypnusa/current
EnvironmentFile=/etc/ypnusa/app.env
ExecStart=/opt/node/bin/node server.js
Restart=always
RestartSec=3
NoNewPrivileges=true
ProtectSystem=strict
ProtectHome=true
PrivateTmp=true
ReadWritePaths=/var/lib/ypnusa /opt/ypnusa/current/.next/cache

[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable ypnusa.service

# ---------------------------------------------------------------- Apache: app.ypnus.com vhost
install -d /var/www/letsencrypt/.well-known/acme-challenge
cat > /usr/local/sbin/ypnusa-render-app-vhost <<'EOF'
#!/bin/bash
# Render /etc/httpd/conf.d/ypnusa.conf: plain HTTP proxy until the
# app.ypnus.com certificate exists, then HTTPS + redirect.
set -euo pipefail
CONF=/etc/httpd/conf.d/ypnusa.conf
LIVE=/etc/letsencrypt/live/app.ypnus.com
ACME='    Alias /.well-known/acme-challenge/ /var/www/letsencrypt/.well-known/acme-challenge/
    <Directory "/var/www/letsencrypt/.well-known/acme-challenge/">
        Require all granted
    </Directory>'
PROXY='    ProxyPreserveHost On
    ProxyTimeout 60
    ProxyPass /.well-known/acme-challenge/ !
    ProxyPass / http://127.0.0.1:3000/
    ProxyPassReverse / http://127.0.0.1:3000/'
if [ -f "$LIVE/fullchain.pem" ]; then
  cat > "$CONF" <<V
# Rendered by ypnusa-render-app-vhost. Loads before zz-ypnus-com.conf, so it is the default vhost.
<VirtualHost *:80>
    ServerName app.ypnus.com
$ACME
    RewriteEngine On
    RewriteCond %{HTTP_HOST} ^app\.ypnus\.com$ [NC]
    RewriteCond %{REQUEST_URI} !^/\.well-known/acme-challenge/
    RewriteRule ^/?(.*)$ https://app.ypnus.com/\$1 [R=301,L]
$PROXY
</VirtualHost>
<VirtualHost *:443>
    ServerName app.ypnus.com
    SSLEngine on
    SSLCertificateFile    $LIVE/fullchain.pem
    SSLCertificateKeyFile $LIVE/privkey.pem
    RequestHeader set X-Forwarded-Proto "https"
$PROXY
    ErrorLog  /var/log/httpd/ypnusa-error.log
    CustomLog /var/log/httpd/ypnusa-access.log combined
</VirtualHost>
V
else
  cat > "$CONF" <<V
# Rendered by ypnusa-render-app-vhost (no certificate yet: HTTP only).
<VirtualHost *:80>
    ServerName app.ypnus.com
$ACME
$PROXY
    ErrorLog  /var/log/httpd/ypnusa-error.log
    CustomLog /var/log/httpd/ypnusa-access.log combined
</VirtualHost>
V
fi
apachectl configtest
EOF
chmod 755 /usr/local/sbin/ypnusa-render-app-vhost
/usr/local/sbin/ypnusa-render-app-vhost
systemctl enable --now httpd
systemctl reload httpd

# ---------------------------------------------------------------- repo tooling
TOOLS=/opt/ypnusa/tools
install -d "$TOOLS/scripts" "$TOOLS/aws/apache" "$TOOLS/aws/ops/systemd"
fetch() { curl -fsSL --retry 3 -o "$TOOLS/$1" "$REPO_RAW/$1"; }
fetch scripts/aws-install-release.sh
for f in install-front-door.sh issue-cert.sh zz-ypnus-com.conf.tmpl; do fetch "aws/apache/$f"; done
for f in install-ops.sh ypnusa-backup.sh ypnusa-restore.sh ypnusa-followups.sh ypnusa-preflight.sh; do fetch "aws/ops/$f"; done
for f in ypnusa-backup.service ypnusa-backup.timer ypnusa-followups.service ypnusa-followups.timer; do fetch "aws/ops/systemd/$f"; done

# ---------------------------------------------------------------- app release
# First install: no store.json yet, so skip the pre-deploy backup (nothing to back up).
YPNUSA_SKIP_BACKUP=1 bash "$TOOLS/scripts/aws-install-release.sh"

# ---------------------------------------------------------------- ops layer + front door
bash "$TOOLS/aws/ops/install-ops.sh" || echo "WARNING: install-ops.sh failed (backups/follow-ups); site still serves"
bash "$TOOLS/aws/apache/install-front-door.sh" "$WP_ORIGIN_IP"

# ---------------------------------------------------------------- automatic certificates
"$CERTBOT" register --register-unsafely-without-email --agree-tos --non-interactive >/dev/null 2>&1 || true
cat > /usr/local/sbin/ypnusa-cert-check <<EOF
#!/bin/bash
# Issue Let's Encrypt certificates once DNS points here. Runs every 5 minutes.
set -u
WP_ORIGIN_IP="$WP_ORIGIN_IP"
TOOLS="$TOOLS"
CERTBOT="$CERTBOT"
EOF
cat >> /usr/local/sbin/ypnusa-cert-check <<'EOF'
STATE=/var/lib/ypnusa-cert; mkdir -p "$STATE"
tok="$(curl -fsS -m 3 -X PUT http://169.254.169.254/latest/api/token -H 'X-aws-ec2-metadata-token-ttl-seconds: 60')"
ME="$(curl -fsS -m 3 -H "X-aws-ec2-metadata-token: $tok" http://169.254.169.254/latest/meta-data/public-ipv4)"
[ -n "$ME" ] || exit 0
here() { dig +short @1.1.1.1 "$1" A | grep -qx "$ME"; }
recent_fail() { [ -f "$STATE/$1.fail" ] && [ $(( $(date +%s) - $(stat -c %Y "$STATE/$1.fail") )) -lt 1800 ]; }

if [ ! -f /etc/letsencrypt/live/app.ypnus.com/fullchain.pem ] && here app.ypnus.com && ! recent_fail app; then
  if "$CERTBOT" certonly --webroot -w /var/www/letsencrypt -d app.ypnus.com --non-interactive --agree-tos --keep-until-expiring; then
    /usr/local/sbin/ypnusa-render-app-vhost && systemctl reload httpd && echo "app.ypnus.com certificate issued"
  else touch "$STATE/app.fail"; fi
fi
if [ ! -f /etc/letsencrypt/live/ypnus.com/fullchain.pem ] && here ypnus.com && here www.ypnus.com && ! recent_fail apex; then
  bash "$TOOLS/aws/apache/issue-cert.sh" "$WP_ORIGIN_IP" && echo "ypnus.com certificate issued" || touch "$STATE/apex.fail"
fi
EOF
chmod 755 /usr/local/sbin/ypnusa-cert-check
cat > /etc/systemd/system/ypnusa-cert-check.service <<'EOF'
[Unit]
Description=YPN USA: issue certificates once DNS points here
[Service]
Type=oneshot
ExecStart=/usr/local/sbin/ypnusa-cert-check
EOF
cat > /etc/systemd/system/ypnusa-cert-check.timer <<'EOF'
[Unit]
Description=YPN USA certificate check every 5 minutes
[Timer]
OnBootSec=2min
OnUnitActiveSec=5min
[Install]
WantedBy=timers.target
EOF
cat > /etc/systemd/system/ypnusa-cert-renew.service <<EOF
[Unit]
Description=YPN USA certificate renewal
[Service]
Type=oneshot
ExecStart=$CERTBOT renew --quiet --deploy-hook "systemctl reload httpd"
EOF
cat > /etc/systemd/system/ypnusa-cert-renew.timer <<'EOF'
[Unit]
Description=YPN USA certificate renewal, twice daily
[Timer]
OnCalendar=*-*-* 03,15:17:00
RandomizedDelaySec=1h
Persistent=true
[Install]
WantedBy=timers.target
EOF
systemctl daemon-reload
systemctl enable --now ypnusa-cert-check.timer ypnusa-cert-renew.timer

echo "=== Health:"
curl -fsS --max-time 8 http://127.0.0.1:3000/api/health || true
echo
echo "=== ypnusa bootstrap DONE $(date -u +%FT%TZ)"
