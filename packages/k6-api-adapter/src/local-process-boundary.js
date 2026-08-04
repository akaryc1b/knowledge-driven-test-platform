import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  cloneExecutionJson,
  validateDigest,
} from '@kdtp/execution-contract';
import {
  K6_API_INVOCATION_PLAN_SCHEMA_VERSION,
  K6_API_RUNTIME_ADMISSION_EVIDENCE_SCHEMA_VERSION,
  K6_API_RUNTIME_ADMISSION_REQUEST_SCHEMA_VERSION,
  K6_API_RUNTIME_EXECUTABLE,
  K6_API_RUNTIME_WORKING_DIRECTORY_MODE,
  K6_LOCAL_PROCESS_PORT_ID,
  K6_LOCAL_PROCESS_PORT_SCHEMA_VERSION,
  K6_LOCAL_PROCESS_PORT_VERSION,
  K6_PROCESS_BOUNDARY_EVIDENCE_SCHEMA_VERSION,
  K6_PROCESS_CAPTURE_MAX_BYTES,
  K6_PROCESS_LAUNCH_DECISION_SCHEMA_VERSION,
  K6_PROCESS_LAUNCH_SPECIFICATION_SCHEMA_VERSION,
  K6_PROCESS_LOGICAL_WORKING_DIRECTORY,
} from './constants.js';
import { runtimeAdmissionInvariant } from './errors.js';
import {
  computeK6ApiRuntimeAdmissionRequestDigest,
  validateK6ApiInvocationPlan,
  validateK6ApiRuntimeAdmissionEvidence,
  validateK6ApiRuntimePolicy,
} from './runtime-admission.js';

const DIGEST = /^[a-f0-9]{64}$/u;
const LAUNCH_ID = /^k6launch-[a-f0-9]{20}$/u;
const DECISION_ID = /^k6launch-decision-[a-f0-9]{20}$/u;
const EVIDENCE_ID = /^k6process-boundary-[a-f0-9]{20}$/u;
const RECEIPT_SCHEMA_VERSION = 'k6-local-process-port-receipt/v1';

const PORT_FIELDS = Object.freeze([
  'schemaVersion', 'portId', 'portVersion', 'implementationStatus',
  'capabilities', 'portDigest',
]);
const PORT_CAPABILITY_FIELDS = Object.freeze([
  'acceptLaunchSpecification', 'startProcess', 'createProcessId', 'shell',
]);
const SPECIFICATION_FIELDS = Object.freeze([
  'schemaVersion', 'launchId', 'runtimePolicyDigest',
  'runtimeAdmissionRequestDigest', 'invocationPlanDigest',
  'runtimeAdmissionEvidenceDigest', 'executable', 'argv', 'shell',
  'workingDirectory', 'environment', 'stdin', 'stdout', 'stderr',
  'processStartAuthorized', 'specificationDigest',
]);
const WORKING_DIRECTORY_FIELDS = Object.freeze([
  'mode', 'logicalName', 'absolutePathIncluded',
]);
const ENVIRONMENT_FIELDS = Object.freeze([
  'allowedNames', 'valuesIncluded', 'inheritHostEnvironment',
]);
const INPUT_FIELDS = Object.freeze(['mode', 'contentIncluded']);
const CAPTURE_FIELDS = Object.freeze(['mode', 'maxBytes', 'collected']);
const RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'portId', 'portDigest', 'launchSpecificationDigest',
  'accepted', 'delegated', 'processStarted', 'processIdCreated',
  'k6Invoked', 'externalProcessExecuted',
]);
const DECISION_FIELDS = Object.freeze([
  'schemaVersion', 'decisionId', 'portDigest', 'launchSpecificationDigest',
  'portReceipt', 'decision', 'safetyBoundary', 'decisionDigest',
]);
const BOUNDARY_EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'runtimePolicyDigest',
  'runtimeAdmissionRequestDigest', 'invocationPlanDigest',
  'runtimeAdmissionEvidenceDigest', 'portDigest',
  'launchSpecificationDigest', 'launchDecisionDigest', 'decision',
  'safetyBoundary', 'evidenceDigest',
]);

export const K6_PROCESS_BOUNDARY_DECISION = deepFreeze({
  localProcessPortContractReady: true,
  launchSpecificationReady: true,
  launchAdapterBoundaryReady: true,
  nodeProcessAdapterImplemented: false,
  processStarted: false,
  processIdCreated: false,
  k6Invoked: false,
  externalProcessExecuted: false,
  nextRequiredSlice: 'M3-R3-P2',
  repositoryBlockers: [],
});

