import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson, validateDigest } from '@kdtp/execution-contract';
import {
  K6_GOVERNED_OUTPUT_ROOT_CONTRACT_ID,
  K6_GOVERNED_OUTPUT_ROOT_CONTRACT_SCHEMA_VERSION,
  K6_GOVERNED_OUTPUT_ROOT_CONTRACT_VERSION,
  K6_GOVERNED_OUTPUT_ROOT_IMPLEMENTATION_STATUS,
  K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES,
  K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_TRANSITIONS,
  K6_GOVERNED_OUTPUT_ROOT_LOGICAL_NAME,
  K6_GOVERNED_OUTPUT_ROOT_OWNERSHIP,
  K6_GOVERNED_OUTPUT_ROOT_POLICY_SCHEMA_VERSION,
  K6_GOVERNED_OUTPUT_ROOT_ROLE,
  K6_OUTPUT_ARTIFACT_DESCRIPTOR_ID,
  K6_OUTPUT_ARTIFACT_DESCRIPTOR_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_ENCODING,
  K6_OUTPUT_ARTIFACT_KIND,
  K6_OUTPUT_ARTIFACT_MEDIA_TYPE,
  K6_OUTPUT_ARTIFACT_RELATIVE_PATH,
  K6_OUTPUT_ROOT_LIMITS,
} from './constants.js';
import { outputRootInvariant } from './errors.js';
import {
  computeK6ApiInvocationPlanDigest,
  computeK6ApiRuntimeAdmissionEvidenceDigest,
  computeK6ApiRuntimeAdmissionRequestDigest,
  validateK6ApiRuntimePolicy,
} from './runtime-admission.js';
import {
  computeK6RuntimeExecutionEvidenceDigest,
  validateK6RuntimeExecutionEvidenceShape,
} from './runtime-result-contracts.js';

const ROOT_CONTRACT_ID = /^k6output-root-contract-[a-f0-9]{20}$/u;
const SAFE_SEGMENT = /^[a-z0-9][a-z0-9._-]{0,127}$/u;

const POLICY_FIELDS = Object.freeze([
  'schemaVersion', 'policyId', 'version', 'implementationStatus',
  'ownership', 'role', 'logicalName', 'hostPathIncluded',
  'callerPathAccepted', 'absolutePathAccepted', 'recursiveDiscoveryAllowed',
  'regularFilesOnly', 'symbolicLinksAllowed', 'hardLinksAllowed',
  'specialFilesAllowed', 'sourceBundleMutationAllowed', 'limits',
  'policyDigest',
]);
const LIMIT_FIELDS = Object.freeze([
  'maxFiles', 'maxFileBytes', 'maxTotalBytes', 'maxJsonDepth',
  'maxCollectionDurationMs',
]);
const DESCRIPTOR_FIELDS = Object.freeze([
  'schemaVersion', 'descriptorId', 'kind', 'relativePath', 'mediaType',
  'encoding', 'required', 'regularFileRequired', 'symbolicLinkAllowed',
  'hardLinkAllowed', 'specialFileAllowed', 'maxBytes', 'parser',
  'descriptorDigest',
]);
const PARSER_FIELDS = Object.freeze([
  'kind', 'maxDepth', 'duplicateKeyPolicy', 'bomAllowed',
]);
const CONTRACT_FIELDS = Object.freeze([
  'schemaVersion', 'rootContractId', 'contractVersion',
  'implementationStatus', 'predecessor', 'policyDigest', 'artifacts',
  'lifecycle', 'effects', 'contractDigest',
]);
const PREDECESSOR_FIELDS = Object.freeze([
  'runtimePolicyDigest', 'runtimeAdmissionRequestDigest',
  'invocationPlanDigest', 'runtimeAdmissionEvidenceDigest',
  'runtimeExecutionEvidenceDigest', 'sourceBundleDigest', 'sourceDigest',
  'runtimeOutcomeDigest',
]);
const LIFECYCLE_FIELDS = Object.freeze([
  'initialState', 'currentState', 'states', 'transitions',
  'allocationAuthorized', 'collectionAuthorized', 'cleanupAuthorized',
]);
const TRANSITION_FIELDS = Object.freeze(['from', 'to']);
const EFFECT_FIELDS = Object.freeze([
  'directoryAllocated', 'fileOpened', 'fileRead', 'fileWritten',
  'processBoundaryChanged',
]);

