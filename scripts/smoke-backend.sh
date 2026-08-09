#!/usr/bin/env bash
# Boot the backend with throwaway auth config and run an authenticated round-trip
# through the non-AI catalog endpoints (confirm → search → edit → export → delete).
# Verifies the wiring + catalog persistence end-to-end without needing an API key.
#
# macOS-friendly: no `timeout` (not installed by default) — uses a bash poll loop.
set -euo pipefail

BACKEND_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../backend" && pwd)"
PORT=3000
BASE="http://localhost:${PORT}"
CATALOG="${BACKEND_DIR}/data/catalog.json"
TMP="$(mktemp -d)"
COOKIES="${TMP}/cookies.txt"
BACKEND_PID=""

cleanup() {
  [ -n "${BACKEND_PID}" ] && kill "${BACKEND_PID}" 2>/dev/null || true
  # Restore the catalog the smoke run wrote to.
  if [ -f "${CATALOG}.smoke-bak" ]; then mv -f "${CATALOG}.smoke-bak" "${CATALOG}"; fi
  rm -rf "${TMP}"
}
trap cleanup EXIT

fail() { echo "❌ smoke: $1" >&2; exit 1; }
expect() { [ "$1" = "$2" ] || fail "expected status $2, got $1 ($3)"; }

# Free the port and stash the real catalog so the smoke run is non-destructive.
lsof -ti:${PORT} 2>/dev/null | xargs kill -9 2>/dev/null || true
[ -f "${CATALOG}" ] && cp "${CATALOG}" "${CATALOG}.smoke-bak"

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

echo "▸ confirm new-food (Kirschtomaten) → catalog"
cat >"${TMP}/confirm.json" <<'JSON'
{"kind":"new-food","entry":{"id":"kirschtomaten","name":"Kirschtomaten","synonyms":["Cocktailtomaten"],"unit":"g","macrosPer100":{"calories":20,"protein":0.9,"carbs":3.9,"fat":0.2}},"original":{"amount":50,"unit":"g","note":"halbiert"}}
JSON
body=$(curl -s -b "${COOKIES}" -X POST "${BASE}/confirm-ingredient-resolution" \
  -H 'content-type: application/json' --data @"${TMP}/confirm.json")
echo "${body}" | grep -q '"source":"CATALOG"' || fail "confirm did not return a CATALOG row: ${body}"
echo "${body}" | grep -q '"note":"halbiert"' || fail "confirm dropped the note: ${body}"

echo "▸ search sources=catalog (immediate findability, via synonym)"
body=$(curl -s -b "${COOKIES}" "${BASE}/search-ingredients?q=cocktailtomaten&sources=catalog")
echo "${body}" | grep -q '"source":"CATALOG"' || fail "confirmed food not findable in the catalog: ${body}"

echo "▸ learn a synonym on an existing entry"
body=$(curl -s -b "${COOKIES}" -X POST "${BASE}/confirm-ingredient-resolution" \
  -H 'content-type: application/json' \
  --data '{"kind":"synonym","foodId":"kirschtomaten","synonym":"Kirschtomate klein","original":{"amount":25,"unit":"g"}}')
echo "${body}" | grep -q '"source":"CATALOG"' || fail "synonym confirm did not return a CATALOG row: ${body}"
body=$(curl -s -b "${COOKIES}" "${BASE}/search-ingredients?q=kirschtomate%20klein&sources=catalog")
echo "${body}" | grep -q '"kirschtomaten"' || fail "learned synonym not searchable: ${body}"

echo "▸ correct the entry's macros"
code=$(curl -s -b "${COOKIES}" -o "${TMP}/update.json" -w '%{http_code}' -X POST "${BASE}/update-catalog-entry" \
  -H 'content-type: application/json' \
  --data '{"id":"kirschtomaten","entry":{"name":"Kirschtomaten","synonyms":["Cocktailtomaten"],"unit":"g","macrosPer100":{"calories":18,"protein":0.9,"carbs":3.9,"fat":0.2}}}')
expect "${code}" "200" "update-catalog-entry"
body=$(curl -s -b "${COOKIES}" "${BASE}/search-ingredients?q=kirschtomaten&sources=catalog")
echo "${body}" | grep -q '"calories":0.18' || fail "corrected macros not reflected in search: ${body}"

echo "▸ duplicate create is rejected"
code=$(curl -s -b "${COOKIES}" -o "${TMP}/dup.json" -w '%{http_code}' -X POST "${BASE}/add-catalog-entry" \
  -H 'content-type: application/json' \
  --data '{"entry":{"name":"Kirschtomaten","synonyms":[],"unit":"g","macrosPer100":{"calories":1,"protein":0,"carbs":0,"fat":0}}}')
expect "${code}" "400" "duplicate add-catalog-entry"
grep -q 'catalog-entry-exists' "${TMP}/dup.json" || fail "duplicate error missing its code: $(cat "${TMP}/dup.json")"

echo "▸ export snapshot (non-draining)"
body=$(curl -s -b "${COOKIES}" "${BASE}/export-catalog")
echo "${body}" | grep -q '"kirschtomaten"' || fail "export missing the confirmed food: ${body}"
before=$(curl -s -b "${COOKIES}" "${BASE}/catalog" | grep -o '"id"' | wc -l | tr -d ' ')
after=$(curl -s -b "${COOKIES}" "${BASE}/catalog" | grep -o '"id"' | wc -l | tr -d ' ')
[ "${before}" = "${after}" ] || fail "catalog changed across exports (${before} → ${after})"

echo "▸ delete the entry"
code=$(curl -s -b "${COOKIES}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/remove-catalog-entry" \
  -H 'content-type: application/json' --data '{"id":"kirschtomaten"}')
expect "${code}" "200" "remove-catalog-entry"
body=$(curl -s -b "${COOKIES}" "${BASE}/search-ingredients?q=kirschtomaten&sources=catalog")
# Other catalog entries may legitimately match the query (a synonym on a sibling food);
# what must be gone is the deleted entry itself. `if` rather than `&&` so the
# happy path (grep finds nothing) doesn't trip `set -e`.
if echo "${body}" | grep -q '"id":"kirschtomaten"'; then fail "deleted entry still searchable: ${body}"; fi
code=$(curl -s -b "${COOKIES}" -o /dev/null -w '%{http_code}' -X POST "${BASE}/remove-catalog-entry" \
  -H 'content-type: application/json' --data '{"id":"kirschtomaten"}')
expect "${code}" "404" "remove unknown entry"

echo "✅ smoke: backend catalog round-trip OK"