export const K6_PROCESS_BOUNDARY_SAFETY = deepFreeze({
  sourceExecuted: false,
  executionRuntimeStarted: false,
  nodeProcessAdapterImplemented: false,
  processStarted: false,
  processIdCreated: false,
  k6Invoked: false,
  xk6Invoked: false,
  playwrightInvoked: false,
  externalProcessExecuted: false,
  shellUsed: false,
  nodeVmUsed: false,
  evalUsed: false,
  dynamicImportUsed: false,
  targetNetworkAccessed: false,
  databaseAccessed: false,
  secretAccessed: false,
  filesystemCredentialAccessed: false,
  temporaryExecutionDirectoryCreated: false,
  runtimeResultCollected: false,
  allureImplemented: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  containerStarted: false,
  kubernetesResourceCreated: false,
  remoteExecutionApiAdded: false,
});

export function createK6LocalProcessPortDescriptor() {
  const withoutDigest = {
    schemaVersion: K6_LOCAL_PROCESS_PORT_SCHEMA_VERSION,
    portId: K6_LOCAL_PROCESS_PORT_ID,
    portVersion: K6_LOCAL_PROCESS_PORT_VERSION,
    implementationStatus: 'INJECTED_NON_EXECUTING',
    capabilities: {
      acceptLaunchSpecification: true,
      startProcess: false,
      createProcessId: false,
      shell: false,
    },
  };
  return freezeWithDigest(withoutDigest, 'portDigest');
}

export function validateK6LocalProcessPortDescriptor(input) {
  exactFields(input, PORT_FIELDS, 'INVALID_K6_LOCAL_PROCESS_PORT', 'Local process port');
  exactFields(input.capabilities, PORT_CAPABILITY_FIELDS,
    'INVALID_K6_LOCAL_PROCESS_PORT', 'Local process port capabilities');
  const expected = createK6LocalProcessPortDescriptor();
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_LOCAL_PROCESS_PORT_MISMATCH',
    'Local process port does not match the fixed injected non-executing contract');
  return expected;
}

export function computeK6LocalProcessPortDigest(input) {
  validateDigestShape(input, PORT_FIELDS, 'portDigest', 'Local process port');
  return digestWithout(input, 'portDigest');
}

export function createK6ProcessLaunchSpecification(bindings) {
  const normalized = validateAcceptedRuntimeBindings(bindings);
  const plan = normalized.invocationPlan;
  const withoutDigest = {
    schemaVersion: K6_PROCESS_LAUNCH_SPECIFICATION_SCHEMA_VERSION,
    launchId: `k6launch-${sha256({
      runtimePolicyDigest: normalized.policy.policyDigest,
      runtimeAdmissionRequestDigest: normalized.admissionRequest.admissionDigest,
      invocationPlanDigest: plan.planDigest,
      runtimeAdmissionEvidenceDigest: normalized.admissionEvidence.evidenceDigest,
    }).slice(0, 20)}`,
    runtimePolicyDigest: normalized.policy.policyDigest,
    runtimeAdmissionRequestDigest: normalized.admissionRequest.admissionDigest,
    invocationPlanDigest: plan.planDigest,
    runtimeAdmissionEvidenceDigest: normalized.admissionEvidence.evidenceDigest,
    executable: K6_API_RUNTIME_EXECUTABLE,
    argv: [...plan.argv],
    shell: false,
    workingDirectory: {
      mode: K6_API_RUNTIME_WORKING_DIRECTORY_MODE,
      logicalName: K6_PROCESS_LOGICAL_WORKING_DIRECTORY,
      absolutePathIncluded: false,
    },
    environment: {
      allowedNames: [...plan.environmentVariableNames],
      valuesIncluded: false,
      inheritHostEnvironment: false,
    },
    stdin: { mode: 'DISABLED', contentIncluded: false },
    stdout: {
      mode: 'BOUNDED_DECLARATION_ONLY',
      maxBytes: K6_PROCESS_CAPTURE_MAX_BYTES,
      collected: false,
    },
    stderr: {
      mode: 'BOUNDED_DECLARATION_ONLY',
      maxBytes: K6_PROCESS_CAPTURE_MAX_BYTES,
      collected: false,
    },
    processStartAuthorized: false,
  };
  const specification = freezeWithDigest(withoutDigest, 'specificationDigest');
  validateSpecificationSelfConsistency(specification);
  return specification;
}

