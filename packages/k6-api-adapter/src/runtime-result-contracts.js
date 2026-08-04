import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson, validateDigest } from '@kdtp/execution-contract';
import { runtimeAdmissionInvariant } from './errors.js';
import {
  validateK6NodeProcessAdapterDescriptor,
  validateK6ProcessExecutionCommand,
  validateK6ProcessExecutionCommandShape,
} from './process-execution-contracts.js';
import {
  validateK6ProcessLifecycleEvidence,
  validateK6ProcessLifecycleEvidenceShape,
} from './process-lifecycle-evidence.js';

export const K6_PROCESS_TERMINAL_OBSERVATION_SCHEMA_VERSION =
  'k6-process-terminal-observation/v1';
export const K6_SANITIZED_RUNTIME_OUTCOME_SCHEMA_VERSION =
  'k6-sanitized-runtime-outcome/v1';
export const K6_RUNTIME_EXECUTION_EVIDENCE_SCHEMA_VERSION =
  'k6-runtime-execution-evidence/v1';

export const K6_SANITIZED_PROCESS_SIGNALS = Object.freeze([
  'SIGABRT', 'SIGHUP', 'SIGINT', 'SIGKILL', 'SIGQUIT', 'SIGTERM',
]);
export const K6_RUNTIME_OUTCOME_CLASSIFICATIONS = Object.freeze([
  'SUCCEEDED', 'FAILED_EXIT_CODE', 'FAILED_SIGNAL', 'START_FAILED',
  'PROCESS_ERROR', 'CANCELLED', 'TIMED_OUT',
]);
export const K6_FILE_RESULT_COLLECTION_DECISION =
  'DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED';
export const K6_FILE_RESULT_COLLECTION_BLOCKER =
  'governed-output-root-not-defined';

const TERMINAL_OBSERVATION_ID = /^k6process-terminal-[a-f0-9]{20}$/u;
const RUNTIME_RESULT_ID = /^k6runtime-result-[a-f0-9]{20}$/u;
const RUNTIME_EVIDENCE_ID = /^k6runtime-execution-[a-f0-9]{20}$/u;
const TERMINAL_OBSERVATION_FIELDS = Object.freeze([
  'schemaVersion', 'observationId', 'commandDigest', 'adapterDigest',
  'lifecycleEvidenceDigest', 'exitObserved', 'exitCodePresent', 'exitCode',
  'signalObserved', 'signal', 'signalClassification',
  'processTerminationConfirmed', 'observationDigest',
]);
const OUTCOME_FIELDS = Object.freeze([
  'schemaVersion', 'resultId', 'commandDigest', 'adapterDigest',
  'lifecycleEvidenceDigest', 'terminalObservationDigest', 'terminalState',
  'outcomeClassification', 'exitObserved', 'exitCodePresent', 'exitCode',
  'signalObserved', 'signal', 'signalClassification', 'processStarted',
  'processStartUnknown', 'processTerminationConfirmed', 'timedOut',
  'cancelled', 'forceKillRequested', 'forceKillSent',
  'runtimeResultCollected', 'resultDigest',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'predecessor', 'terminalObservationDigest',
  'outcomeDigest', 'resultSources', 'fileResultCollection', 'decision',
  'safetyBoundary', 'evidenceDigest',
]);
const PREDECESSOR_FIELDS = Object.freeze([
  'runtimePolicyDigest', 'runtimeAdmissionRequestDigest', 'invocationPlanDigest',
  'runtimeAdmissionEvidenceDigest', 'portDigest', 'launchSpecificationDigest',
  'launchDecisionDigest', 'boundaryEvidenceDigest', 'adapterDigest',
  'commandDigest', 'lifecycleEvidenceDigest',
]);
const RESULT_SOURCE_FIELDS = Object.freeze([
  'lifecycleEvidencePresent', 'terminalObservationPresent',
  'sanitizedOutcomePresent', 'rawRuntimeOutputPresent', 'fileResultPresent',
  'processOutcomeComplete', 'runtimeResultComplete',
]);
const FILE_RESULT_FIELDS = Object.freeze([
  'supported', 'implemented', 'decision', 'blockerCode',
  'sourceBundleRemainsImmutable', 'callerPathAccepted',
  'arbitraryFileReadEnabled',
]);
const DECISION_FIELDS = Object.freeze([
  'allPredecessorsBound', 'runtimeResultCollected',
  'rawRuntimeOutputCollected', 'fileResultCollectionSupported',
  'fileResultCollectionImplemented', 'outcomeClassification',
  'nextRequiredSlice', 'repositoryBlockers',
]);
const SAFETY_FIELDS = Object.freeze([
  'stdoutCollected', 'stderrCollected', 'rawErrorCollected',
  'stackTraceCollected', 'numericProcessIdExposed',
  'hostAbsolutePathExposed', 'environmentValueExposed',
  'secretMaterialCollected', 'arbitraryFileReadEnabled',
  'sourceBundleMutated', 'allureImplemented', 'workerAdded', 'queueAdded',
  'schedulerAdded', 'containerStarted', 'kubernetesResourceCreated',
  'remoteExecutionApiAdded',
]);

