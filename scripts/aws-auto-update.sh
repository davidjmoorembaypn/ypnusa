#!/usr/bin/env bash
# Auto-install new app releases on the production AWS host.
#
# A systemd timer runs `ypnusa-auto-update run` every 10 minutes. Each run asks
# GitHub for the newest published release (app-build-<sha7>, never a draft or
# pre-release). If that build is newer than the one serving traffic, it runs
# scripts/aws-install-release.sh FROM THAT RELEASE'S TAG (never from main), so
# every auto-install gets the same data backup, health checks and automatic
# rollback as a hand install. A build that fails and rolls back is recorded and
# never retried automatically.
#
# One-time setup, ON THE SERVER as root (docs/OPERATIONS.md section 2):
#   bash aws-auto-update.sh install
#
# Day to day (all as root):
#   ypnusa-auto-update status    # paused?, live build, last result, next check
#   ypnusa-auto-update pause     # stop auto-installs (e.g. before a rollback); waits for a
#                                # run already in progress to stop or finish first
#   ypnusa-auto-update resume    # start them again
#   ypnusa-auto-update run       # check now (what the timer does)
#
# Logs: journalctl -u ypnusa-auto-update.service
#
# The YPNUSA_AU_* variables exist only so the test suite can point the script at
# a fake GitHub and a temporary directory; production uses the defaults.
set -euo pipefail

REPO="${YPNUSA_AU_REPO:-davidjmoorembaypn/ypnusa}"
API="${YPNUSA_AU_API:-https://api.github.com}"
RAW="${YPNUSA_AU_RAW:-https://raw.githubusercontent.com}"
BASE="${YPNUSA_AU_BASE:-/opt/ypnusa}"
STATE_DIR="${YPNUSA_AU_STATE_DIR:-/var/lib/ypnusa-auto-update}"
PAUSE_FILE="${YPNUSA_AU_PAUSE_FILE:-/etc/ypnusa/auto-update.paused}"
LOCK_FILE="${YPNUSA_AU_LOCK:-/run/lock/ypnusa-auto-update.lock}"
BIN="${YPNUSA_AU_BIN:-/usr/local/sbin/ypnusa-auto-update}"
UNIT_DIR="${YPNUSA_AU_UNIT_DIR:-/etc/systemd/system}"
# A build that fails before any change (download or backup trouble) is retried
# on later runs, but only this many times, so a stuck build can't trigger a
# pre-deploy backup every 10 minutes forever.
MAX_ATTEMPTS="${YPNUSA_AU_MAX_ATTEMPTS:-3}"
# With less free disk than this, old releases are removed before anything else. A full disk on
# 2026-11-27 made every run fail while writing its own state, so no release installed for a day.
MIN_FREE_MB="${YPNUSA_AU_MIN_FREE_MB:-1024}"

FAILED_FILE="$STATE_DIR/failed-tags"
ATTEMPTS_FILE="$STATE_DIR/attempts"
LAST_FILE="$STATE_DIR/last-result"
TAG_RE='^app-build-[0-9a-f]{7}$'

log() { echo "[auto-update] $*"; }
now() { date -u +%FT%TZ; }
record() { mkdir -p "$STATE_DIR"; echo "$(now) $*" > "$LAST_FILE"; }

gh_get() { curl -fsSL --max-time 30 -H 'Accept: application/vnd.github+json' "$API/repos/$REPO/$1"; }

# The newest non-draft, non-prerelease build tag ("Latest" on the Releases page).
latest_tag() {
  local body tag
  body="$(gh_get releases/latest)" || return 1
  printf '%s' "$body" | grep -q '"draft": *false' || return 1
  printf '%s' "$body" | grep -q '"prerelease": *false' || return 1
  tag="$(printf '%s' "$body" | grep -o '"tag_name": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
  [[ "$tag" =~ $TAG_RE ]] || return 1
  echo "$tag"
}

# The 7-character commit serving traffic now (the release directory name).
live_commit() {
  local cur
  cur="$(readlink -f "$BASE/current" 2>/dev/null || true)"
  if [ -n "$cur" ]; then basename "$cur"; fi
  return 0
}

# Is the latest build ahead of the live one? Never auto-install an older build
# (e.g. if someone installed a newer one by hand). "ahead"/"diverged" install;
# "behind"/"identical" don't. If GitHub can't answer, the newest published
# release wins: that is what the hand-install instructions would install too.
is_newer() {
  local live="$1" latest="$2" body status
  body="$(gh_get "compare/$live...$latest" 2>/dev/null)" || return 0
  status="$(printf '%s' "$body" | grep -o '"status": *"[^"]*"' | head -n1 | sed 's/.*"\([^"]*\)"$/\1/')"
  case "$status" in
    behind|identical) return 1 ;;
    *) return 0 ;;
  esac
}

paused() { [ -e "$PAUSE_FILE" ]; }

