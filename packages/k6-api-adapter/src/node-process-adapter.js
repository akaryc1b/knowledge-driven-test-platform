import { spawn } from 'node:child_process';
import { realpathSync, statSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';
import { cloneExecutionJson } from '@kdtp/execution-contract';
import { runtimeAdmissionInvariant } from './errors.js';
import {
  createK6NodeProcessAdapterDescriptor,
  fixedEnvironmentValuesForAdapter,
  freezeP2Value,
  validateK6NodeProcessAdapterDescriptor,
  validateK6ProcessExecutionCommand,
  validateK6ProcessExecutionCommandShape,
} from './process-execution-contracts.js';
import {
  createK6ProcessLifecycleEvidenceRecord,
  validateK6ProcessLifecycleEvidence,
} from './process-lifecycle-evidence.js';
import {
  createK6ProcessTerminalObservation,
  createK6RuntimeExecutionEvidence,
  createK6SanitizedRuntimeOutcome,
  freezeP3Value,
} from './runtime-result-contracts.js';

const NODE_ADAPTER_EXECUTORS = new WeakMap();
const ENCODED_PATH_BOUNDARY_PATTERN = /%(?:2e|2f|5c)/iu;

export function createNodeK6ProcessAdapter(options = {}) {
  validateAdapterOptions(options);
  const runtime = {
    spawnProcess: options.spawnProcess ?? spawn,
    realpathPath: options.realpathPath ?? realpathSync,
    statPath: options.statPath ?? statSync,
    setTimer: options.setTimer ?? setTimeout,
    clearTimer: options.clearTimer ?? clearTimeout,
  };
  const descriptor = createK6NodeProcessAdapterDescriptor();
  const adapter = Object.freeze({ descriptor });
  NODE_ADAPTER_EXECUTORS.set(adapter, (command, executionContext) =>
    runNodeProcessLifecycle({ command, executionContext, descriptor, runtime }));
  return adapter;
}

export async function executeK6ProcessLifecycle({
  adapter,
  command,
  bindings,
  executionContext,
}) {
  const execution = await executeRegisteredNodeLifecycle({
    adapter,
    command,
    bindings,
    executionContext,
  });
  return execution.lifecycleEvidence;
}

export async function executeK6ProcessWithSanitizedResult({
  adapter,
  command,
  bindings,
  executionContext,
}) {
  const execution = await executeRegisteredNodeLifecycle({
    adapter,
    command,
    bindings,
    executionContext,
  });
  const terminalObservation = createK6ProcessTerminalObservation({
    command: execution.command,
    adapterDescriptor: execution.adapterDescriptor,
    lifecycleEvidence: execution.lifecycleEvidence,
    exitCode: execution.exitCode,
    signal: execution.signal,
  });
  const runtimeOutcome = createK6SanitizedRuntimeOutcome({
    command: execution.command,
    adapterDescriptor: execution.adapterDescriptor,
    lifecycleEvidence: execution.lifecycleEvidence,
    terminalObservation,
  });
  const runtimeEvidence = createK6RuntimeExecutionEvidence({
    bindings,
    command: execution.command,
    adapterDescriptor: execution.adapterDescriptor,
    lifecycleEvidence: execution.lifecycleEvidence,
    terminalObservation,
    runtimeOutcome,
  });
  return freezeP3Value({
    lifecycleEvidence: execution.lifecycleEvidence,
    terminalObservation,
    runtimeOutcome,
    runtimeEvidence,
  });
}

async function executeRegisteredNodeLifecycle({
  adapter,
  command,
  bindings,
  executionContext,
}) {
  runtimeAdmissionInvariant(adapter && typeof adapter === 'object'
      && NODE_ADAPTER_EXECUTORS.has(adapter),
  'K6_NODE_PROCESS_ADAPTER_UNAVAILABLE',
  'A registered Node process adapter is required');
  const descriptor = validateK6NodeProcessAdapterDescriptor(adapter.descriptor);
  const acceptedCommand = validateK6ProcessExecutionCommand(command, bindings);
  let record;
  try {
    record = await NODE_ADAPTER_EXECUTORS.get(adapter)(
      freezeP2Value(cloneExecutionJson(acceptedCommand)), executionContext);
  } catch (error) {
    if (error?.name === 'K6ApiRuntimeAdmissionError') throw error;
    throw sanitizedRuntimeError(
      'K6_NODE_PROCESS_ADAPTER_FAILED',
      'Node process adapter failed before producing lifecycle Evidence');
  }
  exactFields(record, ['lifecycleEvidence', 'exitCode', 'signal'],
    'K6_NODE_PROCESS_RESULT_INVALID', 'Node process result');
  const lifecycleEvidence = validateK6ProcessLifecycleEvidence(record.lifecycleEvidence, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
  });
  return freezeP3Value({
    command: acceptedCommand,
    adapterDescriptor: descriptor,
    lifecycleEvidence,
    exitCode: record.exitCode,
    signal: record.signal,
  });
}