export const K6_OUTPUT_ROOT_P1_DECISION = deepFreeze({
  outputRootContractReady: true,
  outputRootSchemaCatalogReady: true,
  logicalRootIdentityDefined: true,
  artifactDescriptorsDefined: true,
  lifecycleGrammarDefined: true,
  governedOutputRootImplemented: false,
  outputDirectoryCreated: false,
  outputDirectoryAllocated: false,
  filesystemPortImplemented: false,
  fileResultCollectionSupported: false,
  fileResultCollectionImplemented: false,
  nextRequiredSlice: 'M3-R4-P2',
  repositoryBlockers: [],
});

export const K6_OUTPUT_ROOT_P1_SAFETY_BOUNDARY = deepFreeze({
  outputDirectoryCreated: false,
  outputDirectoryAllocated: false,
  filesystemPortImplemented: false,
  fileOpened: false,
  fileRead: false,
  fileWritten: false,
  arbitraryFileReadEnabled: false,
  callerPathAccepted: false,
  absolutePathAccepted: false,
  sourceBundleMutated: false,
  invocationPlanModified: false,
  nodeProcessAdapterModified: false,
  newProcessPrimitiveAdded: false,
  k6Invoked: false,
  xk6Invoked: false,
  playwrightInvoked: false,
  realExternalProcessStartedInCi: false,
  targetNetworkAccessed: false,
  databaseAccessed: false,
  secretAccessed: false,
  filesystemCredentialAccessed: false,
  rawStdoutCollected: false,
  rawStderrCollected: false,
  numericPidExposed: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  containerExecutionAdded: false,
  kubernetesExecutionAdded: false,
  remoteExecutionApiAdded: false,
  allureImplemented: false,
  m4Started: false,
});

export function createK6GovernedOutputRootPolicy() {
  const withoutDigest = {
    schemaVersion: K6_GOVERNED_OUTPUT_ROOT_POLICY_SCHEMA_VERSION,
    policyId: K6_GOVERNED_OUTPUT_ROOT_CONTRACT_ID,
    version: K6_GOVERNED_OUTPUT_ROOT_CONTRACT_VERSION,
    implementationStatus: K6_GOVERNED_OUTPUT_ROOT_IMPLEMENTATION_STATUS,
    ownership: K6_GOVERNED_OUTPUT_ROOT_OWNERSHIP,
    role: K6_GOVERNED_OUTPUT_ROOT_ROLE,
    logicalName: K6_GOVERNED_OUTPUT_ROOT_LOGICAL_NAME,
    hostPathIncluded: false,
    callerPathAccepted: false,
    absolutePathAccepted: false,
    recursiveDiscoveryAllowed: false,
    regularFilesOnly: true,
    symbolicLinksAllowed: false,
    hardLinksAllowed: false,
    specialFilesAllowed: false,
    sourceBundleMutationAllowed: false,
    limits: cloneExecutionJson(K6_OUTPUT_ROOT_LIMITS),
  };
  return freezeWithDigest(withoutDigest, 'policyDigest');
}

export function validateK6GovernedOutputRootPolicy(input) {
  validatePolicyShape(input);
  const expected = createK6GovernedOutputRootPolicy();
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ROOT_POLICY_MISMATCH',
    'Output-root policy does not match the fixed M3-R4-P1 contract');
  return expected;
}

export function computeK6GovernedOutputRootPolicyDigest(input) {
  validatePolicyShape(input, false);
  return digestWithout(input, 'policyDigest');
}

export function createK6OutputArtifactDescriptor() {
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_DESCRIPTOR_SCHEMA_VERSION,
    descriptorId: K6_OUTPUT_ARTIFACT_DESCRIPTOR_ID,
    kind: K6_OUTPUT_ARTIFACT_KIND,
    relativePath: validateK6OutputArtifactRelativePath(K6_OUTPUT_ARTIFACT_RELATIVE_PATH),
    mediaType: K6_OUTPUT_ARTIFACT_MEDIA_TYPE,
    encoding: K6_OUTPUT_ARTIFACT_ENCODING,
    required: true,
    regularFileRequired: true,
    symbolicLinkAllowed: false,
    hardLinkAllowed: false,
    specialFileAllowed: false,
    maxBytes: K6_OUTPUT_ROOT_LIMITS.maxFileBytes,
    parser: {
      kind: 'JSON',
      maxDepth: K6_OUTPUT_ROOT_LIMITS.maxJsonDepth,
      duplicateKeyPolicy: 'REJECT',
      bomAllowed: false,
    },
  };
  return freezeWithDigest(withoutDigest, 'descriptorDigest');
}

