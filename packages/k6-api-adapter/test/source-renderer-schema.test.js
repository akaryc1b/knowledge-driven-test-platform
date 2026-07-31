import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import { K6_API_SOURCE_RESULT_SCHEMA_VERSION } from '../src/index.js';

const ROOT = new URL('../../../', import.meta.url);

async function load(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
}

test('P2 Source Result Schema is strict Draft 2020-12', async () => {
  const schema = await load('schemas/execution/k6-api-source/v1/k6-api-source-result.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schemaVersion.const, K6_API_SOURCE_RESULT_SCHEMA_VERSION);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
  assert.equal(schema.properties.sourceIdentity.additionalProperties, false);
  assert.equal(schema.properties.safetyBoundary.additionalProperties, false);
  assert.deepEqual(schema.properties.moduleImports.prefixItems.map((item) => item.const),
    ['k6', 'k6/http']);
  assert.equal(schema.properties.sourceByteLength.maximum, 16_000_000);
  assert.equal(schema.properties.operationCount.maximum, 10_000);
});

test('P2 Evidence Schema is strict and preserves non-execution decisions', async () => {
  const schema = await load(
    'schemas/execution/k6-api-source/v1/m3-r2-source-generation-p2-evidence.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.decision.additionalProperties, false);
  assert.equal(schema.properties.decision.properties.sourceGenerated.const, true);
  assert.equal(schema.properties.decision.properties.sourceExecuted.const, false);
  assert.equal(schema.properties.decision.properties.executionRuntimeStarted.const, false);
  assert.equal(schema.properties.decision.properties.nextRequiredSlice.const, 'M3-R2-P3');
  for (const key of [
    'k6Invoked', 'xk6Invoked', 'playwrightInvoked', 'externalProcessExecuted',
    'nodeVmUsed', 'evalUsed', 'dynamicImportUsed', 'targetNetworkAccessed',
    'databaseAccessed', 'secretAccessed', 'runtimeResultCollected',
  ]) assert.equal(schema.properties.safetyBoundary.properties[key].const, false, key);
});

test('P2 uses an additive catalog without changing the accepted P1 catalog', async () => {
  const p1 = await load('schemas/execution/k6-api-source/schema-catalog.json');
  const p2 = await load('schemas/execution/k6-api-source/p2-schema-catalog.json');
  assert.equal(p1.schemaVersion, 1);
  assert.equal(Object.keys(p1.schemas).length, 4);
  assert.equal(p2.schemaVersion, 'k6-api-source-p2-schema-catalog/v1');
  assert.deepEqual(p2.schemas, {
    sourceResult: 'v1/k6-api-source-result.schema.json',
    p2Evidence: 'v1/m3-r2-source-generation-p2-evidence.schema.json',
  });
});
