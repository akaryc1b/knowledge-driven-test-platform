import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  K6_API_ASSERTION_SCHEMA_VERSION,
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
  K6_API_OPERATION_SCHEMA_VERSION,
  K6_API_REQUEST_GROUP_SCHEMA_VERSION,
  K6_API_THRESHOLD_SCHEMA_VERSION,
} from '../src/index.js';
import { compilation } from './test-helpers.js';

const root = resolve(import.meta.dirname, '../../..');

const expected = {
  currentExecutionSpec: K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
  currentRequestGroup: K6_API_REQUEST_GROUP_SCHEMA_VERSION,
  currentOperation: K6_API_OPERATION_SCHEMA_VERSION,
  currentAssertion: K6_API_ASSERTION_SCHEMA_VERSION,
  currentThreshold: K6_API_THRESHOLD_SCHEMA_VERSION,
  currentArtifactBundle: K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  currentCompilationEvidence: K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
};

test('k6 API schema catalog pins all versioned non-executable IR contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root,
    'schemas/execution/k6-api/schema-catalog.json'), 'utf8'));
  for (const [key, value] of Object.entries(expected)) assert.equal(catalog[key], value);
  assert.equal(catalog.currentValidationEvidence,
    'm3-r1-k6-api-spec-compiler-evidence/v1');
  assert.equal(Object.keys(catalog.schemas).length, 8);
  for (const path of Object.values(catalog.schemas)) {
    const schema = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});

test('generated objects use the pinned schema versions and contain no executable fields', async () => {
  const output = await compilation();
  assert.equal(output.spec.schemaVersion, K6_API_EXECUTION_SPEC_SCHEMA_VERSION);
  assert.equal(output.bundle.schemaVersion, K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION);
  assert.equal(output.evidence.schemaVersion, K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION);
  for (const group of output.spec.requestGroups) {
    assert.equal(group.schemaVersion, K6_API_REQUEST_GROUP_SCHEMA_VERSION);
    for (const operation of group.operations) {
      assert.equal(operation.schemaVersion, K6_API_OPERATION_SCHEMA_VERSION);
      for (const assertion of operation.assertions) {
        assert.equal(assertion.schemaVersion, K6_API_ASSERTION_SCHEMA_VERSION);
      }
      for (const threshold of operation.thresholds) {
        assert.equal(threshold.schemaVersion, K6_API_THRESHOLD_SCHEMA_VERSION);
      }
    }
  }
  for (const field of ['script', 'command', 'runtimeCommand', 'executorCode', 'javascriptSource']) {
    assert.equal(JSON.stringify(output).includes(`"${field}"`), false);
  }
});
