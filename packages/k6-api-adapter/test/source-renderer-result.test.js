import { createHash } from 'node:crypto';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BODY_ARTIFACT,
  K6_API_SOURCE_ALLOWED_MODULES,
  computeK6ApiSourceResultDigest,
  expectRejected,
  renderK6ApiSource,
  rendererBindings,
  validRendering,
  validateK6ApiRenderedSource,
  validateK6ApiSourceResult,
} from './source-renderer-test-support.js';

test('Source digest independently recomputes from exact UTF-8 bytes', () => {
  const result = renderK6ApiSource(rendererBindings());
  const independent = createHash('sha256').update(Buffer.from(result.source, 'utf8')).digest('hex');
  assert.equal(result.sourceDigest, independent);
  assert.equal(result.sourceByteLength, Buffer.byteLength(result.source, 'utf8'));
  assert.equal(result.sourceLineCount, (result.source.match(/\n/g) ?? []).length);
});

test('Source Result digest independently recomputes', () => {
  const result = renderK6ApiSource(rendererBindings());
  assert.equal(computeK6ApiSourceResultDigest(result), result.resultDigest);
});

test('Source Result is defensively copied and deeply frozen', () => {
  const input = rendererBindings();
  const result = renderK6ApiSource(input);
  const original = result.sourceIdentity.specDigest;
  input.spec.specDigest = '0'.repeat(64);
  assert.equal(result.sourceIdentity.specDigest, original);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.sourceIdentity), true);
  assert.equal(Object.isFrozen(result.moduleImports), true);
  assert.equal(Object.isFrozen(result.safetyBoundary), true);
});

test('Source Result validator rejects additional properties', () => {
  const { input, result } = validRendering(rendererBindings);
  expectRejected(() => validateK6ApiSourceResult({ ...result, executed: true }, input));
});

test('Source Result validator rejects tampered Source bytes', () => {
  const { input, result } = validRendering(rendererBindings);
  expectRejected(() => validateK6ApiSourceResult({ ...result, source: `${result.source}//x\n` }, input));
});

test('canonical Source uses exact fixed module imports and order', () => {
  const result = renderK6ApiSource(rendererBindings());
  assert.deepEqual(result.moduleImports, [...K6_API_SOURCE_ALLOWED_MODULES]);
  assert.equal(result.source.split('\n').slice(0, 2).join('\n'),
    "import { check, group } from 'k6';\nimport http from 'k6/http';");
});

test('canonical Source maps groups, operations, assertions, thresholds and tags', () => {
  const result = renderK6ApiSource(rendererBindings());
  assert.equal(result.operationCount, 3);
  assert.equal(result.assertionCount, 7);
  assert.equal(result.thresholdCount, 3);
  for (const pattern of [
    /http\.request\(/, /status-code-in:/, /json-path-exists:/, /json-path-equals:/,
    /http_req_duration\{operation_id:/, /checks\{operation_id:/,
    /body_artifact_digest/, /intent_tag_/,
  ]) assert.match(result.source, pattern);
});

test('static validator accepts only the exact canonical Source for its bindings', () => {
  const { input, result } = validRendering(rendererBindings);
  assert.equal(validateK6ApiRenderedSource(result.source, input), true);
  assert.deepEqual(validateK6ApiSourceResult(result, input), result);
});

test('P2 safety boundary records generation without execution', () => {
  const result = renderK6ApiSource(rendererBindings());
  assert.equal(result.safetyBoundary.sourceGenerated, true);
  for (const [key, value] of Object.entries(result.safetyBoundary)) {
    if (key !== 'sourceGenerated') assert.equal(value, false, key);
  }
});

test('request body is represented only by its immutable Artifact reference', () => {
  const result = renderK6ApiSource(rendererBindings());
  assert.match(result.source, new RegExp(BODY_ARTIFACT.digest));
  assert.match(result.source, /artifact:\/\/sha256\//);
  assert.doesNotMatch(result.source, /approvalAmount|customerName|payloadValue/);
});
