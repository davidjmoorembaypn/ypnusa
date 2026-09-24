#!/usr/bin/env bash
# Install a GitHub release build of the app (see .github/workflows/release-build.yml)
# into Hostinger's LiteSpeed Node slot, recycle the worker, verify, and roll back
# automatically if the new build doesn't come up. Run on the server:
#   bash hostinger-install-release.sh                    # latest release
#   bash hostinger-install-release.sh app-build-abc1234  # a specific build
# YPNUS_BUILD_URL overrides the source directory (it must hold app-build.tar.gz
# and app-build.tar.gz.sha256), e.g. the deploy/app-build branch's raw URL.
set -euo pipefail

REPO="davidjmoorembaypn/ypnusa"
BASE="${YPNUS_APP_BASE:-${HOME:-/home/u853154979}/domains/ypnus.com/app/hbuilds}"
NODE="/opt/alt/alt-nodejs20/root/usr/bin/node"
HEALTH_URL="https://app.ypnus.com/api/health"
TAG="${1:-}"

if [ -n "${YPNUS_BUILD_URL:-}" ]; then
  url="$YPNUS_BUILD_URL"
elif [ -n "$TAG" ]; then
  url="https://github.com/$REPO/releases/download/$TAG"
else
  url="https://github.com/$REPO/releases/latest/download"
fi

ts="$(date -u +%Y%m%d-%H%M%S)"
work="$BASE/incoming-$ts"
mkdir -p "$work"
trap 'rm -rf "$work"' EXIT
cd "$work"

echo "=== Download $url"
curl -fsSL --retry 3 -o app-build.tar.gz "$url/app-build.tar.gz"
curl -fsSL --retry 3 -o app-build.tar.gz.sha256 "$url/app-build.tar.gz.sha256"
sha256sum -c app-build.tar.gz.sha256
tar -xzf app-build.tar.gz

commit="$(sed -n 's/.*"git_commit":"\([0-9a-f]\{7\}\).*/\1/p' nodejs/DEPLOY_MANIFEST.json)"
[ -n "$commit" ] || { echo "ERROR: DEPLOY_MANIFEST.json has no git_commit" >&2; exit 1; }
[ -f nodejs/server.js ] || { echo "ERROR: bundle has no server.js" >&2; exit 1; }

prev="$(readlink "$BASE/current" || true)"
prev_dir="$BASE/$prev/nodejs"
version="versions/build-$ts-$commit"
dest="$BASE/$version"
mkdir -p "$dest"
mv nodejs "$dest/nodejs"
mkdir -p "$dest/nodejs/tmp"

echo "=== Carry the startup preamble (data dir + app/.env loader) forward from $prev"
"$NODE" - "$prev_dir/server.js" "$dest/nodejs/server.js" <<'JS'
const fs = require("fs");
const [prevPath, nextPath] = process.argv.slice(2);
const anchor = "process.chdir(__dirname)";
const end = "const currentPort";
const prev = fs.readFileSync(prevPath, "utf8");
const next = fs.readFileSync(nextPath, "utf8");
if (next.includes("YPN-ENV-LOADER")) process.exit(0);
const a = prev.indexOf(anchor);
const b = prev.indexOf(end);
const na = next.indexOf(anchor);
const nb = next.indexOf(end);
if (!prev.includes("YPN-ENV-LOADER") || a < 0 || b < a || na < 0 || nb < na) {
  console.error("ERROR: cannot carry the YPN-ENV-LOADER preamble into the new server.js");
  process.exit(1);
}
fs.writeFileSync(nextPath, next.slice(0, na + anchor.length) + prev.slice(a + anchor.length, b) + next.slice(nb));
JS

# Keep the previous build's hashed chunks so HTML still cached at the CDN edge keeps loading.
if [ -d "$prev_dir/.next/static" ]; then
  cp -an "$prev_dir/.next/static/." "$dest/nodejs/.next/static/"
fi

switch_to() {
  ln -sfn "$1" "$BASE/current.next"
  mv -Tf "$BASE/current.next" "$BASE/current"
}

# LiteSpeed's Node integration ignores restart.txt for this app; killing the worker
# (found by its LSNODE_SOCKET) makes it respawn from the new `current` target.
recycle() {
  touch "$BASE/current/nodejs/tmp/restart.txt"
  for pid in $(pgrep -f next-server 2>/dev/null || true); do
    sock="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null | grep '^LSNODE_SOCKET=' | cut -d= -f2- || true)"
    if [[ "$sock" == *app.ypnus.com* ]]; then
      echo "Recycling worker $pid"
      kill -15 "$pid" 2>/dev/null || true
      sleep 2
      if kill -0 "$pid" 2>/dev/null; then kill -9 "$pid" 2>/dev/null || true; fi
    fi
  done
}

verify() {
  local body
  for _ in $(seq 1 15); do
    body="$(curl -fsS --max-time 10 "$HEALTH_URL" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -q "\"commit\":\"$commit"; then return 0; fi
    sleep 3
  done
  return 1
}

echo "=== Switch current: ${prev:-<none>} -> $version"
switch_to "$version"
recycle

if verify; then
  echo "=== Verified: $HEALTH_URL is serving $commit"
else
  echo "ERROR: $HEALTH_URL is not serving $commit; rolling back to ${prev:-<none>}" >&2
  if [ -n "$prev" ]; then
    switch_to "$prev"
    recycle
  fi
  exit 1
fi

echo "=== Prune old builds (keep the 3 newest, the live one and the previous one)"
cd "$BASE/versions"
ls -1dt build-* 2>/dev/null | tail -n +4 | while read -r d; do
  if [ "versions/$d" != "$version" ] && [ "versions/$d" != "$prev" ]; then rm -rf "$d"; fi
done
echo "=== DONE: live build $commit ($version)"
