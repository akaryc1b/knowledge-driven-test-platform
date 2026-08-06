import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import {
  computeK6NodeProcessAdapterDigest,
  computeK6ProcessExecutionCommandDigest,
  createK6NodeProcessAdapterDescriptor,
  createNodeK6ProcessAdapter,
  executeK6ProcessLifecycle,
  fixedEnvironmentValuesForAdapter,
  validateK6NodeProcessAdapterDescriptor,
  validateK6ProcessExecutionCommand,
} from '../src/process-execution-lifecycle.js';
import { processExecutionFixture } from './process-execution-lifecycle-test-helpers.js';

function clone(value) {
  return structuredClone(value);
}

function executeLifecycle(fixture, overrides = {}) {
  return executeK6ProcessLifecycle({
    adapter: overrides.adapter ?? fixture.adapter,
    command: overrides.command ?? fixture.command,
    bindings: overrides.bindings ?? fixture.bindings,
    executionContext: overrides.executionContext ?? fixture.executionContext,
  });
}

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

function assertNoSensitiveMaterial(value) {
  const serialized = JSON.stringify(value);
  const patterns = [
    /authorization/iu,
    /bearer\s+[a-z0-9._~+/=-]+/iu,
    /eyJ[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/iu,
    /cookie/iu,
    /private[-_ ]?key/iu,
    /ssh-rsa/iu,
    /postgres(?:ql)?:\/\//iu,
    /mysql:\/\//iu,
    /mongodb(?:\+srv)?:\/\//iu,
    /aws_secret_access_key/iu,
    /private-runtime-secret/iu,
    /private-stack-marker/iu,
  ];
  for (const pattern of patterns) {
    assert.equal(pattern.test(serialized), false,
      `Sensitive material matched ${pattern}`);
  }
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    for (const key of Object.keys(node)) {
      assert.equal(['stdout', 'stderr', 'pid', 'stack'].includes(key), false,
        `Private runtime field leaked: ${key}`);
      visit(node[key]);
    }
  };
  visit(value);
}

function redigestCommand(command) {
  command.commandId = `k6process-command-${sha256({
    adapterDigest: command.adapterDigest,
    predecessor: command.predecessor,
    sourceBundleDigest: command.source.bundleDigest,
  }).slice(0, 20)}`;
  command.commandDigest = computeK6ProcessExecutionCommandDigest(command);
  return command;
}

