import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeK6ProcessWithSanitizedResult,
} from '../src/process-execution-lifecycle.js';
import {
  processExecutionFixture,
} from './process-execution-lifecycle-test-helpers.js';

async function startIntegrated(options = {}) {
  const fixture = await processExecutionFixture(options.fixtureOptions);
  const pending = executeK6ProcessWithSanitizedResult({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  return { fixture, pending };
}

test('P3 integrated execution collects sanitized success from exactly one spawn', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const result = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(result.lifecycleEvidence.terminalState, 'EXITED');
  assert.equal(result.runtimeOutcome.outcomeClassification, 'SUCCEEDED');
  assert.equal(result.runtimeEvidence.decision.runtimeResultCollected, true);
});

test('P3 integrated execution preserves a non-zero bounded exit code', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 23, null);
  const result = await pending;
  assert.equal(result.runtimeOutcome.exitCode, 23);
  assert.equal(result.runtimeOutcome.outcomeClassification, 'FAILED_EXIT_CODE');
});

test('P3 integrated execution sanitizes an allow-listed signal', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.child.emit('exit', null, 'SIGTERM');
  const result = await pending;
  assert.equal(result.runtimeOutcome.signal, 'SIGTERM');
  assert.equal(result.runtimeOutcome.outcomeClassification, 'FAILED_SIGNAL');
});

test('P3 integrated execution classifies start failure without raw error', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('error', new Error('private start detail Authorization: Bearer abc'));
  const result = await pending;
  assert.equal(result.runtimeOutcome.outcomeClassification, 'START_FAILED');
  assert.doesNotMatch(JSON.stringify(result), /private start detail|Bearer abc/u);
});

test('P3 integrated execution classifies cancellation from the same process', async () => {
  const controller = new AbortController();
  const { fixture, pending } = await startIntegrated({
    fixtureOptions: { abortSignal: controller.signal },
  });
  fixture.child.emit('spawn');
  controller.abort();
  fixture.child.emit('exit', null, 'SIGINT');
  const result = await pending;
  assert.equal(fixture.spawnCalls.length, 1);
  assert.equal(result.runtimeOutcome.outcomeClassification, 'CANCELLED');
  assert.equal(result.runtimeOutcome.signal, 'SIGINT');
});

test('P3 integrated execution classifies forced timeout termination', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  fixture.child.emit('exit', null, 'SIGKILL');
  const result = await pending;
  assert.equal(result.runtimeOutcome.outcomeClassification, 'TIMED_OUT');
  assert.equal(result.runtimeOutcome.forceKillRequested, true);
  assert.equal(result.runtimeOutcome.signalClassification, 'FORCED_TERMINATION');
});

test('P3 integrated execution keeps unconfirmed force termination fail-closed', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  fixture.timers.fireDelay(fixture.command.lifecycle.forceSettleMs);
  const result = await pending;
  assert.equal(result.runtimeOutcome.outcomeClassification, 'TIMED_OUT');
  assert.equal(result.runtimeOutcome.processTerminationConfirmed, false);
  assert.equal(result.runtimeOutcome.exitObserved, false);
});

test('P3 integrated execution settles once under duplicate terminal events', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  fixture.child.emit('exit', 19, null);
  fixture.child.emit('spawn');
  const result = await pending;
  assert.equal(result.runtimeOutcome.exitCode, 0);
  assert.equal(result.runtimeOutcome.outcomeClassification, 'SUCCEEDED');
});

test('P3 integrated execution rejects forged non-allow-listed process signals', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.child.emit('exit', null, 'SIGUSR1');
  await assert.rejects(pending, /signal|allow-listed/u);
});

test('P3 integrated execution exports no PID, stdio value, host path or environment value', async () => {
  const { fixture, pending } = await startIntegrated();
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const result = await pending;
  const serialized = JSON.stringify(result);
  for (const forbidden of [
    String(fixture.child.pid),
    fixture.workingDirectoryPath,
    'K6_LOG_FORMAT',
    'stdout-secret-value',
    'stderr-secret-value',
    'Authorization: Bearer',
    'Cookie=',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
  assert.equal(result.runtimeEvidence.safetyBoundary.stdoutCollected, false);
  assert.equal(result.runtimeEvidence.safetyBoundary.stderrCollected, false);
  assert.equal(result.runtimeEvidence.safetyBoundary.numericProcessIdExposed, false);
  assert.equal(result.runtimeEvidence.safetyBoundary.hostAbsolutePathExposed, false);
});
