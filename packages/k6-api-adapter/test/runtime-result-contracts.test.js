import assert from 'node:assert/strict';
import test from 'node:test';
import { sha256 } from '@kdtp/knowledge-core';
import {
  computeK6ProcessTerminalObservationDigest,
  computeK6RuntimeExecutionEvidenceDigest,
  computeK6SanitizedRuntimeOutcomeDigest,
  createK6ProcessTerminalObservation,
  createK6RuntimeExecutionEvidence,
  createK6SanitizedRuntimeOutcome,
  executeK6ProcessLifecycle,
  validateK6ProcessTerminalObservation,
  validateK6RuntimeExecutionEvidence,
  validateK6SanitizedRuntimeOutcome,
} from '../src/process-execution-lifecycle.js';
import {
  processExecutionFixture,
} from './process-execution-lifecycle-test-helpers.js';
import { clone } from './runtime-admission-test-helpers.js';

function redigest(value, field) {
  const copy = clone(value);
  delete copy[field];
  value[field] = sha256(copy);
}

async function observeExit({ exitCode = 0, signal = null } = {}) {
  const fixture = await processExecutionFixture();
  const pending = executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  fixture.child.emit('spawn');
  fixture.child.emit('exit', exitCode, signal);
  return { fixture, lifecycleEvidence: await pending, exitCode, signal };
}

async function observeStartFailure() {
  const fixture = await processExecutionFixture();
  const pending = executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  fixture.child.emit('error', new Error('private start failure'));
  return { fixture, lifecycleEvidence: await pending, exitCode: null, signal: null };
}

async function observePrestartCancellation() {
  const controller = new AbortController();
  controller.abort();
  const fixture = await processExecutionFixture({ abortSignal: controller.signal });
  const lifecycleEvidence = await executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  return { fixture, lifecycleEvidence, exitCode: null, signal: null };
}

async function observeCancellation() {
  const controller = new AbortController();
  const fixture = await processExecutionFixture({ abortSignal: controller.signal });
  const pending = executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  fixture.child.emit('spawn');
  controller.abort();
  fixture.child.emit('exit', null, 'SIGINT');
  return { fixture, lifecycleEvidence: await pending, exitCode: null, signal: 'SIGINT' };
}