# Frees disk when it is nearly full: removes every release folder except the live one and the
# newest other (the fallback). Site data lives outside the release folders and is never touched.
free_space_if_low() {
  local free live d kept=0
  free="$(df -Pm "$BASE" 2>/dev/null | awk 'NR==2 {print $4}')"
  [ -n "$free" ] || return 0
  [ "$free" -lt "$MIN_FREE_MB" ] || return 0
  [ -d "$BASE/releases" ] || return 0
  live="$(live_commit)"
  log "only ${free} MB free on the disk; removing old releases (keeping live ${live:-none} and one fallback)"
  while read -r d; do
    [ -n "$d" ] || continue
    [ "$d" = "$live" ] && continue
    kept=$((kept + 1))
    [ "$kept" -le 1 ] || rm -rf "${BASE:?}/releases/$d"
  done < <(ls -1t "$BASE/releases" 2>/dev/null)
  return 0
}

is_failed() { [ -f "$FAILED_FILE" ] && grep -qx "$1" "$FAILED_FILE"; }
mark_failed() { mkdir -p "$STATE_DIR"; is_failed "$1" || echo "$1" >> "$FAILED_FILE"; }
attempts_for() { [ -f "$ATTEMPTS_FILE" ] && awk -v t="$1" '$1==t {print $2}' "$ATTEMPTS_FILE" | tail -n1 || true; }
set_attempts() {
  mkdir -p "$STATE_DIR"
  { [ -f "$ATTEMPTS_FILE" ] && awk -v t="$1" '$1!=t' "$ATTEMPTS_FILE" || true; echo "$1 $2"; } > "$ATTEMPTS_FILE.tmp"
  mv -f "$ATTEMPTS_FILE.tmp" "$ATTEMPTS_FILE"
}

# After a good install, pick up this script's newest version from the release
# bundle, so fixes to the updater ship with ordinary releases.
refresh_self() {
  local src="$BASE/current/scripts/aws-auto-update.sh"
  [ -f "$src" ] && [ -f "$BIN" ] || return 0
  cmp -s "$src" "$BIN" && return 0
  bash -n "$src" || { log "new updater in the bundle has a syntax error; keeping the current one"; return 0; }
  cp "$src" "$BIN.new" && chmod 755 "$BIN.new" && mv -f "$BIN.new" "$BIN"
  log "updater refreshed from the installed release"
}

cmd_run() {
  if [ -e "$PAUSE_FILE" ]; then
    log "paused ($PAUSE_FILE exists); nothing checked"
    return 0
  fi

  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    log "another update run is still going; skipping this one"
    return 0
  fi

  # Checked again now that this run holds the lock: a pause issued while the
  # previous run was going must stop this one too.
  if paused; then
    log "paused ($PAUSE_FILE exists); nothing checked"
    return 0
  fi

  free_space_if_low

  local latest live attempts out rc
  if ! latest="$(latest_tag)"; then
    log "could not read the latest release from GitHub; will try again next run"
    return 0
  fi
  live="$(live_commit)"

  if [ "app-build-$live" = "$latest" ]; then
    log "live build $live is the latest release; nothing to do"
    return 0
  fi
  if is_failed "$latest"; then
    log "$latest failed before and was rolled back; not retrying it (live stays $live)"
    return 0
  fi
  if [ -n "$live" ] && ! is_newer "$live" "${latest#app-build-}"; then
    log "$latest is not newer than live build $live; not installing an older build"
    return 0
  fi

  attempts="$(attempts_for "$latest")"; attempts="${attempts:-0}"
  if [ "$attempts" -ge "$MAX_ATTEMPTS" ]; then
    mark_failed "$latest"
    log "$latest could not be installed after $attempts tries; giving up on it"
    record "GAVE_UP $latest"
    return 0
  fi
  set_attempts "$latest" "$((attempts + 1))"

  log "installing $latest (live: ${live:-none}, try $((attempts + 1)) of $MAX_ATTEMPTS)"
  local work; work="$(mktemp -d)"
  # The installer comes from the release's own tag, never from main.
  if ! curl -fsSL --retry 3 --max-time 60 -o "$work/install.sh" "$RAW/$REPO/$latest/scripts/aws-install-release.sh"; then
    rm -rf "$work"
    log "could not download the installer for $latest; will try again next run"
    record "DOWNLOAD_FAILED $latest"
    return 1
  fi

  if paused; then
    rm -rf "$work"
    set_attempts "$latest" "$attempts"
    log "paused while checking; $latest was not installed (live stays ${live:-none})"
    record "PAUSED before installing $latest"
    return 0
  fi

  set +e
  # The installer re-checks the pause file once it holds the deploy lock and right
  # before it switches builds, so a pause stops an install already under way.
  out="$(YPNUSA_ABORT_IF_FILE="$PAUSE_FILE" bash "$work/install.sh" "$latest" 2>&1)"; rc=$?
  set -e
  rm -rf "$work"
  printf '%s\n' "$out"

  if [ "$rc" -eq 0 ]; then
    set_attempts "$latest" 0
    record "INSTALLED $latest"
    log "DONE: $latest is live"
    refresh_self
    return 0
  fi
  if [ "$rc" -eq 4 ] || printf '%s' "$out" | grep -q 'ROLLBACK FAILED'; then
    mark_failed "$latest"
    record "ROLLBACK_FAILED $latest (exit $rc): check the site now"
    log "$latest failed AND putting $live back failed. The site may be down: check 'systemctl status ypnusa'. It won't be retried."
  elif [ "$rc" -eq 3 ] || printf '%s' "$out" | grep -q 'rolling back'; then
    mark_failed "$latest"
    record "ROLLED_BACK $latest"
    log "$latest failed its checks and was rolled back; live stays $live. It won't be retried."
  elif printf '%s' "$out" | grep -q 'Auto-update was paused'; then
    set_attempts "$latest" "$attempts"
    record "PAUSED during install of $latest (nothing switched)"
    log "paused during the install of $latest; nothing was switched (live stays ${live:-none})"
    return 0
  else
    record "FAILED $latest (exit $rc, before any change)"
    log "$latest did not install (exit $rc); nothing was switched. Will retry next run."
  fi
  return 1
}

