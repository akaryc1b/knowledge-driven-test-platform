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

const root = resolve(import.meta.dirname, '../../..');

test('mapping contract constants match the pinned Schema Catalog', async () => {
  const catalog = JSON.parse(await readFile(resolve(root,
    'schemas/execution/k6-api/schema-catalog.json'), 'utf8'));
  assert.deepEqual({
    currentExecutionSpec: K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    currentRequestGroup: K6_API_REQUEST_GROUP_SCHEMA_VERSION,
    currentOperation: K6_API_OPERATION_SCHEMA_VERSION,
    currentAssertion: K6_API_ASSERTION_SCHEMA_VERSION,
    currentThreshold: K6_API_THRESHOLD_SCHEMA_VERSION,
    currentArtifactBundle: K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
    currentCompilationEvidence: K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  }, Object.fromEntries(Object.entries(catalog).filter(([key]) => key.startsWith('current')
    && key !== 'currentValidationEvidence')));
});
