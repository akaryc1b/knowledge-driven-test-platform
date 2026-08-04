import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson, validateDigest } from '@kdtp/execution-contract';
import {
  K6_API_RUNTIME_CANCELLATION_MODE,
  K6_API_RUNTIME_EXECUTABLE,
  K6_API_RUNTIME_LIMITS,
  K6_API_RUNTIME_SOURCE_RELATIVE_PATH,
  K6_API_RUNTIME_SUBCOMMAND,
  K6_API_RUNTIME_WORKING_DIRECTORY_MODE,
  K6_PROCESS_LOGICAL_WORKING_DIRECTORY,
} from './constants.js';
import { runtimeAdmissionInvariant } from './errors.js';
import {
  validateK6LocalProcessPortDescriptor,
  validateK6ProcessBoundaryEvidence,
  validateK6ProcessLaunchDecision,
  validateK6ProcessLaunchSpecification,
} from './local-process-boundary.js';

export const K6_NODE_PROCESS_ADAPTER_SCHEMA_VERSION = 'k6-node-process-adapter/v1';
export const K6_PROCESS_EXECUTION_COMMAND_SCHEMA_VERSION =
  'k6-process-execution-command/v1';
export const K6_PROCESS_LIFECYCLE_EVIDENCE_SCHEMA_VERSION =
  'k6-process-lifecycle-evidence/v1';
export const K6_NODE_PROCESS_ADAPTER_ID = 'k6-node-process-adapter';
export const K6_NODE_PROCESS_ADAPTER_VERSION = '1.0.0';
export const K6_PROCESS_STARTUP_ALLOWANCE_MS = 5_000;
export const K6_PROCESS_FORCE_SETTLE_MS = 1_000;
export const K6_PROCESS_FIXED_ENVIRONMENT_VALUES = Object.freeze({
  K6_LOG_FORMAT: 'json',
  K6_NO_COLOR: 'true',
});

const COMMAND_ID = /^k6process-command-[a-f0-9]{20}$/u;
const DESCRIPTOR_FIELDS = Object.freeze([
  'schemaVersion', 'adapterId', 'adapterVersion', 'implementationStatus',
  'processPrimitive', 'executable', 'shell', 'detached', 'windowsHide',
  'stdio', 'hostEnvironmentInherited', 'numericProcessIdExposed',
  'cancellation', 'adapterDigest',
]);
const STDIO_FIELDS = Object.freeze(['stdin', 'stdout', 'stderr']);
const CANCELLATION_FIELDS = Object.freeze([
  'mode', 'cooperativeSignal', 'forceKillSignal', 'forceSettleMs',
]);
const COMMAND_FIELDS = Object.freeze([
  'schemaVersion', 'commandId', 'adapterDigest', 'predecessor', 'source',
  'executable', 'argv', 'shell', 'workingDirectory', 'environment', 'stdio',
  'lifecycle', 'processStartAuthorized', 'commandDigest',
]);
const PREDECESSOR_FIELDS = Object.freeze([
  'runtimePolicyDigest', 'runtimeAdmissionRequestDigest', 'invocationPlanDigest',
  'runtimeAdmissionEvidenceDigest', 'portDigest', 'launchSpecificationDigest',
  'launchDecisionDigest', 'boundaryEvidenceDigest',
]);
const SOURCE_FIELDS = Object.freeze(['bundleDigest', 'logicalUri']);
const WORKING_DIRECTORY_FIELDS = Object.freeze([
  'mode', 'logicalName', 'absolutePathIncluded',
]);
const ENVIRONMENT_FIELDS = Object.freeze([
  'allowedNames', 'valuesIncluded', 'inheritHostEnvironment', 'fixedValuesDigest',
]);
const LIFECYCLE_FIELDS = Object.freeze([
  'startupTimeoutMs', 'timeoutMs', 'cooperativeGraceMs', 'forceSettleMs',
  'cancellationMode', 'cooperativeSignal', 'forceKillSignal',
]);

