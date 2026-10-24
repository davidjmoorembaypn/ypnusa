#!/usr/bin/env bash
# READ-ONLY inspection of the production host. Changes nothing, prints no secret
# values (environment variables are reported by NAME and set/missing only).
# Run ON THE SERVER as root:  sudo bash ypnusa-preflight.sh
set -uo pipefail

ENV_FILE=/etc/ypnusa/app.env
env_has() { grep -qE "^$1=.+" "$ENV_FILE" 2>/dev/null && echo SET || echo MISSING; }
env_value() { sed -n "s/^$1=//p" "$ENV_FILE" 2>/dev/null | tail -n1 | tr -d "\"'" ; }
DATA_DIR="$(env_value LOANPILOT_DATA_DIR)"; DATA_DIR="${DATA_DIR:-/var/lib/ypnusa}"

echo "== release";   readlink -f /opt/ypnusa/current; ls -1 /opt/ypnusa/releases | tr '\n' ' '; echo
echo "== health";    curl -fsS --max-time 8 http://127.0.0.1:3000/api/health || echo "(health check failed)"; echo
echo "== service";   systemctl is-active ypnusa; systemctl show ypnusa -p Environment --value | tr ' ' '\n' | grep -E '^NODE_ENV=' || echo "NODE_ENV: not set in unit (standalone server defaults to production)"
echo "== env vars (set/missing only)"
for v in SESSION_SECRET YPNUS_SSO_SHARED_SECRET ADMIN_TOKEN CRON_SECRET STRIPE_WEBHOOK_SECRET STRIPE_PRICE_ID_STARTER \
         STRIPE_PRICE_ID_GROWTH STRIPE_PRICE_ID_PRO STRIPE_PRICE_ID_ELITE LAMBDA_FULFILLMENT_SECRET RESEND_API_KEY \
         RESEND_FROM_EMAIL OPENAI_API_KEY ANTHROPIC_API_KEY GEMINI_API_KEY SENDGRID_API_KEY TWILIO_ACCOUNT_SID \
         OUTREACH_WEBHOOK_URL LOANPILOT_DATA_DIR NEXT_PUBLIC_GA_ID YPNUS_WP_API_BASE; do
  printf '  %-28s %s\n' "$v" "$(env_has $v)"
done
echo "== data store ($DATA_DIR)"
ls -la "$DATA_DIR" 2>/dev/null | sed -n 1,15p
if [ -f "$DATA_DIR/store.json" ]; then
  node -e '
    const db = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
    const counts = Object.fromEntries(Object.entries(db).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, v.length]));
    console.log("  record counts:", JSON.stringify(counts));
    const f = db.followUps || [];
    const by = f.reduce((a, x) => (a[x.status] = (a[x.status] || 0) + 1, a), {});
    console.log("  follow-ups by status:", JSON.stringify(by));
    const subs = db.revenueSubscriptions || [];
    console.log("  subscriptions:", subs.length, "| active/trialing:", subs.filter(s => ["active","trialing"].includes(s.status)).length,
      "| ZIPs claimed:", subs.filter(s => ["active","trialing"].includes(s.status)).reduce((n, s) => n + (s.claimedZips || []).length, 0));
  ' "$DATA_DIR/store.json" || echo "  (store.json unreadable)"
fi
echo "== backups";   ls -1t /var/backups/ypnusa/hourly 2>/dev/null | head -3 || true; [ -d /var/backups/ypnusa ] || echo "  no /var/backups/ypnusa (ops layer not installed)"
echo "== timers";    systemctl list-timers --no-pager 2>/dev/null | grep -E 'ypnusa|certbot' || echo "  no ypnusa/certbot timers found"
echo "== apache";    (apachectl -M 2>/dev/null | grep -E 'proxy_module|proxy_http|ssl_module|headers_module|rewrite_module') || echo "  could not list modules"
grep -rhE '^\s*(ServerName|ServerAlias)' /etc/httpd/conf.d 2>/dev/null | sed 's/^\s*/  /' | sort -u
echo "== tls certs";  ls /etc/letsencrypt/live 2>/dev/null | sed 's/^/  /'
echo "== disk";      df -h / | tail -1
echo "== memory";    free -m | sed -n 2p
echo "== instance";  curl -fsS -m 2 http://169.254.169.254/latest/meta-data/instance-id 2>/dev/null || echo "(metadata unavailable)"; echo
