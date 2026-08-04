import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  cloneExecutionJson,
  validateDigest,
  validateExecutionRequestId,
  validateNonEmptyString,
  validateProjectId,
  validateSemver,
  validateUtcTimestamp,
} from '@kdtp/execution-contract';
import {
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
  K6_API_INVOCATION_PLAN_SCHEMA_VERSION,
  K6_API_RUNTIME_ADMISSION_EVIDENCE_SCHEMA_VERSION,
  K6_API_RUNTIME_ADMISSION_REQUEST_SCHEMA_VERSION,
  K6_API_RUNTIME_ALLOWED_ENVIRONMENT_VARIABLE_NAMES,
  K6_API_RUNTIME_ALLOWED_OUTPUT_ARTIFACT_KINDS,
  K6_API_RUNTIME_CANCELLATION_MODE,
  K6_API_RUNTIME_EXECUTABLE,
  K6_API_RUNTIME_EXECUTION_MODE,
  K6_API_RUNTIME_ID,
  K6_API_RUNTIME_IMPLEMENTATION_STATUS,
  K6_API_RUNTIME_LIMITS,
  K6_API_RUNTIME_POLICY_SCHEMA_VERSION,
  K6_API_RUNTIME_SOURCE_RELATIVE_PATH,
  K6_API_RUNTIME_SUBCOMMAND,
  K6_API_RUNTIME_VERSION,
  K6_API_RUNTIME_WORKING_DIRECTORY_MODE,
} from './constants.js';
import { computeK6ApiCompilationEvidenceDigest } from './compiler.js';
import { runtimeAdmissionInvariant } from './errors.js';
import {
  validateK6ApiSourcePublicationBundleIntegrity,
} from './source-publication-bundle.js';
import {
  validateK6ApiSourcePublicationEvidence,
  validateK6ApiSourcePublicationReceipt,
} from './source-bundle-publisher.js';

const DIGEST = /^[a-f0-9]{64}$/u;
const ADMISSION_ID = /^k6runtime-admission-[a-f0-9]{20}$/u;
const PLAN_ID = /^k6invocation-[a-f0-9]{20}$/u;
const EVIDENCE_ID = /^k6runtime-evidence-[a-f0-9]{20}$/u;

const POLICY_FIELDS = Object.freeze([
  'schemaVersion', 'runtimeId', 'runtimeVersion', 'implementationStatus',
  'executionMode', 'executable', 'subcommand', 'shellAllowed',
  'sourceRelativePath', 'workingDirectoryMode',
  'allowedEnvironmentVariableNames', 'allowedOutputArtifactKinds',
  'cancellationMode', 'limits', 'policyDigest',
]);
const LIMIT_FIELDS = Object.freeze([
  'maxVus', 'maxIterations', 'maxDurationMs', 'maxGracefulStopMs',
]);
const ADMISSION_FIELDS = Object.freeze([
  'schemaVersion', 'admissionId', 'runtimePolicyDigest', 'executionRequest',
  'source', 'resources', 'metadata', 'admissionDigest',
]);
const EXECUTION_FIELDS = Object.freeze([
  'requestId', 'requestDigest', 'projectId', 'environmentDigest',
  'frozenTestPlanDigest', 'knowledgeSnapshotDigest', 'adapter',
]);
const ADAPTER_FIELDS = Object.freeze([
  'adapterId', 'adapterType', 'version', 'descriptorDigest',
]);
const SOURCE_FIELDS = Object.freeze([
  'bundleId', 'bundleDigest', 'manifestDigest', 'sourceArtifactDigest',
  'sourceIdentity', 'sourceDigest', 'receiptId', 'receiptDigest',
  'publicationEvidenceDigest', 'logicalUri', 'specDigest',
  'compilationEvidenceDigest',
]);
const RESOURCE_FIELDS = Object.freeze([
  'vus', 'iterations', 'durationMs', 'gracefulStopMs',
  'environmentVariableNames', 'outputArtifactKinds',
]);
const METADATA_FIELDS = Object.freeze(['requestedAt', 'requestedBy']);
const PLAN_FIELDS = Object.freeze([
  'schemaVersion', 'planId', 'admissionId', 'admissionDigest', 'runtime',
  'source', 'resources', 'environmentVariableNames', 'outputArtifactKinds',
  'argv', 'workingDirectoryMode', 'executionAuthorized', 'planDigest',
]);
const PLAN_RUNTIME_FIELDS = Object.freeze([
  'runtimeId', 'runtimeVersion', 'implementationStatus', 'executionMode',
  'executable', 'shellAllowed',
]);
const PLAN_SOURCE_FIELDS = Object.freeze([
  'bundleDigest', 'sourceDigest', 'logicalUri', 'relativePath',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'admissionId', 'admissionDigest', 'planId',
  'planDigest', 'executionRequestDigest', 'sourceBundleDigest', 'sourceDigest',
  'decision', 'safetyBoundary', 'evidenceDigest',
]);

