#!/usr/bin/env bash
# Install a GitHub release build of the app (see .github/workflows/release-build.yml)
# onto the production AWS host behind app.ypnus.com, and roll back automatically
# if the new build doesn't come up. Run this ON THE SERVER as root (or via
# `sudo`) — see aws/README.md for how to get a shell there (SSM Session Manager,
# no SSH key needed):
#
#   bash aws-install-release.sh                    # latest release
#   bash aws-install-release.sh app-build-abc1234   # a specific build
#
# YPNUS_BUILD_URL overrides the source directory (it must hold app-build.tar.gz
# and app-build.tar.gz.sha256), e.g. the deploy/app-build branch's raw URL, for
# when GitHub Actions can't run.
set -euo pipefail

REPO="davidjmoorembaypn/ypnusa"
BASE=/opt/ypnusa
SERVICE=ypnusa.service
HEALTH_URL="http://127.0.0.1:3000/api/health"
TAG="${1:-}"

if [ -n "${YPNUS_BUILD_URL:-}" ]; then
  url="$YPNUS_BUILD_URL"
elif [ -n "$TAG" ]; then
  url="https://github.com/$REPO/releases/download/$TAG"
else
  url="https://github.com/$REPO/releases/latest/download"
fi

work="$(mktemp -d /tmp/ypnusa-deploy-XXXXXX)"
trap 'rm -rf "$work"' EXIT
cd "$work"

echo "=== Download $url"
curl -fsSL --retry 3 -o app-build.tar.gz "$url/app-build.tar.gz"
curl -fsSL --retry 3 -o app-build.tar.gz.sha256 "$url/app-build.tar.gz.sha256"
sha256sum -c app-build.tar.gz.sha256

echo "=== Extract"
tar -xzf app-build.tar.gz
[ -f nodejs/server.js ] || { echo "ERROR: bundle has no server.js" >&2; exit 1; }

commit="$(sed -n 's/.*"git_commit":"\([0-9a-f]\{7,\}\).*/\1/p' nodejs/DEPLOY_MANIFEST.json | cut -c1-7)"
[ -n "$commit" ] || { echo "ERROR: DEPLOY_MANIFEST.json has no git_commit" >&2; exit 1; }

prev="$(readlink -f "$BASE/current" 2>/dev/null || true)"
dest="$BASE/releases/$commit"

echo "=== Installing to $dest"
rm -rf "$dest"
mkdir -p "$dest"
cp -a nodejs/. "$dest/"
chown -R ypnusa:ypnusa "$dest"
mkdir -p "$dest/.next/cache"
chown ypnusa:ypnusa "$dest/.next/cache"

# The systemd unit's ReadWritePaths points at /opt/ypnusa/current/.next/cache
# (a symlink, resolved at service start) rather than a hardcoded release sha —
# no unit-file edit needed here. If you ever see ReadWritePaths hardcoded to a
# specific release dir again, re-generalize it (see aws/README.md).

switch_to() {
  ln -sfn "$1" "$BASE/current.tmp"
  mv -Tf "$BASE/current.tmp" "$BASE/current"
}

verify() {
  local body
  for _ in $(seq 1 15); do
    body="$(curl -fsS --max-time 8 "$HEALTH_URL" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -q "\"commit\":\"$commit\""; then echo "$body"; return 0; fi
    sleep 2
  done
  return 1
}

echo "=== Switch current: ${prev:-<none>} -> $dest"
switch_to "$dest"

echo "=== Restart $SERVICE"
systemctl restart "$SERVICE"

echo "=== Verify $HEALTH_URL reports commit=$commit"
if verify; then
  echo "=== DEPLOY OK: live build $commit"
else
  echo "ERROR: $HEALTH_URL never reported commit=$commit; rolling back" >&2
  if [ -n "$prev" ]; then
    switch_to "$prev"
    systemctl restart "$SERVICE"
    sleep 3
    curl -fsS --max-time 8 "$HEALTH_URL" 2>/dev/null || true
    echo
  fi
  exit 1
fi

echo "=== Prune old releases (keep the 5 newest, skip the live one)"
cd "$BASE/releases"
ls -1dt */ 2>/dev/null | sed 's#/$##' | tail -n +6 | while read -r d; do
  [ "$d" = "$commit" ] || rm -rf "$d"
done

echo "=== DONE: live commit $commit"
