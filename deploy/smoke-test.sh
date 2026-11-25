#!/usr/bin/env bash
#
# Post-deploy smoke test. Runs ON THE SERVER as `deploy`, against a stack
# that deploy.sh just started:
#
#   smoke-test.sh <stack> <host-port>
#
# For the throwaway "develop" stack only. It stops Redis on purpose (to
# prove the service fails closed), so never point it at production.
#
# Output goes to the public workflow log, so it prints only status codes,
# chain ids and pass/fail lines — never URLs, headers with secrets, Redis
# keys, or container logs. Exits non-zero if any check fails.

set -uo pipefail

stack=$1 port=$2
dir=/opt/$stack
base=http://127.0.0.1:$port
fails=0

case "$stack" in
  *-dev) ;;
  *) echo "smoke-test: refusing to run against '$stack' (develop stacks only)" >&2; exit 2 ;;
esac

compose() { docker compose -p "$stack" -f "$dir/compose.yaml" "$@"; }
pass() { echo "  ✓ $*"; }
fail() { echo "  ✗ $*"; fails=$((fails + 1)); }
check() { if [ "$1" = "$2" ]; then pass "$3 ($1)"; else fail "$3 (got '$1', want '$2')"; fi; }

# POST eth_chainId to /rpc/<chain> as client <ip>; prints "<http-code> <result>".
chain_id() {
  local body code
  body=$(curl -s -m 20 -w '\n%{http_code}' -H 'content-type: application/json' -H "x-real-ip: $2" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$base/rpc/$1")
  code=${body##*$'\n'}
  echo "$code $(printf '%s' "${body%$'\n'*}" | sed -n 's/.*"result":"\(0x[0-9a-fA-F]*\)".*/\1/p')"
}
remaining() { # RateLimit-Remaining after one request as client <ip>
  curl -s -m 20 -o /dev/null -D - -H 'content-type: application/json' -H "x-real-ip: $1" \
    -d '{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}' "$base/rpc/sepolia" \
    | tr -d '\r' | awk -F': ' 'tolower($1)=="ratelimit-remaining"{print $2}'
}

echo "== health"
check "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$base/health")" 200 "GET /health"

echo "== every chain reaches the right network (validates this environment's secrets)"
for pair in ethereum:0x1 arbitrum:0xa4b1 base:0x2105 sepolia:0xaa36a7 arbitrum-sepolia:0x66eee base-sepolia:0x14a34; do
  chain=${pair%%:*} want=${pair#*:}
  read -r code got <<<"$(chain_id "$chain" 198.51.100.1)"
  if [ "$code" = 200 ] && [ "$got" = "$want" ]; then pass "/rpc/$chain → chain $got"; else fail "/rpc/$chain → HTTP $code chain '${got:-none}' (want $want)"; fi
done

echo "== CORS preflight answered locally"
pre=$(curl -s -m 5 -o /dev/null -D - -X OPTIONS -H 'origin: https://app.example.com' -H 'access-control-request-method: POST' "$base/rpc/ethereum" | tr -d '\r')
check "$(printf '%s' "$pre" | awk 'NR==1{print $2}')" 204 "OPTIONS /rpc/ethereum"
printf '%s' "$pre" | grep -qi '^access-control-allow-origin:' && pass "Access-Control-Allow-Origin present" || fail "Access-Control-Allow-Origin missing"

echo "== rate limit counts per client (X-Real-IP), in Redis"
max=200
r=""; for _ in 1 2 3; do r=$(remaining 203.0.113.1); done
check "$r" $((max - 3)) "client A after 3 requests: remaining"
check "$(remaining 203.0.113.2)" $((max - 1)) "client B after 1 request: remaining (separate bucket)"
keys=$(compose exec -T redis redis-cli --scan --pattern 'zxstim-rpc:rl:rpc:*' | grep -c .)
[ "$keys" -ge 3 ] && pass "Redis holds $keys per-client keys" || fail "expected ≥3 per-client keys in Redis, found $keys"
compose exec -T redis redis-cli --scan | grep -qE '203\.0\.113|198\.51\.100' && fail "a raw client IP appears in a Redis key" || pass "no raw IPs in Redis keys (salted hashes only)"
ttl_ok=1; for k in $(compose exec -T redis redis-cli --scan --pattern 'zxstim-rpc:rl:rpc:*'); do t=$(compose exec -T redis redis-cli ttl "$k"); { [ "$t" -gt 0 ] && [ "$t" -le 60 ]; } || ttl_ok=0; done
[ $ttl_ok = 1 ] && pass "every key expires within its 60s window" || fail "a key has no or a wrong expiry"
check "$(compose exec -T redis redis-cli config get save | sed -n 2p)" "" "Redis RDB snapshots off (save)"
check "$(compose exec -T redis redis-cli config get appendonly | sed -n 2p)" no "Redis AOF off (appendonly)"

echo "== Redis outage → fails closed, then recovers"
compose stop redis >/dev/null 2>&1
check "$(curl -s -m 5 -o /dev/null -w '%{http_code}' "$base/health")" 503 "GET /health with Redis down"
hdr=$(curl -s -m 5 -o /dev/null -D - -H 'content-type: application/json' -d '{}' "$base/rpc/ethereum" | tr -d '\r')
check "$(printf '%s' "$hdr" | awk 'NR==1{print $2}')" 503 "POST /rpc/ethereum with Redis down"
check "$(printf '%s' "$hdr" | awk -F': ' 'tolower($1)=="retry-after"{print $2}')" 5 "Retry-After on the 503"
compose start redis >/dev/null 2>&1
recovered=""; for i in $(seq 1 40); do [ "$(curl -s -m 2 -o /dev/null -w '%{http_code}' "$base/health")" = 200 ] && { recovered=$i; break; }; sleep 0.5; done
[ -n "$recovered" ] && pass "recovered after Redis restart (~$((recovered / 2))s)" || fail "did not recover within 20s of Redis restarting"
read -r code got <<<"$(chain_id ethereum 198.51.100.2)"
check "$code $got" "200 0x1" "/rpc/ethereum after recovery"

echo "== privacy: the app logged nothing but its startup line"
lines=$(compose logs --no-color --no-log-prefix app 2>/dev/null | grep -c .)
first=$(compose logs --no-color --no-log-prefix app 2>/dev/null | head -1)
case "$first" in *"Elysia is running"*) ok=1 ;; *) ok=0 ;; esac
[ "$lines" = 1 ] && [ $ok = 1 ] && pass "app log has exactly 1 line (startup)" || fail "app log has $lines lines (expected only the startup line)"

echo
if [ $fails -eq 0 ]; then echo "smoke-test: all checks passed"; else echo "smoke-test: $fails check(s) FAILED"; fi
exit $(( fails > 0 ))
