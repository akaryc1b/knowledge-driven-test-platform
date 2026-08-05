import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import * as publicApi from '../src/index.js';
import { processExecutionFixture } from './process-execution-lifecycle-test-helpers.js';

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

function normalizedCompatibilityProduct(fixture) {
  return {
    platformCompatibility: 'linux',
    nodeBaseline: 22,
    nodeCompatibility: 24,
    adapterDescriptor: fixture.adapterDescriptor,
    command: fixture.command,
    publicExports: [
      'createK6NodeProcessAdapterDescriptor',
      'createK6ProcessExecutionCommand',
      'createNodeK6ProcessAdapter',
      'executeK6ProcessLifecycle',
      'executeK6ProcessWithSanitizedResult',
      'validateK6NodeProcessAdapterDescriptor',
      'validateK6ProcessExecutionCommand',
    ].sort(),
    fileResultCollectionImplemented: false,
    sourceBundleRemainsImmutable: true,
  };
}

test('P4 P3 preserves accepted public runtime exports', () => {
  for (const name of [
    'createK6NodeProcessAdapterDescriptor',
    'createK6ProcessExecutionCommand',
    'createNodeK6ProcessAdapter',
    'executeK6ProcessLifecycle',
    'executeK6ProcessWithSanitizedResult',
    'validateK6NodeProcessAdapterDescriptor',
    'validateK6ProcessExecutionCommand',
  ]) {
    assert.equal(typeof publicApi[name], 'function', `Missing public export ${name}`);
  }
});

test('P4 P3 preserves Node 22 ESM baseline, workspaces and historical Validator order', async () => {
  const packageDocument = JSON.parse(await readRepositoryFile('package.json'));
  assert.equal(packageDocument.type, 'module');
  assert.equal(packageDocument.engines.node, '>=22');
  assert.deepEqual(packageDocument.workspaces, ['apps/*', 'packages/*']);
  const validators = [
    'validate-m3-r3-runtime-admission.js',
    'validate-m3-r3-p1-local-process-boundary.js',
    'validate-m3-r3-p2-bounded-process-lifecycle.js',
    'validate-m3-r3-p3-sanitized-runtime-result.js',
    'validate-m2-final-release-closure.js',
  ];
  let previous = -1;
  for (const validator of validators) {
    const position = packageDocument.scripts.validate.indexOf(validator);
    assert.ok(position > previous, `Validator missing or reordered: ${validator}`);
    previous = position;
  }
});

test('P4 P3 preserves accepted P3 Schema identities and closed contracts', async () => {
  const paths = [
    'schemas/execution/k6-api-runtime/v1/k6-process-terminal-observation.schema.json',
    'schemas/execution/k6-api-runtime/v1/k6-sanitized-runtime-outcome.schema.json',
    'schemas/execution/k6-api-runtime/v1/k6-runtime-execution-evidence.schema.json',
    'schemas/execution/k6-api-runtime/v1/m3-r3-sanitized-runtime-result-p3-evidence.schema.json',
  ];
  for (const path of paths) {
    const schema = JSON.parse(await readRepositoryFile(path));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.additionalProperties, false);
    assert.equal(typeof schema.$id, 'string');
    assert.equal(schema.$id.length > 0, true);
  }
});

test('P4 P3 preserves P2 lifecycle semantics and P3 integrated single-spawn behavior', async () => {
  const lifecycleFixture = await processExecutionFixture();
  const lifecyclePending = publicApi.executeK6ProcessLifecycle({
    adapter: lifecycleFixture.adapter,
    command: lifecycleFixture.command,
    bindings: lifecycleFixture.bindings,
    executionContext: lifecycleFixture.executionContext,
  });
  lifecycleFixture.child.emit('spawn');
  lifecycleFixture.child.emit('exit', 0, null);
  const lifecycleEvidence = await lifecyclePending;
  assert.equal(lifecycleFixture.spawnCalls.length, 1);
  assert.equal(lifecycleEvidence.terminalState, 'EXITED');

  const integratedFixture = await processExecutionFixture();
  const integratedPending = publicApi.executeK6ProcessWithSanitizedResult({
    adapter: integratedFixture.adapter,
    command: integratedFixture.command,
    bindings: integratedFixture.bindings,
    executionContext: integratedFixture.executionContext,
  });
  integratedFixture.child.emit('spawn');
  integratedFixture.child.emit('exit', 0, null);
  const integrated = await integratedPending;
  assert.equal(integratedFixture.spawnCalls.length, 1);
  assert.equal(integrated.lifecycleEvidence.terminalState, 'EXITED');
  assert.equal(integrated.runtimeEvidence.decision.fileResultCollectionImplemented, false);
  assert.equal(integrated.runtimeEvidence.decision.sourceBundleRemainsImmutable, true);
});

test('P4 P3 produces a byte-stable compatibility product for identical static fixtures', async () => {
  const first = normalizedCompatibilityProduct(await processExecutionFixture());
  const second = normalizedCompatibilityProduct(await processExecutionFixture());
  assert.deepEqual(first, second);
  assert.equal(JSON.stringify(first), JSON.stringify(second));
  const digest = sha256(first);
  assert.equal(digest, sha256(second));
  assert.match(digest, /^[a-f0-9]{64}$/u);
  console.log(`compatibilityProductDigest=${digest}`);
});

test('P4 P3 canonical identity ignores object insertion order and normalized set order', () => {
  const first = {
    alpha: 1,
    beta: 2,
    categories: [...new Set(['security', 'fault', 'compatibility'])].sort(),
  };
  const second = {
    categories: [...new Set(['compatibility', 'security', 'fault'])].sort(),
    beta: 2,
    alpha: 1,
  };
  assert.equal(sha256(first), sha256(second));
});

test('P4 P3 repeats timeout and abort race products deterministically', async () => {
  const runTimeoutFirst = async () => {
    const fixture = await processExecutionFixture();
    const pending = publicApi.executeK6ProcessLifecycle({
      adapter: fixture.adapter,
      command: fixture.command,
      bindings: fixture.bindings,
      executionContext: fixture.executionContext,
    });
    fixture.child.emit('spawn');
    fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
    fixture.child.emit('exit', null, 'SIGINT');
    return pending;
  };
  assert.deepEqual(await runTimeoutFirst(), await runTimeoutFirst());
});

test('P4 P3 limits the platform claim to Linux and keeps deferred output decisions', async () => {
  const governance = await readRepositoryFile(
    'docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md');
  for (const claim of [
    'platformCompatibility=linux',
    'windowsCompatibilityClaimed=false',
    'macosCompatibilityClaimed=false',
    'governedOutputRootImplemented=false',
    'fileResultCollectionImplemented=false',
    'sourceBundleRemainsImmutable=true',
  ]) {
    assert.equal(governance.includes(claim), true, `Missing compatibility claim: ${claim}`);
  }
});