export function createK6ProcessTerminalObservation({
  command,
  adapterDescriptor,
  lifecycleEvidence,
  exitCode = null,
  signal = null,
}) {
  const acceptedCommand = validateK6ProcessExecutionCommandShape(command);
  const descriptor = validateK6NodeProcessAdapterDescriptor(adapterDescriptor);
  const lifecycle = validateK6ProcessLifecycleEvidence(lifecycleEvidence, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
  });
  const normalized = normalizeExitMetadata({
    exitObserved: lifecycle.observations.exitObserved,
    exitCode,
    signal,
  });
  const identity = {
    commandDigest: acceptedCommand.commandDigest,
    adapterDigest: descriptor.adapterDigest,
    lifecycleEvidenceDigest: lifecycle.evidenceDigest,
    ...normalized,
    processTerminationConfirmed: lifecycle.observations.processTerminationConfirmed,
  };
  const withoutDigest = {
    schemaVersion: K6_PROCESS_TERMINAL_OBSERVATION_SCHEMA_VERSION,
    observationId: `k6process-terminal-${sha256(identity).slice(0, 20)}`,
    ...identity,
  };
  const observation = freezeP3Value({
    ...withoutDigest,
    observationDigest: sha256(withoutDigest),
  });
  validateK6ProcessTerminalObservationShape(observation);
  return observation;
}

export function validateK6ProcessTerminalObservation(input, bindings) {
  validateK6ProcessTerminalObservationShape(input);
  exactFields(bindings, ['command', 'adapterDescriptor', 'lifecycleEvidence'],
    'INVALID_K6_PROCESS_TERMINAL_BINDINGS', 'Terminal observation bindings');
  const expected = createK6ProcessTerminalObservation({
    ...bindings,
    exitCode: input.exitCode,
    signal: input.signal,
  });
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_PROCESS_TERMINAL_OBSERVATION_MISMATCH',
    'Terminal observation does not match its lifecycle predecessor');
  return expected;
}

export function computeK6ProcessTerminalObservationDigest(input) {
  validateK6ProcessTerminalObservationShape(input, false);
  return digestWithout(input, 'observationDigest');
}

export function validateK6ProcessTerminalObservationShape(input, requireDigest = true) {
  exactFields(input, TERMINAL_OBSERVATION_FIELDS,
    'INVALID_K6_PROCESS_TERMINAL_OBSERVATION', 'Terminal observation');
  validateDigest(input.commandDigest, 'terminalObservation.commandDigest');
  validateDigest(input.adapterDigest, 'terminalObservation.adapterDigest');
  validateDigest(input.lifecycleEvidenceDigest,
    'terminalObservation.lifecycleEvidenceDigest');
  const normalized = normalizeExitMetadata({
    exitObserved: input.exitObserved,
    exitCode: input.exitCode,
    signal: input.signal,
  });
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_PROCESS_TERMINAL_OBSERVATION_SCHEMA_VERSION
      && TERMINAL_OBSERVATION_ID.test(input.observationId)
      && input.exitCodePresent === normalized.exitCodePresent
      && input.signalObserved === normalized.signalObserved
      && input.signalClassification === normalized.signalClassification
      && typeof input.processTerminationConfirmed === 'boolean'
      && input.processTerminationConfirmed === input.exitObserved
      && input.observationId === `k6process-terminal-${sha256({
        commandDigest: input.commandDigest,
        adapterDigest: input.adapterDigest,
        lifecycleEvidenceDigest: input.lifecycleEvidenceDigest,
        exitObserved: input.exitObserved,
        exitCodePresent: input.exitCodePresent,
        exitCode: input.exitCode,
        signalObserved: input.signalObserved,
        signal: input.signal,
        signalClassification: input.signalClassification,
        processTerminationConfirmed: input.processTerminationConfirmed,
      }).slice(0, 20)}`,
    'K6_PROCESS_TERMINAL_OBSERVATION_INVALID',
    'Terminal observation violates the closed sanitized contract');
  if (requireDigest) {
    validateDigest(input.observationDigest, 'terminalObservation.observationDigest');
    runtimeAdmissionInvariant(
      digestWithout(input, 'observationDigest') === input.observationDigest,
      'K6_PROCESS_TERMINAL_OBSERVATION_DIGEST_MISMATCH',
      'Terminal observation digest is invalid');
  }
  return input;
}

