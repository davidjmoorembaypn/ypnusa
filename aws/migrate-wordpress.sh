#!/usr/bin/env bash
# Run ON the EC2 instance after bootstrap. Two modes:
#   restore  : backup DB + wp-content present  -> exact copy of the old site
#   rebuild  : no backup                       -> fresh WP + repo plugins; content re-imported from REST export
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"; source "$DIR/config.env"
MODE="${1:-}"; [ "$MODE" = restore ] || [ "$MODE" = rebuild ] || { echo "usage: $0 restore|rebuild"; exit 1; }
WEB=/var/www/$DOMAIN; DBPASS=$(sudo cat /root/.ypnus-db-pass)
WP="sudo -u www-data wp --path=$WEB"

if [ "$MODE" = restore ]; then
  [ -f "$BACKUP_DB" ] && [ -f "$BACKUP_CONTENT" ] || { echo "missing $BACKUP_DB or $BACKUP_CONTENT"; exit 1; }
  sudo -u www-data wp core download --path=$WEB --skip-content --force
  sudo tar -xzf "$BACKUP_CONTENT" -C $WEB          # must contain wp-content/
else
  sudo -u www-data wp core download --path=$WEB --force
fi

[ -f $WEB/wp-config.php ] || sudo -u www-data wp config create --path=$WEB --dbname=ypnus_wp --dbuser=ypnus_wp --dbpass="$DBPASS" --dbhost=127.0.0.1 --extra-php <<'PHP'
define('WP_REDIS_HOST','127.0.0.1');
define('DISALLOW_FILE_EDIT', true);
define('WP_AUTO_UPDATE_CORE','minor');
if (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https') { $_SERVER['HTTPS']='on'; }
PHP

if [ "$MODE" = restore ]; then
  zcat "$BACKUP_DB" | sudo mysql ypnus_wp
  # old table prefix may differ
  PFX=$(sudo mysql -N ypnus_wp -e "SHOW TABLES LIKE '%_options'" | sed 's/options$//' | head -1)
  sudo -u www-data wp config set table_prefix "${PFX:-wp_}" --path=$WEB --type=variable
  OLD=$($WP option get siteurl); echo "old siteurl: $OLD"
  $WP search-replace "$OLD" "https://$DOMAIN" --all-tables --skip-columns=guid
else
  $WP core install --url="https://$DOMAIN" --title="YPN USA" --admin_user=ypnadmin --admin_email="$LE_EMAIL" --prompt=admin_password
  $WP rewrite structure '/%postname%/' --hard
  $WP plugin install seo-by-rank-math redis-cache --activate
fi

# Repo code: mu-plugins and custom plugins always come from git, never from the backup
sudo mkdir -p $WEB/wp-content/mu-plugins $WEB/wp-content/plugins
sudo rsync -a "$REPO_DIR/wp-mu-plugins/" $WEB/wp-content/mu-plugins/ --exclude README.md
for p in ypnus-seo-hygiene ypnus-stripe-webhook ypnus-trust-and-schema; do sudo rsync -a --delete "$REPO_DIR/wp-plugins/$p/" $WEB/wp-content/plugins/$p/; done
$WP plugin activate ypnus-seo-hygiene ypnus-stripe-webhook ypnus-trust-and-schema || true
# LiteSpeed Cache needs a LiteSpeed server; page caching is Nginx FastCGI on this host
$WP plugin deactivate litespeed-cache 2>/dev/null || true
$WP plugin install redis-cache --activate 2>/dev/null || true; $WP redis enable || true

sudo chown -R www-data:www-data $WEB
sudo find $WEB -type d -exec chmod 755 {} \; ; sudo find $WEB -type f -exec chmod 644 {} \;
sudo chmod 640 $WEB/wp-config.php
$WP cache flush; $WP rewrite flush --hard
echo "DONE. Add the Stripe secret + tier maps to $WEB/wp-config.php yourself (see wp-plugins/ypnus-stripe-webhook/README.md)."