async function runNodeProcessLifecycle({ command, executionContext, descriptor, runtime }) {
  const acceptedCommand = validateK6ProcessExecutionCommandShape(command);
  const acceptedDescriptor = validateK6NodeProcessAdapterDescriptor(descriptor);
  runtimeAdmissionInvariant(acceptedCommand.adapterDigest === acceptedDescriptor.adapterDigest,
    'K6_PROCESS_ADAPTER_BINDING_MISMATCH',
    'Process execution command is not bound to the active Node adapter');
  const context = validateExecutionContext(executionContext);
  const events = [];
  const observations = initialObservations();
  pushEvent(events, 'COMMAND_ACCEPTED');

  const finishBeforeStart = () => {
    observations.abortRequested = true;
    pushEvent(events, 'CANCELLED_BEFORE_START');
    return createLifecycleRecord({
      command: acceptedCommand,
      adapterDescriptor: acceptedDescriptor,
      terminalState: 'CANCELLED_BEFORE_START',
      events,
      observations,
      exitCode: null,
      signal: null,
    });
  };
  if (context.abortSignal?.aborted === true) return finishBeforeStart();
  const workingDirectoryPath = resolveWorkingDirectoryPath(
    acceptedCommand, context.resolveWorkingDirectory, runtime);
  if (context.abortSignal?.aborted === true) return finishBeforeStart();
  const environment = fixedEnvironmentValuesForAdapter(
    acceptedCommand.environment.allowedNames);

  return new Promise((resolve) => {
    let child = null;
    let settled = false;
    let spawned = false;
    let cancellationReason = null;
    let cancellationPending = false;
    let terminalExitCode = null;
    let terminalSignal = null;
    let startupTimer = null;
    let timeoutTimer = null;
    let forceTimer = null;
    let forceSettleTimer = null;

    const cleanup = () => {
      for (const timer of [startupTimer, timeoutTimer, forceTimer, forceSettleTimer]) {
        if (timer !== null) runtime.clearTimer(timer);
      }
      if (context.abortSignal) {
        context.abortSignal.removeEventListener('abort', abortListener);
      }
      if (child && typeof child.removeListener === 'function') {
        child.removeListener('spawn', onSpawn);
        child.removeListener('error', onError);
        child.removeListener('exit', onExit);
      }
    };
    const finish = (terminalState) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(createLifecycleRecord({
        command: acceptedCommand,
        adapterDescriptor: acceptedDescriptor,
        terminalState,
        events,
        observations,
        exitCode: terminalExitCode,
        signal: terminalSignal,
      }));
    };
    const forceTerminalPrefix = () => {
      if (cancellationReason === 'TIMEOUT') return 'TIMED_OUT';
      if (cancellationReason === 'START_TIMEOUT') return 'START_TIMED_OUT';
      return 'CANCELLED';
    };
    const sendForceKill = () => {
      if (settled || !child || observations.forceKillSignalRequested) return;
      observations.forceKillSignalRequested = true;
      pushEvent(events, 'FORCE_KILL_SIGNAL_REQUESTED');
      observations.forceKillSignalSent = safeKill(
        child, acceptedCommand.lifecycle.forceKillSignal);
      forceSettleTimer = runtime.setTimer(() => {
        if (settled) return;
        pushEvent(events, 'FORCE_SETTLEMENT_EXPIRED');
        finish(`${forceTerminalPrefix()}_FORCE_UNCONFIRMED`);
      }, acceptedCommand.lifecycle.forceSettleMs);
    };
    const sendCooperativeCancellation = () => {
      if (settled || !spawned || observations.cooperativeSignalRequested) return;
      observations.cooperativeSignalRequested = true;
      pushEvent(events, 'COOPERATIVE_SIGNAL_REQUESTED');
      observations.cooperativeSignalSent = safeKill(
        child, acceptedCommand.lifecycle.cooperativeSignal);
      forceTimer = runtime.setTimer(
        sendForceKill, acceptedCommand.lifecycle.cooperativeGraceMs);
    };
    const requestCancellation = (reason) => {
      if (settled || cancellationReason) return;
      cancellationReason = reason;
      if (reason === 'TIMEOUT') {
        observations.timeoutTriggered = true;
        pushEvent(events, 'TIMEOUT_REACHED');
      } else {
        observations.abortRequested = true;
        pushEvent(events, 'CANCELLATION_REQUESTED');
      }
      cancellationPending = true;
      if (spawned) sendCooperativeCancellation();
    };
    const abortListener = () => requestCancellation('ABORT');
    const onStartupTimeout = () => {
      if (settled || spawned) return;
      observations.startupTimeoutTriggered = true;
      observations.processStartUnknown = observations.processStartAttempted;
      pushEvent(events, 'PROCESS_START_TIMEOUT');
      if (!cancellationReason) cancellationReason = 'START_TIMEOUT';
      sendForceKill();
    };
    const onSpawn = () => {
      if (settled) return;
      spawned = true;
      observations.processStarted = true;
      observations.processStartUnknown = false;
      observations.processIdCreated = Number.isSafeInteger(child?.pid) && child.pid > 0;
      pushEvent(events, 'PROCESS_SPAWNED');
      if (startupTimer !== null) runtime.clearTimer(startupTimer);
      if (cancellationReason !== 'START_TIMEOUT') {
        timeoutTimer = runtime.setTimer(
          () => requestCancellation('TIMEOUT'), acceptedCommand.lifecycle.timeoutMs);
      }
      if (cancellationPending && cancellationReason !== 'START_TIMEOUT') {
        sendCooperativeCancellation();
      }
    };
    const onError = () => {
      if (settled) return;
      if (cancellationReason === 'START_TIMEOUT' && !spawned) {
        pushEvent(events, 'PROCESS_ERROR');
        return;
      }
      pushEvent(events, spawned ? 'PROCESS_ERROR' : 'PROCESS_START_FAILED');
      finish(spawned ? 'PROCESS_ERROR' : 'START_FAILED');
    };
    const onExit = (exitCode, signal) => {
      if (settled) return;
      terminalExitCode = exitCode ?? null;
      terminalSignal = signal ?? null;
      observations.exitObserved = true;
      observations.processTerminationConfirmed = true;
      pushEvent(events, 'PROCESS_EXITED');
      if (cancellationReason === 'TIMEOUT') {
        finish(observations.forceKillSignalRequested
          ? 'TIMED_OUT_FORCE_TERMINATED' : 'TIMED_OUT');
      } else if (cancellationReason === 'ABORT') {
        finish(observations.forceKillSignalRequested
          ? 'CANCELLED_FORCE_TERMINATED' : 'CANCELLED');
      } else if (cancellationReason === 'START_TIMEOUT') {
        finish('START_TIMED_OUT_FORCE_TERMINATED');
      } else {
        finish('EXITED');
      }
    };

    if (context.abortSignal) {
      context.abortSignal.addEventListener('abort', abortListener, { once: true });
      if (context.abortSignal.aborted === true) {
        observations.abortRequested = true;
        pushEvent(events, 'CANCELLED_BEFORE_START');
        finish('CANCELLED_BEFORE_START');
        return;
      }
    }
    try {
      observations.processStartAttempted = true;
      observations.k6InvocationAttempted = true;
      child = runtime.spawnProcess(acceptedCommand.executable, [...acceptedCommand.argv], {
        cwd: workingDirectoryPath,
        env: cloneExecutionJson(environment),
        shell: false,
        detached: false,
        windowsHide: true,
        stdio: ['ignore', 'ignore', 'ignore'],
      });
      validateChildProcessHandle(child);
      observations.processIdCreated = Number.isSafeInteger(child.pid) && child.pid > 0;
      child.once('spawn', onSpawn);
      child.once('error', onError);
      child.once('exit', onExit);
      startupTimer = runtime.setTimer(
        onStartupTimeout, acceptedCommand.lifecycle.startupTimeoutMs);
    } catch {
      pushEvent(events, 'PROCESS_START_FAILED');
      finish('START_FAILED');
    }
  });
}

