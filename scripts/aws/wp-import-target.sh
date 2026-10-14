#!/usr/bin/env bash
# Run ON the Lightsail (Bitnami) instance after copying ~/ypnus-wp-export/ to it.
# Imports into a staging copy. Public DNS is not touched.
# Usage: STAGING_URL=http://<static-ip> bash wp-import-target.sh
set -euo pipefail
: "${STAGING_URL:?Set STAGING_URL, e.g. http://203.0.113.10}"
SRC="${HOME}/ypnus-wp-export"
WP=/opt/bitnami/wordpress
WPCLI="sudo -u daemon /opt/bitnami/wp-cli/bin/wp --path=${WP}"

( cd "${SRC}" && sha256sum -c SHA256SUMS )
OLD_URL="$(cat "${SRC}/siteurl.txt")"

sudo /opt/bitnami/ctlscript.sh stop apache >/dev/null
sudo tar xzf "${SRC}/wp-content.tar.gz" -C "${WP}" --strip-components=0
sudo chown -R daemon:daemon "${WP}/wp-content"
gunzip -c "${SRC}/db.sql.gz" | ${WPCLI} db import -
${WPCLI} search-replace "${OLD_URL}" "${STAGING_URL}" --all-tables --skip-columns=guid
# Hostinger/LiteSpeed-only pieces cannot run on Apache; deactivate so the site boots cleanly.
${WPCLI} plugin deactivate litespeed-cache hostinger-ai-assistant 2>/dev/null || true
${WPCLI} cache flush
${WPCLI} rewrite flush
sudo /opt/bitnami/ctlscript.sh start apache >/dev/null
echo "Staging ready at ${STAGING_URL}. Review it, then follow docs/AWS_MIGRATION.md (cutover)."
