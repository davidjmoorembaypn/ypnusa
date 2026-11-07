#!/usr/bin/env bash
# Usage: verify-cutover.sh <ELASTIC_IP>   (tests the new box before DNS moves, via --resolve)
set -uo pipefail
IP="${1:?elastic ip}"; D=ypnus.com; fail=0
chk(){ local n="$1" c="$2"; if eval "$c" >/dev/null 2>&1; then echo "PASS $n"; else echo "FAIL $n"; fail=1; fi; }
R="--resolve $D:80:$IP --resolve $D:443:$IP -sk"
chk "home 200"            "[ \$(curl $R -o /dev/null -w '%{http_code}' http://$D/) = 200 ]"
chk "wp-json"             "curl $R http://$D/wp-json/ | grep -q namespaces"
chk "zip-check endpoint"  "curl $R http://$D/wp-json/ypnus/v1/zip-check/90210 | grep -q ."
chk "rank math sitemap"   "curl $R http://$D/sitemap_index.xml | grep -q sitemap"
chk "NMLS 787257 footer"  "curl $R http://$D/ | grep -q 787257"
chk "xmlrpc blocked"      "! curl $R -f http://$D/xmlrpc.php"
chk "CTA -> app register" "curl $R http://$D/ | grep -q 'app.ypnus.com/register'"
exit $fail
