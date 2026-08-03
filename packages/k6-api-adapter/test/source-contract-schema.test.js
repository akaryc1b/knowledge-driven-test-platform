import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import {
  K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
  K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
  K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
  createK6ApiSourceGenerationRequest,
  createK6ApiSourceGeneratorDescriptor,
} from '../src/index.js';
import { compilation } from './test-helpers.js';

const root = resolve(import.meta.dirname, '../../..');

test('P1 schema catalog pins strict versioned source-generation contracts', async () => {
  const catalog = JSON.parse(await readFile(resolve(root,
    'schemas/execution/k6-api-source/schema-catalog.json'), 'utf8'));
  assert.equal(catalog.currentRenderingPolicy,
    K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION);
  assert.equal(catalog.currentGeneratorDescriptor,
    K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION);
  assert.equal(catalog.currentGenerationRequest,
    K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION);
  assert.equal(catalog.currentValidationEvidence,
    'm3-r2-source-generation-p1-evidence/v1');
  assert.equal(Object.keys(catalog.schemas).length, 4);
  for (const path of Object.values(catalog.schemas)) {
    const schema = JSON.parse(await readFile(resolve(root, path), 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
  }
});

test('P1 schemas and objects remain contract-only and non-generating', async () => {
  const output = await compilation();
  const descriptor = createK6ApiSourceGeneratorDescriptor();
  const request = createK6ApiSourceGenerationRequest({
    descriptor,
    spec: output.spec,
    bundle: output.bundle,
    compilationEvidence: output.evidence,
    requestedAt: '2026-07-31T05:00:00.000Z',
    requestedBy: 'm3-r2-p1-schema-test',
  });
  assert.equal(descriptor.schemaVersion,
    K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION);
  assert.equal(request.schemaVersion, K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION);
  const serialized = JSON.stringify({ descriptor, request });
  for (const forbidden of [
    '"sourceText"', '"sourceBytes"', '"generatedSource"', '"javascriptSource"',
    '"runtimeCommand"', '"executionResult"', '"artifactManifest"',
  ]) assert.equal(serialized.includes(forbidden), false);
});
