# New production server (Amazon Linux 2023, user data)

Used on 2026-11-06 after the old app server (`i-0ad200fc61f4d39f5`, 18.223.107.93, in the
locked account ending 3723) stopped answering. Builds a fresh server from the console with no shell access. **ypnus.com is the one public site**:
app.ypnus.com 301-redirects to the same path on ypnus.com (except `/api/webhooks/`, served
directly because Stripe does not follow redirects).

## Launch (AWS console, account ending 3689, region Ohio us-east-2)

1. EC2 → **Launch instance**. Name: `ypnus-app`.
2. AMI: **Amazon Linux 2023** (the default). Instance type: **t3.micro** (or t3.small).
3. Key pair: pick existing `YPNUSA` (or "Proceed without a key pair").
4. Network settings: tick **Allow SSH**, **Allow HTTPS traffic from the internet** and
   **Allow HTTP traffic from the internet**.
5. Storage: **20 GiB** gp3.
6. Advanced details → **User data**: paste

   ```bash
   #!/bin/bash
   curl -fsSL -o /root/new-server.sh https://raw.githubusercontent.com/davidjmoorembaypn/ypnusa/main/aws/bootstrap/new-server.sh && bash /root/new-server.sh
   ```

   (Before this file is on `main`, use the branch or commit path instead of `main`.)
7. **Launch instance**.
8. EC2 → Elastic IPs → **Allocate** → **Associate** with `ypnus-app`. That address is the
   server's permanent IP.

## Check before DNS

About 10 minutes after launch, `http://<elastic-ip>/api/health` returns
`{"ok":true,...,"storage":{"persistent":true,"degraded":false},"build":{"commit":"<sha7>"}}`.
Log on the box: `/var/log/ypnusa-bootstrap.log` (EC2 Instance Connect).

## DNS (Hostinger, ypnus.com zone)

| Record | Value | TTL |
| --- | --- | --- |
| `A app` | Elastic IP | 300 |
| `A @` | Elastic IP | 300 |
| `CNAME www` | `ypnus.com` (already set) | 300 |

Delete any `AAAA` on `@`, `app` or `www`. Leave MX and TXT alone. The `ypnusa-cert-check`
timer issues both Let's Encrypt certificates within ~5 minutes of DNS resolving to the server;
until then HTTPS shows a certificate warning.

Rollback: set `A @` back to `82.29.85.227` (Hostinger WordPress, kept running).

## After launch

- Move any Stripe webhook endpoint that points at `app.ypnus.com` to `https://ypnus.com/...`
  (same path) when convenient; the old URL keeps working.
- Links built from `APP_SITE_URL` (`src/lib/site.ts`) still say app.ypnus.com and redirect;
  switching its default to ypnus.com is a follow-up code change.

- `/etc/ypnusa/app.env` has generated `SESSION_SECRET`, `ADMIN_TOKEN`, `CRON_SECRET`.
  `ANTHROPIC_API_KEY` (assistant tools) and `YPNUS_SSO_SHARED_SECRET` (sign-in hand-off from
  WordPress) must be added by hand, then `systemctl restart ypnusa`.
- App data starts empty. The last known store is on Hostinger
  (`~/domains/ypnus.com/app/persistent-data/store.json`, 2026-10-09); restore it with
  `ypnusa-restore` if needed.
- Later deploys: `bash /opt/ypnusa/tools/scripts/aws-install-release.sh` (see `aws/README.md`).