export function validateK6ProcessLaunchSpecification(input, bindings) {
  validateSpecificationSelfConsistency(input);
  const expected = createK6ProcessLaunchSpecification(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_PROCESS_LAUNCH_SPECIFICATION_MISMATCH',
    'Process launch specification does not match the accepted runtime chain');
  return expected;
}

export function computeK6ProcessLaunchSpecificationDigest(input) {
  validateSpecificationSelfConsistency(input, false);
  return digestWithout(input, 'specificationDigest');
}

export function createK6LocalProcessPortReceipt(portDescriptor, launchSpecification) {
  const port = validateK6LocalProcessPortDescriptor(portDescriptor);
  validateSpecificationSelfConsistency(launchSpecification);
  return deepFreeze({
    schemaVersion: RECEIPT_SCHEMA_VERSION,
    portId: port.portId,
    portDigest: port.portDigest,
    launchSpecificationDigest: launchSpecification.specificationDigest,
    accepted: true,
    delegated: true,
    processStarted: false,
    processIdCreated: false,
    k6Invoked: false,
    externalProcessExecuted: false,
  });
}

export function prepareK6LocalProcessLaunch({
  localProcessPort,
  policy,
  admissionRequest,
  invocationPlan,
  admissionEvidence,
}) {
  runtimeAdmissionInvariant(localProcessPort && typeof localProcessPort === 'object',
    'K6_LOCAL_PROCESS_PORT_UNAVAILABLE', 'An injected LocalProcessPort is required');
  runtimeAdmissionInvariant(typeof localProcessPort.acceptLaunchSpecification === 'function',
    'K6_LOCAL_PROCESS_PORT_UNAVAILABLE',
    'The injected LocalProcessPort must accept a launch specification');
  const portDescriptor = validateK6LocalProcessPortDescriptor(localProcessPort.descriptor);
  const bindings = { policy, admissionRequest, invocationPlan, admissionEvidence };
  const launchSpecification = createK6ProcessLaunchSpecification(bindings);
  let portReceipt;
  try {
    portReceipt = localProcessPort.acceptLaunchSpecification(
      deepFreeze(cloneExecutionJson(launchSpecification)));
  } catch (error) {
    throw new ErrorWithCause(
      'K6_LOCAL_PROCESS_PORT_REJECTED',
      'The injected LocalProcessPort rejected the launch specification',
      error,
    );
  }
  validatePortReceipt(portReceipt, portDescriptor, launchSpecification);
  const launchDecision = createK6ProcessLaunchDecision({
    portDescriptor,
    launchSpecification,
    portReceipt,
  });
  const boundaryEvidence = createK6ProcessBoundaryEvidence({
    ...bindings,
    portDescriptor,
    launchSpecification,
    launchDecision,
  });
  return deepFreeze(cloneExecutionJson({
    launchSpecification,
    launchDecision,
    boundaryEvidence,
  }));
}

export function createK6ProcessLaunchDecision({
  portDescriptor,
  launchSpecification,
  portReceipt,
}) {
  const port = validateK6LocalProcessPortDescriptor(portDescriptor);
  validateSpecificationSelfConsistency(launchSpecification);
  const receipt = validatePortReceipt(portReceipt, port, launchSpecification);
  const withoutDigest = {
    schemaVersion: K6_PROCESS_LAUNCH_DECISION_SCHEMA_VERSION,
    decisionId: `k6launch-decision-${launchSpecification.specificationDigest.slice(0, 20)}`,
    portDigest: port.portDigest,
    launchSpecificationDigest: launchSpecification.specificationDigest,
    portReceipt: cloneExecutionJson(receipt),
    decision: cloneExecutionJson(K6_PROCESS_BOUNDARY_DECISION),
    safetyBoundary: cloneExecutionJson(K6_PROCESS_BOUNDARY_SAFETY),
  };
  return freezeWithDigest(withoutDigest, 'decisionDigest');
}

export function validateK6ProcessLaunchDecision(input, bindings) {
  validateDecisionSelfConsistency(input);
  const expected = createK6ProcessLaunchDecision(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_PROCESS_LAUNCH_DECISION_MISMATCH',
    'Process launch decision does not match the injected port receipt');
  return expected;
}

