import test from 'node:test';
import assert from 'node:assert/strict';
import {
  executeK6ProcessLifecycle,
  executeK6ProcessWithSanitizedResult,
} from '../src/process-execution-lifecycle.js';
import {
  FakeAbortSignal,
  FakeChildProcess,
  createFakeClock,
  processExecutionFixture,
} from './process-execution-lifecycle-test-helpers.js';

const STATIC_FAULT_FIXTURE = Object.freeze({
  realProcessStartedInCi: false,
  processIdCreatedInCi: false,
  signalSentInCi: false,
  rawRuntimeOutputCollected: false,
  singleSpawnInvariant: true,
  singleSettlementInvariant: true,
});

function executeLifecycle(fixture) {
  return executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
}

function executeSanitized(fixture) {
  return executeK6ProcessWithSanitizedResult({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
}

function assertDeepFrozen(value) {
  if (!value || typeof value !== 'object') return;
  assert.equal(Object.isFrozen(value), true);
  for (const child of Object.values(value)) assertDeepFrozen(child);
}

function assertNoPrivateRuntimeMaterial(value) {
  const serialized = JSON.stringify(value);
  for (const forbidden of [
    'private detail',
    'private child error',
    'private runtime error',
    'private resolver failure',
    'private realpath failure',
    'private stat failure',
    'private kill failure',
    'stack',
    '987654',
  ]) {
    assert.equal(serialized.includes(forbidden), false,
      `Private runtime material leaked: ${forbidden}`);
  }
}

test('P4 P1 uses static fixtures with injected fake clock, timer, process, resolver and abort signal', async () => {
  const clock = createFakeClock(10_000);
  const signal = new FakeAbortSignal();
  const fixture = await processExecutionFixture({ clock, abortSignal: signal });
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  assert.equal(clock.now(), 10_000 + fixture.command.lifecycle.timeoutMs);
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT');
  assert.deepEqual(STATIC_FAULT_FIXTURE, {
    realProcessStartedInCi: false,
    processIdCreatedInCi: false,
    signalSentInCi: false,
    rawRuntimeOutputCollected: false,
    singleSpawnInvariant: true,
    singleSettlementInvariant: true,
  });
});

test('P4 P1 converts synchronous spawn throw into deterministic sanitized start failure', async () => {
  const fixture = await processExecutionFixture({ spawnThrows: true });
  const evidence = await executeLifecycle(fixture);
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(evidence.terminalState, 'START_FAILED');
  assert.equal(evidence.observations.processStartAttempted, true);
  assert.equal(evidence.observations.processStarted, false);
  assertNoPrivateRuntimeMaterial(evidence);
  assertDeepFrozen(evidence);
});

test('P4 P1 fails closed when spawn returns an invalid process handle', async () => {
  const fixture = await processExecutionFixture({ child: {} });
  const evidence = await executeLifecycle(fixture);
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(evidence.terminalState, 'START_FAILED');
  assert.equal(evidence.observations.processStarted, false);
  assertNoPrivateRuntimeMaterial(evidence);
});

test('P4 P1 classifies child error before spawn acknowledgement exactly once', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.child.emit('error', new Error('private child error'));
  fixture.child.emit('exit', 9, null);
  fixture.child.emit('close', 9, null);
  const evidence = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(evidence.terminalState, 'START_FAILED');
  assert.equal(evidence.events.filter((event) =>
    event.type === 'PROCESS_START_FAILED').length, 1);
  assert.equal(evidence.events.some((event) => event.type === 'PROCESS_EXITED'), false);
  assertNoPrivateRuntimeMaterial(evidence);
});

test('P4 P1 classifies child error after spawn acknowledgement exactly once', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('error', new Error('private runtime error'));
  fixture.child.emit('exit', 7, null);
  fixture.child.emit('close', 7, null);
  const evidence = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(evidence.terminalState, 'PROCESS_ERROR');
  assert.equal(evidence.observations.processStarted, true);
  assert.equal(evidence.events.filter((event) =>
    event.type === 'PROCESS_ERROR').length, 1);
  assertNoPrivateRuntimeMaterial(evidence);
});

test('P4 P1 bounds missing spawn acknowledgement with confirmed forced termination', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.timers.fireDelay(fixture.command.lifecycle.startupTimeoutMs);
  assert.deepEqual(fixture.child.signals, ['SIGKILL']);
  fixture.child.emit('exit', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(evidence.terminalState, 'START_TIMED_OUT_FORCE_TERMINATED');
  assert.equal(evidence.observations.startupTimeoutTriggered, true);
  assert.equal(evidence.observations.processTerminationConfirmed, true);
});