export function createK6SanitizedRuntimeOutcome({
  command,
  adapterDescriptor,
  lifecycleEvidence,
  terminalObservation,
}) {
  const acceptedCommand = validateK6ProcessExecutionCommandShape(command);
  const descriptor = validateK6NodeProcessAdapterDescriptor(adapterDescriptor);
  const lifecycle = validateK6ProcessLifecycleEvidence(lifecycleEvidence, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
  });
  const terminal = validateK6ProcessTerminalObservation(terminalObservation, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
    lifecycleEvidence: lifecycle,
  });
  const outcomeClassification = classifyOutcome(lifecycle, terminal);
  const terminalState = lifecycle.terminalState;
  const withoutDigest = {
    schemaVersion: K6_SANITIZED_RUNTIME_OUTCOME_SCHEMA_VERSION,
    resultId: `k6runtime-result-${sha256({
      commandDigest: acceptedCommand.commandDigest,
      lifecycleEvidenceDigest: lifecycle.evidenceDigest,
      terminalObservationDigest: terminal.observationDigest,
    }).slice(0, 20)}`,
    commandDigest: acceptedCommand.commandDigest,
    adapterDigest: descriptor.adapterDigest,
    lifecycleEvidenceDigest: lifecycle.evidenceDigest,
    terminalObservationDigest: terminal.observationDigest,
    terminalState,
    outcomeClassification,
    exitObserved: terminal.exitObserved,
    exitCodePresent: terminal.exitCodePresent,
    exitCode: terminal.exitCode,
    signalObserved: terminal.signalObserved,
    signal: terminal.signal,
    signalClassification: terminal.signalClassification,
    processStarted: lifecycle.observations.processStarted,
    processStartUnknown: lifecycle.observations.processStartUnknown,
    processTerminationConfirmed: lifecycle.observations.processTerminationConfirmed,
    timedOut: terminalState.startsWith('TIMED_OUT')
      || terminalState.startsWith('START_TIMED_OUT'),
    cancelled: terminalState.startsWith('CANCELLED'),
    forceKillRequested: lifecycle.observations.forceKillSignalRequested,
    forceKillSent: lifecycle.observations.forceKillSignalSent,
    runtimeResultCollected: true,
  };
  const result = freezeP3Value({ ...withoutDigest, resultDigest: sha256(withoutDigest) });
  validateK6SanitizedRuntimeOutcomeShape(result);
  return result;
}

export function validateK6SanitizedRuntimeOutcome(input, bindings) {
  validateK6SanitizedRuntimeOutcomeShape(input);
  exactFields(bindings, [
    'command', 'adapterDescriptor', 'lifecycleEvidence', 'terminalObservation',
  ], 'INVALID_K6_SANITIZED_RUNTIME_OUTCOME_BINDINGS', 'Runtime outcome bindings');
  const expected = createK6SanitizedRuntimeOutcome(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_SANITIZED_RUNTIME_OUTCOME_MISMATCH',
    'Runtime outcome does not match its immutable predecessors');
  return expected;
}

export function computeK6SanitizedRuntimeOutcomeDigest(input) {
  validateK6SanitizedRuntimeOutcomeShape(input, false);
  return digestWithout(input, 'resultDigest');
}