export function validateK6OutputArtifactDescriptor(input) {
  validateDescriptorShape(input);
  const expected = createK6OutputArtifactDescriptor();
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ARTIFACT_DESCRIPTOR_MISMATCH',
    'Output artifact descriptor does not match the fixed allow-list');
  return expected;
}

export function computeK6OutputArtifactDescriptorDigest(input) {
  validateDescriptorShape(input, false);
  return digestWithout(input, 'descriptorDigest');
}

export function validateK6OutputArtifactRelativePath(value) {
  outputRootInvariant(typeof value === 'string' && value.length > 0 && value.length <= 512,
    'INVALID_K6_OUTPUT_ARTIFACT_PATH', 'Output artifact path must be bounded text');
  outputRootInvariant(value === value.normalize('NFC'),
    'INVALID_K6_OUTPUT_ARTIFACT_PATH', 'Output artifact path must be NFC-normalized');
  outputRootInvariant(!value.startsWith('/') && !value.endsWith('/')
      && !value.includes('\\') && !value.includes('\0')
      && !/^[a-z][a-z0-9+.-]*:/iu.test(value)
      && !/^[a-z]:/iu.test(value),
  'INVALID_K6_OUTPUT_ARTIFACT_PATH',
  'Output artifact path must be a normalized repository-style relative path');
  const segments = value.split('/');
  outputRootInvariant(segments.length > 1
      && segments.every((segment) => segment !== '.' && segment !== '..'
        && SAFE_SEGMENT.test(segment)),
  'INVALID_K6_OUTPUT_ARTIFACT_PATH',
  'Output artifact path contains an unsafe segment');
  return value;
}

export function createK6GovernedOutputRootContract(bindings) {
  const normalized = validateAcceptedOutputRootBindings(bindings);
  const outputRootPolicy = normalized.outputRootPolicy;
  const artifact = createK6OutputArtifactDescriptor();
  const predecessor = {
    runtimePolicyDigest: normalized.admissionRequest.runtimePolicyDigest,
    runtimeAdmissionRequestDigest: normalized.admissionRequest.admissionDigest,
    invocationPlanDigest: normalized.invocationPlan.planDigest,
    runtimeAdmissionEvidenceDigest: normalized.admissionEvidence.evidenceDigest,
    runtimeExecutionEvidenceDigest: normalized.runtimeEvidence.evidenceDigest,
    sourceBundleDigest: normalized.admissionRequest.source.bundleDigest,
    sourceDigest: normalized.admissionRequest.source.sourceDigest,
    runtimeOutcomeDigest: normalized.runtimeEvidence.outcomeDigest,
  };
  const artifactDescriptorDigests = [artifact.descriptorDigest];
  const rootContractId = `k6output-root-contract-${sha256({
    predecessor,
    policyDigest: outputRootPolicy.policyDigest,
    artifactDescriptorDigests,
  }).slice(0, 20)}`;
  const withoutDigest = {
    schemaVersion: K6_GOVERNED_OUTPUT_ROOT_CONTRACT_SCHEMA_VERSION,
    rootContractId,
    contractVersion: K6_GOVERNED_OUTPUT_ROOT_CONTRACT_VERSION,
    implementationStatus: K6_GOVERNED_OUTPUT_ROOT_IMPLEMENTATION_STATUS,
    predecessor,
    policyDigest: outputRootPolicy.policyDigest,
    artifacts: [artifact],
    lifecycle: {
      initialState: 'DECLARED',
      currentState: 'DECLARED',
      states: [...K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES],
      transitions: K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_TRANSITIONS
        .map((transition) => ({ ...transition })),
      allocationAuthorized: false,
      collectionAuthorized: false,
      cleanupAuthorized: false,
    },
    effects: {
      directoryAllocated: false,
      fileOpened: false,
      fileRead: false,
      fileWritten: false,
      processBoundaryChanged: false,
    },
  };
  const contract = freezeWithDigest(withoutDigest, 'contractDigest');
  validateContractShape(contract);
  return contract;
}

