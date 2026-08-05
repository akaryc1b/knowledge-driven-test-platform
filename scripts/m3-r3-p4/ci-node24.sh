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
total_positive=false
passed_equal_total=false
failed_zero=false
digest_valid=false
digest_equal=false
if test "$total" -gt 0; then total_positive=true; fi
if test "$passed" -eq "$total"; then passed_equal_total=true; fi
if test "$failed" -eq 0; then failed_zero=true; fi
if test "${#digest}" -eq 64; then digest_valid=true; fi
if test "$digest_valid" = true \
    && test "$digest" = "$M3_R3_P4_NODE22_PRODUCT_DIGEST"; then
  digest_equal=true
fi
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
{
  echo "node_status=$node_status"
  echo "total_positive=$total_positive"
  echo "passed_equal_total=$passed_equal_total"
  echo "failed_zero=$failed_zero"
  echo "digest_valid=$digest_valid"
  echo "digest_equal=$digest_equal"
  echo "total=$total"
  echo "passed=$passed"
  echo "failed=$failed"
  echo "digest=$digest"
} >> "$GITHUB_OUTPUT"
printf 'M3_R3_P4_NODE24_TOTAL=%s\n' "$total" >> "$GITHUB_ENV"
printf 'M3_R3_P4_NODE24_PASSED=%s\n' "$passed" >> "$GITHUB_ENV"
printf 'M3_R3_P4_NODE24_FAILED=%s\n' "$failed" >> "$GITHUB_ENV"
printf 'M3_R3_P4_NODE24_PRODUCT_DIGEST=%s\n' "$digest" >> "$GITHUB_ENV"
