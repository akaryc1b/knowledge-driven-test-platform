set -euo pipefail
node scripts/m3-r3-g1/scope-audit.js

node --test --test-reporter=tap \
  packages/k6-api-adapter/test/m3-r3-g1-formal-acceptance.test.js \
  > /tmp/m3-r3-g1-focused-node22.tap 2>&1
node --test --test-reporter=tap packages/k6-api-adapter/test/*.test.js \
  > /tmp/m3-r3-g1-adapter-node22.tap 2>&1
npm test > /tmp/m3-r3-g1-full-node22.tap 2>&1
node --test --test-reporter=tap \
  packages/k6-api-adapter/test/compatibility-determinism-acceptance.test.js \
  > /tmp/m3-r3-g1-compatibility-node22.tap 2>&1

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
parse_tap M3_R3_G1_FOCUSED /tmp/m3-r3-g1-focused-node22.tap
parse_tap M3_R3_G1_ADAPTER /tmp/m3-r3-g1-adapter-node22.tap
parse_tap M3_R3_G1_FULL /tmp/m3-r3-g1-full-node22.tap
parse_tap M3_R3_G1_NODE22 /tmp/m3-r3-g1-compatibility-node22.tap

digest="$(sed -n 's/^# compatibilityProductDigest=//p' \
  /tmp/m3-r3-g1-compatibility-node22.tap | tail -1)"
test "${#digest}" -eq 64
test "$digest" = \
  "9bf593893d370448ece828710969eb3b838951ae6e4df5a82c462b1b23d739dd"
printf 'M3_R3_G1_NODE22_PRODUCT_DIGEST=%s\n' "$digest" >> "$GITHUB_ENV"
echo "node22CompatibilityProductDigest=$digest"

npm run validate
node scripts/validate-m3-r3-g1-formal-acceptance.js
npm run validate:m3-r3-p4-fault-security-compatibility
npm run validate:m3-r3-p3-sanitized-runtime-result
npm run validate:m3-r3-p2-bounded-process-lifecycle
npm run validate:m3-r3-p1-local-process-boundary
npm run validate:m3-r3-runtime-admission
npm run validate:m3-r2-source-generation-p5
npm run validate:m3-r1-k6-api-spec-compiler
npm run validate:m3-r0-execution-contracts
npm run validate:m2-final-release-closure

printf 'M3_R3_G1_REPOSITORY_VALIDATOR=success\n' >> "$GITHUB_ENV"
printf 'M3_R3_G1_VALIDATOR=success\n' >> "$GITHUB_ENV"
printf 'M3_R3_G1_PREDECESSOR_VALIDATORS=success\n' >> "$GITHUB_ENV"