export function validateK6GovernedOutputRootContract(input, bindings) {
  validateContractShape(input);
  const expected = createK6GovernedOutputRootContract(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ROOT_CONTRACT_MISMATCH',
    'Output-root contract does not match its immutable predecessor chain');
  return expected;
}

export function computeK6GovernedOutputRootContractDigest(input) {
  validateContractShape(input, false);
  return digestWithout(input, 'contractDigest');
}

export function validateK6GovernedOutputRootContractShape(input, requireDigest = true) {
  return validateContractShape(input, requireDigest);
}

function validateAcceptedOutputRootBindings(bindings) {
  exactFields(bindings, [
    'outputRootPolicy', 'runtimePolicy', 'admissionRequest', 'invocationPlan',
    'admissionEvidence', 'runtimeEvidence',
  ], 'INVALID_K6_OUTPUT_ROOT_BINDINGS', 'Output-root predecessor bindings');
  const outputRootPolicy = validateK6GovernedOutputRootPolicy(bindings.outputRootPolicy);
  const runtimePolicy = validateK6ApiRuntimePolicy(bindings.runtimePolicy);
  const admissionRequest = cloneExecutionJson(bindings.admissionRequest);
  const invocationPlan = cloneExecutionJson(bindings.invocationPlan);
  const admissionEvidence = cloneExecutionJson(bindings.admissionEvidence);
  const runtimeEvidence = cloneExecutionJson(bindings.runtimeEvidence);

  outputRootInvariant(
    computeK6ApiRuntimeAdmissionRequestDigest(admissionRequest)
      === admissionRequest.admissionDigest
      && admissionRequest.runtimePolicyDigest === runtimePolicy.policyDigest,
    'K6_OUTPUT_ROOT_ADMISSION_BINDING_MISMATCH',
    'Output-root contract requires an accepted Runtime Admission Request');
  outputRootInvariant(
    computeK6ApiInvocationPlanDigest(invocationPlan) === invocationPlan.planDigest
      && invocationPlan.admissionId === admissionRequest.admissionId
      && invocationPlan.admissionDigest === admissionRequest.admissionDigest,
    'K6_OUTPUT_ROOT_INVOCATION_BINDING_MISMATCH',
    'Output-root contract requires an accepted Invocation Plan');
  outputRootInvariant(
    computeK6ApiRuntimeAdmissionEvidenceDigest(admissionEvidence)
      === admissionEvidence.evidenceDigest
      && admissionEvidence.admissionId === admissionRequest.admissionId
      && admissionEvidence.admissionDigest === admissionRequest.admissionDigest
      && admissionEvidence.planId === invocationPlan.planId
      && admissionEvidence.planDigest === invocationPlan.planDigest,
    'K6_OUTPUT_ROOT_ADMISSION_EVIDENCE_BINDING_MISMATCH',
    'Output-root contract requires accepted Runtime Admission Evidence');

  validateK6RuntimeExecutionEvidenceShape(runtimeEvidence);
  outputRootInvariant(
    computeK6RuntimeExecutionEvidenceDigest(runtimeEvidence)
      === runtimeEvidence.evidenceDigest
      && runtimeEvidence.predecessor.runtimePolicyDigest
        === admissionRequest.runtimePolicyDigest
      && runtimeEvidence.predecessor.runtimeAdmissionRequestDigest
        === admissionRequest.admissionDigest
      && runtimeEvidence.predecessor.invocationPlanDigest === invocationPlan.planDigest
      && runtimeEvidence.predecessor.runtimeAdmissionEvidenceDigest
        === admissionEvidence.evidenceDigest
      && runtimeEvidence.fileResultCollection.supported === false
      && runtimeEvidence.fileResultCollection.implemented === false
      && runtimeEvidence.fileResultCollection.sourceBundleRemainsImmutable === true
      && runtimeEvidence.fileResultCollection.callerPathAccepted === false
      && runtimeEvidence.fileResultCollection.arbitraryFileReadEnabled === false
      && runtimeEvidence.resultSources.fileResultPresent === false,
    'K6_OUTPUT_ROOT_RUNTIME_EVIDENCE_BINDING_MISMATCH',
    'Output-root contract requires the accepted deferred file-result decision');

  outputRootInvariant(
    invocationPlan.outputArtifactKinds.length === 1
      && invocationPlan.outputArtifactKinds[0] === K6_OUTPUT_ARTIFACT_KIND
      && invocationPlan.argv.includes(K6_OUTPUT_ARTIFACT_RELATIVE_PATH),
    'K6_OUTPUT_ROOT_ARTIFACT_BINDING_MISMATCH',
    'Output-root artifact descriptor is not bound to the accepted Invocation Plan');

  return deepFreeze({
    outputRootPolicy,
    runtimePolicy,
    admissionRequest,
    invocationPlan,
    admissionEvidence,
    runtimeEvidence,
  });
}

