set -euo pipefail
set +e
node --test packages/k6-api-adapter/test/compatibility-determinism-acceptance.test.js \
  > /tmp/m3-r3-p4-compatibility-node24.tap 2>&1
node_status=$?
set -e
total="$(awk '/^# tests /{value=$3} END{print value+0}' \
  /tmp/m3-r3-p4-compatibility-node24.tap)"
passed="$(awk '/^# pass /{value=$3} END{print value+0}' \
  /tmp/m3-r3-p4-compatibility-node24.tap)"
failed="$(awk '/^# fail /{value=$3} END{print value+0}' \
  /tmp/m3-r3-p4-compatibility-node24.tap)"
digest="$(sed -n 's/^# compatibilityProductDigest=//p' \
  /tmp/m3-r3-p4-compatibility-node24.tap | tail -1)"
echo "node24TestExitStatus=$node_status"
echo "node24CompatibilityTotal=$total"
echo "node24CompatibilityPassed=$passed"
echo "node24CompatibilityFailed=$failed"
echo "node24CompatibilityProductDigest=$digest"
echo "node22ExpectedProductDigest=$M3_R3_P4_NODE22_PRODUCT_DIGEST"
if test "$node_status" -ne 0; then
  echo '--- Node 24 TAP failure tail ---'
  tail -80 /tmp/m3-r3-p4-compatibility-node24.tap
fi
test "$node_status" -eq 0
test "$total" -gt 0
test "$passed" -eq "$total"
test "$failed" -eq 0
test "${#digest}" -eq 64
test "$digest" = "$M3_R3_P4_NODE22_PRODUCT_DIGEST"
printf 'M3_R3_P4_NODE24_TOTAL=%s\n' "$total" >> "$GITHUB_ENV"
printf 'M3_R3_P4_NODE24_PASSED=%s\n' "$passed" >> "$GITHUB_ENV"
printf 'M3_R3_P4_NODE24_FAILED=%s\n' "$failed" >> "$GITHUB_ENV"
printf 'M3_R3_P4_NODE24_PRODUCT_DIGEST=%s\n' "$digest" >> "$GITHUB_ENV"
echo "crossNodeCompatibilityProductDigest=$digest"
