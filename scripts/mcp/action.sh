#!/usr/bin/env bash
# Exercise the live MCP endpoint end to end. Needs only curl and python3; run it anywhere.
#   bash action.sh [--url URL] [--token TOKEN] [--ask "message"] [zip ...]
#
# Checks: the handshake, the tool list, check_zip_availability for each ZIP code (default 93618 93619 90210),
# find_nearby_open_zips for the first locked one, GET and DELETE answering 405, and the CORS preflight for
# claude.ai (204) and for an unknown origin (403). --ask also sends one message to ask_cerebro, which spends a
# paid model call. Environment: MCP_URL, MCP_TOKEN. Exit status is 1 if any check fails. Nothing is written to disk.
set -uo pipefail

url="${MCP_URL:-https://ypnus.com/api/mcp}" token="${MCP_TOKEN:-}" ask="" zips=()
while [ $# -gt 0 ]; do
  case "$1" in
    --url) url="${2:?--url needs a value}"; shift ;;
    --token) token="${2:?--token needs a value}"; shift ;;
    --ask) ask="${2:?--ask needs a message}"; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) zips+=("$1") ;;
  esac
  shift
done
[ ${#zips[@]} -gt 0 ] || zips=(93618 93619 90210)

pass=0 fail=0
ok()  { printf '  PASS  %s\n' "$1"; pass=$((pass+1)); }
bad() { printf '  FAIL  %s\n' "$1"; fail=$((fail+1)); }
auth=(); [ -n "$token" ] && auth=(-H "Authorization: Bearer $token")
H=(-H 'content-type: application/json' -H 'accept: application/json, text/event-stream' -H 'mcp-protocol-version: 2025-06-18')

# rpc <id> <method> [params-json]  -> sets $body (the response) and $code (the HTTP status) in this shell
body="" code=""
rpc() {
  local out
  out="$(curl -s -m 60 -w '\n%{http_code}' -X POST "$url" "${H[@]}" "${auth[@]}" \
    -d "{\"jsonrpc\":\"2.0\",\"id\":$1,\"method\":\"$2\"${3:+,\"params\":$3}}")"
  code="${out##*$'\n'}"; body="${out%$'\n'*}"
}
jget() { python3 -c 'import sys,json
d=json.load(sys.stdin)
for k in sys.argv[1].split("."):
    d=d[int(k)] if k.isdigit() else d[k]
print(d if not isinstance(d,(dict,list)) else json.dumps(d))' "$1" 2>/dev/null; }
call() { rpc "$1" tools/call "{\"name\":\"$2\",\"arguments\":$3}"; }

echo "MCP endpoint: $url"
rpc 1 initialize '{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"action","version":"1"}}'
[ "$code" = 200 ] && [ "$(echo "$body" | jget result.serverInfo.name)" = "ypn-usa" ] && ok "initialize: HTTP 200, server ypn-usa" || { bad "initialize: HTTP $code"; [ "$code" = 401 ] && echo "        (the endpoint is private: pass --token)"; }

rpc 2 tools/list
names="$(echo "$body" | python3 -c 'import sys,json; print(" ".join(sorted(t["name"] for t in json.load(sys.stdin)["result"]["tools"])))' 2>/dev/null)"
n=$(echo "$names" | wc -w)
[ "$n" -ge 5 ] && ok "tools/list: $n tools ($names)" || bad "tools/list: expected at least 5 tools, got '$names'"

locked_zip=""
for z in "${zips[@]}"; do
  call 3 check_zip_availability "{\"zip\":\"$z\"}"
  status="$(echo "$body" | jget result.structuredContent.status)"
  msg="$(echo "$body" | jget result.structuredContent.message)"
  case "$status" in
    open|locked) ok "check_zip_availability $z: $status ($msg)"; [ "$status" = locked ] && [ -z "$locked_zip" ] && locked_zip="$z" ;;
    invalid) ok "check_zip_availability $z: invalid ZIP code reported as a tool error" ;;
    *) bad "check_zip_availability $z: no answer (HTTP $code)" ;;
  esac
done

if [ -n "$locked_zip" ]; then
  call 4 find_nearby_open_zips "{\"zip\":\"$locked_zip\",\"limit\":3}"
  near="$(echo "$body" | python3 -c 'import sys,json; print(", ".join(n["zip"]+" "+n["city"] for n in json.load(sys.stdin)["result"]["structuredContent"]["neighbors"]) or "none found")' 2>/dev/null)"
  [ -n "$near" ] && ok "find_nearby_open_zips $locked_zip: $near" || bad "find_nearby_open_zips $locked_zip: no answer"
fi

g="$(curl -s -m 20 -o /dev/null -D - "$url" "${auth[@]}" -H 'accept: text/event-stream')"
last_status() { grep '^HTTP/' | tail -1; }   # the last status line: a proxy can print its own CONNECT line first
echo "$g" | last_status | grep -q ' 405' && echo "$g" | grep -qi '^allow: POST, OPTIONS' && ok "GET: 405 with Allow: POST, OPTIONS" || bad "GET: expected 405 with Allow"
d="$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X DELETE "$url" "${auth[@]}" -H 'mcp-session-id: x')"
[ "$d" = 405 ] && ok "DELETE: 405" || bad "DELETE: expected 405, got $d"

p="$(curl -s -m 20 -o /dev/null -D - -X OPTIONS "$url" -H 'origin: https://claude.ai' -H 'access-control-request-method: POST')"
echo "$p" | last_status | grep -q ' 204' && echo "$p" | grep -qi '^access-control-allow-origin: https://claude.ai' && ok "preflight from claude.ai: 204 with CORS headers" || bad "preflight from claude.ai: expected 204 with CORS headers"
e="$(curl -s -m 20 -o /dev/null -w '%{http_code}' -X OPTIONS "$url" -H 'origin: https://evil.example')"
[ "$e" = 403 ] && ok "preflight from an unknown origin: 403" || bad "preflight from an unknown origin: expected 403, got $e"

if [ -n "$ask" ]; then
  call 5 ask_cerebro "$(python3 -c 'import json,sys; print(json.dumps({"message":sys.argv[1]}))' "$ask")"
  reply="$(echo "$body" | jget result.structuredContent.reply)"
  [ -n "$reply" ] && ok "ask_cerebro: ${reply:0:240}" || bad "ask_cerebro: no reply (HTTP $code)"
fi

echo
echo "$pass passed, $fail failed"
[ "$fail" = 0 ]