export function validateK6SanitizedRuntimeOutcomeShape(input, requireDigest = true) {
  exactFields(input, OUTCOME_FIELDS,
    'INVALID_K6_SANITIZED_RUNTIME_OUTCOME', 'Sanitized runtime outcome');
  validateDigest(input.commandDigest, 'runtimeOutcome.commandDigest');
  validateDigest(input.adapterDigest, 'runtimeOutcome.adapterDigest');
  validateDigest(input.lifecycleEvidenceDigest, 'runtimeOutcome.lifecycleEvidenceDigest');
  validateDigest(input.terminalObservationDigest,
    'runtimeOutcome.terminalObservationDigest');
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_SANITIZED_RUNTIME_OUTCOME_SCHEMA_VERSION
      && RUNTIME_RESULT_ID.test(input.resultId)
      && K6_RUNTIME_OUTCOME_CLASSIFICATIONS.includes(input.outcomeClassification)
      && typeof input.exitObserved === 'boolean'
      && typeof input.exitCodePresent === 'boolean'
      && (input.exitCode === null
        || (Number.isInteger(input.exitCode) && input.exitCode >= 0 && input.exitCode <= 255))
      && typeof input.signalObserved === 'boolean'
      && (input.signal === null || K6_SANITIZED_PROCESS_SIGNALS.includes(input.signal))
      && ['NONE', 'COOPERATIVE_TERMINATION', 'FORCED_TERMINATION',
        'EXTERNAL_TERMINATION'].includes(input.signalClassification)
      && typeof input.processStarted === 'boolean'
      && typeof input.processStartUnknown === 'boolean'
      && typeof input.processTerminationConfirmed === 'boolean'
      && typeof input.timedOut === 'boolean'
      && typeof input.cancelled === 'boolean'
      && typeof input.forceKillRequested === 'boolean'
      && typeof input.forceKillSent === 'boolean'
      && input.runtimeResultCollected === true
      && (!input.exitCodePresent || input.exitObserved)
      && (!input.signalObserved || input.exitObserved)
      && !(input.exitCodePresent && input.signalObserved)
      && input.resultId === `k6runtime-result-${sha256({
        commandDigest: input.commandDigest,
        lifecycleEvidenceDigest: input.lifecycleEvidenceDigest,
        terminalObservationDigest: input.terminalObservationDigest,
      }).slice(0, 20)}`,
    'K6_SANITIZED_RUNTIME_OUTCOME_INVALID',
    'Sanitized runtime outcome violates the closed contract');
  if (requireDigest) {
    validateDigest(input.resultDigest, 'runtimeOutcome.resultDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'resultDigest') === input.resultDigest,
      'K6_SANITIZED_RUNTIME_OUTCOME_DIGEST_MISMATCH',
      'Sanitized runtime outcome digest is invalid');
  }
  return input;
}