test('P4 P1 fails closed when missing spawn acknowledgement cannot confirm termination', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.timers.fireDelay(fixture.command.lifecycle.startupTimeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.forceSettleMs);
  const evidence = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(evidence.terminalState, 'START_TIMED_OUT_FORCE_UNCONFIRMED');
  assert.equal(evidence.observations.processTerminationConfirmed, false);
  assert.equal(evidence.events.at(-1).type, 'FORCE_SETTLEMENT_EXPIRED');
});

test('P4 P1 ignores a stale startup timer after spawn acknowledgement', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  const startupTask = fixture.timers.tasks.find((task) =>
    task.delay === fixture.command.lifecycle.startupTimeoutMs);
  assert.ok(startupTask);
  fixture.child.emit('spawn');
  assert.equal(startupTask.cleared, true);
  startupTask.callback();
  fixture.child.emit('exit', 0, null);
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'EXITED');
  assert.equal(evidence.observations.startupTimeoutTriggered, false);
  assert.deepEqual(fixture.child.signals, []);
});

test('P4 P1 keeps startup-timeout precedence when spawn acknowledgement arrives late', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.timers.fireDelay(fixture.command.lifecycle.startupTimeoutMs);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'START_TIMED_OUT_FORCE_TERMINATED');
  assert.deepEqual(fixture.child.signals, ['SIGKILL']);
  assert.equal(evidence.events.filter((event) =>
    event.type === 'PROCESS_SPAWNED').length, 1);
});

test('P4 P1 cancels before resolver and spawn using a fake abort signal', async () => {
  let resolverCalls = 0;
  const signal = new FakeAbortSignal(true);
  const fixture = await processExecutionFixture({
    abortSignal: signal,
    assertBinding() { resolverCalls += 1; },
  });
  const evidence = await executeLifecycle(fixture);
  assert.equal(resolverCalls, 0);
  assert.equal(fixture.spawnCalls.length, 0);
  assert.equal(evidence.terminalState, 'CANCELLED_BEFORE_START');
  assert.equal(evidence.observations.abortRequested, true);
});

test('P4 P1 cancels after resolver but before spawn without widening the boundary', async () => {
  const signal = new FakeAbortSignal();
  let resolverCalls = 0;
  const fixture = await processExecutionFixture({
    abortSignal: signal,
    assertBinding() {
      resolverCalls += 1;
      signal.abort();
    },
  });
  const evidence = await executeLifecycle(fixture);
  assert.equal(resolverCalls, 1);
  assert.equal(fixture.spawnCalls.length, 0);
  assert.equal(evidence.terminalState, 'CANCELLED_BEFORE_START');
});

test('P4 P1 performs bounded cooperative cancellation after spawn', async () => {
  const signal = new FakeAbortSignal();
  const fixture = await processExecutionFixture({ abortSignal: signal });
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  signal.abort();
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'CANCELLED');
  assert.equal(evidence.observations.abortRequested, true);
  assert.equal(signal.listenerCount(), 0);
});

test('P4 P1 performs bounded cooperative timeout cancellation', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT');
  assert.equal(evidence.observations.timeoutTriggered, true);
  assert.equal(evidence.observations.forceKillSignalRequested, false);
});

test('P4 P1 escalates ignored cooperative timeout to confirmed SIGKILL', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  assert.deepEqual(fixture.child.signals, ['SIGINT', 'SIGKILL']);
  fixture.child.emit('exit', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT_FORCE_TERMINATED');
  assert.equal(evidence.observations.processTerminationConfirmed, true);
});

test('P4 P1 bounds kill failures and refuses to claim termination success', async () => {
  const child = new FakeChildProcess({ killThrows: true });
  const fixture = await processExecutionFixture({ child });
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.forceSettleMs);
  const evidence = await pending;
  assert.deepEqual(fixture.child.signals, ['SIGINT', 'SIGKILL']);
  assert.equal(evidence.terminalState, 'TIMED_OUT_FORCE_UNCONFIRMED');
  assert.equal(evidence.observations.cooperativeSignalSent, false);
  assert.equal(evidence.observations.forceKillSignalSent, false);
  assert.equal(evidence.observations.processTerminationConfirmed, false);
  assertNoPrivateRuntimeMaterial(evidence);
});

test('P4 P1 deterministically gives timeout precedence when timeout wins the race', async () => {
  const signal = new FakeAbortSignal();
  const fixture = await processExecutionFixture({ abortSignal: signal });
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  signal.abort();
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'TIMED_OUT');
  assert.equal(evidence.observations.timeoutTriggered, true);
  assert.equal(evidence.observations.abortRequested, false);
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
});

