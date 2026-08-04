import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { localProcessBoundaryFixture } from './local-process-boundary-test-helpers.js';

const ROOT = new URL('../../../', import.meta.url);
const paths = {
  r0Catalog: 'schemas/execution/k6-api-runtime/schema-catalog.json',
  catalog: 'schemas/execution/k6-api-runtime/p1-schema-catalog.json',
  port: 'schemas/execution/k6-api-runtime/v1/k6-local-process-port.schema.json',
  specification:
    'schemas/execution/k6-api-runtime/v1/k6-process-launch-specification.schema.json',
  decision: 'schemas/execution/k6-api-runtime/v1/k6-process-launch-decision.schema.json',
  evidence: 'schemas/execution/k6-api-runtime/v1/k6-process-boundary-evidence.schema.json',
  acceptance:
    'schemas/execution/k6-api-runtime/v1/m3-r3-local-process-boundary-p1-evidence.schema.json',
};

const acceptedR0Schemas = [
  { schemaVersion: 'k6-api-runtime-policy/v1',
    path: 'schemas/execution/k6-api-runtime/v1/k6-api-runtime-policy.schema.json' },
  { schemaVersion: 'k6-api-runtime-admission-request/v1',
    path: 'schemas/execution/k6-api-runtime/v1/k6-api-runtime-admission-request.schema.json' },
  { schemaVersion: 'k6-api-invocation-plan/v1',
    path: 'schemas/execution/k6-api-runtime/v1/k6-api-invocation-plan.schema.json' },
  { schemaVersion: 'k6-api-runtime-admission-evidence/v1',
    path: 'schemas/execution/k6-api-runtime/v1/k6-api-runtime-admission-evidence.schema.json' },
  { schemaVersion: 'm3-r3-runtime-admission-r0-evidence/v1',
    path: 'schemas/execution/k6-api-runtime/v1/m3-r3-runtime-admission-r0-evidence.schema.json' },
];

const p1Schemas = [
  { schemaVersion: 'k6-local-process-port/v1', path: paths.port },
  { schemaVersion: 'k6-process-launch-specification/v1', path: paths.specification },
  { schemaVersion: 'k6-process-launch-decision/v1', path: paths.decision },
  { schemaVersion: 'k6-process-boundary-evidence/v1', path: paths.evidence },
  { schemaVersion: 'm3-r3-local-process-boundary-p1-evidence/v1',
    path: paths.acceptance },
];

async function json(path) {
  return JSON.parse(await readFile(new URL(path, ROOT), 'utf8'));
}

function assertClosed(schema, label) {
  assert.equal(schema.type, 'object', `${label} type`);
  assert.equal(schema.additionalProperties, false, `${label} additionalProperties`);
  assert.deepEqual([...schema.required].sort(), Object.keys(schema.properties).sort(),
    `${label} every property required`);
}

test('P1 preserves the accepted R0 Schema Catalog exactly', async () => {
  const catalog = await json(paths.r0Catalog);
  assert.equal(catalog.schemaVersion, 'k6-api-runtime-schema-catalog/v1');
  assert.deepEqual(catalog.schemas, acceptedR0Schemas);
});

test('P1 has an isolated five-contract Schema Catalog', async () => {
  const catalog = await json(paths.catalog);
  assert.equal(catalog.schemaVersion, 'k6-local-process-boundary-schema-catalog/v1');
  assert.deepEqual(catalog.schemas, p1Schemas);
});

test('P1 Schemas are closed Draft 2020-12 contracts', async () => {
  for (const [label, path] of [
    ['port', paths.port],
    ['specification', paths.specification],
    ['decision', paths.decision],
    ['evidence', paths.evidence],
    ['acceptance', paths.acceptance],
  ]) {
    const schema = await json(path);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assertClosed(schema, label);
  }
  const port = await json(paths.port);
  assertClosed(port.properties.capabilities, 'port.capabilities');
  const specification = await json(paths.specification);
  for (const field of ['workingDirectory', 'environment', 'stdin', 'stdout', 'stderr']) {
    assertClosed(specification.properties[field], `specification.${field}`);
  }
  const decision = await json(paths.decision);
  assertClosed(decision.properties.portReceipt, 'decision.portReceipt');
  assertClosed(decision.properties.decision, 'decision.decision');
  assertClosed(decision.properties.safetyBoundary, 'decision.safetyBoundary');
  const evidence = await json(paths.evidence);
  assertClosed(evidence.properties.decision, 'evidence.decision');
  assertClosed(evidence.properties.safetyBoundary, 'evidence.safetyBoundary');
});

test('P1 Schemas fix the injected non-executing process boundary', async () => {
  const port = await json(paths.port);
  assert.equal(port.properties.capabilities.properties.startProcess.const, false);
  assert.equal(port.properties.capabilities.properties.createProcessId.const, false);
  const specification = await json(paths.specification);
  assert.equal(specification.properties.executable.const, 'k6');
  assert.equal(specification.properties.shell.const, false);
  assert.equal(specification.properties.processStartAuthorized.const, false);
  assert.equal(specification.properties.environment.properties.valuesIncluded.const, false);
  assert.equal(
    specification.properties.environment.properties.inheritHostEnvironment.const, false);
  assert.equal(specification.properties.stdin.properties.contentIncluded.const, false);
  for (const path of [paths.decision, paths.evidence, paths.acceptance]) {
    const schema = await json(path);
    assert.equal(schema.properties.decision.properties.nodeProcessAdapterImplemented.const, false);
    assert.equal(schema.properties.decision.properties.processStarted.const, false);
    assert.equal(schema.properties.decision.properties.nextRequiredSlice.const, 'M3-R3-P2');
    assert.ok(Object.values(schema.properties.safetyBoundary.properties)
      .every((property) => property.const === false));
  }
});

test('P1 produced objects match the top-level Schema field sets', async () => {
  const fixture = await localProcessBoundaryFixture();
  for (const [value, path] of [
    [fixture.descriptor, paths.port],
    [fixture.result.launchSpecification, paths.specification],
    [fixture.result.launchDecision, paths.decision],
    [fixture.result.boundaryEvidence, paths.evidence],
  ]) {
    const schema = await json(path);
    assert.deepEqual(Object.keys(value).sort(), Object.keys(schema.properties).sort());
  }
});
