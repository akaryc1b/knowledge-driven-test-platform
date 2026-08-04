import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson, validateDigest } from '@kdtp/execution-contract';
import { runtimeAdmissionInvariant } from './errors.js';
import {
  K6_PROCESS_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
  freezeP2Value,
  validateK6NodeProcessAdapterDescriptor,
  validateK6ProcessExecutionCommandShape,
} from './process-execution-contracts.js';

const EVIDENCE_ID = /^k6process-lifecycle-[a-f0-9]{20}$/u;
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'commandDigest', 'adapterDigest',
  'terminalState', 'events', 'observations', 'decision', 'safetyBoundary',
  'evidenceDigest',
]);
const EVENT_FIELDS = Object.freeze(['sequence', 'type']);
const OBSERVATION_FIELDS = Object.freeze([
  'processStartAttempted', 'processStarted', 'processStartUnknown',
  'processIdCreated', 'numericProcessIdExposed', 'k6InvocationAttempted',
  'abortRequested', 'startupTimeoutTriggered', 'timeoutTriggered',
  'cooperativeSignalRequested', 'cooperativeSignalSent',
  'forceKillSignalRequested', 'forceKillSignalSent',
  'exitObserved', 'processTerminationConfirmed',
  'stdoutCollected', 'stderrCollected', 'runtimeResultCollected',
]);
const DECISION_FIELDS = Object.freeze([
  'nodeProcessAdapterImplemented', 'boundedLifecycleImplemented',
  'timeoutImplemented', 'cooperativeCancellationImplemented', 'terminalState',
  'processStartAttempted', 'processStarted', 'processStartUnknown',
  'processIdCreated', 'k6InvocationAttempted', 'k6Invoked',
  'externalProcessExecuted', 'runtimeResultCollected', 'nextRequiredSlice',
  'repositoryBlockers',
]);
const SAFETY_FIELDS = Object.freeze([
  'shellUsed', 'hostEnvironmentInherited', 'stdinProvided', 'stdoutCollected',
  'stderrCollected', 'numericProcessIdExposed',
  'temporaryExecutionDirectoryCreated', 'secretAccessed', 'databaseAccessed',
  'workerAdded', 'queueAdded', 'schedulerAdded', 'containerStarted',
  'kubernetesResourceCreated', 'remoteExecutionApiAdded', 'allureImplemented',
]);

export const K6_PROCESS_LIFECYCLE_EVENT_TYPES = Object.freeze([
  'COMMAND_ACCEPTED', 'CANCELLED_BEFORE_START', 'PROCESS_SPAWNED',
  'PROCESS_START_TIMEOUT', 'TIMEOUT_REACHED', 'CANCELLATION_REQUESTED',
  'COOPERATIVE_SIGNAL_REQUESTED', 'FORCE_KILL_SIGNAL_REQUESTED',
  'PROCESS_EXITED', 'PROCESS_START_FAILED', 'PROCESS_ERROR',
  'FORCE_SETTLEMENT_EXPIRED',
]);

export const K6_PROCESS_LIFECYCLE_TERMINAL_STATES = Object.freeze([
  'CANCELLED_BEFORE_START', 'EXITED', 'START_FAILED',
  'START_TIMED_OUT_FORCE_TERMINATED', 'START_TIMED_OUT_FORCE_UNCONFIRMED',
  'PROCESS_ERROR', 'CANCELLED', 'CANCELLED_FORCE_TERMINATED',
  'CANCELLED_FORCE_UNCONFIRMED', 'TIMED_OUT', 'TIMED_OUT_FORCE_TERMINATED',
  'TIMED_OUT_FORCE_UNCONFIRMED',
]);

