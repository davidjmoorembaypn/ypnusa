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
#
# Exit codes: 0 = new build live (or already live), 1 = failed before anything was
# switched, 3 = the new build was switched in, failed, and the previous build was
# put back ("rolling back" is also printed), 4 = it failed AND the rollback failed
# too (the site may be down: check `systemctl status ypnusa`).
#
# YPNUSA_ABORT_IF_FILE (set by the auto-updater to its pause file): if that file
# exists once this install holds the deploy lock, or right before the switch, the
# install stops with nothing switched. So `ypnusa-auto-update pause` also stops an
# auto-install that is already downloading or backing up.
#
# The YPNUSA_INSTALL_* variables exist only so the test suite can run this script
# against a temporary directory; production uses the defaults.
set -Eeuo pipefail

REPO="davidjmoorembaypn/ypnusa"
BASE="${YPNUSA_INSTALL_BASE:-/opt/ypnusa}"
SERVICE=ypnusa.service
HEALTH_URL="${YPNUSA_INSTALL_HEALTH_URL:-http://127.0.0.1:3000/api/health}"
APP_URL="${YPNUSA_INSTALL_APP_URL:-http://127.0.0.1:3000}"
BACKUP_TOOL="${YPNUSA_INSTALL_BACKUP_TOOL:-/usr/local/sbin/ypnusa-backup}"
LOCK_DIR="${YPNUSA_INSTALL_LOCK_DIR:-/run/lock}"
VERIFY_TRIES="${YPNUSA_INSTALL_VERIFY_TRIES:-15}"
ABORT_FILE="${YPNUSA_ABORT_IF_FILE:-}"
TAG="${1:-}"

# Stop before any switch when the auto-updater was paused mid-run.
stop_if_paused() {
  if [ -n "$ABORT_FILE" ] && [ -e "$ABORT_FILE" ]; then
    echo "=== Auto-update was paused ($ABORT_FILE); stopping before any change. Nothing was switched."
    exit 1
  fi
}

# One install at a time: a hand install and the auto-updater (scripts/aws-auto-update.sh)
# must never switch releases at the same moment.
mkdir -p "$LOCK_DIR"
exec 8>"$LOCK_DIR/ypnusa-deploy.lock"
if ! flock -w 900 8; then
  echo "ERROR: another install is still running; nothing was changed. Try again in a few minutes." >&2
  exit 1
fi
stop_if_paused

if [ -n "${YPNUS_BUILD_URL:-}" ]; then
  url="$YPNUS_BUILD_URL"
elif [ -n "$TAG" ]; then
  url="https://github.com/$REPO/releases/download/$TAG"
else
  url="https://github.com/$REPO/releases/latest/download"
fi

mkdir -p /var/tmp && work="$(mktemp -d /var/tmp/ypnusa-deploy-XXXXXX)"
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

# Customer data comes first: snapshot the store before touching anything. A failed
# backup aborts the deploy (set YPNUSA_SKIP_BACKUP=1 only for a deliberate override).
if [ -x "$BACKUP_TOOL" ]; then
  echo "=== Pre-deploy data backup"
  if ! "$BACKUP_TOOL" pre-deploy; then
    if [ "${YPNUSA_SKIP_BACKUP:-0}" = "1" ]; then
      echo "WARNING: backup failed; continuing because YPNUSA_SKIP_BACKUP=1" >&2
    else
      echo "ERROR: pre-deploy backup failed; aborting before any change." >&2
      exit 1
    fi
  fi
else
  echo "WARNING: $BACKUP_TOOL is not installed (run aws/ops/install-ops.sh); deploying without a pre-deploy backup." >&2
fi

prev="$(readlink -f "$BASE/current" 2>/dev/null || true)"
dest="$BASE/releases/$commit"

# Never delete the release that is serving traffic (it is also the rollback target).
if [ "$prev" = "$dest" ]; then
  echo "=== Release $commit is already live; nothing to do."
  exit 0
fi

echo "=== Installing to $dest"
rm -rf "$dest"
mkdir -p "$dest"
cp -a nodejs/. "$dest/"
chown -R ypnusa:ypnusa "$dest"
mkdir -p "$dest/.next/cache"
chown ypnusa:ypnusa "$dest/.next/cache"

# The systemd unit's ReadWritePaths covers /opt/ypnusa/releases (every release),
# because Next.js writes its prerender/route cache under .next/server as well as
# .next/cache. No unit-file edit is needed per release. If you ever see
# ReadWritePaths hardcoded to a specific release dir again, re-generalize it.

