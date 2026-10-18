#!/usr/bin/env bash
# One-shot verification for the Tolesh overnight build (P0–P4).
# Run from the repo root:  bash scripts/verify.sh
# Exit code 0 = everything passed. Each phase is reported distinctly, and a
# failure stops that phase but the script continues to later phases so a
# single broken piece doesn't hide the state of the rest.
set -u
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
FAIL=0

banner() { printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }
pass()   { printf '  \033[1;32mPASS\033[0m %s\n' "$1"; }
fail()   { printf '  \033[1;31mFAIL\033[0m %s\n' "$1"; FAIL=1; }

# ---- Phase 0: environment ------------------------------------------------
banner "Environment"
node --version || fail "node missing"
[ -d "$ROOT/server/node_modules/express" ] && pass "server deps present (node_modules)" \
  || fail "server deps missing — run: cd server && npm install"

# ---- Phase 1: server unit + integration tests ----------------------------
banner "Server tests (node:test, no network)"
( cd "$ROOT/server" && node --test ) && pass "server tests" || fail "server tests — see output above"

# ---- Phase 2: live server smoke test --------------------------------------
banner "Server smoke test (boots the real server)"
SMOKE="$(mktemp -d)"
DB="$SMOKE/smoke.db" PORT=8799 node "$ROOT/server/src/index.js" >"$SMOKE/server.log" 2>&1 &
SRV=$!
# wait up to 10s for health
ok=0
for _ in $(seq 1 40); do
  if curl -sf http://127.0.0.1:8799/api/health >/dev/null 2>&1; then ok=1; break; fi
  sleep 0.25
done
if [ "$ok" = 1 ]; then
  pass "GET /api/health"
  H="$(curl -s http://127.0.0.1:8799/api/providers)"
  echo "$H" | grep -q '"dahl"' && pass "GET /api/providers reports dahl" || fail "providers body: $H"
  CID="$(curl -s -X POST http://127.0.0.1:8799/api/conversations | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
  [ -n "$CID" ] && pass "POST /api/conversations → id $CID" || fail "conversation create"
  R="$(curl -s -o /tmp/smoke_chat_body -w '%{http_code}' -X POST http://127.0.0.1:8799/api/chat \
        -H 'Content-Type: application/json' \
        -d "{\"conversationId\":\"$CID\",\"message\":\"you dey?\"}")"
  if [ -z "${DAHL_API_KEY:-}" ]; then
    [ "$R" = "503" ] && pass "POST /api/chat without key → honest 503 no_key" \
      || fail "chat without key → HTTP $R (expected 503): $(cat /tmp/smoke_chat_body)"
  else
    [ "$R" = "200" ] && pass "POST /api/chat with key → 200" \
      || fail "chat with key → HTTP $R: $(cat /tmp/smoke_chat_body)"
  fi
  curl -s "http://127.0.0.1:8799/api/conversations/$CID" | grep -q '"you dey?"' \
    && pass "user message persisted (user-controlled memory)" \
    || fail "user message not persisted"
else
  fail "server did not become healthy in 10s — log:"
  sed 's/^/    /' "$SMOKE/server.log"
fi
kill "$SRV" 2>/dev/null
wait "$SRV" 2>/dev/null
rm -rf "$SMOKE" /tmp/smoke_chat_body

# ---- Phase 3: web typecheck + tests + build --------------------------------
banner "Web toolchain"
if [ -d "$ROOT/web/node_modules/vite" ]; then
  ( cd "$ROOT/web" && npm run typecheck ) && pass "web typecheck (tsc --noEmit)" || fail "web typecheck"
  ( cd "$ROOT/web" && npm test ) && pass "web tests (vitest)" || fail "web tests"
  ( cd "$ROOT/web" && npm run build ) && pass "web production build" || fail "web build"
else
  fail "web deps missing — run: cd web && npm install"
fi

banner "RESULT"
if [ "$FAIL" = 0 ]; then
  printf '\033[1;32mAll phases passed.\033[0m\n'
else
  printf '\033[1;31mOne or more phases FAILED — address above before pushing.\033[0m\n'
fi
exit $FAIL