test('P4 P2 keeps the dedicated adapter as the only process primitive and internal executor', async () => {
  const source = await readRepositoryFile(
    'packages/k6-api-adapter/src/node-process-adapter.js');
  assert.equal(source.match(/from 'node:child_process'/gu)?.length, 1);
  assert.equal(source.includes("import { spawn } from 'node:child_process';"), true);
  assert.equal(source.match(/runtime\.spawnProcess\(/gu)?.length, 1);
  assert.equal(source.includes('export async function executeRegisteredNodeLifecycle'), false);
  assert.equal(source.includes('export async function runNodeProcessLifecycle'), false);
  for (const forbidden of [
    ' exec(', 'execFile(', 'fork(', 'spawnSync(', 'execSync(',
    "from 'node:vm'", "from 'node:worker_threads'", 'eval(',
    'new Function(', 'import(', 'shell: true', 'detached: true',
  ]) {
    assert.equal(source.includes(forbidden), false,
      `Alternative process boundary detected: ${forbidden}`);
  }
});

test('P4 P2 rejects descriptor primitive, executable, shell, detach, signal and output escalation', () => {
  const accepted = createK6NodeProcessAdapterDescriptor();
  const mutations = [
    (value) => { value.processPrimitive = 'node:child_process.exec'; },
    (value) => { value.executable = '/bin/sh'; },
    (value) => { value.shell = true; },
    (value) => { value.detached = true; },
    (value) => { value.stdio.stdout = 'pipe'; },
    (value) => { value.numericProcessIdExposed = true; },
    (value) => { value.cancellation.cooperativeSignal = 'SIGTERM'; },
    (value) => { value.cancellation.forceKillSignal = 'SIGUSR1'; },
  ];
  for (const mutate of mutations) {
    const forged = clone(accepted);
    mutate(forged);
    assert.throws(() => validateK6NodeProcessAdapterDescriptor(forged));
  }
  const copied = clone(accepted);
  copied.adapterDigest = computeK6NodeProcessAdapterDigest(copied);
  assert.deepEqual(validateK6NodeProcessAdapterDescriptor(copied), accepted);
});

test('P4 P2 rejects shell fragments, command substitution and command-field escalation', async () => {
  const fixture = await processExecutionFixture();
  const mutations = [
    (value) => { value.executable = '/bin/sh'; },
    (value) => { value.shell = true; },
    (value) => { value.argv.push(';'); },
    (value) => { value.argv.push('&&'); },
    (value) => { value.argv.push('|'); },
    (value) => { value.argv.push('`id`'); },
    (value) => { value.argv.push('$(id)'); },
    (value) => { value.argv.push('--unknown'); },
    (value) => { value.argv.push('--out'); },
    (value) => { value.argv.push('/tmp/result.json'); },
    (value) => { value.argv.push(value.argv[0]); },
    (value) => { value.source.bundleDigest = '0'.repeat(64); },
    (value) => { value.environment.allowedNames.push('PATH'); },
    (value) => { value.environment.valuesIncluded = true; },
    (value) => { value.environment.inheritHostEnvironment = true; },
    (value) => { value.stdio.stderr = 'pipe'; },
    (value) => { value.lifecycle.cooperativeSignal = 'SIGTERM'; },
    (value) => { value.lifecycle.forceKillSignal = 'SIGUSR1'; },
  ];
  for (const mutate of mutations) {
    const forged = clone(fixture.command);
    mutate(forged);
    assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings));
  }
});

test('P4 P2 rejects a fully self-redigested predecessor substitution', async () => {
  const fixture = await processExecutionFixture();
  const forged = clone(fixture.command);
  forged.predecessor.runtimePolicyDigest = '0'.repeat(64);
  redigestCommand(forged);
  assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings));
});

test('P4 P2 rejects copied, unregistered and unsupported adapter identities before spawn', async () => {
  const fixture = await processExecutionFixture();
  const copiedAdapter = Object.freeze({ descriptor: fixture.adapter.descriptor });
  await assert.rejects(() => executeLifecycle(fixture, { adapter: copiedAdapter }));
  assert.equal(fixture.spawnCalls.length, 0);
  assert.throws(() => createNodeK6ProcessAdapter({
    exec() {},
  }));
  assert.throws(() => createNodeK6ProcessAdapter({
    spawnProcess: 'not-a-function',
  }));
});

test('P4 P2 supplies only adapter-owned fixed environment values and ignores host secrets', async () => {
  const previous = process.env.KDTP_PRIVATE_RUNTIME_SECRET;
  process.env.KDTP_PRIVATE_RUNTIME_SECRET = 'private-runtime-secret';
  try {
    const fixture = await processExecutionFixture();
    const pending = executeLifecycle(fixture);
    assert.equal(fixture.spawnCalls.length, 1);
    assert.deepEqual(fixture.spawnCalls[0].options.env,
      fixedEnvironmentValuesForAdapter(fixture.command.environment.allowedNames));
    assert.equal(Object.hasOwn(fixture.spawnCalls[0].options.env,
      'KDTP_PRIVATE_RUNTIME_SECRET'), false);
    assert.equal(fixture.spawnCalls[0].options.shell, false);
    assert.equal(fixture.spawnCalls[0].options.detached, false);
    assert.deepEqual(fixture.spawnCalls[0].options.stdio,
      ['ignore', 'ignore', 'ignore']);
    fixture.child.emit('error', Object.assign(
      new Error('private-runtime-secret private-stack-marker'), {
        stack: 'private-stack-marker',
      }));
    const evidence = await pending;
    assertNoSensitiveMaterial(evidence);
  } finally {
    if (previous === undefined) delete process.env.KDTP_PRIVATE_RUNTIME_SECRET;
    else process.env.KDTP_PRIVATE_RUNTIME_SECRET = previous;
  }
});

