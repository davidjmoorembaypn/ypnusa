#!/usr/bin/env bash
# Run on the CURRENT WordPress host (Hostinger) from the WordPress root. Read-only against the site.
# Produces ~/ypnus-wp-export/{db.sql.gz,wp-content.tar.gz,SHA256SUMS}. Contains PII: never commit it.
set -euo pipefail
[ -f wp-config.php ] || { echo "Run from the WordPress root"; exit 1; }
command -v wp >/dev/null || { echo "wp-cli not found"; exit 1; }

OUT="${HOME}/ypnus-wp-export"
mkdir -p "${OUT}"
wp db export - | gzip -9 > "${OUT}/db.sql.gz"
tar czf "${OUT}/wp-content.tar.gz" \
  --exclude='wp-content/cache' --exclude='wp-content/litespeed' \
  --exclude='wp-content/upgrade' --exclude='wp-content/backups' \
  --exclude='wp-content/updraft' --exclude='wp-content/ai1wm-backups' \
  wp-content
( cd "${OUT}" && sha256sum db.sql.gz wp-content.tar.gz > SHA256SUMS )
wp option get siteurl > "${OUT}/siteurl.txt"
echo "Export ready in ${OUT}. Copy it to the Lightsail instance, then run wp-import-target.sh there."