test('P4 P1 deterministically gives abort precedence when abort wins the race', async () => {
  const signal = new FakeAbortSignal();
  const fixture = await processExecutionFixture({ abortSignal: signal });
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  signal.abort();
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.child.emit('exit', null, 'SIGINT');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'CANCELLED');
  assert.equal(evidence.observations.abortRequested, true);
  assert.equal(evidence.observations.timeoutTriggered, false);
  assert.deepEqual(fixture.child.signals, ['SIGINT']);
});

test('P4 P1 settles only once under duplicate and contradictory terminal events', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  fixture.child.emit('exit', null, 'SIGKILL');
  fixture.child.emit('close', null, 'SIGKILL');
  const evidence = await pending;
  assert.equal(evidence.terminalState, 'EXITED');
  assert.equal(evidence.events.filter((event) => event.type === 'PROCESS_EXITED').length, 1);
  assert.equal(evidence.observations.processTerminationConfirmed, true);
});

test('P4 P1 stale timer callbacks cannot mutate a settled result', async () => {
  const fixture = await processExecutionFixture();
  const pending = executeLifecycle(fixture);
  const startupTask = fixture.timers.tasks.find((task) =>
    task.delay === fixture.command.lifecycle.startupTimeoutMs);
  fixture.child.emit('spawn');
  const timeoutTask = fixture.timers.tasks.find((task) =>
    task.delay === fixture.command.lifecycle.timeoutMs);
  fixture.child.emit('exit', 0, null);
  const evidence = await pending;
  const accepted = JSON.stringify(evidence);
  startupTask.callback();
  timeoutTask.callback();
  assert.equal(JSON.stringify(evidence), accepted);
  assert.deepEqual(fixture.child.signals, []);
});

for (const [label, options, message] of [
  ['resolver throw', { resolverThrows: true }, /could not be resolved/u],
  ['relative resolver path', { workingDirectoryPath: '../bundle' }, /normalized absolute path/u],
  ['symlink resolver path', { realPath: '/real/bundle' }, /non-symlink directory/u],
  ['non-directory resolver path', { isDirectory: false }, /non-symlink directory/u],
  ['realpath failure', { realpathThrows: true }, /unavailable/u],
  ['stat failure', { statThrows: true }, /unavailable/u],
]) {
  test(`P4 P1 fails closed for ${label} before spawn`, async () => {
    const fixture = await processExecutionFixture(options);
    await assert.rejects(() => executeLifecycle(fixture), message);
    assert.equal(fixture.spawnCalls.length, 0);
  });
}

for (const [label, exitCode, signal, message] of [
  ['out-of-range exit code', 256, null, /exactly one bounded exit code/u],
  ['unknown signal', null, 'SIGUSR1', /exactly one bounded exit code/u],
  ['missing exit metadata', null, null, /exactly one bounded exit code/u],
]) {
  test(`P4 P1 rejects ${label} from an observed exit`, async () => {
    const fixture = await processExecutionFixture();
    const pending = executeSanitized(fixture);
    fixture.child.emit('spawn');
    fixture.child.emit('exit', exitCode, signal);
    await assert.rejects(() => pending, message);
    assert.equal(fixture.spawnCalls.length, 1);
  });
}

test('P4 P1 keeps every public result deeply immutable and omits raw output and PID', async () => {
  const fixture = await processExecutionFixture({
    child: new FakeChildProcess({ pid: 987654 }),
  });
  const pending = executeSanitized(fixture);
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 7, null);
  const result = await pending;
  assertDeepFrozen(result);
  assertNoPrivateRuntimeMaterial(result);
  assert.equal(result.lifecycleEvidence.observations.numericProcessIdExposed, false);
  assert.equal(result.lifecycleEvidence.observations.stdoutCollected, false);
  assert.equal(result.lifecycleEvidence.observations.stderrCollected, false);
  assert.equal(result.runtimeEvidence.decision.rawRuntimeOutputCollected, false);
});

test('P4 P1 repeats fail-closed classifications byte-for-byte for identical static input', async () => {
  const firstFixture = await processExecutionFixture({ spawnThrows: true });
  const secondFixture = await processExecutionFixture({ spawnThrows: true });
  const first = await executeLifecycle(firstFixture);
  const second = await executeLifecycle(secondFixture);
  assert.deepEqual(first, second);
  assert.equal(firstFixture.spawnCalls.length, 1);
  assert.equal(secondFixture.spawnCalls.length, 1);
  assert.equal(first.terminalState, 'START_FAILED');
});