function createLifecycleRecord({
  command,
  adapterDescriptor,
  terminalState,
  events,
  observations,
  exitCode,
  signal,
}) {
  return freezeP3Value({
    lifecycleEvidence: createK6ProcessLifecycleEvidenceRecord({
      command,
      adapterDescriptor,
      terminalState,
      events,
      observations,
    }),
    exitCode,
    signal,
  });
}

function initialObservations() {
  return {
    processStartAttempted: false,
    processStarted: false,
    processStartUnknown: false,
    processIdCreated: false,
    numericProcessIdExposed: false,
    k6InvocationAttempted: false,
    abortRequested: false,
    startupTimeoutTriggered: false,
    timeoutTriggered: false,
    cooperativeSignalRequested: false,
    cooperativeSignalSent: false,
    forceKillSignalRequested: false,
    forceKillSignalSent: false,
    exitObserved: false,
    processTerminationConfirmed: false,
    stdoutCollected: false,
    stderrCollected: false,
    runtimeResultCollected: false,
  };
}

function validateAdapterOptions(options) {
  runtimeAdmissionInvariant(options && typeof options === 'object' && !Array.isArray(options),
    'INVALID_K6_NODE_PROCESS_ADAPTER_OPTIONS',
    'Node process adapter options must be an object');
  const allowed = new Set([
    'spawnProcess', 'realpathPath', 'statPath', 'setTimer', 'clearTimer',
  ]);
  runtimeAdmissionInvariant(Object.keys(options).every((key) => allowed.has(key)),
    'INVALID_K6_NODE_PROCESS_ADAPTER_OPTIONS',
    'Node process adapter options contain an unsupported field');
  for (const [key, value] of Object.entries(options)) {
    runtimeAdmissionInvariant(typeof value === 'function',
      'INVALID_K6_NODE_PROCESS_ADAPTER_OPTIONS',
      `Node process adapter option ${key} must be a function`);
  }
}