for (const [label, path] of [
  ['relative traversal', '../bundle'],
  ['Windows drive path', 'C:\\private\\bundle'],
  ['UNC path', '\\\\server\\share\\bundle'],
  ['URI path', 'file:///private/bundle'],
]) {
  test(`P4 P2 rejects ${label} before spawn`, async () => {
    const fixture = await processExecutionFixture({
      workingDirectoryPath: path,
      realPath: path,
      spawnThrows: true,
    });
    await assert.rejects(() => executeLifecycle(fixture));
    assert.equal(fixture.spawnCalls.length, 0);
  });
}

for (const [label, suffix] of [
  ['actual NUL path', String.fromCharCode(0)],
  ['encoded traversal path', '/%2e%2e/escape'],
  ['backslash traversal path', '\\..\\escape'],
]) {
  test(`P4 P2 rejects ${label} before spawn`, async () => {
    const base = await processExecutionFixture();
    const path = `${base.workingDirectoryPath}${suffix}`;
    const fixture = await processExecutionFixture({
      workingDirectoryPath: path,
      realPath: path,
      spawnThrows: true,
    });
    await assert.rejects(() => executeLifecycle(fixture));
    assert.equal(fixture.spawnCalls.length, 0);
  });
}

test('P4 P2 rejects symlink, special-file and caller-provided output-path boundaries', async () => {
  const symlink = await processExecutionFixture({ realPath: '/different/real/path' });
  await assert.rejects(() => executeLifecycle(symlink));
  assert.equal(symlink.spawnCalls.length, 0);

  const special = await processExecutionFixture({ isDirectory: false });
  await assert.rejects(() => executeLifecycle(special));
  assert.equal(special.spawnCalls.length, 0);

  const callerPath = await processExecutionFixture();
  await assert.rejects(() => executeLifecycle(callerPath, {
    executionContext: {
      ...callerPath.executionContext,
      outputPath: '/tmp/caller-controlled',
    },
  }));
  assert.equal(callerPath.spawnCalls.length, 0);
});

test('P4 P2 preserves immutable Source Bundle binding and spawns at most once', async () => {
  const fixture = await processExecutionFixture();
  const before = JSON.stringify(fixture.bindings.admissionRequest.source);
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const evidence = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(JSON.stringify(fixture.bindings.admissionRequest.source), before);
  assert.equal(Object.isFrozen(fixture.bindings.admissionRequest.source), true);
  assert.equal(evidence.observations.stdoutCollected, false);
  assert.equal(evidence.observations.stderrCollected, false);
  assert.equal(evidence.observations.numericProcessIdExposed, false);
  assertNoSensitiveMaterial(evidence);
});

test('P4 P2 keeps file-result, output-root and CI execution boundaries false in governance', async () => {
  const documents = await Promise.all([
    readRepositoryFile(
      'docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md'),
    readRepositoryFile(
      'docs/04-governance/m3-r3-p4-fault-security-compatibility-acceptance-matrix.md'),
    readRepositoryFile(
      'docs/06-security/m3-r3-p4-fault-security-compatibility-threat-model.md'),
  ]);
  const text = documents.join('\n');
  for (const claim of [
    'sourceBundleRemainsImmutable=true',
    'governedOutputRootImplemented=false',
    'fileResultCollectionImplemented=false',
    'callerPathAccepted=false',
    'arbitraryFileReadEnabled=false',
    'realProcessStartedInCi=false',
    'processIdCreatedInCi=false',
    'signalSentInCi=false',
  ]) {
    assert.equal(text.includes(claim), true, `Missing security claim: ${claim}`);
  }
});