export function createK6ProcessLifecycleEvidenceRecord({
  command,
  adapterDescriptor,
  terminalState,
  events,
  observations,
}) {
  const acceptedCommand = validateK6ProcessExecutionCommandShape(command);
  const descriptor = validateK6NodeProcessAdapterDescriptor(adapterDescriptor);
  runtimeAdmissionInvariant(K6_PROCESS_LIFECYCLE_TERMINAL_STATES.includes(terminalState),
    'K6_PROCESS_TERMINAL_STATE_INVALID', 'Process lifecycle terminal state is invalid');
  const frozenObservations = cloneExecutionJson(observations);
  const decision = {
    nodeProcessAdapterImplemented: true,
    boundedLifecycleImplemented: true,
    timeoutImplemented: true,
    cooperativeCancellationImplemented: true,
    terminalState,
    processStartAttempted: frozenObservations.processStartAttempted,
    processStarted: frozenObservations.processStarted,
    processStartUnknown: frozenObservations.processStartUnknown,
    processIdCreated: frozenObservations.processIdCreated,
    k6InvocationAttempted: frozenObservations.k6InvocationAttempted,
    k6Invoked: frozenObservations.processStarted,
    externalProcessExecuted: frozenObservations.processStarted,
    runtimeResultCollected: false,
    nextRequiredSlice: 'M3-R3-P3',
    repositoryBlockers: [],
  };
  const safetyBoundary = Object.fromEntries(SAFETY_FIELDS.map((field) => [field, false]));
  const identity = {
    commandDigest: acceptedCommand.commandDigest,
    adapterDigest: descriptor.adapterDigest,
    terminalState,
    events,
    observations: frozenObservations,
  };
  const withoutDigest = {
    schemaVersion: K6_PROCESS_LIFECYCLE_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6process-lifecycle-${sha256(identity).slice(0, 20)}`,
    commandDigest: acceptedCommand.commandDigest,
    adapterDigest: descriptor.adapterDigest,
    terminalState,
    events: cloneExecutionJson(events),
    observations: frozenObservations,
    decision,
    safetyBoundary,
  };
  const evidence = freezeP2Value(cloneExecutionJson({
    ...withoutDigest,
    evidenceDigest: sha256(withoutDigest),
  }));
  validateK6ProcessLifecycleEvidenceShape(evidence);
  return evidence;
}

export function validateK6ProcessLifecycleEvidence(input, bindings) {
  validateK6ProcessLifecycleEvidenceShape(input);
  exactFields(bindings, ['command', 'adapterDescriptor'],
    'INVALID_K6_PROCESS_LIFECYCLE_BINDINGS', 'Lifecycle Evidence bindings');
  const command = validateK6ProcessExecutionCommandShape(bindings.command);
  const descriptor = validateK6NodeProcessAdapterDescriptor(bindings.adapterDescriptor);
  runtimeAdmissionInvariant(input.commandDigest === command.commandDigest
      && input.adapterDigest === descriptor.adapterDigest,
  'K6_PROCESS_LIFECYCLE_BINDING_MISMATCH',
  'Lifecycle Evidence is not bound to its execution command and adapter');
  return freezeP2Value(cloneExecutionJson(input));
}

export function computeK6ProcessLifecycleEvidenceDigest(input) {
  validateK6ProcessLifecycleEvidenceShape(input, false);
  return digestWithout(input, 'evidenceDigest');
}

export function validateK6ProcessLifecycleEvidenceShape(input, requireDigest = true) {
  exactFields(input, EVIDENCE_FIELDS,
    'INVALID_K6_PROCESS_LIFECYCLE_EVIDENCE', 'Process lifecycle Evidence');
  exactFields(input.observations, OBSERVATION_FIELDS,
    'INVALID_K6_PROCESS_LIFECYCLE_EVIDENCE', 'Process lifecycle observations');
  exactFields(input.decision, DECISION_FIELDS,
    'INVALID_K6_PROCESS_LIFECYCLE_EVIDENCE', 'Process lifecycle decision');
  exactFields(input.safetyBoundary, SAFETY_FIELDS,
    'INVALID_K6_PROCESS_LIFECYCLE_EVIDENCE', 'Process lifecycle safety boundary');
  runtimeAdmissionInvariant(Array.isArray(input.events)
      && input.events.length >= 2 && input.events.length <= 16,
    'K6_PROCESS_LIFECYCLE_EVENTS_INVALID',
    'Process lifecycle Evidence requires a bounded event sequence');
  input.events.forEach((event, index) => {
    exactFields(event, EVENT_FIELDS,
      'K6_PROCESS_LIFECYCLE_EVENTS_INVALID', 'Process lifecycle event');
    runtimeAdmissionInvariant(event.sequence === index + 1
        && K6_PROCESS_LIFECYCLE_EVENT_TYPES.includes(event.type),
    'K6_PROCESS_LIFECYCLE_EVENTS_INVALID',
    'Process lifecycle event sequence or type is invalid');
  });
  const eventTypes = input.events.map((event) => event.type);
  const eventSet = new Set(eventTypes);
  runtimeAdmissionInvariant(eventSet.size === eventTypes.length
      && eventTypes[0] === 'COMMAND_ACCEPTED',
    'K6_PROCESS_LIFECYCLE_EVENTS_INVALID',
    'Process lifecycle event sequence contains duplicates or lacks COMMAND_ACCEPTED');
  const has = (type) => eventSet.has(type);
  const observations = input.observations;
  runtimeAdmissionInvariant(
    observations.processStartAttempted === observations.k6InvocationAttempted
      && observations.processStarted === has('PROCESS_SPAWNED')
      && observations.processStartUnknown
        === (has('PROCESS_START_TIMEOUT') && !has('PROCESS_SPAWNED'))
      && (!observations.processIdCreated || observations.processStartAttempted)
      && observations.abortRequested
        === (has('CANCELLED_BEFORE_START') || has('CANCELLATION_REQUESTED'))
      && observations.startupTimeoutTriggered === has('PROCESS_START_TIMEOUT')
      && observations.timeoutTriggered === has('TIMEOUT_REACHED')
      && observations.cooperativeSignalRequested
        === has('COOPERATIVE_SIGNAL_REQUESTED')
      && (!observations.cooperativeSignalSent
        || observations.cooperativeSignalRequested)
      && observations.forceKillSignalRequested
        === has('FORCE_KILL_SIGNAL_REQUESTED')
      && (!observations.forceKillSignalSent || observations.forceKillSignalRequested)
      && observations.exitObserved === has('PROCESS_EXITED')
      && observations.processTerminationConfirmed === observations.exitObserved
      && observations.numericProcessIdExposed === false
      && observations.stdoutCollected === false
      && observations.stderrCollected === false
      && observations.runtimeResultCollected === false,
    'K6_PROCESS_LIFECYCLE_OBSERVATION_MISMATCH',
    'Process lifecycle observations do not match the event sequence');
  validateTerminalEventSemantics(input.terminalState, eventTypes, observations);
  runtimeAdmissionInvariant(input.schemaVersion === K6_PROCESS_LIFECYCLE_EVIDENCE_SCHEMA_VERSION
      && EVIDENCE_ID.test(input.evidenceId)
      && input.evidenceId === `k6process-lifecycle-${sha256({
        commandDigest: input.commandDigest,
        adapterDigest: input.adapterDigest,
        terminalState: input.terminalState,
        events: input.events,
        observations: input.observations,
      }).slice(0, 20)}`
      && K6_PROCESS_LIFECYCLE_TERMINAL_STATES.includes(input.terminalState)
      && input.decision.nodeProcessAdapterImplemented === true
      && input.decision.boundedLifecycleImplemented === true
      && input.decision.timeoutImplemented === true
      && input.decision.cooperativeCancellationImplemented === true
      && input.decision.terminalState === input.terminalState
      && input.decision.processStartAttempted === observations.processStartAttempted
      && input.decision.processStarted === observations.processStarted
      && input.decision.processStartUnknown === observations.processStartUnknown
      && input.decision.processIdCreated === observations.processIdCreated
      && input.decision.k6InvocationAttempted === observations.k6InvocationAttempted
      && input.decision.k6Invoked === observations.processStarted
      && input.decision.externalProcessExecuted === observations.processStarted
      && input.decision.runtimeResultCollected === false
      && input.decision.nextRequiredSlice === 'M3-R3-P3'
      && Array.isArray(input.decision.repositoryBlockers)
      && input.decision.repositoryBlockers.length === 0
      && Object.values(input.safetyBoundary).every((value) => value === false),
    'K6_PROCESS_LIFECYCLE_EVIDENCE_ESCALATION',
    'Process lifecycle Evidence violates the P2 boundary');
  validateDigest(input.commandDigest, 'processLifecycle.commandDigest');
  validateDigest(input.adapterDigest, 'processLifecycle.adapterDigest');
  if (requireDigest) {
    validateDigest(input.evidenceDigest, 'processLifecycle.evidenceDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'evidenceDigest') === input.evidenceDigest,
      'K6_PROCESS_LIFECYCLE_EVIDENCE_DIGEST_MISMATCH',
      'Process lifecycle Evidence digest is invalid');
  }
  return input;
}

function validateTerminalEventSemantics(terminalState, eventTypes, observations) {
  const last = eventTypes.at(-1);
  const has = (type) => eventTypes.includes(type);
  const valid = {
    CANCELLED_BEFORE_START: last === 'CANCELLED_BEFORE_START'
      && observations.processStartAttempted === false,
    EXITED: last === 'PROCESS_EXITED'
      && !has('TIMEOUT_REACHED') && !has('CANCELLATION_REQUESTED')
      && !has('PROCESS_START_TIMEOUT'),
    START_FAILED: last === 'PROCESS_START_FAILED'
      && observations.processStarted === false,
    START_TIMED_OUT_FORCE_TERMINATED: last === 'PROCESS_EXITED'
      && has('PROCESS_START_TIMEOUT') && has('FORCE_KILL_SIGNAL_REQUESTED'),
    START_TIMED_OUT_FORCE_UNCONFIRMED: last === 'FORCE_SETTLEMENT_EXPIRED'
      && has('PROCESS_START_TIMEOUT') && has('FORCE_KILL_SIGNAL_REQUESTED'),
    PROCESS_ERROR: last === 'PROCESS_ERROR' && observations.processStarted === true,
    CANCELLED: last === 'PROCESS_EXITED'
      && has('CANCELLATION_REQUESTED') && has('COOPERATIVE_SIGNAL_REQUESTED')
      && !has('FORCE_KILL_SIGNAL_REQUESTED'),
    CANCELLED_FORCE_TERMINATED: last === 'PROCESS_EXITED'
      && has('CANCELLATION_REQUESTED') && has('FORCE_KILL_SIGNAL_REQUESTED'),
    CANCELLED_FORCE_UNCONFIRMED: last === 'FORCE_SETTLEMENT_EXPIRED'
      && has('CANCELLATION_REQUESTED') && has('FORCE_KILL_SIGNAL_REQUESTED'),
    TIMED_OUT: last === 'PROCESS_EXITED'
      && has('TIMEOUT_REACHED') && has('COOPERATIVE_SIGNAL_REQUESTED')
      && !has('FORCE_KILL_SIGNAL_REQUESTED'),
    TIMED_OUT_FORCE_TERMINATED: last === 'PROCESS_EXITED'
      && has('TIMEOUT_REACHED') && has('FORCE_KILL_SIGNAL_REQUESTED'),
    TIMED_OUT_FORCE_UNCONFIRMED: last === 'FORCE_SETTLEMENT_EXPIRED'
      && has('TIMEOUT_REACHED') && has('FORCE_KILL_SIGNAL_REQUESTED'),
  }[terminalState] === true;
  runtimeAdmissionInvariant(valid,
    'K6_PROCESS_LIFECYCLE_TERMINAL_MISMATCH',
    'Process lifecycle terminal state does not match its events');
}

function digestWithout(input, field) {
  const copy = cloneExecutionJson(input);
  delete copy[field];
  return sha256(copy);
}

function exactFields(value, fields, code, label) {
  runtimeAdmissionInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  runtimeAdmissionInvariant(
    canonicalStringify(Object.keys(value).sort()) === canonicalStringify([...fields].sort()),
    code, `${label} fields do not match the closed contract`);
}