export function createK6NodeProcessAdapterDescriptor() {
  const withoutDigest = {
    schemaVersion: K6_NODE_PROCESS_ADAPTER_SCHEMA_VERSION,
    adapterId: K6_NODE_PROCESS_ADAPTER_ID,
    adapterVersion: K6_NODE_PROCESS_ADAPTER_VERSION,
    implementationStatus: 'IMPLEMENTED',
    processPrimitive: 'node:child_process.spawn',
    executable: K6_API_RUNTIME_EXECUTABLE,
    shell: false,
    detached: false,
    windowsHide: true,
    stdio: { stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' },
    hostEnvironmentInherited: false,
    numericProcessIdExposed: false,
    cancellation: {
      mode: K6_API_RUNTIME_CANCELLATION_MODE,
      cooperativeSignal: 'SIGINT',
      forceKillSignal: 'SIGKILL',
      forceSettleMs: K6_PROCESS_FORCE_SETTLE_MS,
    },
  };
  return freezeWithDigest(withoutDigest, 'adapterDigest');
}

export function validateK6NodeProcessAdapterDescriptor(input) {
  validateDescriptorSelfConsistency(input);
  const expected = createK6NodeProcessAdapterDescriptor();
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_NODE_PROCESS_ADAPTER_MISMATCH',
    'Node process adapter does not match the fixed P2 contract');
  return expected;
}

export function computeK6NodeProcessAdapterDigest(input) {
  validateDescriptorSelfConsistency(input, false);
  return digestWithout(input, 'adapterDigest');
}

export function createK6ProcessExecutionCommand(bindings) {
  const accepted = validateAcceptedP1Bindings(bindings);
  const allowedNames = [...accepted.launchSpecification.environment.allowedNames];
  const fixedValues = fixedEnvironmentValues(allowedNames);
  const timeoutMs = accepted.admissionRequest.resources.durationMs
    + accepted.admissionRequest.resources.gracefulStopMs
    + K6_PROCESS_STARTUP_ALLOWANCE_MS;
  const predecessor = {
    runtimePolicyDigest: accepted.policy.policyDigest,
    runtimeAdmissionRequestDigest: accepted.admissionRequest.admissionDigest,
    invocationPlanDigest: accepted.invocationPlan.planDigest,
    runtimeAdmissionEvidenceDigest: accepted.admissionEvidence.evidenceDigest,
    portDigest: accepted.portDescriptor.portDigest,
    launchSpecificationDigest: accepted.launchSpecification.specificationDigest,
    launchDecisionDigest: accepted.launchDecision.decisionDigest,
    boundaryEvidenceDigest: accepted.boundaryEvidence.evidenceDigest,
  };
  const identity = {
    adapterDigest: accepted.adapterDescriptor.adapterDigest,
    predecessor,
    sourceBundleDigest: accepted.admissionRequest.source.bundleDigest,
  };
  const withoutDigest = {
    schemaVersion: K6_PROCESS_EXECUTION_COMMAND_SCHEMA_VERSION,
    commandId: `k6process-command-${sha256(identity).slice(0, 20)}`,
    adapterDigest: accepted.adapterDescriptor.adapterDigest,
    predecessor,
    source: {
      bundleDigest: accepted.admissionRequest.source.bundleDigest,
      logicalUri: accepted.admissionRequest.source.logicalUri,
    },
    executable: K6_API_RUNTIME_EXECUTABLE,
    argv: [...accepted.launchSpecification.argv],
    shell: false,
    workingDirectory: cloneExecutionJson(accepted.launchSpecification.workingDirectory),
    environment: {
      allowedNames,
      valuesIncluded: false,
      inheritHostEnvironment: false,
      fixedValuesDigest: sha256(fixedValues),
    },
    stdio: cloneExecutionJson(accepted.adapterDescriptor.stdio),
    lifecycle: {
      startupTimeoutMs: K6_PROCESS_STARTUP_ALLOWANCE_MS,
      timeoutMs,
      cooperativeGraceMs: accepted.admissionRequest.resources.gracefulStopMs,
      forceSettleMs: K6_PROCESS_FORCE_SETTLE_MS,
      cancellationMode: K6_API_RUNTIME_CANCELLATION_MODE,
      cooperativeSignal: accepted.adapterDescriptor.cancellation.cooperativeSignal,
      forceKillSignal: accepted.adapterDescriptor.cancellation.forceKillSignal,
    },
    processStartAuthorized: true,
  };
  const command = freezeWithDigest(withoutDigest, 'commandDigest');
  validateCommandSelfConsistency(command);
  return command;
}

export function validateK6ProcessExecutionCommand(input, bindings) {
  validateCommandSelfConsistency(input);
  const expected = createK6ProcessExecutionCommand(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_PROCESS_EXECUTION_COMMAND_MISMATCH',
    'Process execution command does not match the accepted P1 chain');
  return expected;
}

