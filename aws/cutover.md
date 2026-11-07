# Cutover (DNS is wherever the nameservers point; Hostinger access is NOT needed unless NS = Hostinger)

1. `dig NS ypnus.com +short` — if Cloudflare/Route 53, edit there. If `*.dns-parking.com` (Hostinger NS) and you can't log in,
   move the domain's nameservers at the **registrar** (where you bought it) to Route 53 or Cloudflare first.
2. Route 53: create hosted zone, recreate existing records (MX/TXT/SPF/DKIM, `app` -> app host), add `A @ -> <Elastic IP>`, `CNAME www -> ypnus.com`.
3. `bash aws/verify-cutover.sh <Elastic IP>` must be all PASS.
4. Lower TTL to 300 a day ahead; switch A record; then on the box: `sudo certbot --nginx -d ypnus.com -d www.ypnus.com -m $LE_EMAIL --agree-tos -n --redirect`.
5. Re-point `app.ypnus.com` only if it also lived on Hostinger (it did: see hostinger/README.md) — separate migration.