export function computeK6ProcessLaunchDecisionDigest(input) {
  validateDecisionSelfConsistency(input, false);
  return digestWithout(input, 'decisionDigest');
}

export function createK6ProcessBoundaryEvidence({
  policy,
  admissionRequest,
  invocationPlan,
  admissionEvidence,
  portDescriptor,
  launchSpecification,
  launchDecision,
}) {
  const runtime = validateAcceptedRuntimeBindings({
    policy, admissionRequest, invocationPlan, admissionEvidence,
  });
  const port = validateK6LocalProcessPortDescriptor(portDescriptor);
  const specification = validateK6ProcessLaunchSpecification(launchSpecification, runtime);
  const decision = validateK6ProcessLaunchDecision(launchDecision, {
    portDescriptor: port,
    launchSpecification: specification,
    portReceipt: launchDecision.portReceipt,
  });
  const withoutDigest = {
    schemaVersion: K6_PROCESS_BOUNDARY_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6process-boundary-${decision.decisionDigest.slice(0, 20)}`,
    runtimePolicyDigest: runtime.policy.policyDigest,
    runtimeAdmissionRequestDigest: runtime.admissionRequest.admissionDigest,
    invocationPlanDigest: runtime.invocationPlan.planDigest,
    runtimeAdmissionEvidenceDigest: runtime.admissionEvidence.evidenceDigest,
    portDigest: port.portDigest,
    launchSpecificationDigest: specification.specificationDigest,
    launchDecisionDigest: decision.decisionDigest,
    decision: cloneExecutionJson(K6_PROCESS_BOUNDARY_DECISION),
    safetyBoundary: cloneExecutionJson(K6_PROCESS_BOUNDARY_SAFETY),
  };
  return freezeWithDigest(withoutDigest, 'evidenceDigest');
}

export function validateK6ProcessBoundaryEvidence(input, bindings) {
  validateBoundaryEvidenceSelfConsistency(input);
  const expected = createK6ProcessBoundaryEvidence(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_PROCESS_BOUNDARY_EVIDENCE_MISMATCH',
    'Process boundary Evidence does not match the accepted runtime and port chain');
  return expected;
}

export function computeK6ProcessBoundaryEvidenceDigest(input) {
  validateBoundaryEvidenceSelfConsistency(input, false);
  return digestWithout(input, 'evidenceDigest');
}

function validateAcceptedRuntimeBindings(bindings) {
  exactFields(bindings, [
    'policy', 'admissionRequest', 'invocationPlan', 'admissionEvidence',
  ], 'INVALID_K6_PROCESS_RUNTIME_BINDINGS', 'Process runtime bindings');
  const policy = validateK6ApiRuntimePolicy(bindings.policy);
  const admissionRequest = cloneExecutionJson(bindings.admissionRequest);
  runtimeAdmissionInvariant(
    admissionRequest.schemaVersion === K6_API_RUNTIME_ADMISSION_REQUEST_SCHEMA_VERSION
      && computeK6ApiRuntimeAdmissionRequestDigest(admissionRequest)
        === admissionRequest.admissionDigest
      && admissionRequest.runtimePolicyDigest === policy.policyDigest,
    'K6_PROCESS_ADMISSION_BINDING_MISMATCH',
    'Process boundary admission request is not bound to the fixed runtime policy');
  const invocationPlan = validateK6ApiInvocationPlan(
    bindings.invocationPlan, admissionRequest, policy);
  const admissionEvidence = validateK6ApiRuntimeAdmissionEvidence(
    bindings.admissionEvidence, { admissionRequest, invocationPlan });
  runtimeAdmissionInvariant(
    invocationPlan.schemaVersion === K6_API_INVOCATION_PLAN_SCHEMA_VERSION
      && admissionEvidence.schemaVersion === K6_API_RUNTIME_ADMISSION_EVIDENCE_SCHEMA_VERSION
      && invocationPlan.executionAuthorized === false
      && admissionEvidence.decision.externalProcessExecuted === false
      && Object.values(admissionEvidence.safetyBoundary).every((value) => value === false),
    'K6_PROCESS_PREDECESSOR_NOT_ACCEPTED',
    'Process boundary requires an accepted non-executing Runtime Admission chain');
  return deepFreeze({ policy, admissionRequest, invocationPlan, admissionEvidence });
}

function validateSpecificationSelfConsistency(input, requireDigest = true) {
  exactFields(input, SPECIFICATION_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_SPECIFICATION', 'Process launch specification');
  exactFields(input.workingDirectory, WORKING_DIRECTORY_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_SPECIFICATION', 'Process working directory');
  exactFields(input.environment, ENVIRONMENT_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_SPECIFICATION', 'Process environment');
  exactFields(input.stdin, INPUT_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_SPECIFICATION', 'Process stdin');
  exactFields(input.stdout, CAPTURE_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_SPECIFICATION', 'Process stdout');
  exactFields(input.stderr, CAPTURE_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_SPECIFICATION', 'Process stderr');
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_PROCESS_LAUNCH_SPECIFICATION_SCHEMA_VERSION
      && LAUNCH_ID.test(input.launchId)
      && input.executable === K6_API_RUNTIME_EXECUTABLE
      && input.shell === false
      && input.workingDirectory.mode === K6_API_RUNTIME_WORKING_DIRECTORY_MODE
      && input.workingDirectory.logicalName === K6_PROCESS_LOGICAL_WORKING_DIRECTORY
      && input.workingDirectory.absolutePathIncluded === false
      && input.environment.valuesIncluded === false
      && input.environment.inheritHostEnvironment === false
      && input.stdin.mode === 'DISABLED'
      && input.stdin.contentIncluded === false
      && input.stdout.mode === 'BOUNDED_DECLARATION_ONLY'
      && input.stderr.mode === 'BOUNDED_DECLARATION_ONLY'
      && input.stdout.maxBytes === K6_PROCESS_CAPTURE_MAX_BYTES
      && input.stderr.maxBytes === K6_PROCESS_CAPTURE_MAX_BYTES
      && input.stdout.collected === false
      && input.stderr.collected === false
      && input.processStartAuthorized === false,
    'K6_PROCESS_LAUNCH_SPECIFICATION_ESCALATION',
    'Process launch specification widens the P1 non-execution boundary');
  for (const field of [
    'runtimePolicyDigest', 'runtimeAdmissionRequestDigest', 'invocationPlanDigest',
    'runtimeAdmissionEvidenceDigest',
  ]) validateDigest(input[field], `processLaunchSpecification.${field}`);
  validateArgv(input.argv);
  validateEnvironmentNames(input.environment.allowedNames);
  if (requireDigest) {
    validateDigest(input.specificationDigest, 'processLaunchSpecification.specificationDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'specificationDigest')
      === input.specificationDigest,
    'K6_PROCESS_LAUNCH_SPECIFICATION_DIGEST_MISMATCH',
    'Process launch specification digest is invalid');
  }
  return input;
}

function validatePortReceipt(input, portDescriptor, launchSpecification) {
  exactFields(input, RECEIPT_FIELDS,
    'INVALID_K6_LOCAL_PROCESS_PORT_RECEIPT', 'Local process port receipt');
  runtimeAdmissionInvariant(
    input.schemaVersion === RECEIPT_SCHEMA_VERSION
      && input.portId === portDescriptor.portId
      && input.portDigest === portDescriptor.portDigest
      && input.launchSpecificationDigest === launchSpecification.specificationDigest
      && input.accepted === true
      && input.delegated === true
      && input.processStarted === false
      && input.processIdCreated === false
      && input.k6Invoked === false
      && input.externalProcessExecuted === false,
    'K6_LOCAL_PROCESS_PORT_RECEIPT_ESCALATION',
    'Local process port receipt is unbound or claims process execution');
  return deepFreeze(cloneExecutionJson(input));
}

function validateDecisionSelfConsistency(input, requireDigest = true) {
  exactFields(input, DECISION_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_DECISION', 'Process launch decision');
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_PROCESS_LAUNCH_DECISION_SCHEMA_VERSION
      && DECISION_ID.test(input.decisionId)
      && DIGEST.test(input.portDigest)
      && DIGEST.test(input.launchSpecificationDigest)
      && canonicalStringify(input.decision)
        === canonicalStringify(K6_PROCESS_BOUNDARY_DECISION)
      && canonicalStringify(input.safetyBoundary)
        === canonicalStringify(K6_PROCESS_BOUNDARY_SAFETY),
    'K6_PROCESS_LAUNCH_DECISION_ESCALATION',
    'Process launch decision violates the P1 non-execution decision');
  exactFields(input.portReceipt, RECEIPT_FIELDS,
    'INVALID_K6_PROCESS_LAUNCH_DECISION', 'Process launch decision receipt');
  runtimeAdmissionInvariant(input.portReceipt.portDigest === input.portDigest
      && input.portReceipt.launchSpecificationDigest === input.launchSpecificationDigest
      && input.portReceipt.processStarted === false
      && input.portReceipt.processIdCreated === false
      && input.portReceipt.k6Invoked === false
      && input.portReceipt.externalProcessExecuted === false,
  'K6_PROCESS_LAUNCH_DECISION_RECEIPT_MISMATCH',
  'Process launch decision receipt is not bound to its decision');
  if (requireDigest) {
    validateDigest(input.decisionDigest, 'processLaunchDecision.decisionDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'decisionDigest') === input.decisionDigest,
      'K6_PROCESS_LAUNCH_DECISION_DIGEST_MISMATCH',
      'Process launch decision digest is invalid');
  }
  return input;
}

function validateBoundaryEvidenceSelfConsistency(input, requireDigest = true) {
  exactFields(input, BOUNDARY_EVIDENCE_FIELDS,
    'INVALID_K6_PROCESS_BOUNDARY_EVIDENCE', 'Process boundary Evidence');
  runtimeAdmissionInvariant(
    input.schemaVersion === K6_PROCESS_BOUNDARY_EVIDENCE_SCHEMA_VERSION
      && EVIDENCE_ID.test(input.evidenceId)
      && canonicalStringify(input.decision)
        === canonicalStringify(K6_PROCESS_BOUNDARY_DECISION)
      && canonicalStringify(input.safetyBoundary)
        === canonicalStringify(K6_PROCESS_BOUNDARY_SAFETY),
    'K6_PROCESS_BOUNDARY_EVIDENCE_ESCALATION',
    'Process boundary Evidence violates the P1 non-execution decision');
  for (const field of [
    'runtimePolicyDigest', 'runtimeAdmissionRequestDigest', 'invocationPlanDigest',
    'runtimeAdmissionEvidenceDigest', 'portDigest', 'launchSpecificationDigest',
    'launchDecisionDigest',
  ]) validateDigest(input[field], `processBoundaryEvidence.${field}`);
  if (requireDigest) {
    validateDigest(input.evidenceDigest, 'processBoundaryEvidence.evidenceDigest');
    runtimeAdmissionInvariant(digestWithout(input, 'evidenceDigest') === input.evidenceDigest,
      'K6_PROCESS_BOUNDARY_EVIDENCE_DIGEST_MISMATCH',
      'Process boundary Evidence digest is invalid');
  }
  return input;
}

function validateArgv(argv) {
  runtimeAdmissionInvariant(Array.isArray(argv) && argv.length >= 2
      && argv.every((item) => typeof item === 'string' && item.length > 0)
      && !argv.some((item) => /[;&|`$<>\n\r\0]/u.test(item)),
  'K6_PROCESS_ARGV_UNSAFE',
  'Process launch argv must remain a fixed shell-free string array');
}