# Pause, then wait until no run is in progress, so that when this returns nothing
# will switch builds behind your back (e.g. right before a hand rollback). A run
# that already switched builds still finishes its checks, or rolls itself back.
cmd_pause() {
  mkdir -p "$(dirname "$PAUSE_FILE")"
  touch "$PAUSE_FILE"
  mkdir -p "$(dirname "$LOCK_FILE")"
  exec 9>"$LOCK_FILE"
  if ! flock -n 9; then
    echo "An auto-install is in progress; waiting for it to stop (it stops before switching builds if it hasn't yet)..."
    if ! flock -w "${YPNUSA_AU_PAUSE_WAIT:-1200}" 9; then
      echo "Auto-update PAUSED, but the run in progress has not finished yet. Check: sudo ypnusa-auto-update status" >&2
      return 1
    fi
  fi
  flock -u 9
  echo "Auto-update PAUSED. Nothing is installing now. Live build: app-build-$(live_commit || echo '?')"
  echo "Resume with: sudo ypnusa-auto-update resume"
}

cmd_status() {
  local paused=no
  [ -e "$PAUSE_FILE" ] && paused=yes
  echo "Auto-update paused: $paused"
  echo "Live build:         app-build-$(live_commit || echo '?')"
  echo "Last result:        $(cat "$LAST_FILE" 2>/dev/null || echo 'no install yet')"
  echo "Never retried:      $( [ -s "$FAILED_FILE" ] && tr '\n' ' ' < "$FAILED_FILE" || echo none)"
  if command -v systemctl >/dev/null 2>&1; then
    systemctl list-timers ypnusa-auto-update.timer --no-pager 2>/dev/null || true
  fi
}

cmd_install() {
  [ "$(id -u)" -eq 0 ] || { echo "run as root (sudo)" >&2; exit 2; }
  local self; self="$(readlink -f "${BASH_SOURCE[0]}")"
  mkdir -p "$(dirname "$BIN")"
  if [ "$self" != "$(readlink -f "$BIN" 2>/dev/null || true)" ]; then
    install -m 755 "$self" "$BIN"
  fi
  # mkdir, not `install -d`: never loosen /etc/ypnusa's permissions (it holds app.env).
  mkdir -p "$STATE_DIR" "$(dirname "$PAUSE_FILE")"

  cat > "$UNIT_DIR/ypnusa-auto-update.service" <<EOF
[Unit]
Description=YPN USA: install the newest app release if there is one
After=network-online.target ypnusa.service
Wants=network-online.target

[Service]
Type=oneshot
ExecStart=$BIN run
TimeoutStartSec=20min
EOF

  cat > "$UNIT_DIR/ypnusa-auto-update.timer" <<'EOF'
[Unit]
Description=Check GitHub for a new YPN USA app release every 10 minutes

[Timer]
OnActiveSec=2min
OnUnitActiveSec=10min
RandomizedDelaySec=30
Persistent=false

[Install]
WantedBy=timers.target
EOF

  systemctl daemon-reload
  systemctl enable --now ypnusa-auto-update.timer
  rm -f "$PAUSE_FILE"
  echo "=== AUTO-UPDATE ON: new releases install by themselves within about 10 minutes."
  echo "=== Live build now: app-build-$(live_commit || echo '?')"
  systemctl list-timers ypnusa-auto-update.timer --no-pager || true
}

case "${1:-}" in
  run) cmd_run ;;
  status) cmd_status ;;
  pause) cmd_pause ;;
  resume) rm -f "$PAUSE_FILE"; echo "Auto-update RESUMED. The next check runs within 10 minutes." ;;
  install) cmd_install ;;
  *) echo "usage: $0 {run|status|pause|resume|install}" >&2; exit 2 ;;
esac
