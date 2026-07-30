import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION,
  EXECUTION_EVIDENCE_SCHEMA_VERSION,
  EXECUTION_FAILURE_SCHEMA_VERSION,
  EXECUTION_REQUEST_SCHEMA_VERSION,
  EXECUTION_RESULT_SCHEMA_VERSION,
} from '../src/index.js';

const root = resolve(import.meta.dirname, '../../..');

test('execution schema catalog pins all M3-R0 contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root,
    'schemas/execution/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentAdapterDescriptor, EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION);
  assert.equal(catalog.currentExecutionRequest, EXECUTION_REQUEST_SCHEMA_VERSION);
  assert.equal(catalog.currentExecutionFailure, EXECUTION_FAILURE_SCHEMA_VERSION);
  assert.equal(catalog.currentExecutionResult, EXECUTION_RESULT_SCHEMA_VERSION);
  assert.equal(catalog.currentExecutionEvidence, EXECUTION_EVIDENCE_SCHEMA_VERSION);
  for (const path of Object.values(catalog.schemas)) {
    const schema = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});