export const K6_API_RUNTIME_ADMISSION_DECISION = Object.freeze({
  runtimeAdmissionContractReady: true,
  invocationPlanReady: true,
  executionImplementationStarted: false,
  sourceExecuted: false,
  k6Invoked: false,
  externalProcessExecuted: false,
  nextRequiredSlice: 'M3-R3-P1',
  repositoryBlockers: Object.freeze([]),
});

export const K6_API_RUNTIME_ADMISSION_SAFETY_BOUNDARY = Object.freeze({
  sourceExecuted: false,
  executionRuntimeStarted: false,
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
  containerStarted: false,
  kubernetesResourceCreated: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  runtimeResultCollected: false,
  allureImplemented: false,
});

export function createK6ApiRuntimePolicy() {
  const withoutDigest = {
    schemaVersion: K6_API_RUNTIME_POLICY_SCHEMA_VERSION,
    runtimeId: K6_API_RUNTIME_ID,
    runtimeVersion: K6_API_RUNTIME_VERSION,
    implementationStatus: K6_API_RUNTIME_IMPLEMENTATION_STATUS,
    executionMode: K6_API_RUNTIME_EXECUTION_MODE,
    executable: K6_API_RUNTIME_EXECUTABLE,
    subcommand: K6_API_RUNTIME_SUBCOMMAND,
    shellAllowed: false,
    sourceRelativePath: K6_API_RUNTIME_SOURCE_RELATIVE_PATH,
    workingDirectoryMode: K6_API_RUNTIME_WORKING_DIRECTORY_MODE,
    allowedEnvironmentVariableNames: [...K6_API_RUNTIME_ALLOWED_ENVIRONMENT_VARIABLE_NAMES],
    allowedOutputArtifactKinds: [...K6_API_RUNTIME_ALLOWED_OUTPUT_ARTIFACT_KINDS],
    cancellationMode: K6_API_RUNTIME_CANCELLATION_MODE,
    limits: cloneExecutionJson(K6_API_RUNTIME_LIMITS),
  };
  return deepFreeze(cloneExecutionJson({
    ...withoutDigest,
    policyDigest: sha256(withoutDigest),
  }));
}

export function validateK6ApiRuntimePolicy(input) {
  exactFields(input, POLICY_FIELDS, 'INVALID_K6_API_RUNTIME_POLICY', 'Runtime policy');
  exactFields(input.limits, LIMIT_FIELDS,
    'INVALID_K6_API_RUNTIME_POLICY', 'Runtime policy limits');
  const expected = createK6ApiRuntimePolicy();
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_RUNTIME_POLICY_MISMATCH',
    'Runtime policy does not match the fixed M3-R3-R0 contract');
  return expected;
}

