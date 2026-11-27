#!/usr/bin/env bash
#
# Post-deploy smoke test. Runs ON THE SERVER as `deploy`, against a stack
# that deploy.sh just started:
#
#   smoke-test.sh <stack> <host-port>
#
# For the throwaway "develop" stack only. It stops Redis on purpose (to
# prove the service fails closed) and writes a test account and payment
# into Postgres, so never point it at production.
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

echo "== billing: register a key, claim a payment, spend credits"
# Fixed test vectors (bash can't compute keccak); src/test/keccak-calls.test.ts
# asserts the hashes, so they can't drift. Test values only, safe to print.
S=0x$(printf '11%.0s' $(seq 32))   # account secret
K=$(printf '22%.0s' $(seq 32))     # API key, as it appears in a URL
C=0x$(printf '33%.0s' $(seq 32))   # payment secret
KEY_HASH=0xc4bd59e1394781d1c7bf20a2c0b30c2acc9fbdd52dc5e0d76917de4034ebdf59
MEMO=0x02cc96397d444c8ebdd3c75f2c53fc945bed8aab1e8da3f22ecca96cd45f8c57
psql() { compose exec -T postgres psql -U zxstim -d zxstim_rpc -v ON_ERROR_STOP=1 -qtAc "$1"; }
call='{"jsonrpc":"2.0","id":1,"method":"eth_chainId","params":[]}'
batch="[$call,$call,$call]"
# POST to /rpc/<chain>/<key>; prints "<http-code> <x-credits-remaining> <result>".
billed() {
  local hdrs body code left
  hdrs=$(mktemp)
  body=$(curl -s -m 20 -D "$hdrs" -H 'content-type: application/json' -H 'x-real-ip: 198.51.100.7' -d "$2" "$base/rpc/$1/$K")
  code=$(tr -d '\r' < "$hdrs" | awk 'NR==1{print $2}')
  left=$(tr -d '\r' < "$hdrs" | awk -F': ' 'tolower($1)=="x-credits-remaining"{print $2}')
  rm -f "$hdrs"
  echo "$code ${left:--} $(printf '%s' "$body" | sed -n 's/.*"result":"\(0x[0-9a-fA-F]*\)".*/\1/p' | head -1)"
}
v1() { # <method> <path> <auth> [json] → "<http-code> <body>"
  local out
  out=$(curl -s -m 10 -w '\n%{http_code}' -X "$1" -H "authorization: $3" -H 'content-type: application/json' -H 'x-real-ip: 198.51.100.7' ${4:+-d "$4"} "$base$2")
  echo "${out##*$'\n'} ${out%$'\n'*}"
}

read -r code _ <<<"$(billed sepolia "$call")"
check "$code" 401 "unregistered key → 401"
read -r code _ <<<"$(v1 POST /v1/account/keys "Account $S" "{\"keyHash\":\"$KEY_HASH\"}")"
check "$code" 201 "register the key with the account secret"
read -r code _ <<<"$(billed sepolia "$call")"
check "$code" 402 "registered key without credits → 402"

# Stand-in for the payment indexer: record an on-chain payment worth 50 credits.
psql "insert into payments (chain_id, tx_hash, log_index, memo, token, amount, credits) values (11155111, '0x$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')', 0, '$MEMO', '0x0000000000000000000000000000000000000000', '1000000000000000', 50)" >/dev/null
read -r code body <<<"$(v1 POST /v1/claims "Bearer 0x$K" "{\"secret\":\"$C\"}")"
check "$code $body" '200 {"status":"credited","credits":50}' "claim the payment by its secret"
read -r code _ <<<"$(v1 POST /v1/claims "Bearer 0x$K" "{\"secret\":\"$C\"}")"
check "$code" 409 "claiming it again → 409"

check "$(billed sepolia "$call")" "200 49 0xaa36a7" "billed eth_chainId on sepolia (1 credit)"
read -r code left _ <<<"$(billed base-sepolia "$batch")"
check "$code $left" "200 46" "billed batch of 3 on base-sepolia (3 credits)"
read -r code body <<<"$(v1 GET /v1/account "Bearer 0x$K")"
check "$code $body" '200 {"credits":46}' "GET /v1/account balance"
check "$(psql 'select count(*) from payments where claimed')" 1 "payment marked claimed"
check "$(psql "select count(*) from information_schema.columns where table_name = 'payments' and column_name like '%account%'")" 0 "payments table has no account column"
dump=$(compose exec -T postgres pg_dump -U zxstim -d zxstim_rpc --data-only 2>/dev/null)
printf '%s' "$dump" | grep -qE '198\.51\.100|203\.0\.113' && fail "a client IP appears in Postgres" || pass "no client IPs in Postgres"
printf '%s' "$dump" | grep -qiE "${S#0x}|$K|${C#0x}" && fail "a raw secret or key appears in Postgres" || pass "Postgres holds only hashes (no secrets, keys or payment secrets)"
check "$(psql 'show log_min_error_statement')" panic "Postgres never logs query text (log_min_error_statement)"
compose logs --no-color postgres 2>/dev/null | grep -qE '198\.51\.100|203\.0\.113|172\.[0-9]+\.[0-9]+\.[0-9]+' && fail "Postgres logged a client address" || pass "Postgres log has no client addresses"

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
# Redis lost the live lease (46 credits). The next refill refunds all of it,
# so the customer is never short-changed (they got the 4 spent calls free).
read -r code left _ <<<"$(billed sepolia "$call")"
if [ "$code" = 200 ] && [ "${left:-0}" -ge 45 ]; then pass "billed route after Redis restart: lease refunded ($left left)"; else fail "billed route after Redis restart (HTTP $code, ${left:-none} left; want 200, ≥45)"; fi

echo "== privacy: the app logged nothing but its startup line"
lines=$(compose logs --no-color --no-log-prefix app 2>/dev/null | grep -c .)
first=$(compose logs --no-color --no-log-prefix app 2>/dev/null | head -1)
case "$first" in *"Elysia is running"*) ok=1 ;; *) ok=0 ;; esac
[ "$lines" = 1 ] && [ $ok = 1 ] && pass "app log has exactly 1 line (startup)" || fail "app log has $lines lines (expected only the startup line)"

echo
if [ $fails -eq 0 ]; then echo "smoke-test: all checks passed"; else echo "smoke-test: $fails check(s) FAILED"; fi
exit $(( fails > 0 ))
