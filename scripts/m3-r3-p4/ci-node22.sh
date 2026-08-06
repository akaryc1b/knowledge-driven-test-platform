set -euo pipefail
node --test --test-reporter=tap \
  packages/k6-api-adapter/test/fault-security-compatibility-r0.test.js \
  packages/k6-api-adapter/test/fault-lifecycle-race-acceptance.test.js \
  packages/k6-api-adapter/test/adversarial-runtime-security-acceptance.test.js \
  packages/k6-api-adapter/test/compatibility-determinism-acceptance.test.js \
  packages/k6-api-adapter/test/fault-security-compatibility-validator.test.js \
  > /tmp/m3-r3-p4-focused-node22.tap 2>&1
node --test --test-reporter=tap packages/k6-api-adapter/test/*.test.js \
  > /tmp/m3-r3-p4-adapter-node22.tap 2>&1
npm test > /tmp/m3-r3-p4-full-node22.tap 2>&1
node --test --test-reporter=tap \
  packages/k6-api-adapter/test/compatibility-determinism-acceptance.test.js \
  > /tmp/m3-r3-p4-compatibility-node22.tap 2>&1
parse_tap() {
  local prefix="$1" file="$2" total passed failed skipped
  total="$(awk '/^# tests /{value=$3} END{print value+0}' "$file")"
  passed="$(awk '/^# pass /{value=$3} END{print value+0}' "$file")"
  failed="$(awk '/^# fail /{value=$3} END{print value+0}' "$file")"
  skipped="$(awk '/^# skipped /{value=$3} END{print value+0}' "$file")"
  test "$total" -gt 0
  test "$failed" -eq 0
  printf '%s_TOTAL=%s\n%s_PASSED=%s\n%s_FAILED=%s\n%s_SKIPPED=%s\n' \
    "$prefix" "$total" "$prefix" "$passed" "$prefix" "$failed" \
    "$prefix" "$skipped" >> "$GITHUB_ENV"
  echo "${prefix,,}Total=$total"
  echo "${prefix,,}Passed=$passed"
  echo "${prefix,,}Failed=$failed"
  echo "${prefix,,}Skipped=$skipped"
}
parse_tap M3_R3_P4_FOCUSED /tmp/m3-r3-p4-focused-node22.tap
parse_tap M3_R3_P4_ADAPTER /tmp/m3-r3-p4-adapter-node22.tap
parse_tap M3_R3_P4_FULL /tmp/m3-r3-p4-full-node22.tap
parse_tap M3_R3_P4_NODE22 /tmp/m3-r3-p4-compatibility-node22.tap
digest="$(sed -n 's/^# compatibilityProductDigest=//p' \
  /tmp/m3-r3-p4-compatibility-node22.tap | tail -1)"
test "${#digest}" -eq 64
printf 'M3_R3_P4_NODE22_PRODUCT_DIGEST=%s\n' "$digest" >> "$GITHUB_ENV"
echo "node22CompatibilityProductDigest=$digest"
npm run validate
npm run validate:m3-r3-p4-fault-security-compatibility
npm run validate:m3-r3-p3-sanitized-runtime-result
npm run validate:m3-r3-p2-bounded-process-lifecycle
npm run validate:m3-r3-p1-local-process-boundary
npm run validate:m3-r3-runtime-admission
npm run validate:m3-r2-source-generation-p5
npm run validate:m3-r1-k6-api-spec-compiler
npm run validate:m3-r0-execution-contracts
npm run validate:m2-final-release-closure
npm run validate:m2-portable-release-readiness
npm run validate:m2-r2a-external-evidence-intake
printf 'M3_R3_P4_REPOSITORY_VALIDATOR=success\n' >> "$GITHUB_ENV"
printf 'M3_R3_P4_PREDECESSOR_VALIDATORS=success\n' >> "$GITHUB_ENV"
