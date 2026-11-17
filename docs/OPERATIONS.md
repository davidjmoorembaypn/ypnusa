# Running ypnus.com: install, roll back, check health, backups

A plain-English run guide for the live site. Every step is one command: copy it, paste it, press Enter, and wait
for it to finish before the next one.

This repository is public, so this guide never contains keys, passwords, server addresses or account numbers. Keys
are named here only by their setting name. Their values live on the server and in the owner's password manager.

For deeper technical notes on the server itself, see [aws/README.md](../aws/README.md) and
[aws/bootstrap/README.md](../aws/bootstrap/README.md). What changed in each release is in
[CHANGELOG.md](../CHANGELOG.md).

---

## 1. How a release is made

1. A change is merged into the `main` branch on GitHub.
2. GitHub automatically runs the **Release build** workflow
   ([.github/workflows/release-build.yml](../.github/workflows/release-build.yml)). It runs all the tests, builds
   the site, and publishes a GitHub release named `app-build-` plus the first 7 characters of the change, for example
   `app-build-17e6e2d`.
3. **The server installs it by itself** within about 10 minutes, once auto-install is turned on (section 2). If
   auto-install is off or paused, the live site only changes when someone installs the build by hand (section 2).
4. GitHub keeps only the **five newest** builds. Older ones are deleted automatically, so they can no longer be
   installed from GitHub.

Notes:

- If the tests fail, no build is published and nothing can be installed. That is on purpose.
- A change that only edits documents can skip the build: put `[skip ci]` in its merge commit title. Without it, every
  merge makes a new build (and pushes the oldest of the five off GitHub).
- The list of builds is on the repository's **Releases** page on GitHub. The newest is marked "Latest".

---

## 2. Install a release

### Automatic install (the normal way)

Once it is turned on, the server checks GitHub every 10 minutes. When a newer build is published, it installs it by
itself, with the same backup, checks and automatic rollback as the hand install below. You don't paste anything.

- **Turn it on (one time):** connect to the server (steps below), then paste this one line, with the build name in the
  middle replaced by the newest build:

  ```
  cd /tmp && curl -fsSL -o u.sh https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/app-build-17e6e2d/scripts/aws-auto-update.sh && sudo bash u.sh install
  ```

  It ends with `AUTO-UPDATE ON`. Nothing is installed at that moment; the first check runs a couple of minutes later.
- **See what it did:** `sudo ypnusa-auto-update status` shows the live build, the last result, and when the next check
  runs.
- **Pause it** (for example before rolling back by hand, section 3): `sudo ypnusa-auto-update pause`.
  **Turn it back on:** `sudo ypnusa-auto-update resume`.
- A build that fails its checks is rolled back automatically and **never retried**. The site keeps running the build it
  had. Fix the problem in a new change; the next build installs normally.
- It never installs a build older than the one that is live.
- Its log: `sudo journalctl -u ypnusa-auto-update.service --since today`.

### Install by hand

You need a terminal on the production server. Open the AWS console, go to **EC2 > Instances**, select the
production instance (named `ypnus-app`), click **Connect**, choose **EC2 Instance Connect**, and click **Connect**.
A black terminal window opens in your browser.

**Step 1.** Make sure you are on the right server. The name on the prompt line must match the production instance's
private name shown on its EC2 page. If it doesn't, close the window and connect again from the right instance.

**Step 2.** Paste this one line, with the build name at the end replaced by the build you want (for example
`app-build-17e6e2d`):

```
cd /tmp && curl -fsSL -o i.sh https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/main/scripts/aws-install-release.sh && sudo bash i.sh app-build-17e6e2d
```

**Step 3.** Wait for it to finish (usually under a minute). The last lines tell you how it went:

| You see | It means |
| --- | --- |
| `DEPLOY OK: live build ...` and `DONE` | The new build is live. Go to section 4 to double-check. |
| `Release ... is already live; nothing to do.` | That build was already installed. Nothing changed. |
| `failed verification; rolling back` | The new build didn't start properly, so the old one was put back automatically. The site keeps running the old build. |
| `pre-deploy backup failed; aborting before any change.` | Nothing was changed. The data backup must work before an install. |
| `curl: (22) ... 404` | That build name doesn't exist on GitHub (typo, or it was one of the older builds that were deleted). Nothing was changed. |

**If the prompt shows `>` and nothing happens**, the line was pasted twice or incompletely. Press **Ctrl+C**, then
paste the line once.

What the installer does, in order:

1. Downloads the build from GitHub and checks it wasn't damaged in transit.
2. Backs up all customer data first (section 5). If that backup fails, it stops before changing anything.
3. Puts the new build next to the old ones and switches the site to it.
4. Restarts the site and checks it: the health check must show the new build with working storage, and the home page,
   pricing page and sitemap must load.
5. If any check fails, it switches back to the previous build automatically.
6. Keeps the five newest builds on the server and deletes older ones (never the live one).

---

## 3. Roll back to an earlier build