export function createK6RuntimeExecutionEvidence({
  bindings,
  command,
  adapterDescriptor,
  lifecycleEvidence,
  terminalObservation,
  runtimeOutcome,
}) {
  const acceptedCommand = validateK6ProcessExecutionCommand(command, bindings);
  const descriptor = validateK6NodeProcessAdapterDescriptor(adapterDescriptor);
  const lifecycle = validateK6ProcessLifecycleEvidence(lifecycleEvidence, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
  });
  const terminal = validateK6ProcessTerminalObservation(terminalObservation, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
    lifecycleEvidence: lifecycle,
  });
  const outcome = validateK6SanitizedRuntimeOutcome(runtimeOutcome, {
    command: acceptedCommand,
    adapterDescriptor: descriptor,
    lifecycleEvidence: lifecycle,
    terminalObservation: terminal,
  });
  const predecessor = {
    runtimePolicyDigest: bindings.policy.policyDigest,
    runtimeAdmissionRequestDigest: bindings.admissionRequest.admissionDigest,
    invocationPlanDigest: bindings.invocationPlan.planDigest,
    runtimeAdmissionEvidenceDigest: bindings.admissionEvidence.evidenceDigest,
    portDigest: bindings.portDescriptor.portDigest,
    launchSpecificationDigest: bindings.launchSpecification.specificationDigest,
    launchDecisionDigest: bindings.launchDecision.decisionDigest,
    boundaryEvidenceDigest: bindings.boundaryEvidence.evidenceDigest,
    adapterDigest: descriptor.adapterDigest,
    commandDigest: acceptedCommand.commandDigest,
    lifecycleEvidenceDigest: lifecycle.evidenceDigest,
  };
  const resultSources = {
    lifecycleEvidencePresent: true,
    terminalObservationPresent: true,
    sanitizedOutcomePresent: true,
    rawRuntimeOutputPresent: false,
    fileResultPresent: false,
    processOutcomeComplete: true,
    runtimeResultComplete: true,
  };
  const fileResultCollection = {
    supported: false,
    implemented: false,
    decision: K6_FILE_RESULT_COLLECTION_DECISION,
    blockerCode: K6_FILE_RESULT_COLLECTION_BLOCKER,
    sourceBundleRemainsImmutable: true,
    callerPathAccepted: false,
    arbitraryFileReadEnabled: false,
  };
  const decision = {
    allPredecessorsBound: true,
    runtimeResultCollected: true,
    rawRuntimeOutputCollected: false,
    fileResultCollectionSupported: false,
    fileResultCollectionImplemented: false,
    outcomeClassification: outcome.outcomeClassification,
    nextRequiredSlice: 'M3-R3-P4',
    repositoryBlockers: [],
  };
  const safetyBoundary = Object.fromEntries(SAFETY_FIELDS.map((field) => [field, false]));
  const withoutDigest = {
    schemaVersion: K6_RUNTIME_EXECUTION_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6runtime-execution-${outcome.resultDigest.slice(0, 20)}`,
    predecessor,
    terminalObservationDigest: terminal.observationDigest,
    outcomeDigest: outcome.resultDigest,
    resultSources,
    fileResultCollection,
    decision,
    safetyBoundary,
  };
  const evidence = freezeP3Value({
    ...withoutDigest,
    evidenceDigest: sha256(withoutDigest),
  });
  validateK6RuntimeExecutionEvidenceShape(evidence);
  return evidence;
}

export function validateK6RuntimeExecutionEvidence(input, bindings) {
  validateK6RuntimeExecutionEvidenceShape(input);
  const expected = createK6RuntimeExecutionEvidence(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_RUNTIME_EXECUTION_EVIDENCE_MISMATCH',
    'Runtime execution Evidence does not match its accepted predecessor chain');
  return expected;
}

export function computeK6RuntimeExecutionEvidenceDigest(input) {
  validateK6RuntimeExecutionEvidenceShape(input, false);
  return digestWithout(input, 'evidenceDigest');
}

export function validateK6RuntimeExecutionEvidenceShape(input, requireDigest = true) {
  exactFields(input, EVIDENCE_FIELDS,
    'INVALID_K6_RUNTIME_EXECUTION_EVIDENCE', 'Runtime execution Evidence');
  exactFields(input.predecessor, PREDECESSOR_FIELDS,
    'INVALID_K6_RUNTIME_EXECUTION_EVIDENCE', 'Runtime execution predecessors');
  exactFields(input.resultSources, RESULT_SOURCE_FIELDS,
    'INVALID_K6_RUNTIME_EXECUTION_EVIDENCE', 'Runtime result sources');
  exactFields(input.fileResultCollection, FILE_RESULT_FIELDS,
    'INVALID_K6_RUNTIME_EXECUTION_EVIDENCE', 'File result decision');
  exactFields(input.decision, DECISION_FIELDS,
    'INVALID_K6_RUNTIME_EXECUTION_EVIDENCE', 'Runtime execution decision');
  exactFields(input.safetyBoundary, SAFETY_FIELDS,
    'INVALID_K6_RUNTIME_EXECUTION_EVIDENCE', 'Runtime execution safety boundary');
  for (const [field, value] of Object.entries(input.predecessor)) {
    validateDigest(value, `runtimeExecution.predecessor.${field}`);
  }
  validateDigest(input.terminalObservationDigest,
    'runtimeExecution.terminalObservationDigest');
  validateDigest(input.outcomeDigest, 'runtimeExecution.outcomeDigest');
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_RUNTIME_EXECUTION_EVIDENCE_SCHEMA_VERSION
      && RUNTIME_EVIDENCE_ID.test(input.evidenceId)
      && input.evidenceId === `k6runtime-execution-${input.outcomeDigest.slice(0, 20)}`
      && Object.values(input.resultSources).every((value) => typeof value === 'boolean')
      && input.resultSources.lifecycleEvidencePresent === true
      && input.resultSources.terminalObservationPresent === true
      && input.resultSources.sanitizedOutcomePresent === true
      && input.resultSources.rawRuntimeOutputPresent === false
      && input.resultSources.fileResultPresent === false
      && input.resultSources.processOutcomeComplete === true
      && input.resultSources.runtimeResultComplete === true
      && input.fileResultCollection.supported === false
      && input.fileResultCollection.implemented === false
      && input.fileResultCollection.decision === K6_FILE_RESULT_COLLECTION_DECISION
      && input.fileResultCollection.blockerCode === K6_FILE_RESULT_COLLECTION_BLOCKER
      && input.fileResultCollection.sourceBundleRemainsImmutable === true
      && input.fileResultCollection.callerPathAccepted === false
      && input.fileResultCollection.arbitraryFileReadEnabled === false
      && input.decision.allPredecessorsBound === true
      && input.decision.runtimeResultCollected === true
      && input.decision.rawRuntimeOutputCollected === false
      && input.decision.fileResultCollectionSupported === false
      && input.decision.fileResultCollectionImplemented === false
      && K6_RUNTIME_OUTCOME_CLASSIFICATIONS.includes(input.decision.outcomeClassification)
      && input.decision.nextRequiredSlice === 'M3-R3-P4'
      && Array.isArray(input.decision.repositoryBlockers)
      && input.decision.repositoryBlockers.length === 0
      && Object.values(input.safetyBoundary).every((value) => value === false),
    'K6_RUNTIME_EXECUTION_EVIDENCE_ESCALATION',
    'Runtime execution Evidence widens the P3 safety boundary');
  if (requireDigest) {
    validateDigest(input.evidenceDigest, 'runtimeExecution.evidenceDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'evidenceDigest') === input.evidenceDigest,
      'K6_RUNTIME_EXECUTION_EVIDENCE_DIGEST_MISMATCH',
      'Runtime execution Evidence digest is invalid');
  }
  return input;
}

function normalizeExitMetadata({ exitObserved, exitCode, signal }) {
  runtimeAdmissionInvariant(typeof exitObserved === 'boolean',
    'K6_PROCESS_EXIT_OBSERVATION_INVALID', 'exitObserved must be boolean');
  if (!exitObserved) {
    runtimeAdmissionInvariant(exitCode === null && signal === null,
      'K6_PROCESS_EXIT_METADATA_UNEXPECTED',
      'Exit metadata is forbidden when no exit event was observed');
    return {
      exitObserved: false,
      exitCodePresent: false,
      exitCode: null,
      signalObserved: false,
      signal: null,
      signalClassification: 'NONE',
    };
  }
  const exitCodePresent = Number.isInteger(exitCode) && exitCode >= 0 && exitCode <= 255;
  const signalObserved = typeof signal === 'string'
    && K6_SANITIZED_PROCESS_SIGNALS.includes(signal);
  runtimeAdmissionInvariant(exitCodePresent !== signalObserved,
    'K6_PROCESS_EXIT_METADATA_INVALID',
    'An observed exit requires exactly one bounded exit code or allow-listed signal');
  runtimeAdmissionInvariant(exitCode === null || exitCodePresent,
    'K6_PROCESS_EXIT_CODE_INVALID', 'Exit code must be an integer from 0 through 255');
  runtimeAdmissionInvariant(signal === null || signalObserved,
    'K6_PROCESS_EXIT_SIGNAL_INVALID', 'Exit signal is not allow-listed');
  return {
    exitObserved: true,
    exitCodePresent,
    exitCode: exitCodePresent ? exitCode : null,
    signalObserved,
    signal: signalObserved ? signal : null,
    signalClassification: classifySignal(signalObserved ? signal : null),
  };
}

function classifySignal(signal) {
  if (signal === null) return 'NONE';
  if (signal === 'SIGINT' || signal === 'SIGTERM') return 'COOPERATIVE_TERMINATION';
  if (signal === 'SIGKILL') return 'FORCED_TERMINATION';
  return 'EXTERNAL_TERMINATION';
}

function classifyOutcome(lifecycle, terminal) {
  const state = lifecycle.terminalState;
  if (state === 'EXITED') {
    runtimeAdmissionInvariant(terminal.exitObserved,
      'K6_RUNTIME_OUTCOME_EXIT_MISSING',
      'EXITED lifecycle requires sanitized exit metadata');
    if (terminal.signalObserved) return 'FAILED_SIGNAL';
    return terminal.exitCode === 0 ? 'SUCCEEDED' : 'FAILED_EXIT_CODE';
  }
  if (state === 'START_FAILED') return 'START_FAILED';
  if (state === 'PROCESS_ERROR') return 'PROCESS_ERROR';
  if (state.startsWith('CANCELLED')) return 'CANCELLED';
  if (state.startsWith('TIMED_OUT') || state.startsWith('START_TIMED_OUT')) {
    return 'TIMED_OUT';
  }
  runtimeAdmissionInvariant(false, 'K6_RUNTIME_OUTCOME_UNCLASSIFIED',
    'Lifecycle terminal state has no sanitized outcome classification');
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

export function freezeP3Value(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeP3Value(child);
  return Object.freeze(value);
}