export function validateK6ProcessExecutionCommandShape(input) {
  validateCommandSelfConsistency(input);
  return freezeP2Value(cloneExecutionJson(input));
}

export function computeK6ProcessExecutionCommandDigest(input) {
  validateCommandSelfConsistency(input, false);
  return digestWithout(input, 'commandDigest');
}

export function fixedEnvironmentValuesForAdapter(names) {
  return freezeP2Value(fixedEnvironmentValues(names));
}

function validateAcceptedP1Bindings(bindings) {
  exactFields(bindings, [
    'adapterDescriptor', 'policy', 'admissionRequest', 'invocationPlan',
    'admissionEvidence', 'portDescriptor', 'launchSpecification',
    'launchDecision', 'boundaryEvidence',
  ], 'INVALID_K6_PROCESS_EXECUTION_BINDINGS', 'Process execution bindings');
  const adapterDescriptor = validateK6NodeProcessAdapterDescriptor(
    bindings.adapterDescriptor);
  const runtimeBindings = {
    policy: bindings.policy,
    admissionRequest: bindings.admissionRequest,
    invocationPlan: bindings.invocationPlan,
    admissionEvidence: bindings.admissionEvidence,
  };
  const portDescriptor = validateK6LocalProcessPortDescriptor(bindings.portDescriptor);
  const launchSpecification = validateK6ProcessLaunchSpecification(
    bindings.launchSpecification, runtimeBindings);
  const launchDecision = validateK6ProcessLaunchDecision(bindings.launchDecision, {
    portDescriptor,
    launchSpecification,
    portReceipt: bindings.launchDecision.portReceipt,
  });
  const boundaryEvidence = validateK6ProcessBoundaryEvidence(bindings.boundaryEvidence, {
    ...runtimeBindings,
    portDescriptor,
    launchSpecification,
    launchDecision,
  });
  runtimeAdmissionInvariant(boundaryEvidence.decision.nodeProcessAdapterImplemented === false
      && boundaryEvidence.decision.processStarted === false
      && boundaryEvidence.decision.k6Invoked === false
      && boundaryEvidence.decision.externalProcessExecuted === false
      && boundaryEvidence.decision.nextRequiredSlice === 'M3-R3-P2',
  'K6_PROCESS_P1_PREDECESSOR_NOT_ACCEPTED',
  'P2 requires the accepted non-executing P1 boundary');
  return freezeP2Value({
    adapterDescriptor,
    policy: cloneExecutionJson(bindings.policy),
    admissionRequest: cloneExecutionJson(bindings.admissionRequest),
    invocationPlan: cloneExecutionJson(bindings.invocationPlan),
    admissionEvidence: cloneExecutionJson(bindings.admissionEvidence),
    portDescriptor,
    launchSpecification,
    launchDecision,
    boundaryEvidence,
  });
}