function validatePolicyShape(input, requireDigest = true) {
  exactFields(input, POLICY_FIELDS, 'INVALID_K6_OUTPUT_ROOT_POLICY', 'Output-root policy');
  exactFields(input.limits, LIMIT_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_POLICY', 'Output-root limits');
  outputRootInvariant(
    input.schemaVersion === K6_GOVERNED_OUTPUT_ROOT_POLICY_SCHEMA_VERSION
      && input.policyId === K6_GOVERNED_OUTPUT_ROOT_CONTRACT_ID
      && input.version === K6_GOVERNED_OUTPUT_ROOT_CONTRACT_VERSION
      && input.implementationStatus === K6_GOVERNED_OUTPUT_ROOT_IMPLEMENTATION_STATUS
      && input.ownership === K6_GOVERNED_OUTPUT_ROOT_OWNERSHIP
      && input.role === K6_GOVERNED_OUTPUT_ROOT_ROLE
      && input.logicalName === K6_GOVERNED_OUTPUT_ROOT_LOGICAL_NAME
      && input.hostPathIncluded === false
      && input.callerPathAccepted === false
      && input.absolutePathAccepted === false
      && input.recursiveDiscoveryAllowed === false
      && input.regularFilesOnly === true
      && input.symbolicLinksAllowed === false
      && input.hardLinksAllowed === false
      && input.specialFilesAllowed === false
      && input.sourceBundleMutationAllowed === false
      && canonicalStringify(input.limits) === canonicalStringify(K6_OUTPUT_ROOT_LIMITS),
    'K6_OUTPUT_ROOT_POLICY_INVALID',
    'Output-root policy violates the frozen contract boundary');
  if (requireDigest) {
    validateDigest(input.policyDigest, 'outputRootPolicy.policyDigest');
    outputRootInvariant(digestWithout(input, 'policyDigest') === input.policyDigest,
      'K6_OUTPUT_ROOT_POLICY_DIGEST_MISMATCH',
      'Output-root policy digest is invalid');
  }
  return input;
}

function validateDescriptorShape(input, requireDigest = true) {
  exactFields(input, DESCRIPTOR_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_DESCRIPTOR', 'Output artifact descriptor');
  exactFields(input.parser, PARSER_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_DESCRIPTOR', 'Output artifact parser');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_DESCRIPTOR_SCHEMA_VERSION
      && input.descriptorId === K6_OUTPUT_ARTIFACT_DESCRIPTOR_ID
      && input.kind === K6_OUTPUT_ARTIFACT_KIND
      && validateK6OutputArtifactRelativePath(input.relativePath)
        === K6_OUTPUT_ARTIFACT_RELATIVE_PATH
      && input.mediaType === K6_OUTPUT_ARTIFACT_MEDIA_TYPE
      && input.encoding === K6_OUTPUT_ARTIFACT_ENCODING
      && input.required === true
      && input.regularFileRequired === true
      && input.symbolicLinkAllowed === false
      && input.hardLinkAllowed === false
      && input.specialFileAllowed === false
      && input.maxBytes === K6_OUTPUT_ROOT_LIMITS.maxFileBytes
      && input.parser.kind === 'JSON'
      && input.parser.maxDepth === K6_OUTPUT_ROOT_LIMITS.maxJsonDepth
      && input.parser.duplicateKeyPolicy === 'REJECT'
      && input.parser.bomAllowed === false,
    'K6_OUTPUT_ARTIFACT_DESCRIPTOR_INVALID',
    'Output artifact descriptor violates the frozen allow-list');
  if (requireDigest) {
    validateDigest(input.descriptorDigest, 'outputArtifact.descriptorDigest');
    outputRootInvariant(digestWithout(input, 'descriptorDigest') === input.descriptorDigest,
      'K6_OUTPUT_ARTIFACT_DESCRIPTOR_DIGEST_MISMATCH',
      'Output artifact descriptor digest is invalid');
  }
  return input;
}

function validateContractShape(input, requireDigest = true) {
  exactFields(input, CONTRACT_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_CONTRACT', 'Output-root contract');
  exactFields(input.predecessor, PREDECESSOR_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_CONTRACT', 'Output-root predecessor');
  exactFields(input.lifecycle, LIFECYCLE_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_CONTRACT', 'Output-root lifecycle');
  exactFields(input.effects, EFFECT_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_CONTRACT', 'Output-root effects');
  for (const digest of Object.values(input.predecessor)) validateDigest(digest, 'predecessor');
  validateDigest(input.policyDigest, 'outputRootContract.policyDigest');
  outputRootInvariant(Array.isArray(input.artifacts) && input.artifacts.length === 1,
    'K6_OUTPUT_ROOT_ARTIFACT_SET_INVALID',
    'Output-root contract must contain the exact one-item artifact allow-list');
  const artifacts = input.artifacts.map(validateK6OutputArtifactDescriptor);
  const normalizedPaths = artifacts.map(({ relativePath }) =>
    validateK6OutputArtifactRelativePath(relativePath).normalize('NFC').toLowerCase());
  outputRootInvariant(new Set(normalizedPaths).size === normalizedPaths.length,
    'K6_OUTPUT_ROOT_ARTIFACT_PATH_COLLISION',
    'Output-root artifact paths collide after normalization');
  outputRootInvariant(Array.isArray(input.lifecycle.states)
      && canonicalStringify(input.lifecycle.states)
        === canonicalStringify(K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES)
      && Array.isArray(input.lifecycle.transitions)
      && canonicalStringify(input.lifecycle.transitions)
        === canonicalStringify(K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_TRANSITIONS),
  'K6_OUTPUT_ROOT_LIFECYCLE_INVALID',
  'Output-root lifecycle grammar is not the fixed P1 state machine');
  input.lifecycle.transitions.forEach((transition) => exactFields(
    transition, TRANSITION_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_CONTRACT', 'Output-root lifecycle transition'));
  outputRootInvariant(
    input.schemaVersion === K6_GOVERNED_OUTPUT_ROOT_CONTRACT_SCHEMA_VERSION
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && input.contractVersion === K6_GOVERNED_OUTPUT_ROOT_CONTRACT_VERSION
      && input.implementationStatus === K6_GOVERNED_OUTPUT_ROOT_IMPLEMENTATION_STATUS
      && input.lifecycle.initialState === 'DECLARED'
      && input.lifecycle.currentState === 'DECLARED'
      && input.lifecycle.allocationAuthorized === false
      && input.lifecycle.collectionAuthorized === false
      && input.lifecycle.cleanupAuthorized === false
      && Object.values(input.effects).every((value) => value === false)
      && input.rootContractId === `k6output-root-contract-${sha256({
        predecessor: input.predecessor,
        policyDigest: input.policyDigest,
        artifactDescriptorDigests: artifacts.map(({ descriptorDigest }) => descriptorDigest),
      }).slice(0, 20)}`,
    'K6_OUTPUT_ROOT_CONTRACT_INVALID',
    'Output-root contract violates the closed contract-only boundary');
  if (requireDigest) {
    validateDigest(input.contractDigest, 'outputRootContract.contractDigest');
    outputRootInvariant(digestWithout(input, 'contractDigest') === input.contractDigest,
      'K6_OUTPUT_ROOT_CONTRACT_DIGEST_MISMATCH',
      'Output-root contract digest is invalid');
  }
  return input;
}

function exactFields(input, fields, code, label) {
  outputRootInvariant(input && typeof input === 'object' && !Array.isArray(input),
    code, `${label} must be an object`);
  const actual = Object.keys(input).sort();
  const expected = [...fields].sort();
  outputRootInvariant(canonicalStringify(actual) === canonicalStringify(expected),
    code, `${label} fields are invalid`);
}

function digestWithout(input, field) {
  const clone = cloneExecutionJson(input);
  delete clone[field];
  return sha256(clone);
}

function freezeWithDigest(withoutDigest, field) {
  return deepFreeze(cloneExecutionJson({
    ...withoutDigest,
    [field]: sha256(withoutDigest),
  }));
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
