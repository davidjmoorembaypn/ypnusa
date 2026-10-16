# AWS deploy notes — app.ypnus.com

Documented 2026-10-16, after locating and deploying to the live host by hand.
Supersedes the "deploy path isn't documented yet" note in `AGENTS.md` and
`docs/AWS_MIGRATION.md` — see those files for migration history and the
separate (unapplied) Terraform/ECS stack in `infra/aws/`, which is **not**
what currently serves traffic.

## Where it actually runs

| What | Value |
| --- | --- |
| Instance | `i-0ad200fc61f4d39f5`, tag `Name=YPNUSA`, region **us-east-2** |
| Public IP | `18.223.107.93` (→ `app.ypnus.com`) |
| OS | Amazon Linux 2023, t3.micro |
| Web server | Apache, reverse-proxies `app.ypnus.com` → `http://127.0.0.1:3000` (see `/etc/httpd/conf.d/ypnusa.conf`); TLS via Let's Encrypt (`ypnusa-cert-renew.service` / certbot timer) |
| App | Next.js **standalone** build, run directly with `node server.js` (not `next start`) |
| Process manager | systemd unit `ypnusa.service` (`/etc/systemd/system/ypnusa.service`), `User=ypnusa Group=ypnusa` (uid/gid 992) |
| Releases | `/opt/ypnusa/releases/<sha7>/`, with `/opt/ypnusa/current` symlinked to the live one |
| Secrets | `/etc/ypnusa/app.env` (root-only, 600), loaded by systemd's `EnvironmentFile=` — **never shipped in the release bundle, never edited by the install script** |
| Health check | `GET /api/health` → `{"ok":true,"build":{"commit":"<sha7>"},...}` |

No SSH key is set up for this box day-to-day; it's reached through **AWS SSM
Session Manager**, which the org's quarantine SCP (`p-vxracxez`) does not
block (most EC2/Lambda/CloudFormation/ECS actions are denied by that SCP —
SSM `SendCommand` / Session Manager still works). The instance has IAM
instance profile `YPNUSA-SSM-TempAccess`.

### Getting a shell

- **Console:** EC2 → Instances → `i-0ad200fc61f4d39f5` (us-east-2) → Connect →
  Session Manager → Connect.
- **CLI:** `aws ssm start-session --target i-0ad200fc61f4d39f5 --region us-east-2`
- **Programmatic (what was used to set this up):** `ssm:SendCommand` with
  `AWS-RunShellScript`, then poll `ssm:GetCommandInvocation`. Useful for an
  agent/tool that only has boto3/AWS API access, not an interactive terminal.

You land as `root`.

## Deploying a new release

1. Merge to `main`. `.github/workflows/release-build.yml` builds the standalone
   bundle (same artifact format as the Hostinger deploy) and publishes GitHub
   release `app-build-<sha7>` (`app-build.tar.gz` + `.sha256`).
2. On the server (via SSM, see above), run:
   ```
   bash scripts/aws-install-release.sh                   # latest release
   bash scripts/aws-install-release.sh app-build-<sha7>   # a specific build
   ```
   Fetch the script onto the box first (it isn't pre-installed there), e.g.:
   ```
   curl -fsSL -o aws-install-release.sh \
     https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/main/scripts/aws-install-release.sh
   bash aws-install-release.sh
   ```
3. The script verifies the checksum, installs to `/opt/ypnusa/releases/<sha7>`,
   switches the `current` symlink, restarts `ypnusa.service`, and **rolls back
   automatically** if `/api/health` doesn't report the new commit within ~30s.
   It prunes old releases down to the 5 newest (skipping whichever is live).
4. Confirm from anywhere: `curl https://app.ypnus.com/api/health` shows the new
   `build.commit`.

The systemd unit's `ReadWritePaths` points at `/opt/ypnusa/current/.next/cache`
(the symlink, resolved fresh at every service start) rather than a hardcoded
release path, so the install script never needs to touch the unit file. If
you ever find `ReadWritePaths` hardcoded to a specific `releases/<sha7>` path
again, re-generalize it the same way and `systemctl daemon-reload`.

## Rules

- Never hand-edit `/etc/ypnusa/app.env` as part of a deploy; it's independent
  of the release bundle and systemd re-reads it on every `restart`.
- Never delete `/opt/ypnusa/releases/<sha7>` for the currently-live commit —
  it's the rollback target until the next successful deploy.
- This is a **single instance** serving from a local filesystem — there's no
  load balancer or second node to drain. A restart is a few seconds of
  downtime, not a rolling deploy.
- This box is unrelated to the Terraform/ECS/ALB stack in `infra/aws/` (never
  applied) and unrelated to the Hostinger standby copy (`hostinger/README.md`)
  or the Vercel preview projects auto-deployed from this same GitHub repo —
  three different places this code can end up running, only this one is
  production.