export function createK6ApiRuntimeAdmissionRequest(command) {
  exactFields(command, [
    'policy', 'executionRequest', 'spec', 'compilationEvidence', 'bundle',
    'receipt', 'publicationEvidence', 'acceptedP3', 'resources',
    'requestedAt', 'requestedBy',
  ], 'INVALID_K6_API_RUNTIME_ADMISSION_COMMAND', 'Runtime admission command');

  const policy = validateK6ApiRuntimePolicy(command.policy);
  const executionRequest = normalizeExecutionRequestBinding(command.executionRequest);
  const spec = validateSpec(command.spec);
  const compilationEvidence = validateCompilationEvidence(command.compilationEvidence);
  const publication = validatePublication(command, spec, compilationEvidence);
  validateExecutionSourceBindings(executionRequest, spec, compilationEvidence, publication.bundle);
  const resources = normalizeResources(command.resources, policy);
  const metadata = {
    requestedAt: validateUtcTimestamp(command.requestedAt, 'runtimeAdmission.requestedAt'),
    requestedBy: validateNonEmptyString(
      command.requestedBy, 'runtimeAdmission.requestedBy', 256),
  };
  const source = {
    bundleId: publication.bundle.bundleId,
    bundleDigest: publication.bundle.bundleDigest,
    manifestDigest: publication.bundle.manifest.manifestDigest,
    sourceArtifactDigest: publication.bundle.sourceArtifactDigest,
    sourceIdentity: publication.bundle.provenance.sourceIdentity,
    sourceDigest: publication.bundle.provenance.sourceDigest,
    receiptId: publication.receipt.receiptId,
    receiptDigest: publication.receipt.receiptDigest,
    publicationEvidenceDigest: publication.evidence.evidenceDigest,
    logicalUri: publication.receipt.storage.logicalUri,
    specDigest: publication.bundle.provenance.specDigest,
    compilationEvidenceDigest: publication.bundle.provenance.compilationEvidenceDigest,
  };
  const identity = {
    runtimePolicyDigest: policy.policyDigest,
    executionRequest,
    source,
    resources,
  };
  const admissionId = `k6runtime-admission-${sha256(identity).slice(0, 20)}`;
  const withoutDigest = {
    schemaVersion: K6_API_RUNTIME_ADMISSION_REQUEST_SCHEMA_VERSION,
    admissionId,
    runtimePolicyDigest: policy.policyDigest,
    executionRequest,
    source,
    resources,
    metadata,
  };
  const request = {
    ...withoutDigest,
    admissionDigest: sha256(withoutDigest),
  };
  validateAdmissionSelfConsistency(request);
  return deepFreeze(cloneExecutionJson(request));
}

export function validateK6ApiRuntimeAdmissionRequest(input, bindings) {
  validateAdmissionSelfConsistency(input);
  exactFields(bindings, [
    'policy', 'spec', 'compilationEvidence', 'bundle', 'receipt',
    'publicationEvidence', 'acceptedP3',
  ], 'INVALID_K6_API_RUNTIME_ADMISSION_BINDINGS', 'Runtime admission bindings');
  const expected = createK6ApiRuntimeAdmissionRequest({
    ...bindings,
    executionRequest: input.executionRequest,
    resources: input.resources,
    requestedAt: input.metadata.requestedAt,
    requestedBy: input.metadata.requestedBy,
  });
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_RUNTIME_ADMISSION_REQUEST_MISMATCH',
    'Runtime admission request does not match its immutable predecessor bindings');
  return expected;
}

export function computeK6ApiRuntimeAdmissionRequestDigest(input) {
  validateAdmissionSelfConsistency(input, false);
  const { admissionDigest: _admissionDigest, ...withoutDigest } = input;
  return sha256(withoutDigest);
}

