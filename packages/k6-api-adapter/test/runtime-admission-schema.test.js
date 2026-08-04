import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runtimeAdmissionFixture } from './runtime-admission-test-helpers.js';

const ROOT = new URL('../../../', import.meta.url);
const paths = {
  catalog: 'schemas/execution/k6-api-runtime/schema-catalog.json',
  policy: 'schemas/execution/k6-api-runtime/v1/k6-api-runtime-policy.schema.json',
  admission: 'schemas/execution/k6-api-runtime/v1/k6-api-runtime-admission-request.schema.json',
  plan: 'schemas/execution/k6-api-runtime/v1/k6-api-invocation-plan.schema.json',
  evidence: 'schemas/execution/k6-api-runtime/v1/k6-api-runtime-admission-evidence.schema.json',
  acceptance: 'schemas/execution/k6-api-runtime/v1/m3-r3-runtime-admission-r0-evidence.schema.json',
};

async function json(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
}

function assertClosed(schema, label) {
  assert.equal(schema.type, 'object', `${label} type`);
  assert.equal(schema.additionalProperties, false, `${label} additionalProperties`);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(),
    `${label} every property required`);
}

test('R0 runtime schema catalog pins every versioned contract', async () => {
  const catalog = await json(paths.catalog);
  assert.equal(catalog.schemaVersion, 'k6-api-runtime-schema-catalog/v1');
  assert.deepEqual(catalog.schemas, [
    { schemaVersion: 'k6-api-runtime-policy/v1', path: paths.policy },
    { schemaVersion: 'k6-api-runtime-admission-request/v1', path: paths.admission },
    { schemaVersion: 'k6-api-invocation-plan/v1', path: paths.plan },
    { schemaVersion: 'k6-api-runtime-admission-evidence/v1', path: paths.evidence },
    { schemaVersion: 'm3-r3-runtime-admission-r0-evidence/v1', path: paths.acceptance },
  ]);
});

test('R0 runtime schemas are closed Draft 2020-12 contracts', async () => {
  for (const [label, path] of Object.entries(paths).filter(([key]) => key !== 'catalog')) {
    const schema = await json(path);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assertClosed(schema, label);
  }
  const admission = await json(paths.admission);
  assertClosed(admission.properties.executionRequest, 'executionRequest');
  assertClosed(admission.properties.executionRequest.properties.adapter, 'adapter');
  assertClosed(admission.properties.source, 'source');
  assertClosed(admission.properties.metadata, 'metadata');
  assertClosed(admission.$defs.resources, 'resources');
  const plan = await json(paths.plan);
  assertClosed(plan.properties.runtime, 'plan.runtime');
  assertClosed(plan.properties.source, 'plan.source');
  assertClosed(plan.properties.resources, 'plan.resources');
  for (const path of [paths.evidence, paths.acceptance]) {
    const evidence = await json(path);
    assertClosed(evidence.properties.decision, `${path}.decision`);
    assertClosed(evidence.properties.safetyBoundary, `${path}.safetyBoundary`);
  }
});

test('R0 schemas fix admission-only and non-execution claims', async () => {
  const policy = await json(paths.policy);
  assert.equal(policy.properties.implementationStatus.const, 'ADMISSION_ONLY');
  assert.equal(policy.properties.shellAllowed.const, false);
  assert.equal(policy.properties.executable.const, 'k6');
  const plan = await json(paths.plan);
  assert.equal(plan.properties.executionAuthorized.const, false);
  assert.equal(plan.properties.runtime.properties.shellAllowed.const, false);
  for (const path of [paths.evidence, paths.acceptance]) {
    const evidence = await json(path);
    assert.equal(evidence.properties.decision.properties.executionImplementationStarted.const, false);
    assert.equal(evidence.properties.decision.properties.nextRequiredSlice.const, 'M3-R3-P1');
    assert.ok(Object.values(evidence.properties.safetyBoundary.properties)
      .every((property) => property.const === false));
  }
});

test('R0 produced objects match the schema field sets and fixed constants', async () => {
  const fixture = await runtimeAdmissionFixture();
  for (const [value, path] of [
    [fixture.policy, paths.policy],
    [fixture.admissionRequest, paths.admission],
    [fixture.invocationPlan, paths.plan],
    [fixture.admissionEvidence, paths.evidence],
  ]) {
    const schema = await json(path);
    assert.deepEqual(Object.keys(value).sort(), Object.keys(schema.properties).sort());
    for (const [field, property] of Object.entries(schema.properties)) {
      if (Object.hasOwn(property, 'const')) assert.equal(value[field], property.const, field);
    }
  }
  assert.equal(join('source', 'main.js'), fixture.invocationPlan.source.relativePath);
});
