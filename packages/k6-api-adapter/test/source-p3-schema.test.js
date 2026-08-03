import { readFile } from 'node:fs/promises';
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION,
  K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_SOURCE_STATIC_CHECK_IDS,
} from '../src/index.js';

const ROOT = new URL('../../../', import.meta.url);
async function load(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
}

test('P3 Source Artifact Schema is strict Draft 2020-12 and in-memory only', async () => {
  const schema = await load(
    'schemas/execution/k6-api-source/v1/k6-api-source-artifact.schema.json');
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.properties.schemaVersion.const, K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION);
  assert.equal(schema.additionalProperties, false);
  assert.deepEqual(new Set(schema.required), new Set(Object.keys(schema.properties)));
  assert.equal(schema.properties.persistence.const, 'IN_MEMORY_ONLY');
  assert.equal(schema.properties.published.const, false);
  assert.equal(schema.properties.sourceIdentity.additionalProperties, false);
  assert.equal(schema.properties.provenance.additionalProperties, false);
  assert.equal(schema.properties.validationReport.additionalProperties, false);
  assert.equal(schema.properties.safetyBoundary.additionalProperties, false);
});

test('P3 Validation Evidence Schema fixes validator, checks and non-execution decision', async () => {
  const schema = await load(
    'schemas/execution/k6-api-source/v1/k6-api-source-validation-evidence.schema.json');
  assert.equal(schema.properties.schemaVersion.const,
    K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION);
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.validator.additionalProperties, false);
  assert.deepEqual(schema.properties.validator.properties.checkIds.prefixItems
    .map((item) => item.const), [...K6_API_SOURCE_STATIC_CHECK_IDS]);
  assert.equal(schema.properties.decision.properties.sourceStaticallyValidated.const, true);
  assert.equal(schema.properties.decision.properties.sourcePersisted.const, false);
  assert.equal(schema.properties.decision.properties.artifactPublished.const, false);
  assert.equal(schema.properties.decision.properties.sourceExecuted.const, false);
  assert.equal(schema.properties.decision.properties.nextRequiredSlice.const, 'M3-R2-P4');
});

test('P3 Evidence Schema and additive catalog preserve the P2 contracts', async () => {
  const p2 = await load('schemas/execution/k6-api-source/p2-schema-catalog.json');
  const p3 = await load('schemas/execution/k6-api-source/p3-schema-catalog.json');
  const schema = await load(
    'schemas/execution/k6-api-source/v1/m3-r2-source-generation-p3-evidence.schema.json');
  assert.equal(p2.schemaVersion, 'k6-api-source-p2-schema-catalog/v1');
  assert.equal(p3.schemaVersion, 'k6-api-source-p3-schema-catalog/v1');
  assert.deepEqual(p3.schemas, {
    sourceArtifact: 'v1/k6-api-source-artifact.schema.json',
    sourceValidationEvidence: 'v1/k6-api-source-validation-evidence.schema.json',
    p3Evidence: 'v1/m3-r2-source-generation-p3-evidence.schema.json',
  });
  assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.equal(schema.additionalProperties, false);
  assert.equal(schema.properties.decision.properties.nextRequiredSlice.const, 'M3-R2-P4');
  assert.equal(schema.properties.safetyBoundary.additionalProperties, false);
});
