import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { test } from 'node:test';

const root = new URL('../../../schemas/execution/k6-api-source/', import.meta.url);
const schemaNames = [
  'k6-api-source-publication-bundle.schema.json',
  'k6-api-source-publication-receipt.schema.json',
  'k6-api-source-publication-evidence.schema.json',
  'm3-r2-source-generation-p4-evidence.schema.json',
];

async function json(path) { return JSON.parse(await readFile(new URL(path, root), 'utf8')); }

test('P4 schema catalog pins all publication contracts', async () => {
  const catalog = await json('p4-schema-catalog.json');
  assert.equal(catalog.schemaVersion, 'k6-api-source-p4-schema-catalog/v1');
  assert.deepEqual(catalog.schemas.map((item) => item.schemaVersion), [
    'k6-api-source-publication-bundle/v1',
    'k6-api-source-publication-receipt/v1',
    'k6-api-source-publication-evidence/v1',
    'm3-r2-source-generation-p4-evidence/v1',
  ]);
});

test('P4 schemas are strict Draft 2020-12 contracts', async () => {
  for (const name of schemaNames) {
    const schema = await json(`v1/${name}`);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.type, 'object');
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort());
  }
});

test('P4 publication Evidence fixes local persistence and non-execution claims', async () => {
  const schema = await json('v1/k6-api-source-publication-evidence.schema.json');
  assert.equal(schema.properties.decision.properties.sourcePersisted.const, true);
  assert.equal(schema.properties.decision.properties.artifactPublished.const, true);
  assert.equal(schema.properties.decision.properties.remoteArtifactPublished.const, false);
  assert.equal(schema.properties.decision.properties.sourceExecuted.const, false);
  assert.equal(schema.properties.safetyBoundary.properties.targetNetworkAccessed.const, false);
  assert.equal(schema.properties.safetyBoundary.properties.artifactStorageAccessed.const, true);
});
