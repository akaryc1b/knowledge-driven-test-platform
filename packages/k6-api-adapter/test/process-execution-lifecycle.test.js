import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import {
  computeK6NodeProcessAdapterDigest,
  computeK6ProcessExecutionCommandDigest,
  computeK6ProcessLifecycleEvidenceDigest,
  createK6NodeProcessAdapterDescriptor,
  createK6ProcessExecutionCommand,
  executeK6ProcessLifecycle,
  validateK6NodeProcessAdapterDescriptor,
  validateK6ProcessExecutionCommand,
  validateK6ProcessLifecycleEvidence,
} from '../src/process-execution-lifecycle.js';
import { clone } from './runtime-admission-test-helpers.js';
import {
  FakeChildProcess,
  processExecutionFixture,
} from './process-execution-lifecycle-test-helpers.js';

function redigest(value, field) {
  const copy = clone(value);
  delete copy[field];
  value[field] = sha256(copy);
  return value;
}

async function execute(fixture) {
  return executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
}

test('P2 creates deterministic descriptor and execution command contracts', async () => {
  const first = await processExecutionFixture();
  const second = await processExecutionFixture();
  assert.deepEqual(first.adapterDescriptor, second.adapterDescriptor);
  assert.deepEqual(first.command, second.command);
  assert.equal(computeK6NodeProcessAdapterDigest(first.adapterDescriptor),
    first.adapterDescriptor.adapterDigest);
  assert.equal(computeK6ProcessExecutionCommandDigest(first.command),
    first.command.commandDigest);
});

test('P2 command binds the exact accepted P1 chain without host path or values', async () => {
  const fixture = await processExecutionFixture();
  const { command, p1 } = fixture;
  assert.equal(command.executable, 'k6');
  assert.deepEqual(command.argv, p1.result.launchSpecification.argv);
  assert.equal(command.shell, false);
  assert.equal(command.processStartAuthorized, true);
  assert.equal(command.workingDirectory.absolutePathIncluded, false);
  assert.equal(command.environment.valuesIncluded, false);
  assert.equal(command.environment.inheritHostEnvironment, false);
  assert.equal(JSON.stringify(command).includes('/var/lib/'), false);
  assert.equal(JSON.stringify(command).includes('K6_LOG_FORMAT":"json'), false);
  assert.equal(command.predecessor.boundaryEvidenceDigest,
    p1.result.boundaryEvidence.evidenceDigest);
});

test('P2 adapter uses spawn with exact shell-free process options', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const evidence = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  const call = fixture.spawnCalls[0];
  assert.equal(call.executable, 'k6');
  assert.deepEqual(call.argv, fixture.command.argv);
  assert.equal(call.options.cwd, fixture.workingDirectoryPath);
  assert.deepEqual(call.options.env, Object.fromEntries(
    fixture.command.environment.allowedNames.map((name) => [name,
      name === 'K6_LOG_FORMAT' ? 'json' : 'true'])));
  assert.equal(call.options.shell, false);
  assert.equal(call.options.detached, false);
  assert.equal(call.options.windowsHide, true);
  assert.deepEqual(call.options.stdio, ['ignore', 'ignore', 'ignore']);
  assert.equal(evidence.terminalState, 'EXITED');
  assert.equal(evidence.observations.processStartAttempted, true);
  assert.equal(evidence.observations.k6InvocationAttempted, true);
  assert.equal(evidence.observations.processStarted, true);
  assert.equal(evidence.observations.processStartUnknown, false);
  assert.equal(evidence.observations.processIdCreated, true);
  assert.equal(evidence.observations.exitObserved, true);
  assert.equal(evidence.observations.processTerminationConfirmed, true);
});

test('P2 cancels before start without calling spawn', async () => {
  const controller = new AbortController();
  controller.abort();
  const fixture = await processExecutionFixture({ abortSignal: controller.signal });
  const evidence = await execute(fixture);
  assert.equal(fixture.spawnCalls.length, 0);
  assert.equal(evidence.terminalState, 'CANCELLED_BEFORE_START');
  assert.equal(evidence.observations.abortRequested, true);
  assert.equal(evidence.observations.processStartAttempted, false);
  assert.equal(evidence.observations.processStarted, false);
});

test('P2 bounds missing spawn acknowledgement and force-terminates the handle', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.timers.fireDelay(fixture.command.lifecycle.startupTimeoutMs);
  assert.deepEqual(fixture.child.signals, ['SIGKILL']);
  fixture.child.emit('exit', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'START_TIMED_OUT_FORCE_TERMINATED');
  assert.equal(evidence.observations.processStartAttempted, true);
  assert.equal(evidence.observations.processStarted, false);
  assert.equal(evidence.observations.processStartUnknown, true);
  assert.equal(evidence.observations.startupTimeoutTriggered, true);
  assert.equal(evidence.observations.forceKillSignalRequested, true);
});