export function createK6ApiInvocationPlan(admissionRequest, policyInput) {
  const policy = validateK6ApiRuntimePolicy(policyInput);
  validateAdmissionSelfConsistency(admissionRequest);
  runtimeAdmissionInvariant(admissionRequest.runtimePolicyDigest === policy.policyDigest,
    'K6_API_INVOCATION_POLICY_BINDING_MISMATCH',
    'Invocation plan policy does not match the admission request');
  const resources = cloneExecutionJson(admissionRequest.resources);
  const argv = [
    policy.subcommand,
    '--vus', String(resources.vus),
    '--iterations', String(resources.iterations),
    '--duration', `${resources.durationMs / 1000}s`,
    '--graceful-stop', `${resources.gracefulStopMs / 1000}s`,
  ];
  if (resources.outputArtifactKinds.includes('k6-run-summary-json')) {
    argv.push('--summary-export', 'outputs/summary.json');
  }
  argv.push(policy.sourceRelativePath);
  const runtime = {
    runtimeId: policy.runtimeId,
    runtimeVersion: policy.runtimeVersion,
    implementationStatus: policy.implementationStatus,
    executionMode: policy.executionMode,
    executable: policy.executable,
    shellAllowed: policy.shellAllowed,
  };
  const source = {
    bundleDigest: admissionRequest.source.bundleDigest,
    sourceDigest: admissionRequest.source.sourceDigest,
    logicalUri: admissionRequest.source.logicalUri,
    relativePath: policy.sourceRelativePath,
  };
  const identity = {
    admissionDigest: admissionRequest.admissionDigest,
    runtime,
    source,
    resources,
    argv,
  };
  const planId = `k6invocation-${sha256(identity).slice(0, 20)}`;
  const withoutDigest = {
    schemaVersion: K6_API_INVOCATION_PLAN_SCHEMA_VERSION,
    planId,
    admissionId: admissionRequest.admissionId,
    admissionDigest: admissionRequest.admissionDigest,
    runtime,
    source,
    resources: {
      vus: resources.vus,
      iterations: resources.iterations,
      durationMs: resources.durationMs,
      gracefulStopMs: resources.gracefulStopMs,
    },
    environmentVariableNames: [...resources.environmentVariableNames],
    outputArtifactKinds: [...resources.outputArtifactKinds],
    argv,
    workingDirectoryMode: policy.workingDirectoryMode,
    executionAuthorized: false,
  };
  const plan = { ...withoutDigest, planDigest: sha256(withoutDigest) };
  validatePlanSelfConsistency(plan);
  return deepFreeze(cloneExecutionJson(plan));
}

export function validateK6ApiInvocationPlan(input, admissionRequest, policyInput) {
  validatePlanSelfConsistency(input);
  const expected = createK6ApiInvocationPlan(admissionRequest, policyInput);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_INVOCATION_PLAN_MISMATCH',
    'Invocation plan does not match the admitted immutable Source bundle');
  return expected;
}

export function computeK6ApiInvocationPlanDigest(input) {
  validatePlanSelfConsistency(input, false);
  const { planDigest: _planDigest, ...withoutDigest } = input;
  return sha256(withoutDigest);
}