**During an install** you don't need to do anything: a failed install rolls itself back (section 2, step 3).

**After a good install**, if the new build turns out to have a problem, first pause auto-install, or it will put the
newest build back within 10 minutes:

```
sudo ypnusa-auto-update pause
```

Then install the previous build the same way as in section 2, using the previous build's name from
[CHANGELOG.md](../CHANGELOG.md):

```
cd /tmp && curl -fsSL -o i.sh https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/main/scripts/aws-install-release.sh && sudo bash i.sh app-build-01c062a
```

(Replace `app-build-01c062a` with the build you want to go back to.) Once a fixed build is published, turn
auto-install back on with `sudo ypnusa-auto-update resume`.

Things to know:

- **This only works for a build still on GitHub** (the five newest). For an older one, ask a developer: the server
  also keeps its five newest builds, and a developer can switch to one of those directly.
- **Rolling back the site does not roll back the data.** Leads, accounts and chats stay as they are. Restoring data
  from a backup is a separate, careful step (section 5) and should only be done with a developer.
- **Never go back to a build older than app-build-8bec5a1** (Nov 16, 2026). Borrower data on the live site is
  encrypted, and builds before that one can't read encrypted data.

---

## 4. Check the site's health

Open this address in any browser, or paste it into a terminal with `curl -s` in front:

```
https://ypnus.com/api/health
```

A healthy answer looks like this (the build and times will differ):

```
{"ok":true,"service":"ypnusa-app","storage":{"persistent":true,"degraded":false,"piiEncryption":"on"},"email":"on","build":{"commit":"17e6e2d",...}}
```

| Field | Healthy value | What it means |
| --- | --- | --- |
| `ok` | `true` | The site is answering. |
| `build.commit` | the build you installed | Which build is live. `17e6e2d` here means `app-build-17e6e2d`. |
| `storage.persistent` | `true` | Customer data is saved to disk, not lost on restart. |
| `storage.degraded` | `false` | The data store is working normally. |
| `storage.piiEncryption` | `on` | Borrower personal data is encrypted on the server. |
| `email` | `on` | The site can send email (sign-in links, lead alerts, Cerebro's borrower emails). |

If the page doesn't load at all, or `ok` isn't `true`, the site is down: reinstall the last good build (section 3)
and contact a developer.

---

## 5. Backups

Customer data (accounts, loan officers, ZIP codes, leads, chats) lives in one data file on the server. It is backed
up automatically on the server, under `/var/backups/ypnusa/`:

| Folder | When | Kept for |
| --- | --- | --- |
| `hourly/` | every hour | 3 days |
| `daily/` | the first backup of each day, plus a daily archive of officer headshots | 90 days |
| `pre-deploy/` | right before every install | 30 days |

- Every backup is checked before it is kept: a copy that isn't valid, or that looks emptied out, is refused.
- An off-server copy to Amazon S3 is made only if the server setting `YPNUSA_BACKUP_S3_URI` is filled in. Without it,
  backups exist only on the server itself.
- Restoring a backup replaces the live data, so do it only with a developer. The restore tool
  (`ypnusa-restore`, source in [aws/ops/ypnusa-restore.sh](../aws/ops/ypnusa-restore.sh)) keeps a copy of the
  current data first and puts it back automatically if the site doesn't come up healthy.
- The backup tools are set up by [aws/ops/install-ops.sh](../aws/ops/install-ops.sh).

---

## 6. Server settings and keys

The site's settings and keys are in one file on the server, `/etc/ypnusa/app.env`, readable only by the
administrator. It is **never** in GitHub and the installer never changes it. Changing it means restarting the site.

The settings that matter most, by name only:

| Setting | What it does | If it's missing |
| --- | --- | --- |
| `PII_ENCRYPTION_KEY` | Encrypts borrower personal data on the server. | Data isn't encrypted. **If this key is lost or changed after encryption is on, encrypted data can't be read.** Keep the safe copy in the password manager. |
| `SESSION_SECRET` | Signs sign-in sessions. | The server makes and saves its own, so sign-ins still work. Changing it signs everyone out. |
| `RESEND_API_KEY` | Sends email. | Health check shows `"email":"off"`; no sign-in links or alerts go out. |
| `AI_PROVIDER`, `GEMINI_API_KEY` | Cerebro's AI model. | Cerebro gives a fallback answer instead of a real reply. |
| `STRIPE_WEBHOOK_SECRET` | Confirms payments from Stripe. | Paid plans and ZIP code locks don't update after checkout. |
| `ADMIN_EMAILS` | Who can open the admin screens. | No one has admin access. |
| `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` | Phone alerts. | The server makes and saves its own pair, so alerts still work. |
| `GA_MEASUREMENT_API_SECRET` | Sends "first payment" events to Google Analytics. | Payments are logged on the server only. |
| `YPNUSA_BACKUP_S3_URI` | Off-server backup copies. | Backups stay on the server only. |

Never paste any of these values into GitHub, a chat, an email or a document.
