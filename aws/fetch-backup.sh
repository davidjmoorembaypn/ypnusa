#!/usr/bin/env bash
# Run ON the EC2 instance. Pulls the Hostinger backup links straight onto the server (they expire 7 days after the email),
# finds the WordPress database among the many DB dumps, and builds the two inputs migrate-wordpress.sh expects.
# Usage: put one URL per line in /root/restore/urls.txt  (website-files link FIRST, then every database link), then:
#   sudo bash aws/fetch-backup.sh
set -euo pipefail
R=/root/restore; mkdir -p "$R/raw" "$R/site"; cd "$R"
[ -s urls.txt ] || { echo "create $R/urls.txt first"; exit 1; }

i=0
while read -r url; do
  [ -z "$url" ] && continue; i=$((i+1))
  curl -fL --retry 3 -J -O --output-dir raw "$url" || { echo "FAILED link $i (expired?)"; continue; }
done < urls.txt
ls -lh raw

# Unpack everything we can; Hostinger ships .zip / .tar.gz / .gz / .sql
cd raw
for f in *; do
  case "$f" in
    *.zip) unzip -oq "$f" -d "../site/${f%.zip}" ;;
    *.tar.gz|*.tgz) mkdir -p "../site/${f%.tar.gz}"; tar -xzf "$f" -C "../site/${f%.tar.gz}" ;;
    *.sql.gz|*.gz) gunzip -kf "$f" ;;
  esac
done
cd "$R"

# 1) wp-content -> wp-content.tar.gz
WPC=$(find site -type d -name wp-content -path '*ypnus*' -o -type d -name wp-content | head -1)
[ -n "$WPC" ] || { echo "no wp-content found in website files"; exit 1; }
echo "wp-content: $WPC ($(du -sh "$WPC" | cut -f1))"
tar -czf wp-content.tar.gz -C "$(dirname "$WPC")" wp-content

# 2) pick the WordPress DB: the dump containing a *_options table with siteurl=ypnus.com
echo "--- candidate databases"
for s in $(find raw site -name '*.sql' -o -name '*.sql.gz' 2>/dev/null); do
  c=$( (zcat -f "$s" 2>/dev/null || cat "$s") | grep -m1 -o "https\?://[a-z.]*ypnus.com" || true)
  t=$( (zcat -f "$s" 2>/dev/null || cat "$s") | grep -c "CREATE TABLE .*_options" || true)
  printf '%-60s options_tables=%s siteurl=%s size=%s\n' "$s" "$t" "${c:-none}" "$(du -h "$s" | cut -f1)"
done
echo
echo "Pick the one with options_tables>=1 and siteurl=ypnus.com, then:"
echo "  gzip -c <that.sql> > $R/db.sql.gz   (or: cp <that.sql.gz> $R/db.sql.gz)"
echo "  bash aws/migrate-wordpress.sh restore"