function validateExecutionContext(input) {
  exactFields(input, ['resolveWorkingDirectory', 'abortSignal'],
    'INVALID_K6_PROCESS_EXECUTION_CONTEXT', 'Process execution context');
  runtimeAdmissionInvariant(typeof input.resolveWorkingDirectory === 'function',
    'INVALID_K6_PROCESS_EXECUTION_CONTEXT',
    'Process execution context requires a working-directory resolver');
  if (input.abortSignal !== null) {
    runtimeAdmissionInvariant(input.abortSignal && typeof input.abortSignal === 'object'
        && typeof input.abortSignal.aborted === 'boolean'
        && typeof input.abortSignal.addEventListener === 'function'
        && typeof input.abortSignal.removeEventListener === 'function',
    'INVALID_K6_PROCESS_ABORT_SIGNAL',
    'Process abort signal does not match the required contract');
  }
  return input;
}

function resolveWorkingDirectoryPath(command, resolver, runtime) {
  let candidate;
  try {
    candidate = resolver(freezeP2Value({
      bundleDigest: command.source.bundleDigest,
      logicalName: command.workingDirectory.logicalName,
    }));
  } catch {
    throw sanitizedRuntimeError(
      'K6_PROCESS_WORKING_DIRECTORY_RESOLUTION_FAILED',
      'Process working directory could not be resolved');
  }
  runtimeAdmissionInvariant(typeof candidate === 'string' && candidate.length > 0
      && !candidate.includes('\0') && !candidate.includes('\\')
      && !ENCODED_PATH_BOUNDARY_PATTERN.test(candidate)
      && isAbsolute(candidate) && normalize(candidate) === candidate,
  'K6_PROCESS_WORKING_DIRECTORY_INVALID',
  'Resolved working directory must be a normalized absolute path');
  let realPath;
  let stat;
  try {
    realPath = runtime.realpathPath(candidate);
    stat = runtime.statPath(candidate);
  } catch {
    throw sanitizedRuntimeError(
      'K6_PROCESS_WORKING_DIRECTORY_UNAVAILABLE',
      'Resolved working directory is unavailable');
  }
  runtimeAdmissionInvariant(realPath === candidate
      && stat && typeof stat.isDirectory === 'function' && stat.isDirectory() === true,
  'K6_PROCESS_WORKING_DIRECTORY_UNTRUSTED',
  'Resolved working directory must be a real non-symlink directory');
  return candidate;
}

function validateChildProcessHandle(child) {
  runtimeAdmissionInvariant(child && typeof child === 'object'
      && typeof child.once === 'function'
      && typeof child.removeListener === 'function'
      && typeof child.kill === 'function',
  'K6_PROCESS_HANDLE_INVALID',
  'Spawn returned an invalid process handle');
}

function safeKill(child, signal) {
  try { return child.kill(signal) === true; } catch { return false; }
}

function pushEvent(events, type) {
  runtimeAdmissionInvariant(events.length < 16,
    'K6_PROCESS_LIFECYCLE_EVENT_LIMIT',
    'Process lifecycle event count exceeds the fixed bound');
  events.push({ sequence: events.length + 1, type });
}

function exactFields(value, fields, code, label) {
  runtimeAdmissionInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  runtimeAdmissionInvariant(
    JSON.stringify(Object.keys(value).sort()) === JSON.stringify([...fields].sort()),
    code, `${label} fields do not match the closed contract`);
}

function sanitizedRuntimeError(code, message) {
  const error = new Error(message);
  error.name = 'K6ApiRuntimeAdmissionError';
  error.code = code;
  error.details = {};
  return error;
}