test('P2 settles missing spawn acknowledgement without assuming termination', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.timers.fireDelay(fixture.command.lifecycle.startupTimeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.forceSettleMs);
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'START_TIMED_OUT_FORCE_UNCONFIRMED');
  assert.equal(evidence.observations.processStartUnknown, true);
  assert.equal(evidence.observations.processTerminationConfirmed, false);
});

test('P2 timeout sends cooperative SIGINT and settles on exit', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT');
  assert.equal(evidence.observations.timeoutTriggered, true);
  assert.equal(evidence.observations.cooperativeSignalSent, true);
  assert.equal(evidence.observations.forceKillSignalSent, false);
});

test('P2 explicit abort sends cooperative SIGINT and settles as cancelled', async () => {
  const controller = new AbortController();
  const fixture = await processExecutionFixture({ abortSignal: controller.signal });
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  controller.abort();
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'CANCELLED');
  assert.equal(evidence.observations.abortRequested, true);
  assert.equal(evidence.observations.timeoutTriggered, false);
});

test('P2 escalates to SIGKILL only after bounded cooperative grace', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  assert.deepEqual(fixture.child.signals, ['SIGINT', 'SIGKILL']);
  fixture.child.emit('exit', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT_FORCE_TERMINATED');
  assert.equal(evidence.observations.forceKillSignalSent, true);
  assert.equal(evidence.observations.processTerminationConfirmed, true);
});

test('P2 bounds force-kill settlement when exit confirmation never arrives', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.forceSettleMs);
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT_FORCE_UNCONFIRMED');
  assert.equal(evidence.observations.processTerminationConfirmed, false);
  assert.equal(evidence.events.at(-1).type, 'FORCE_SETTLEMENT_EXPIRED');
});

test('P2 converts synchronous spawn failure into sanitized lifecycle Evidence', async () => {
  const fixture = await processExecutionFixture({ spawnThrows: true });
  const evidence = await execute(fixture);
  assert.equal(evidence.terminalState, 'START_FAILED');
  assert.equal(evidence.observations.processStarted, false);
  assert.equal(JSON.stringify(evidence).includes('private detail'), false);
});

test('P2 converts pre-spawn child error into sanitized lifecycle Evidence', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('error', new Error('private child error'));
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'START_FAILED');
  assert.equal(evidence.events.at(-1).type, 'PROCESS_START_FAILED');
  assert.equal(JSON.stringify(evidence).includes('private child error'), false);
});

test('P2 records post-spawn child error without leaking details', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('error', new Error('private runtime error'));
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'PROCESS_ERROR');
  assert.equal(evidence.observations.processStarted, true);
  assert.equal(JSON.stringify(evidence).includes('private runtime error'), false);
});

test('P2 never exposes a numeric host PID or runtime output', async () => {
  const fixture = await processExecutionFixture({ child: new FakeChildProcess({ pid: 987654 }) });
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 7, null);
  const evidence = await pending;
  const serialized = JSON.stringify(evidence);
  assert.equal(serialized.includes('987654'), false);
  assert.equal(evidence.observations.numericProcessIdExposed, false);
  assert.equal(evidence.observations.stdoutCollected, false);
  assert.equal(evidence.observations.stderrCollected, false);
  assert.equal(evidence.observations.runtimeResultCollected, false);
  assert.equal(evidence.decision.runtimeResultCollected, false);
});

for (const [label, options, pattern] of [
  ['relative path', { workingDirectoryPath: '../bundle' }, /normalized absolute path/u],
  ['symlink path', { realPath: '/real/bundle' }, /non-symlink directory/u],
  ['non-directory', { isDirectory: false }, /non-symlink directory/u],
  ['resolver failure', { resolverThrows: true }, /could not be resolved/u],
]) {
  test(`P2 rejects ${label} before spawn`, async () => {
    const fixture = await processExecutionFixture(options);
    await assert.rejects(() => execute(fixture), pattern);
    assert.equal(fixture.spawnCalls.length, 0);
  });
}

test('P2 validates the descriptor, command and lifecycle Evidence contracts', async () => {
  const fixture = await processExecutionFixture();
  assert.deepEqual(validateK6NodeProcessAdapterDescriptor(fixture.adapterDescriptor),
    fixture.adapterDescriptor);
  assert.deepEqual(validateK6ProcessExecutionCommand(fixture.command, fixture.bindings),
    fixture.command);
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const evidence = await pending;
  assert.deepEqual(validateK6ProcessLifecycleEvidence(evidence, {
    command: fixture.command,
    adapterDescriptor: fixture.adapterDescriptor,
  }), evidence);
  assert.equal(computeK6ProcessLifecycleEvidenceDigest(evidence), evidence.evidenceDigest);
});