switch_to() {
  ln -sfn "$1" "$BASE/current.tmp"
  mv -Tf "$BASE/current.tmp" "$BASE/current"
}

# A deploy only counts as good when the NEW commit is serving AND its storage is
# durable AND the main public pages render. Anything less rolls back.
verify() {
  local body path code
  for _ in $(seq 1 "$VERIFY_TRIES"); do
    body="$(curl -fsS --max-time 8 "$HEALTH_URL" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -q "\"commit\":\"$commit\"" \
      && printf '%s' "$body" | grep -q '"persistent":true' \
      && printf '%s' "$body" | grep -q '"degraded":false'; then
      for path in / /pricing /sitemap.xml; do
        code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$APP_URL$path" || true)"
        if [ "$code" != "200" ]; then
          echo "smoke check failed: $path returned HTTP $code" >&2
          return 1
        fi
      done
      echo "$body"
      return 0
    fi
    sleep 2
  done
  echo "health check never showed commit=$commit with persistent, non-degraded storage; last response: ${body:-<none>}" >&2
  return 1
}

# Put the previous build back after the new one was switched in and failed. Exits 3
# when the old build is serving again, 4 when even that failed.
roll_back() {
  trap - ERR
  set +e
  echo "ERROR: release $commit $1; rolling back to ${prev:-<none>}" >&2
  if [ -z "$prev" ]; then
    echo "ROLLBACK FAILED: there is no previous build to go back to." >&2
    exit 4
  fi
  switch_to "$prev"
  if ! systemctl restart "$SERVICE"; then
    echo "ROLLBACK FAILED: $SERVICE did not restart on the previous build $(basename "$prev")." >&2
    exit 4
  fi
  local body=""
  for _ in $(seq 1 "$VERIFY_TRIES"); do
    body="$(curl -fsS --max-time 8 "$HEALTH_URL" 2>/dev/null || true)"
    if printf '%s' "$body" | grep -q "\"commit\":\"$(basename "$prev")\""; then
      echo "$body"
      echo "=== ROLLED BACK: previous build $(basename "$prev") is live again; $commit was not kept."
      exit 3
    fi
    sleep 2
  done
  echo "ROLLBACK FAILED: the previous build $(basename "$prev") did not answer its health check; last response: ${body:-<none>}" >&2
  exit 4
}

stop_if_paused

echo "=== Switch current: ${prev:-<none>} -> $dest"
switch_to "$dest"
# From here on, any unexpected failure puts the previous build back.
trap 'roll_back "hit an error after the switch"' ERR

echo "=== Restart $SERVICE"
if ! systemctl restart "$SERVICE"; then
  roll_back "did not start ($SERVICE restart failed)"
fi

echo "=== Verify $HEALTH_URL reports commit=$commit (healthy storage + smoke pages)"
if verify; then
  echo "=== DEPLOY OK: live build $commit"
else
  roll_back "failed verification"
fi
trap - ERR

# Tell IndexNow about the pages of the build that is now live. This can never change the deploy
# result: it runs only after verification passed, and any failure here is just a warning.
# YPNUSA_SKIP_INDEXNOW=1 turns it off; YPNUSA_INSTALL_INDEXNOW lets the tests point at a stub.
indexnow="${YPNUSA_INSTALL_INDEXNOW:-$dest/scripts/ping-indexnow.mjs}"
if [ "${YPNUSA_SKIP_INDEXNOW:-0}" != "1" ] && [ -f "$indexnow" ]; then
  echo "=== IndexNow ping (never fails the deploy)"
  node_bin="$(command -v node || true)"
  if [ -z "$node_bin" ] && [ -x /opt/node/bin/node ]; then node_bin=/opt/node/bin/node; fi
  if [ -n "$node_bin" ] && timeout 120 "$node_bin" "$indexnow"; then
    :
  else
    echo "WARNING: the IndexNow ping failed or node was not found; the deploy itself is fine. Run 'node $indexnow' by hand to retry." >&2
  fi
fi

echo "=== Prune old releases (keep the 5 newest, skip the live one)"
cd "$BASE/releases"
ls -1dt */ 2>/dev/null | sed 's#/$##' | tail -n +6 | while read -r d; do
  [ "$d" = "$commit" ] || rm -rf "$d"
done

echo "=== DONE: live commit $commit"
