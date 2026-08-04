import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { executeK6ProcessLifecycle } from '../src/process-execution-lifecycle.js';
import { processExecutionFixture } from './process-execution-lifecycle-test-helpers.js';

const ROOT = new URL('../../../', import.meta.url);
const paths = {
  p1Catalog: 'schemas/execution/k6-api-runtime/p1-schema-catalog.json',
  catalog: 'schemas/execution/k6-api-runtime/p2-schema-catalog.json',
  adapter: 'schemas/execution/k6-api-runtime/v1/k6-node-process-adapter.schema.json',
  command: 'schemas/execution/k6-api-runtime/v1/k6-process-execution-command.schema.json',
  lifecycle: 'schemas/execution/k6-api-runtime/v1/k6-process-lifecycle-evidence.schema.json',
  acceptance:
    'schemas/execution/k6-api-runtime/v1/m3-r3-bounded-process-lifecycle-p2-evidence.schema.json',
};

const p2Schemas = [
  { schemaVersion: 'k6-node-process-adapter/v1', path: paths.adapter },
  { schemaVersion: 'k6-process-execution-command/v1', path: paths.command },
  { schemaVersion: 'k6-process-lifecycle-evidence/v1', path: paths.lifecycle },
  { schemaVersion: 'm3-r3-bounded-process-lifecycle-p2-evidence/v1',
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

async function lifecycleEvidence(fixture) {
  const pending = executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  return pending;
}

test('P2 preserves the accepted P1 Schema Catalog exactly', async () => {
  const catalog = await json(paths.p1Catalog);
  assert.equal(catalog.schemaVersion, 'k6-local-process-boundary-schema-catalog/v1');
  assert.equal(catalog.schemas.length, 5);
  assert.equal(catalog.schemas.at(-1).schemaVersion,
    'm3-r3-local-process-boundary-p1-evidence/v1');
});

test('P2 has an isolated four-contract Schema Catalog', async () => {
  const catalog = await json(paths.catalog);
  assert.equal(catalog.schemaVersion, 'k6-bounded-process-lifecycle-schema-catalog/v1');
  assert.deepEqual(catalog.schemas, p2Schemas);
});

test('P2 Schemas are closed Draft 2020-12 contracts', async () => {
  for (const [label, path] of Object.entries({
    adapter: paths.adapter,
    command: paths.command,
    lifecycle: paths.lifecycle,
    acceptance: paths.acceptance,
  })) {
    const schema = await json(path);
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assertClosed(schema, label);
  }
  const adapter = await json(paths.adapter);
  assertClosed(adapter.properties.stdio, 'adapter.stdio');
  assertClosed(adapter.properties.cancellation, 'adapter.cancellation');
  const command = await json(paths.command);
  for (const field of [
    'predecessor', 'source', 'workingDirectory', 'environment', 'stdio', 'lifecycle',
  ]) assertClosed(command.properties[field], `command.${field}`);
  const lifecycle = await json(paths.lifecycle);
  for (const field of ['observations', 'decision', 'safetyBoundary']) {
    assertClosed(lifecycle.properties[field], `lifecycle.${field}`);
  }
  const acceptance = await json(paths.acceptance);
  for (const field of [
    'source', 'acceptedP1', 'contracts', 'testResults', 'decision', 'safetyBoundary',
  ]) assertClosed(acceptance.properties[field], `acceptance.${field}`);
});

test('P2 Schemas fix spawn, shell, environment, signal and output boundaries', async () => {
  const adapter = await json(paths.adapter);
  assert.equal(adapter.properties.processPrimitive.const, 'node:child_process.spawn');
  assert.equal(adapter.properties.shell.const, false);
  assert.equal(adapter.properties.detached.const, false);
  assert.equal(adapter.properties.hostEnvironmentInherited.const, false);
  assert.equal(adapter.properties.numericProcessIdExposed.const, false);
  assert.equal(adapter.properties.cancellation.properties.cooperativeSignal.const, 'SIGINT');
  assert.equal(adapter.properties.cancellation.properties.forceKillSignal.const, 'SIGKILL');
  const command = await json(paths.command);
  assert.equal(command.properties.executable.const, 'k6');
  assert.equal(command.properties.shell.const, false);
  assert.equal(command.properties.processStartAuthorized.const, true);
  assert.equal(command.properties.workingDirectory.properties.absolutePathIncluded.const, false);
  assert.equal(command.properties.environment.properties.valuesIncluded.const, false);
  assert.equal(command.properties.environment.properties.inheritHostEnvironment.const, false);
  assert.equal(command.properties.lifecycle.properties.startupTimeoutMs.const, 5000);
  assert.equal(command.properties.lifecycle.properties.forceSettleMs.const, 1000);
  const lifecycle = await json(paths.lifecycle);
  assert.equal(lifecycle.properties.observations.properties.numericProcessIdExposed.const, false);
  assert.equal(lifecycle.properties.observations.properties.stdoutCollected.const, false);
  assert.equal(lifecycle.properties.observations.properties.stderrCollected.const, false);
  assert.equal(lifecycle.properties.observations.properties.runtimeResultCollected.const, false);
  assert.ok(Object.values(lifecycle.properties.safetyBoundary.properties)
    .every((property) => property.const === false));
});

test('P2 produced objects match their top-level Schema field sets', async () => {
  const fixture = await processExecutionFixture();
  const evidence = await lifecycleEvidence(fixture);
  for (const [value, path] of [
    [fixture.adapterDescriptor, paths.adapter],
    [fixture.command, paths.command],
    [evidence, paths.lifecycle],
  ]) {
    const schema = await json(path);
    assert.deepEqual(Object.keys(value).sort(), Object.keys(schema.properties).sort());
  }
});