function validateEnvironmentNames(names) {
  runtimeAdmissionInvariant(Array.isArray(names),
    'K6_PROCESS_ENVIRONMENT_INVALID', 'Process environment names must be an array');
  const normalized = [...names].sort();
  runtimeAdmissionInvariant(new Set(normalized).size === normalized.length
      && normalized.every((name) => name === 'K6_LOG_FORMAT' || name === 'K6_NO_COLOR')
      && canonicalStringify(names) === canonicalStringify(normalized),
  'K6_PROCESS_ENVIRONMENT_ESCALATION',
  'Process environment names must be sorted and limited to the Runtime Policy allow-list');
}

function validateDigestShape(input, fields, digestField, label) {
  exactFields(input, fields, `INVALID_${digestField.toUpperCase()}`, label);
  validateDigest(input[digestField], `${label}.${digestField}`);
}

function digestWithout(input, field) {
  const clone = cloneExecutionJson(input);
  delete clone[field];
  return sha256(clone);
}

function freezeWithDigest(withoutDigest, digestField) {
  return deepFreeze(cloneExecutionJson({
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

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) deepFreeze(child);
  return Object.freeze(value);
}

class ErrorWithCause extends Error {
  constructor(code, message, cause) {
    super(message, { cause });
    this.name = 'K6ApiRuntimeAdmissionError';
    this.code = code;
    this.details = {};
  }
}
