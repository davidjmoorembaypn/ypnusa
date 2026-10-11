#!/usr/bin/env bash
# EC2 user-data: Nginx + PHP 8.3-FPM + MariaDB + Redis + certbot + WP-CLI. Idempotent enough to re-run.
exec > >(tee -a /var/log/ypnus-bootstrap.log) 2>&1
set -euxo pipefail
export DEBIAN_FRONTEND=noninteractive
DOMAIN="ypnus.com"

apt-get update -y
apt-get install -y nginx mariadb-server redis-server certbot python3-certbot-nginx rsync unzip curl fail2ban unattended-upgrades \
  php8.3-fpm php8.3-mysql php8.3-curl php8.3-gd php8.3-mbstring php8.3-xml php8.3-zip php8.3-intl php8.3-imagick php8.3-redis php8.3-bcmath php8.3-opcache
curl -fsSL https://raw.githubusercontent.com/wp-cli/builds/gh-pages/phar/wp-cli.phar -o /usr/local/bin/wp && chmod +x /usr/local/bin/wp

# PHP tuning
cat >/etc/php/8.3/fpm/conf.d/99-ypnus.ini <<PHP
memory_limit=512M
upload_max_filesize=128M
post_max_size=128M
max_execution_time=120
opcache.enable=1
opcache.memory_consumption=192
opcache.max_accelerated_files=20000
opcache.validate_timestamps=0
PHP
sed -i 's/^;*pm.max_children.*/pm.max_children = 20/' /etc/php/8.3/fpm/pool.d/www.conf

# Redis: local only
sed -i 's/^# *maxmemory .*/maxmemory 256mb/; s/^# *maxmemory-policy .*/maxmemory-policy allkeys-lru/' /etc/redis/redis.conf
systemctl enable --now redis-server

# Database (socket auth only, no remote)
systemctl enable --now mariadb
DBPASS_FILE=/root/.ypnus-db-pass
if [ ! -f "$DBPASS_FILE" ]; then openssl rand -base64 24 | tr -d '/+=' >"$DBPASS_FILE"; chmod 600 "$DBPASS_FILE"; fi
mysql -e "CREATE DATABASE IF NOT EXISTS ypnus_wp CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_520_ci;
          CREATE USER IF NOT EXISTS 'ypnus_wp'@'127.0.0.1' IDENTIFIED BY '$(cat $DBPASS_FILE)';
          GRANT ALL ON ypnus_wp.* TO 'ypnus_wp'@'127.0.0.1'; FLUSH PRIVILEGES;"

# Nginx vhost with FastCGI page cache (replaces LiteSpeed page cache)
mkdir -p /var/www/$DOMAIN /var/cache/nginx/wp && chown -R www-data:www-data /var/www/$DOMAIN /var/cache/nginx/wp
cat >/etc/nginx/conf.d/00-wpcache.conf <<'NG'
fastcgi_cache_path /var/cache/nginx/wp levels=1:2 keys_zone=WP:100m inactive=60m max_size=1g;
fastcgi_cache_key "$scheme$request_method$host$request_uri";
limit_req_zone $binary_remote_addr zone=wplogin:10m rate=5r/m;
NG
cat >/etc/nginx/sites-available/$DOMAIN <<NG
server {
  listen 80; listen [::]:80;
  server_name $DOMAIN www.$DOMAIN;
  root /var/www/$DOMAIN;
  index index.php index.html;
  client_max_body_size 128m;
  server_tokens off;

  set \$skip 0;
  if (\$request_method = POST) { set \$skip 1; }
  if (\$query_string != "") { set \$skip 1; }
  if (\$request_uri ~* "/wp-admin/|/wp-json/|/wp-login.php|/xmlrpc.php|wp-.*\\.php|/feed/|sitemap(_index)?\\.xml|/cart|/checkout|/my-account") { set \$skip 1; }
  if (\$http_cookie ~* "comment_author|wordpress_[a-f0-9]+|wp-postpass|wordpress_logged_in") { set \$skip 1; }

  location / { try_files \$uri \$uri/ /index.php?\$args; }
  location = /wp-login.php { limit_req zone=wplogin burst=5 nodelay; include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.3-fpm.sock; }
  location ~ \\.php\$ {
    include snippets/fastcgi-php.conf; fastcgi_pass unix:/run/php/php8.3-fpm.sock;
    fastcgi_cache WP; fastcgi_cache_valid 200 301 302 10m; fastcgi_cache_bypass \$skip; fastcgi_no_cache \$skip;
    add_header X-Cache \$upstream_cache_status;
  }
  location = /xmlrpc.php { return 444; }
  location ~* /(?:uploads|files)/.*\\.php\$ { deny all; }
  location ~ /\\.(?!well-known) { deny all; }
  location ~* \\.(?:css|js|woff2?|ttf|svg|png|jpe?g|gif|webp|avif|ico)\$ { expires 365d; add_header Cache-Control "public, immutable"; access_log off; }
  gzip on; gzip_types text/css application/javascript application/json image/svg+xml text/xml;
}
NG
ln -sf /etc/nginx/sites-available/$DOMAIN /etc/nginx/sites-enabled/$DOMAIN; rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx
systemctl enable --now php8.3-fpm fail2ban unattended-upgrades

# Daily DB dump to local disk (EBS snapshots cover the rest)
cat >/etc/cron.daily/ypnus-dbdump <<'CR'
#!/bin/sh
mkdir -p /var/backups/ypnus && mysqldump --single-transaction ypnus_wp | gzip >/var/backups/ypnus/ypnus_wp-$(date +%F).sql.gz
find /var/backups/ypnus -mtime +7 -delete
CR
chmod +x /etc/cron.daily/ypnus-dbdump
echo "BOOTSTRAP DONE $(date)"