export function createK6ApiRuntimeAdmissionEvidence({ admissionRequest, invocationPlan }) {
  validateAdmissionSelfConsistency(admissionRequest);
  validatePlanSelfConsistency(invocationPlan);
  runtimeAdmissionInvariant(invocationPlan.admissionId === admissionRequest.admissionId
      && invocationPlan.admissionDigest === admissionRequest.admissionDigest,
  'K6_API_RUNTIME_EVIDENCE_BINDING_MISMATCH',
  'Runtime admission Evidence plan does not bind the admission request');
  const withoutDigest = {
    schemaVersion: K6_API_RUNTIME_ADMISSION_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6runtime-evidence-${invocationPlan.planDigest.slice(0, 20)}`,
    admissionId: admissionRequest.admissionId,
    admissionDigest: admissionRequest.admissionDigest,
    planId: invocationPlan.planId,
    planDigest: invocationPlan.planDigest,
    executionRequestDigest: admissionRequest.executionRequest.requestDigest,
    sourceBundleDigest: admissionRequest.source.bundleDigest,
    sourceDigest: admissionRequest.source.sourceDigest,
    decision: cloneExecutionJson(K6_API_RUNTIME_ADMISSION_DECISION),
    safetyBoundary: cloneExecutionJson(K6_API_RUNTIME_ADMISSION_SAFETY_BOUNDARY),
  };
  return deepFreeze(cloneExecutionJson({
    ...withoutDigest,
    evidenceDigest: sha256(withoutDigest),
  }));
}

export function validateK6ApiRuntimeAdmissionEvidence(input, bindings) {
  exactFields(input, EVIDENCE_FIELDS,
    'INVALID_K6_API_RUNTIME_ADMISSION_EVIDENCE', 'Runtime admission Evidence');
  exactFields(bindings, ['admissionRequest', 'invocationPlan'],
    'INVALID_K6_API_RUNTIME_ADMISSION_EVIDENCE_BINDINGS',
    'Runtime admission Evidence bindings');
  runtimeAdmissionInvariant(EVIDENCE_ID.test(input.evidenceId)
      && DIGEST.test(input.evidenceDigest),
  'INVALID_K6_API_RUNTIME_ADMISSION_EVIDENCE', 'Runtime admission Evidence identity is invalid');
  const expected = createK6ApiRuntimeAdmissionEvidence(bindings);
  runtimeAdmissionInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_RUNTIME_ADMISSION_EVIDENCE_MISMATCH',
    'Runtime admission Evidence does not match the request and invocation plan');
  return expected;
}

export function computeK6ApiRuntimeAdmissionEvidenceDigest(input) {
  exactFields(input, EVIDENCE_FIELDS,
    'INVALID_K6_API_RUNTIME_ADMISSION_EVIDENCE', 'Runtime admission Evidence');
  const { evidenceDigest: _evidenceDigest, ...withoutDigest } = input;
  return sha256(withoutDigest);
}

function normalizeExecutionRequestBinding(input) {
  exactFields(input, EXECUTION_FIELDS,
    'INVALID_K6_API_RUNTIME_EXECUTION_BINDING', 'Execution request binding');
  exactFields(input.adapter, ADAPTER_FIELDS,
    'INVALID_K6_API_RUNTIME_EXECUTION_BINDING', 'Execution adapter binding');
  validateExecutionRequestId(input.requestId);
  const normalized = {
    requestId: input.requestId,
    requestDigest: validateDigest(input.requestDigest, 'executionRequest.requestDigest'),
    projectId: validateProjectId(input.projectId),
    environmentDigest: validateDigest(
      input.environmentDigest, 'executionRequest.environmentDigest'),
    frozenTestPlanDigest: validateDigest(
      input.frozenTestPlanDigest, 'executionRequest.frozenTestPlanDigest'),
    knowledgeSnapshotDigest: validateDigest(
      input.knowledgeSnapshotDigest, 'executionRequest.knowledgeSnapshotDigest'),
    adapter: {
      adapterId: validateNonEmptyString(input.adapter.adapterId, 'executionRequest.adapterId', 256),
      adapterType: validateNonEmptyString(
        input.adapter.adapterType, 'executionRequest.adapterType', 64),
      version: validateSemver(input.adapter.version, 'executionRequest.adapter.version'),
      descriptorDigest: validateDigest(
        input.adapter.descriptorDigest, 'executionRequest.adapter.descriptorDigest'),
    },
  };
  runtimeAdmissionInvariant(normalized.adapter.adapterType === 'k6-api',
    'K6_API_RUNTIME_ADAPTER_TYPE_MISMATCH',
    'Runtime admission requires the k6-api Adapter type');
  return deepFreeze(cloneExecutionJson(normalized));
}

function validateSpec(input) {
  const spec = cloneExecutionJson(input, '$.runtimeAdmission.spec');
  runtimeAdmissionInvariant(spec?.schemaVersion === K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    'K6_API_RUNTIME_SPEC_SCHEMA_MISMATCH', 'Runtime admission requires the accepted Spec schema');
  validateDigest(spec.specDigest, 'runtimeAdmission.spec.specDigest');
  const { specDigest, ...withoutDigest } = spec;
  runtimeAdmissionInvariant(sha256(withoutDigest) === specDigest,
    'K6_API_RUNTIME_SPEC_DIGEST_MISMATCH', 'Runtime admission Spec digest is invalid');
  return deepFreeze(spec);
}

function validateCompilationEvidence(input) {
  const evidence = cloneExecutionJson(input, '$.runtimeAdmission.compilationEvidence');
  runtimeAdmissionInvariant(
    evidence?.schemaVersion === K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
    'K6_API_RUNTIME_COMPILATION_EVIDENCE_SCHEMA_MISMATCH',
    'Runtime admission requires the accepted Compilation Evidence schema');
  validateDigest(evidence.evidenceDigest,
    'runtimeAdmission.compilationEvidence.evidenceDigest');
  runtimeAdmissionInvariant(
    computeK6ApiCompilationEvidenceDigest(evidence) === evidence.evidenceDigest,
    'K6_API_RUNTIME_COMPILATION_EVIDENCE_DIGEST_MISMATCH',
    'Runtime admission Compilation Evidence digest is invalid');
  return deepFreeze(evidence);
}

function validatePublication(command, spec, compilationEvidence) {
  const bundle = validateK6ApiSourcePublicationBundleIntegrity(
    command.bundle, command.acceptedP3);
  const receipt = validateK6ApiSourcePublicationReceipt(
    command.receipt, bundle, { acceptedP3: command.acceptedP3 });
  const evidence = validateK6ApiSourcePublicationEvidence(command.publicationEvidence, {
    bundle,
    receipt,
    acceptedP3: command.acceptedP3,
  });
  runtimeAdmissionInvariant(bundle.provenance.specDigest === spec.specDigest
      && bundle.provenance.compilationEvidenceDigest === compilationEvidence.evidenceDigest,
  'K6_API_RUNTIME_SOURCE_PROVENANCE_MISMATCH',
  'Published Source provenance does not bind the accepted Spec and Compilation Evidence');
  return { bundle, receipt, evidence };
}

function validateExecutionSourceBindings(execution, spec, compilationEvidence, bundle) {
  runtimeAdmissionInvariant(spec.projectId === execution.projectId
      && spec.environment?.digest === execution.environmentDigest
      && spec.frozenTestPlan?.contentDigest === execution.frozenTestPlanDigest
      && spec.knowledgeSnapshot?.digest === execution.knowledgeSnapshotDigest
      && spec.adapter?.adapterId === execution.adapter.adapterId
      && spec.adapter?.adapterType === execution.adapter.adapterType
      && spec.adapter?.version === execution.adapter.version
      && spec.adapter?.descriptorDigest === execution.adapter.descriptorDigest,
  'K6_API_RUNTIME_EXECUTION_SPEC_BINDING_MISMATCH',
  'Execution request binding does not match the accepted Spec');
  runtimeAdmissionInvariant(
    compilationEvidence.executionRequestDigest === execution.requestDigest
      && compilationEvidence.environmentDigest === execution.environmentDigest
      && compilationEvidence.testPlanDigest === execution.frozenTestPlanDigest
      && compilationEvidence.knowledgeSnapshotDigest === execution.knowledgeSnapshotDigest
      && compilationEvidence.adapterDescriptorDigest === execution.adapter.descriptorDigest
      && compilationEvidence.specDigest === spec.specDigest,
    'K6_API_RUNTIME_EXECUTION_EVIDENCE_BINDING_MISMATCH',
    'Execution request binding does not match Compilation Evidence');
  runtimeAdmissionInvariant(bundle.provenance.specDigest === spec.specDigest
      && bundle.provenance.compilationEvidenceDigest === compilationEvidence.evidenceDigest,
  'K6_API_RUNTIME_PUBLICATION_BINDING_MISMATCH',
  'Published Source bundle does not bind the admitted execution chain');
}

function normalizeResources(input, policy) {
  exactFields(input, RESOURCE_FIELDS,
    'INVALID_K6_API_RUNTIME_RESOURCES', 'Runtime resource request');
  const vus = boundedInteger(input.vus, 1, policy.limits.maxVus, 'vus');
  const iterations = boundedInteger(
    input.iterations, 1, policy.limits.maxIterations, 'iterations');
  const durationMs = boundedMilliseconds(
    input.durationMs, 1_000, policy.limits.maxDurationMs, 'durationMs');
  const gracefulStopMs = boundedMilliseconds(
    input.gracefulStopMs, 0, policy.limits.maxGracefulStopMs, 'gracefulStopMs');
  runtimeAdmissionInvariant(gracefulStopMs <= durationMs,
    'K6_API_RUNTIME_GRACEFUL_STOP_EXCEEDS_DURATION',
    'Runtime graceful stop must not exceed duration');
  const environmentVariableNames = normalizeAllowList(
    input.environmentVariableNames, policy.allowedEnvironmentVariableNames,
    'environmentVariableNames');
  const outputArtifactKinds = normalizeAllowList(
    input.outputArtifactKinds, policy.allowedOutputArtifactKinds, 'outputArtifactKinds');
  return deepFreeze({
    vus,
    iterations,
    durationMs,
    gracefulStopMs,
    environmentVariableNames,
    outputArtifactKinds,
  });
}

function validateAdmissionSelfConsistency(input, requireDigest = true) {
  exactFields(input, ADMISSION_FIELDS,
    'INVALID_K6_API_RUNTIME_ADMISSION_REQUEST', 'Runtime admission request');
  runtimeAdmissionInvariant(input.schemaVersion === K6_API_RUNTIME_ADMISSION_REQUEST_SCHEMA_VERSION
      && ADMISSION_ID.test(input.admissionId),
  'INVALID_K6_API_RUNTIME_ADMISSION_REQUEST', 'Runtime admission request identity is invalid');
  validateDigest(input.runtimePolicyDigest, 'runtimeAdmission.runtimePolicyDigest');
  normalizeExecutionRequestBinding(input.executionRequest);
  exactFields(input.source, SOURCE_FIELDS,
    'INVALID_K6_API_RUNTIME_ADMISSION_REQUEST', 'Runtime admission source binding');
  for (const field of [
    'bundleDigest', 'manifestDigest', 'sourceArtifactDigest', 'sourceIdentity',
    'sourceDigest', 'receiptDigest', 'publicationEvidenceDigest', 'specDigest',
    'compilationEvidenceDigest',
  ]) validateDigest(input.source[field], `runtimeAdmission.source.${field}`);
  runtimeAdmissionInvariant(
    input.source.logicalUri === `kdtp-source-bundle://sha256/${input.source.bundleDigest}`,
    'K6_API_RUNTIME_SOURCE_URI_MISMATCH',
    'Runtime admission Source URI does not bind the bundle digest');
  exactFields(input.resources, RESOURCE_FIELDS,
    'INVALID_K6_API_RUNTIME_ADMISSION_REQUEST', 'Runtime admission resources');
  normalizeResources(input.resources, createK6ApiRuntimePolicy());
  exactFields(input.metadata, METADATA_FIELDS,
    'INVALID_K6_API_RUNTIME_ADMISSION_REQUEST', 'Runtime admission metadata');
  validateUtcTimestamp(input.metadata.requestedAt, 'runtimeAdmission.requestedAt');
  validateNonEmptyString(input.metadata.requestedBy, 'runtimeAdmission.requestedBy', 256);
  if (requireDigest) {
    validateDigest(input.admissionDigest, 'runtimeAdmission.admissionDigest');
    const { admissionDigest, ...withoutDigest } = input;
    runtimeAdmissionInvariant(sha256(withoutDigest) === admissionDigest,
      'K6_API_RUNTIME_ADMISSION_DIGEST_MISMATCH',
      'Runtime admission request digest is invalid');
  }
  return input;
}

