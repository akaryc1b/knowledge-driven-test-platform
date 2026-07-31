import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertK6ApiCompilationSafe,
  compileK6ApiExecutionSpec,
  computeK6ApiCompilationEvidenceDigest,
} from '../src/index.js';
import { compilerInput } from './test-helpers.js';

const ACCEPTED_COMPILATION_EVIDENCE_DIGEST =
  '7c5972c8901198dbe236d27c51fb10510bf7439a486efafcb5a46ca8860ca65e';

test('safety rejects ordinary named, async and generator function declarations', () => {
  for (const source of [
    'function payload() { return 1; }',
    'async function payload() { return 1; }',
    'function* payload() { yield 1; }',
  ]) {
    assert.throws(
      () => assertK6ApiCompilationSafe({ expected: source }),
      (error) => error.code === 'K6_API_EXECUTABLE_SOURCE_FORBIDDEN',
      `${source} must be rejected`,
    );
  }
});

test('evidence integrity preserves the accepted digest and detects changed safety claims', async () => {
  const output = compileK6ApiExecutionSpec(await compilerInput());
  const evidence = output.evidence;
  assert.equal(evidence.evidenceDigest, ACCEPTED_COMPILATION_EVIDENCE_DIGEST);
  assert.equal(evidence.evidenceDigest, computeK6ApiCompilationEvidenceDigest(evidence));

  const changedDecision = structuredClone(evidence);
  changedDecision.decision.k6Invoked = true;
  assert.notEqual(computeK6ApiCompilationEvidenceDigest(changedDecision), evidence.evidenceDigest);

  const changedSafety = structuredClone(evidence);
  changedSafety.safetyBoundary.secretAccessed = true;
  assert.notEqual(computeK6ApiCompilationEvidenceDigest(changedSafety), evidence.evidenceDigest);

  const changedMetadata = structuredClone(evidence);
  changedMetadata.metadata.compiledAt = '2099-01-01T00:00:00.000Z';
  assert.equal(computeK6ApiCompilationEvidenceDigest(changedMetadata), evidence.evidenceDigest);
});

test('assertion schema is a closed discriminated union', async () => {
  const { readFile } = await import('node:fs/promises');
  const { resolve } = await import('node:path');
  const root = resolve(import.meta.dirname, '../../..');
  const schema = JSON.parse(await readFile(resolve(root,
    'schemas/execution/k6-api/v1/k6-api-assertion.schema.json'), 'utf8'));

  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.oneOf.length, 3);
  const byKind = Object.fromEntries(schema.oneOf
    .map((variant) => [variant.properties.kind.const, variant]));
  assert.deepEqual(Object.keys(byKind).sort(), [
    'JSON_PATH_EQUALS', 'JSON_PATH_EXISTS', 'STATUS_CODE_IN',
  ]);
  assert.equal(byKind.STATUS_CODE_IN.properties.operator.const, 'IN');
  assert(byKind.STATUS_CODE_IN.required.includes('expected'));
  assert.equal(byKind.STATUS_CODE_IN.properties.expected.items.minimum, 100);
  assert.equal(byKind.STATUS_CODE_IN.properties.expected.items.maximum, 599);
  assert.equal(byKind.JSON_PATH_EXISTS.properties.operator.const, 'EXISTS');
  assert(byKind.JSON_PATH_EXISTS.required.includes('path'));
  assert.equal(byKind.JSON_PATH_EQUALS.properties.operator.const, 'EQUALS');
  assert(byKind.JSON_PATH_EQUALS.required.includes('path'));
  assert(byKind.JSON_PATH_EQUALS.required.includes('expected'));
});