function validateDescriptorSelfConsistency(input, requireDigest = true) {
  exactFields(input, DESCRIPTOR_FIELDS,
    'INVALID_K6_NODE_PROCESS_ADAPTER', 'Node process adapter descriptor');
  exactFields(input.stdio, STDIO_FIELDS,
    'INVALID_K6_NODE_PROCESS_ADAPTER', 'Node process adapter stdio');
  exactFields(input.cancellation, CANCELLATION_FIELDS,
    'INVALID_K6_NODE_PROCESS_ADAPTER', 'Node process adapter cancellation');
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_NODE_PROCESS_ADAPTER_SCHEMA_VERSION
      && input.adapterId === K6_NODE_PROCESS_ADAPTER_ID
      && input.adapterVersion === K6_NODE_PROCESS_ADAPTER_VERSION
      && input.implementationStatus === 'IMPLEMENTED'
      && input.processPrimitive === 'node:child_process.spawn'
      && input.executable === K6_API_RUNTIME_EXECUTABLE
      && input.shell === false
      && input.detached === false
      && input.windowsHide === true
      && canonicalStringify(input.stdio)
        === canonicalStringify({ stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
      && input.hostEnvironmentInherited === false
      && input.numericProcessIdExposed === false
      && input.cancellation.mode === K6_API_RUNTIME_CANCELLATION_MODE
      && input.cancellation.cooperativeSignal === 'SIGINT'
      && input.cancellation.forceKillSignal === 'SIGKILL'
      && input.cancellation.forceSettleMs === K6_PROCESS_FORCE_SETTLE_MS,
    'K6_NODE_PROCESS_ADAPTER_ESCALATION',
    'Node process adapter widens the fixed P2 boundary');
  if (requireDigest) {
    validateDigest(input.adapterDigest, 'nodeProcessAdapter.adapterDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'adapterDigest') === input.adapterDigest,
      'K6_NODE_PROCESS_ADAPTER_DIGEST_MISMATCH',
      'Node process adapter digest is invalid');
  }
  return input;
}

function validateCommandSelfConsistency(input, requireDigest = true) {
  exactFields(input, COMMAND_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution command');
  exactFields(input.predecessor, PREDECESSOR_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution predecessor');
  exactFields(input.source, SOURCE_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution source');
  exactFields(input.workingDirectory, WORKING_DIRECTORY_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution working directory');
  exactFields(input.environment, ENVIRONMENT_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution environment');
  exactFields(input.stdio, STDIO_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution stdio');
  exactFields(input.lifecycle, LIFECYCLE_FIELDS,
    'INVALID_K6_PROCESS_EXECUTION_COMMAND', 'Process execution lifecycle');
  validateDigest(input.adapterDigest, 'processExecution.adapterDigest');
  for (const field of Object.keys(input.predecessor)) {
    validateDigest(input.predecessor[field], `processExecution.predecessor.${field}`);
  }
  validateDigest(input.source.bundleDigest, 'processExecution.source.bundleDigest');
  validateDigest(input.environment.fixedValuesDigest,
    'processExecution.environment.fixedValuesDigest');
  const parsedArgv = validateFixedInvocationArgv(input.argv);
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_PROCESS_EXECUTION_COMMAND_SCHEMA_VERSION
      && COMMAND_ID.test(input.commandId)
      && input.commandId === `k6process-command-${sha256({
        adapterDigest: input.adapterDigest,
        predecessor: input.predecessor,
        sourceBundleDigest: input.source.bundleDigest,
      }).slice(0, 20)}`
      && input.source.logicalUri
        === `kdtp-source-bundle://sha256/${input.source.bundleDigest}`
      && input.executable === K6_API_RUNTIME_EXECUTABLE
      && input.shell === false
      && input.workingDirectory.mode === K6_API_RUNTIME_WORKING_DIRECTORY_MODE
      && input.workingDirectory.logicalName === K6_PROCESS_LOGICAL_WORKING_DIRECTORY
      && input.workingDirectory.absolutePathIncluded === false
      && input.environment.valuesIncluded === false
      && input.environment.inheritHostEnvironment === false
      && canonicalStringify(input.stdio)
        === canonicalStringify({ stdin: 'ignore', stdout: 'ignore', stderr: 'ignore' })
      && input.lifecycle.startupTimeoutMs === K6_PROCESS_STARTUP_ALLOWANCE_MS
      && input.lifecycle.timeoutMs
        === parsedArgv.durationMs + parsedArgv.gracefulStopMs
          + K6_PROCESS_STARTUP_ALLOWANCE_MS
      && input.lifecycle.cooperativeGraceMs === parsedArgv.gracefulStopMs
      && input.lifecycle.cancellationMode === K6_API_RUNTIME_CANCELLATION_MODE
      && input.lifecycle.cooperativeSignal === 'SIGINT'
      && input.lifecycle.forceKillSignal === 'SIGKILL'
      && input.lifecycle.forceSettleMs === K6_PROCESS_FORCE_SETTLE_MS
      && input.processStartAuthorized === true,
    'K6_PROCESS_EXECUTION_COMMAND_ESCALATION',
    'Process execution command widens the bounded P2 lifecycle');
  const names = [...input.environment.allowedNames];
  runtimeAdmissionInvariant(canonicalStringify(names)
      === canonicalStringify([...names].sort())
      && new Set(names).size === names.length,
  'K6_PROCESS_ENVIRONMENT_INVALID',
  'Process environment names must be sorted and unique');
  const fixedValues = fixedEnvironmentValues(names);
  runtimeAdmissionInvariant(sha256(fixedValues) === input.environment.fixedValuesDigest,
    'K6_PROCESS_ENVIRONMENT_DIGEST_MISMATCH',
    'Process environment values digest does not match the adapter-owned values');
  if (requireDigest) {
    validateDigest(input.commandDigest, 'processExecution.commandDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'commandDigest') === input.commandDigest,
      'K6_PROCESS_EXECUTION_COMMAND_DIGEST_MISMATCH',
      'Process execution command digest is invalid');
  }
  return input;
}

function fixedEnvironmentValues(names) {
  runtimeAdmissionInvariant(Array.isArray(names),
    'K6_PROCESS_ENVIRONMENT_INVALID', 'Process environment names must be an array');
  const result = {};
  for (const name of names) {
    runtimeAdmissionInvariant(Object.hasOwn(K6_PROCESS_FIXED_ENVIRONMENT_VALUES, name),
      'K6_PROCESS_ENVIRONMENT_ESCALATION',
      'Process environment name is not adapter-owned');
    result[name] = K6_PROCESS_FIXED_ENVIRONMENT_VALUES[name];
  }
  return result;
}

function validateFixedInvocationArgv(argv) {
  validateArgv(argv);
  const hasSummary = argv.length === 12;
  runtimeAdmissionInvariant((argv.length === 10 || hasSummary)
      && argv[0] === K6_API_RUNTIME_SUBCOMMAND
      && argv[1] === '--vus'
      && argv[3] === '--iterations'
      && argv[5] === '--duration'
      && argv[7] === '--graceful-stop'
      && (!hasSummary || (argv[9] === '--summary-export'
        && argv[10] === 'outputs/summary.json'))
      && argv.at(-1) === K6_API_RUNTIME_SOURCE_RELATIVE_PATH,
    'K6_PROCESS_ARGV_STRUCTURE_INVALID',
    'Process execution argv does not match the fixed k6 invocation structure');
  parseCanonicalInteger(argv[2], 'vus', 1, K6_API_RUNTIME_LIMITS.maxVus);
  parseCanonicalInteger(
    argv[4], 'iterations', 1, K6_API_RUNTIME_LIMITS.maxIterations);
  const durationSeconds = parseCanonicalSeconds(
    argv[6], 'duration', 1, K6_API_RUNTIME_LIMITS.maxDurationMs / 1000);
  const gracefulStopSeconds = parseCanonicalSeconds(
    argv[8], 'graceful stop', 0, K6_API_RUNTIME_LIMITS.maxGracefulStopMs / 1000);
  return {
    durationMs: durationSeconds * 1000,
    gracefulStopMs: gracefulStopSeconds * 1000,
  };
}

function parseCanonicalInteger(value, label, minimum, maximum) {
  runtimeAdmissionInvariant(typeof value === 'string' && /^(?:0|[1-9][0-9]*)$/u.test(value),
    'K6_PROCESS_ARGV_VALUE_INVALID',
    `Process execution ${label} must be a canonical integer`);
  const parsed = Number(value);
  runtimeAdmissionInvariant(Number.isSafeInteger(parsed)
      && parsed >= minimum && parsed <= maximum,
    'K6_PROCESS_ARGV_VALUE_INVALID',
    `Process execution ${label} exceeds the fixed Runtime Policy`);
  return parsed;
}

function parseCanonicalSeconds(value, label, minimum, maximum) {
  runtimeAdmissionInvariant(typeof value === 'string'
      && /^(?:0|[1-9][0-9]*)s$/u.test(value),
    'K6_PROCESS_ARGV_VALUE_INVALID',
    `Process execution ${label} must be canonical whole seconds`);
  return parseCanonicalInteger(value.slice(0, -1), label, minimum, maximum);
}

function validateArgv(argv) {
  runtimeAdmissionInvariant(Array.isArray(argv) && argv.length >= 2
      && argv.every((item) => typeof item === 'string' && item.length > 0)
      && !argv.some((item) => /[;&|`$<>\n\r\0]/u.test(item)),
  'K6_PROCESS_ARGV_UNSAFE',
  'Process execution argv must remain a fixed shell-free string array');
}

function digestWithout(input, field) {
  const copy = cloneExecutionJson(input);
  delete copy[field];
  return sha256(copy);
}

function freezeWithDigest(withoutDigest, digestField) {
  return freezeP2Value(cloneExecutionJson({
    ...withoutDigest,
    [digestField]: sha256(withoutDigest),
  }));
}

function exactFields(value, fields, code, label) {
  runtimeAdmissionInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  runtimeAdmissionInvariant(
    canonicalStringify(Object.keys(value).sort()) === canonicalStringify([...fields].sort()),
    code, `${label} fields do not match the closed contract`);
}

export function freezeP2Value(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeP2Value(child);
  return Object.freeze(value);
}