function validatePlanSelfConsistency(input, requireDigest = true) {
  exactFields(input, PLAN_FIELDS,
    'INVALID_K6_API_INVOCATION_PLAN', 'k6 invocation plan');
  exactFields(input.runtime, PLAN_RUNTIME_FIELDS,
    'INVALID_K6_API_INVOCATION_PLAN', 'k6 invocation runtime');
  exactFields(input.source, PLAN_SOURCE_FIELDS,
    'INVALID_K6_API_INVOCATION_PLAN', 'k6 invocation source');
  exactFields(input.resources, ['vus', 'iterations', 'durationMs', 'gracefulStopMs'],
    'INVALID_K6_API_INVOCATION_PLAN', 'k6 invocation resources');
  runtimeAdmissionInvariant(input.schemaVersion === K6_API_INVOCATION_PLAN_SCHEMA_VERSION
      && PLAN_ID.test(input.planId)
      && ADMISSION_ID.test(input.admissionId)
      && input.runtime.implementationStatus === K6_API_RUNTIME_IMPLEMENTATION_STATUS
      && input.runtime.executable === K6_API_RUNTIME_EXECUTABLE
      && input.runtime.shellAllowed === false
      && input.source.relativePath === K6_API_RUNTIME_SOURCE_RELATIVE_PATH
      && input.workingDirectoryMode === K6_API_RUNTIME_WORKING_DIRECTORY_MODE
      && input.executionAuthorized === false,
  'INVALID_K6_API_INVOCATION_PLAN', 'k6 invocation plan violates the R0 boundary');
  validateDigest(input.admissionDigest, 'invocationPlan.admissionDigest');
  validateDigest(input.source.bundleDigest, 'invocationPlan.source.bundleDigest');
  validateDigest(input.source.sourceDigest, 'invocationPlan.source.sourceDigest');
  runtimeAdmissionInvariant(
    input.source.logicalUri === `kdtp-source-bundle://sha256/${input.source.bundleDigest}`,
    'K6_API_INVOCATION_SOURCE_URI_MISMATCH',
    'Invocation plan Source URI does not bind the bundle digest');
  runtimeAdmissionInvariant(Array.isArray(input.argv)
      && input.argv.every((item) => typeof item === 'string' && item.length > 0)
      && !input.argv.some((item) => /[;&|`$<>\n\r]/u.test(item))
      && input.argv[0] === K6_API_RUNTIME_SUBCOMMAND
      && input.argv.at(-1) === K6_API_RUNTIME_SOURCE_RELATIVE_PATH,
  'K6_API_INVOCATION_ARGV_UNSAFE', 'Invocation plan argv is not a fixed shell-free array');
  if (requireDigest) {
    validateDigest(input.planDigest, 'invocationPlan.planDigest');
    const { planDigest, ...withoutDigest } = input;
    runtimeAdmissionInvariant(sha256(withoutDigest) === planDigest,
      'K6_API_INVOCATION_PLAN_DIGEST_MISMATCH', 'Invocation plan digest is invalid');
  }
  return input;
}

function boundedInteger(value, minimum, maximum, field) {
  runtimeAdmissionInvariant(Number.isSafeInteger(value)
      && value >= minimum && value <= maximum,
  'K6_API_RUNTIME_RESOURCE_LIMIT_EXCEEDED',
  `Runtime ${field} must be an integer between ${minimum} and ${maximum}`, { field, value });
  return value;
}

function boundedMilliseconds(value, minimum, maximum, field) {
  const accepted = boundedInteger(value, minimum, maximum, field);
  runtimeAdmissionInvariant(accepted % 1000 === 0,
    'K6_API_RUNTIME_DURATION_NOT_CANONICAL',
    `Runtime ${field} must be expressed in whole seconds`, { field, value });
  return accepted;
}

function normalizeAllowList(values, allowedValues, field) {
  runtimeAdmissionInvariant(Array.isArray(values),
    'K6_API_RUNTIME_ALLOW_LIST_INVALID', `Runtime ${field} must be an array`);
  const normalized = [...values].sort();
  runtimeAdmissionInvariant(new Set(normalized).size === normalized.length,
    'K6_API_RUNTIME_ALLOW_LIST_INVALID', `Runtime ${field} contains duplicates`);
  const allowed = new Set(allowedValues);
  for (const value of normalized) {
    runtimeAdmissionInvariant(typeof value === 'string' && allowed.has(value),
      'K6_API_RUNTIME_ALLOW_LIST_ESCALATION',
      `Runtime ${field} contains a value outside the policy allow-list`, { field, value });
  }
  return normalized;
}

function exactFields(value, fields, code, label) {
  runtimeAdmissionInvariant(value && typeof value === 'object' && !Array.isArray(value),
    code, `${label} must be an object`);
  const expected = [...fields].sort();
  const actual = Object.keys(value).sort();
  runtimeAdmissionInvariant(canonicalStringify(actual) === canonicalStringify(expected),
    code, `${label} fields do not match the closed contract`, { expected, actual });
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}