test('P2 rejects descriptor process primitive escalation', () => {
  const forged = clone(createK6NodeProcessAdapterDescriptor());
  forged.processPrimitive = 'node:child_process.exec';
  redigest(forged, 'adapterDigest');
  assert.throws(() => validateK6NodeProcessAdapterDescriptor(forged),
    /widens the fixed P2 boundary/u);
});

test('P2 rejects command executable substitution', async () => {
  const fixture = await processExecutionFixture();
  const forged = clone(fixture.command);
  forged.executable = 'bash';
  redigest(forged, 'commandDigest');
  assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings),
    /widens the bounded P2 lifecycle/u);
});

for (const fragment of [';', '&&', '|', '`id`', '$(id)']) {
  test(`P2 rejects command argv shell fragment ${fragment}`, async () => {
    const fixture = await processExecutionFixture();
    const forged = clone(fixture.command);
    forged.argv.splice(1, 0, fragment);
    redigest(forged, 'commandDigest');
    assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings),
      /shell-free string array/u);
  });
}

test('P2 rejects environment values digest substitution', async () => {
  const fixture = await processExecutionFixture();
  const forged = clone(fixture.command);
  forged.environment.fixedValuesDigest = 'f'.repeat(64);
  redigest(forged, 'commandDigest');
  assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings),
    /adapter-owned values/u);
});

test('P2 rejects timeout expansion beyond the fixed runtime limit', async () => {
  const fixture = await processExecutionFixture();
  const forged = clone(fixture.command);
  forged.lifecycle.timeoutMs = Number.MAX_SAFE_INTEGER;
  redigest(forged, 'commandDigest');
  assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings),
    /bounded P2 lifecycle/u);
});

test('P2 resolves only the exact accepted Source Bundle binding', async () => {
  let observed;
  const fixture = await processExecutionFixture({
    assertBinding(binding) { observed = binding; },
  });
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  await pending;
  assert.deepEqual(observed, {
    bundleDigest: fixture.command.source.bundleDigest,
    logicalName: fixture.command.workingDirectory.logicalName,
  });
  assert.ok(Object.isFrozen(observed));
});

test('P2 settles only once under timeout, abort and duplicate exit races', async () => {
  const controller = new AbortController();
  const fixture = await processExecutionFixture({ abortSignal: controller.signal });
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  controller.abort();
  fixture.child.emit('exit', null, 'SIGINT');
  fixture.child.emit('exit', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT');
  assert.equal(evidence.events.filter((event) => event.type === 'PROCESS_EXITED').length, 1);
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
});

test('P2 rejects an unregistered adapter even when its descriptor is copied', async () => {
  const fixture = await processExecutionFixture();
  await assert.rejects(() => executeK6ProcessLifecycle({
    adapter: { descriptor: fixture.adapterDescriptor },
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  }), /registered Node process adapter/u);
  assert.equal(fixture.spawnCalls.length, 0);
});

test('P2 rejects a self-redigested argv structure substitution', async () => {
  const fixture = await processExecutionFixture();
  const forged = clone(fixture.command);
  [forged.argv[1], forged.argv[3]] = [forged.argv[3], forged.argv[1]];
  redigest(forged, 'commandDigest');
  assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings),
    /fixed k6 invocation structure/u);
});

test('P2 rejects Source Bundle logical URI substitution', async () => {
  const fixture = await processExecutionFixture();
  const forged = clone(fixture.command);
  forged.source.logicalUri = `kdtp-source-bundle://sha256/${'f'.repeat(64)}`;
  redigest(forged, 'commandDigest');
  assert.throws(() => validateK6ProcessExecutionCommand(forged, fixture.bindings),
    /bounded P2 lifecycle/u);
});

test('P2 rejects lifecycle Evidence event substitution after redigest', async () => {
  const fixture = await processExecutionFixture();
  const pending = execute(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const forged = clone(await pending);
  forged.events.at(-1).type = 'PROCESS_ERROR';
  redigest(forged, 'evidenceDigest');
  assert.throws(() => validateK6ProcessLifecycleEvidence(forged, {
    command: fixture.command,
    adapterDescriptor: fixture.adapterDescriptor,
  }), /observations do not match|terminal state does not match/u);
});

test('P2 constructors defensively copy and freeze contract values', async () => {
  const fixture = await processExecutionFixture();
  const descriptor = createK6NodeProcessAdapterDescriptor();
  const command = createK6ProcessExecutionCommand(fixture.bindings);
  assert.ok(Object.isFrozen(descriptor));
  assert.ok(Object.isFrozen(descriptor.cancellation));
  assert.ok(Object.isFrozen(command));
  assert.ok(Object.isFrozen(command.argv));
  assert.ok(Object.isFrozen(command.lifecycle));
});