async function observeTimeout({ forced = false, confirmed = true } = {}) {
  const fixture = await processExecutionFixture();
  const pending = executeK6ProcessLifecycle({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  fixture.child.emit('spawn');
  fixture.timers.fireDelay(fixture.command.lifecycle.timeoutMs);
  if (forced) fixture.timers.fireDelay(fixture.command.lifecycle.cooperativeGraceMs);
  if (confirmed) {
    fixture.child.emit('exit', null, forced ? 'SIGKILL' : 'SIGINT');
  } else {
    fixture.timers.fireDelay(fixture.command.lifecycle.forceSettleMs);
  }
  return {
    fixture,
    lifecycleEvidence: await pending,
    exitCode: null,
    signal: confirmed ? (forced ? 'SIGKILL' : 'SIGINT') : null,
  };
}

function createProduct(record) {
  const terminalObservation = createK6ProcessTerminalObservation({
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    exitCode: record.exitCode,
    signal: record.signal,
  });
  const runtimeOutcome = createK6SanitizedRuntimeOutcome({
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    terminalObservation,
  });
  const runtimeEvidence = createK6RuntimeExecutionEvidence({
    bindings: record.fixture.bindings,
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    terminalObservation,
    runtimeOutcome,
  });
  return { terminalObservation, runtimeOutcome, runtimeEvidence };
}

test('P3 classifies zero exit as SUCCEEDED', async () => {
  const record = await observeExit({ exitCode: 0 });
  const product = createProduct(record);
  assert.equal(product.runtimeOutcome.outcomeClassification, 'SUCCEEDED');
  assert.equal(product.runtimeOutcome.exitCode, 0);
  assert.equal(product.runtimeOutcome.runtimeResultCollected, true);
});

test('P3 classifies non-zero exit as FAILED_EXIT_CODE', async () => {
  const product = createProduct(await observeExit({ exitCode: 17 }));
  assert.equal(product.runtimeOutcome.outcomeClassification, 'FAILED_EXIT_CODE');
  assert.equal(product.runtimeOutcome.exitCode, 17);
});

test('P3 classifies signal exit through an allow-list', async () => {
  const product = createProduct(await observeExit({ exitCode: null, signal: 'SIGTERM' }));
  assert.equal(product.runtimeOutcome.outcomeClassification, 'FAILED_SIGNAL');
  assert.equal(product.runtimeOutcome.signalClassification, 'COOPERATIVE_TERMINATION');
});

test('P3 classifies start failure without raw error material', async () => {
  const product = createProduct(await observeStartFailure());
  assert.equal(product.runtimeOutcome.outcomeClassification, 'START_FAILED');
  assert.equal(product.runtimeOutcome.exitObserved, false);
  assert.doesNotMatch(JSON.stringify(product), /private start failure/u);
});

test('P3 classifies pre-start cancellation as CANCELLED', async () => {
  const product = createProduct(await observePrestartCancellation());
  assert.equal(product.runtimeOutcome.outcomeClassification, 'CANCELLED');
  assert.equal(product.runtimeOutcome.processStarted, false);
});

test('P3 classifies cooperative cancellation as CANCELLED', async () => {
  const product = createProduct(await observeCancellation());
  assert.equal(product.runtimeOutcome.outcomeClassification, 'CANCELLED');
  assert.equal(product.runtimeOutcome.signal, 'SIGINT');
});

test('P3 classifies timeout as TIMED_OUT', async () => {
  const product = createProduct(await observeTimeout());
  assert.equal(product.runtimeOutcome.outcomeClassification, 'TIMED_OUT');
  assert.equal(product.runtimeOutcome.timedOut, true);
});

test('P3 preserves forced termination without claiming success', async () => {
  const product = createProduct(await observeTimeout({ forced: true }));
  assert.equal(product.runtimeOutcome.outcomeClassification, 'TIMED_OUT');
  assert.equal(product.runtimeOutcome.forceKillRequested, true);
  assert.equal(product.runtimeOutcome.signalClassification, 'FORCED_TERMINATION');
});

test('P3 keeps unconfirmed forced termination fail-closed', async () => {
  const product = createProduct(await observeTimeout({ forced: true, confirmed: false }));
  assert.equal(product.runtimeOutcome.outcomeClassification, 'TIMED_OUT');
  assert.equal(product.runtimeOutcome.processTerminationConfirmed, false);
  assert.equal(product.runtimeOutcome.exitObserved, false);
});

test('P3 terminal observation digest recomputes', async () => {
  const { terminalObservation } = createProduct(await observeExit());
  assert.equal(computeK6ProcessTerminalObservationDigest(terminalObservation),
    terminalObservation.observationDigest);
});

test('P3 runtime outcome digest recomputes', async () => {
  const { runtimeOutcome } = createProduct(await observeExit());
  assert.equal(computeK6SanitizedRuntimeOutcomeDigest(runtimeOutcome),
    runtimeOutcome.resultDigest);
});

test('P3 aggregate Evidence digest recomputes', async () => {
  const { runtimeEvidence } = createProduct(await observeExit());
  assert.equal(computeK6RuntimeExecutionEvidenceDigest(runtimeEvidence),
    runtimeEvidence.evidenceDigest);
});

test('P3 products are defensively copied and deeply frozen', async () => {
  const record = await observeExit();
  const { terminalObservation, runtimeOutcome, runtimeEvidence } = createProduct(record);
  assert.equal(Object.isFrozen(terminalObservation), true);
  assert.equal(Object.isFrozen(runtimeOutcome), true);
  assert.equal(Object.isFrozen(runtimeEvidence), true);
  assert.equal(Object.isFrozen(runtimeEvidence.predecessor), true);
  assert.throws(() => { runtimeOutcome.exitCode = 9; }, TypeError);
});

test('P3 rejects an exit code outside the bounded range', async () => {
  const record = await observeExit();
  assert.throws(() => createK6ProcessTerminalObservation({
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    exitCode: 256,
    signal: null,
  }), /Exit code/u);
});

test('P3 rejects arbitrary signals', async () => {
  const record = await observeExit({ exitCode: null, signal: 'SIGTERM' });
  assert.throws(() => createK6ProcessTerminalObservation({
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    exitCode: null,
    signal: 'SIGUSR1',
  }), /signal/u);
});

test('P3 rejects exit metadata when no exit was observed', async () => {
  const record = await observeStartFailure();
  assert.throws(() => createK6ProcessTerminalObservation({
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    exitCode: 1,
    signal: null,
  }), /forbidden/u);
});

test('P3 rejects forged terminal observation after self-redigest', async () => {
  const record = await observeExit();
  const { terminalObservation } = createProduct(record);
  const forged = clone(terminalObservation);
  forged.exitCode = 9;
  redigest(forged, 'observationDigest');
  assert.throws(() => validateK6ProcessTerminalObservation(forged, {
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
  }), /observation|mismatch/u);
});

test('P3 rejects forged success classification after self-redigest', async () => {
  const record = await observeExit({ exitCode: 7 });
  const { terminalObservation, runtimeOutcome } = createProduct(record);
  const forged = clone(runtimeOutcome);
  forged.outcomeClassification = 'SUCCEEDED';
  redigest(forged, 'resultDigest');
  assert.throws(() => validateK6SanitizedRuntimeOutcome(forged, {
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    terminalObservation,
  }), /outcome|mismatch/u);
});

test('P3 rejects predecessor digest substitution after self-redigest', async () => {
  const record = await observeExit();
  const { terminalObservation, runtimeOutcome, runtimeEvidence } = createProduct(record);
  const forged = clone(runtimeEvidence);
  forged.predecessor.commandDigest = 'a'.repeat(64);
  redigest(forged, 'evidenceDigest');
  assert.throws(() => validateK6RuntimeExecutionEvidence(forged, {
    bindings: record.fixture.bindings,
    command: record.fixture.command,
    adapterDescriptor: record.fixture.adapterDescriptor,
    lifecycleEvidence: record.lifecycleEvidence,
    terminalObservation,
    runtimeOutcome,
  }), /Evidence|mismatch/u);
});

test('P3 rejects unknown additional fields', async () => {
  const record = await observeExit();
  const { runtimeOutcome } = createProduct(record);
  const forged = clone(runtimeOutcome);
  forged.stdout = 'forbidden';
  assert.throws(() => validateK6SanitizedRuntimeOutcome(forged, {}), /fields/u);
});

test('P3 aggregate Evidence records the explicit file-result deferral', async () => {
  const { runtimeEvidence } = createProduct(await observeExit());
  assert.deepEqual(runtimeEvidence.fileResultCollection, {
    supported: false,
    implemented: false,
    decision: 'DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED',
    blockerCode: 'governed-output-root-not-defined',
    sourceBundleRemainsImmutable: true,
    callerPathAccepted: false,
    arbitraryFileReadEnabled: false,
  });
  assert.deepEqual(runtimeEvidence.decision.repositoryBlockers, []);
});

test('P3 aggregate Evidence binds every accepted predecessor digest', async () => {
  const record = await observeExit();
  const { runtimeEvidence } = createProduct(record);
  assert.equal(runtimeEvidence.predecessor.runtimePolicyDigest,
    record.fixture.bindings.policy.policyDigest);
  assert.equal(runtimeEvidence.predecessor.boundaryEvidenceDigest,
    record.fixture.bindings.boundaryEvidence.evidenceDigest);
  assert.equal(runtimeEvidence.predecessor.lifecycleEvidenceDigest,
    record.lifecycleEvidence.evidenceDigest);
});

test('P3 public products exclude PID, stdio, paths, environment values and credentials', async () => {
  const record = await observeExit();
  const product = createProduct(record);
  const serialized = JSON.stringify(product);
  for (const forbidden of [
    String(record.fixture.child.pid),
    record.fixture.workingDirectoryPath,
    'stdout-secret-value',
    'stderr-secret-value',
    'Authorization',
    'Bearer ',
    'K6_LOG_FORMAT',
    'private start failure',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});
