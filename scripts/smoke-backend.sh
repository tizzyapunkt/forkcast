#!/usr/bin/env bash
# Boot the backend with throwaway auth config and run an authenticated round-trip
# through the non-AI resolution endpoints (confirm → get → search → export).
# Verifies the wiring + overlay persistence end-to-end without needing an API key.
#
# macOS-friendly: no `timeout` (not installed by default) — uses a bash poll loop.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../backend" && pwd)"
PORT=3000
BASE="http://localhost:${PORT}"
OVERLAY="${BACKEND_DIR}/data/user-foods.json"
TMP="$(mktemp -d)"
COOKIES="${TMP}/cookies.txt"
BACKEND_PID=""

cleanup() {
  [ -n "${BACKEND_PID}" ] && kill "${BACKEND_PID}" 2>/dev/null || true
  # Restore any overlay the smoke run created/clobbered.
  if [ -f "${OVERLAY}.smoke-bak" ]; then mv -f "${OVERLAY}.smoke-bak" "${OVERLAY}"; else rm -f "${OVERLAY}"; fi
  rm -rf "${TMP}"
}
trap cleanup EXIT

fail() { echo "❌ smoke: $1" >&2; exit 1; }
expect() { [ "$1" = "$2" ] || fail "expected status $2, got $1 ($3)"; }

# Free the port and stash any existing overlay so the smoke run is non-destructive.
lsof -ti:${PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
[ -f "${OVERLAY}" ] && cp "${OVERLAY}" "${OVERLAY}.smoke-bak"

echo "▸ booting backend…"
( cd "${BACKEND_DIR}" && AUTH_PASSWORD=smoke AUTH_JWT_SECRET=smoke-secret \
  node --experimental-transform-types src/index.ts >"${TMP}/backend.log" 2>&1 ) &
BACKEND_PID=$!
disown "${BACKEND_PID}" 2>/dev/null || true

# Poll for readiness (max ~15s).
for _ in $(seq 1 30); do
  if curl -fs -o /dev/null "${BASE}/auth/me" 2>/dev/null || [ "$(curl -s -o /dev/null -w '%{http_code}' "${BASE}/auth/me")" != "000" ]; then break; fi
  sleep 0.5
done

echo "▸ login"
echo '{"password":"smoke"}' >"${TMP}/login.json"
code=$(curl -s -c "${COOKIES}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/auth/login" \
  -H 'content-type: application/json' --data @"${TMP}/login.json")
expect "${code}" "200" "login"

echo "▸ confirm new-food (Kirschtomaten)"
cat >"${TMP}/confirm.json" <<'JSON'
{"kind":"new-food","entry":{"id":"kirschtomaten","name":"Kirschtomaten","synonyms":["Cocktailtomaten"],"unit":"g","macrosPer100":{"calories":20,"protein":0.9,"carbs":3.9,"fat":0.2}},"original":{"amount":50,"unit":"g","note":"halbiert"}}
JSON
body=$(curl -s -b "${COOKIES}" -X POST "${BASE}/confirm-ingredient-resolution" \
  -H 'content-type: application/json' --data @"${TMP}/confirm.json")
echo "${body}" | grep -q '"source":"USER"' || fail "confirm did not return a USER row: ${body}"
echo "${body}" | grep -q '"note":"halbiert"' || fail "confirm dropped the note: ${body}"

echo "▸ search sources=user (immediate findability)"
body=$(curl -s -b "${COOKIES}" "${BASE}/search-ingredients?q=cocktailtomaten&sources=user")
echo "${body}" | grep -q '"source":"USER"' || fail "overlay food not findable via USER search: ${body}"

echo "▸ export-and-clear"
body=$(curl -s -b "${COOKIES}" -X POST "${BASE}/export-user-foods")
echo "${body}" | grep -q '"kirschtomaten"' || fail "export missing the confirmed food: ${body}"
after=$(curl -s -b "${COOKIES}" "${BASE}/user-foods")
echo "${after}" | grep -q '"foods":\[\]' || fail "overlay not drained after export: ${after}"

echo "✅ smoke: backend resolution round-trip OK"
