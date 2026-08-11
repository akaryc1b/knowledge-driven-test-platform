import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson, validateDigest } from '@kdtp/execution-contract';
import {
  K6OutputRootContractError,
  outputRootInvariant,
} from './errors.js';
import {
  createK6OutputArtifactDescriptor,
  validateK6GovernedOutputRootContract,
  validateK6OutputArtifactDescriptor,
} from './output-root-contracts.js';

export const K6_TRUSTED_OUTPUT_ROOT_PORT_SCHEMA_VERSION =
  'k6-trusted-output-root-port/v1';
export const K6_OUTPUT_ROOT_ALLOCATION_REQUEST_SCHEMA_VERSION =
  'k6-output-root-allocation-request/v1';
export const K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_SCHEMA_VERSION =
  'k6-output-root-allocation-receipt/v1';
export const K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_SCHEMA_VERSION =
  'k6-output-artifact-resolution-request/v1';
export const K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_SCHEMA_VERSION =
  'k6-output-artifact-resolution-receipt/v1';
export const K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_SCHEMA_VERSION =
  'k6-trusted-output-root-boundary-evidence/v1';
export const K6_TRUSTED_OUTPUT_ROOT_PORT_ID = 'k6-trusted-output-root-port';
export const K6_TRUSTED_OUTPUT_ROOT_PORT_VERSION = '1.0.0';

const PORT_FIELDS = Object.freeze([
  'schemaVersion', 'portId', 'portVersion', 'implementationStatus',
  'ownership', 'capabilities', 'portDigest',
]);
const CAPABILITY_FIELDS = Object.freeze([
  'allocateLogicalRoot', 'resolveDeclaredArtifact', 'createRealDirectory',
  'accessRealFilesystem', 'returnHostPath', 'openFile', 'readFile',
  'writeFile', 'recursivelyDiscover',
]);
const ALLOCATION_REQUEST_FIELDS = Object.freeze([
  'schemaVersion', 'requestId', 'portDigest', 'rootContractId',
  'rootContractDigest', 'policyDigest', 'artifactDescriptorDigests',
  'logicalName', 'ownership', 'role', 'transition', 'callerPathAccepted',
  'absolutePathAccepted', 'hostPathIncluded', 'sourceBundleMutationAllowed',
  'requestDigest',
]);
const TRANSITION_FIELDS = Object.freeze(['from', 'to']);
const ALLOCATION_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'portId', 'portDigest',
  'allocationRequestDigest', 'rootContractId', 'allocationHandle',
  'accepted', 'delegated', 'logicalRootAllocated', 'currentState',
  'realDirectoryCreated', 'realFilesystemAccessed', 'hostPathIncluded',
  'callerPathAccepted', 'sourceBundleMutated', 'receiptDigest',
]);
const RESOLUTION_REQUEST_FIELDS = Object.freeze([
  'schemaVersion', 'requestId', 'portDigest', 'rootContractId',
  'rootContractDigest', 'allocationRequestDigest', 'allocationReceiptDigest',
  'allocationHandle', 'descriptorId', 'descriptorDigest', 'kind',
  'relativePath', 'required', 'regularFileRequired', 'symbolicLinkAllowed',
  'hardLinkAllowed', 'specialFileAllowed', 'openAuthorized',
  'readAuthorized', 'writeAuthorized', 'requestDigest',
]);
const RESOLUTION_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'portId', 'portDigest',
  'resolutionRequestDigest', 'allocationHandle', 'artifactHandle',
  'descriptorDigest', 'relativePath', 'accepted', 'delegated', 'resolved',
  'opaqueHandleReturned', 'regularFileVerified', 'objectOpened', 'fileRead',
  'fileWritten', 'realFilesystemAccessed', 'hostPathIncluded',
  'receiptDigest',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'portDigest', 'rootContractId',
  'rootContractDigest', 'allocationRequestDigest', 'allocationReceiptDigest',
  'resolutionRequestDigest', 'resolutionReceiptDigest', 'lifecycle',
  'artifact', 'decision', 'safetyBoundary', 'evidenceDigest',
]);
const LIFECYCLE_FIELDS = Object.freeze([
  'initialState', 'currentState', 'logicalAllocationCompleted',
  'realDirectoryCreated', 'sealed', 'collectionAuthorized',
  'cleanupAuthorized',
]);
const ARTIFACT_FIELDS = Object.freeze([
  'descriptorId', 'descriptorDigest', 'kind', 'relativePath',
  'allocationHandle', 'artifactHandle', 'resolved', 'regularFileVerified',
  'opened', 'read', 'written',
]);
const PORT_ID = /^k6-trusted-output-root-port$/u;
const ROOT_CONTRACT_ID = /^k6output-root-contract-[a-f0-9]{20}$/u;
const ALLOCATION_REQUEST_ID = /^k6root-allocation-[a-f0-9]{20}$/u;
const ALLOCATION_RECEIPT_ID =
  /^k6root-allocation-receipt-[a-f0-9]{20}$/u;
const ALLOCATION_HANDLE = /^k6root-handle-[a-f0-9]{20}$/u;
const RESOLUTION_REQUEST_ID = /^k6artifact-resolution-[a-f0-9]{20}$/u;
const RESOLUTION_RECEIPT_ID =
  /^k6artifact-resolution-receipt-[a-f0-9]{20}$/u;
const ARTIFACT_HANDLE = /^k6artifact-handle-[a-f0-9]{20}$/u;
const EVIDENCE_ID = /^k6output-root-port-[a-f0-9]{20}$/u;

export const K6_OUTPUT_ROOT_P2_DECISION = deepFreeze({
  trustedOutputRootPortReady: true,
  logicalRootAllocationSupported: true,
  logicalRootAllocated: true,
  exactArtifactResolutionSupported: true,
  exactArtifactResolved: true,
  realFilesystemPortImplemented: false,
  outputDirectoryCreated: false,
  fileResultCollectionSupported: false,
  fileResultCollectionImplemented: false,
  nextRequiredSlice: 'M3-R4-P3',
  repositoryBlockers: [],
});

export const K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY = deepFreeze({
  callerPathAccepted: false,
  absolutePathAccepted: false,
  hostPathIncluded: false,
  hostPathResolved: false,
  realDirectoryCreated: false,
  realFilesystemAccessed: false,
  fileOpened: false,
  fileRead: false,
  fileWritten: false,
  recursiveDiscoveryPerformed: false,
  symbolicLinkFollowed: false,
  hardLinkTrusted: false,
  specialFileAccepted: false,
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

export function createK6TrustedOutputRootPortDescriptor() {
  const withoutDigest = {
    schemaVersion: K6_TRUSTED_OUTPUT_ROOT_PORT_SCHEMA_VERSION,
    portId: K6_TRUSTED_OUTPUT_ROOT_PORT_ID,
    portVersion: K6_TRUSTED_OUTPUT_ROOT_PORT_VERSION,
    implementationStatus: 'INJECTED_FAKE_ONLY',
    ownership: 'PLATFORM_OWNED',
    capabilities: {
      allocateLogicalRoot: true,
      resolveDeclaredArtifact: true,
      createRealDirectory: false,
      accessRealFilesystem: false,
      returnHostPath: false,
      openFile: false,
      readFile: false,
      writeFile: false,
      recursivelyDiscover: false,
    },
  };
  return freezeWithDigest(withoutDigest, 'portDigest');
}

export function validateK6TrustedOutputRootPortDescriptor(input) {
  validatePortSelfConsistency(input);
  const expected = createK6TrustedOutputRootPortDescriptor();
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_TRUSTED_OUTPUT_ROOT_PORT_MISMATCH',
    'Trusted output-root port does not match the fixed fake-only contract');
  return expected;
}

export function computeK6TrustedOutputRootPortDigest(input) {
  validatePortSelfConsistency(input, false);
  return digestWithout(input, 'portDigest');
}

export function createK6OutputRootAllocationRequest({
  portDescriptor,
  rootContract,
  contractBindings,
}) {
  const port = validateK6TrustedOutputRootPortDescriptor(portDescriptor);
  const accepted = validateAcceptedP1(rootContract, contractBindings);
  const identity = {
    portDigest: port.portDigest,
    rootContractDigest: accepted.contract.contractDigest,
    artifactDescriptorDigests: [accepted.descriptor.descriptorDigest],
  };
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ROOT_ALLOCATION_REQUEST_SCHEMA_VERSION,
    requestId: `k6root-allocation-${sha256(identity).slice(0, 20)}`,
    portDigest: port.portDigest,
    rootContractId: accepted.contract.rootContractId,
    rootContractDigest: accepted.contract.contractDigest,
    policyDigest: accepted.contract.policyDigest,
    artifactDescriptorDigests: [accepted.descriptor.descriptorDigest],
    logicalName: 'execution-output-root',
    ownership: 'PLATFORM_OWNED',
    role: 'EXECUTION_SCOPED_WRITABLE_RESULTS',
    transition: { from: 'DECLARED', to: 'ALLOCATED' },
    callerPathAccepted: false,
    absolutePathAccepted: false,
    hostPathIncluded: false,
    sourceBundleMutationAllowed: false,
  };
  const request = freezeWithDigest(withoutDigest, 'requestDigest');
  validateAllocationRequestSelfConsistency(request);
  return request;
}

export function validateK6OutputRootAllocationRequest(input, bindings) {
  validateAllocationRequestSelfConsistency(input);
  const expected = createK6OutputRootAllocationRequest(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ROOT_ALLOCATION_REQUEST_MISMATCH',
    'Output-root allocation request does not match the accepted P1 contract');
  return expected;
}

export function computeK6OutputRootAllocationRequestDigest(input) {
  validateAllocationRequestSelfConsistency(input, false);
  return digestWithout(input, 'requestDigest');
}

export function createK6OutputRootAllocationReceipt(
  portDescriptor,
  allocationRequest,
) {
  const port = validateK6TrustedOutputRootPortDescriptor(portDescriptor);
  validateAllocationRequestSelfConsistency(allocationRequest);
  outputRootInvariant(allocationRequest.portDigest === port.portDigest,
    'K6_OUTPUT_ROOT_ALLOCATION_PORT_MISMATCH',
    'Allocation request is not bound to the injected port');
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_SCHEMA_VERSION,
    receiptId:
      `k6root-allocation-receipt-${allocationRequest.requestDigest.slice(0, 20)}`,
    portId: port.portId,
    portDigest: port.portDigest,
    allocationRequestDigest: allocationRequest.requestDigest,
    rootContractId: allocationRequest.rootContractId,
    allocationHandle:
      `k6root-handle-${allocationRequest.requestDigest.slice(0, 20)}`,
    accepted: true,
    delegated: true,
    logicalRootAllocated: true,
    currentState: 'ALLOCATED',
    realDirectoryCreated: false,
    realFilesystemAccessed: false,
    hostPathIncluded: false,
    callerPathAccepted: false,
    sourceBundleMutated: false,
  };
  const receipt = freezeWithDigest(withoutDigest, 'receiptDigest');
  validateAllocationReceiptSelfConsistency(receipt);
  return receipt;
}

export function validateK6OutputRootAllocationReceipt(
  input,
  portDescriptor,
  allocationRequest,
) {
  validateAllocationReceiptSelfConsistency(input);
  const expected = createK6OutputRootAllocationReceipt(
    portDescriptor, allocationRequest);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_MISMATCH',
    'Injected output-root allocation receipt is not exact');
  return expected;
}

export function computeK6OutputRootAllocationReceiptDigest(input) {
  validateAllocationReceiptSelfConsistency(input, false);
  return digestWithout(input, 'receiptDigest');
}

export function createK6OutputArtifactResolutionRequest({
  portDescriptor,
  rootContract,
  contractBindings,
  allocationRequest,
  allocationReceipt,
}) {
  const port = validateK6TrustedOutputRootPortDescriptor(portDescriptor);
  const accepted = validateAcceptedP1(rootContract, contractBindings);
  const request = validateK6OutputRootAllocationRequest(allocationRequest, {
    portDescriptor: port,
    rootContract: accepted.contract,
    contractBindings,
  });
  const receipt = validateK6OutputRootAllocationReceipt(
    allocationReceipt, port, request);
  const descriptor = accepted.descriptor;
  const identity = {
    portDigest: port.portDigest,
    rootContractDigest: accepted.contract.contractDigest,
    allocationReceiptDigest: receipt.receiptDigest,
    descriptorDigest: descriptor.descriptorDigest,
  };
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_SCHEMA_VERSION,
    requestId: `k6artifact-resolution-${sha256(identity).slice(0, 20)}`,
    portDigest: port.portDigest,
    rootContractId: accepted.contract.rootContractId,
    rootContractDigest: accepted.contract.contractDigest,
    allocationRequestDigest: request.requestDigest,
    allocationReceiptDigest: receipt.receiptDigest,
    allocationHandle: receipt.allocationHandle,
    descriptorId: descriptor.descriptorId,
    descriptorDigest: descriptor.descriptorDigest,
    kind: descriptor.kind,
    relativePath: descriptor.relativePath,
    required: descriptor.required,
    regularFileRequired: descriptor.regularFileRequired,
    symbolicLinkAllowed: descriptor.symbolicLinkAllowed,
    hardLinkAllowed: descriptor.hardLinkAllowed,
    specialFileAllowed: descriptor.specialFileAllowed,
    openAuthorized: false,
    readAuthorized: false,
    writeAuthorized: false,
  };
  const resolution = freezeWithDigest(withoutDigest, 'requestDigest');
  validateResolutionRequestSelfConsistency(resolution);
  return resolution;
}

export function validateK6OutputArtifactResolutionRequest(input, bindings) {
  validateResolutionRequestSelfConsistency(input);
  const expected = createK6OutputArtifactResolutionRequest(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_MISMATCH',
    'Artifact resolution request does not match the exact P1 descriptor');
  return expected;
}

export function computeK6OutputArtifactResolutionRequestDigest(input) {
  validateResolutionRequestSelfConsistency(input, false);
  return digestWithout(input, 'requestDigest');
}

export function createK6OutputArtifactResolutionReceipt(
  portDescriptor,
  resolutionRequest,
) {
  const port = validateK6TrustedOutputRootPortDescriptor(portDescriptor);
  validateResolutionRequestSelfConsistency(resolutionRequest);
  outputRootInvariant(resolutionRequest.portDigest === port.portDigest,
    'K6_OUTPUT_ARTIFACT_RESOLUTION_PORT_MISMATCH',
    'Artifact resolution request is not bound to the injected port');
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_SCHEMA_VERSION,
    receiptId:
      `k6artifact-resolution-receipt-${resolutionRequest.requestDigest.slice(0, 20)}`,
    portId: port.portId,
    portDigest: port.portDigest,
    resolutionRequestDigest: resolutionRequest.requestDigest,
    allocationHandle: resolutionRequest.allocationHandle,
    artifactHandle:
      `k6artifact-handle-${resolutionRequest.requestDigest.slice(0, 20)}`,
    descriptorDigest: resolutionRequest.descriptorDigest,
    relativePath: resolutionRequest.relativePath,
    accepted: true,
    delegated: true,
    resolved: true,
    opaqueHandleReturned: true,
    regularFileVerified: false,
    objectOpened: false,
    fileRead: false,
    fileWritten: false,
    realFilesystemAccessed: false,
    hostPathIncluded: false,
  };
  const receipt = freezeWithDigest(withoutDigest, 'receiptDigest');
  validateResolutionReceiptSelfConsistency(receipt);
  return receipt;
}

export function validateK6OutputArtifactResolutionReceipt(
  input,
  portDescriptor,
  resolutionRequest,
) {
  validateResolutionReceiptSelfConsistency(input);
  const expected = createK6OutputArtifactResolutionReceipt(
    portDescriptor, resolutionRequest);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_MISMATCH',
    'Injected artifact resolution receipt is not exact');
  return expected;
}

export function computeK6OutputArtifactResolutionReceiptDigest(input) {
  validateResolutionReceiptSelfConsistency(input, false);
  return digestWithout(input, 'receiptDigest');
}

export function prepareK6TrustedOutputRoot({
  trustedOutputRootPort,
  rootContract,
  contractBindings,
}) {
  outputRootInvariant(trustedOutputRootPort
      && typeof trustedOutputRootPort === 'object',
  'K6_TRUSTED_OUTPUT_ROOT_PORT_UNAVAILABLE',
  'An injected TrustedOutputRootPort is required');
  outputRootInvariant(
    typeof trustedOutputRootPort.allocateRoot === 'function'
      && typeof trustedOutputRootPort.resolveArtifact === 'function',
    'K6_TRUSTED_OUTPUT_ROOT_PORT_UNAVAILABLE',
    'The injected port must allocate a logical root and resolve an artifact');
  const portDescriptor = validateK6TrustedOutputRootPortDescriptor(
    trustedOutputRootPort.descriptor);
  const allocationRequest = createK6OutputRootAllocationRequest({
    portDescriptor, rootContract, contractBindings,
  });
  const allocationReceipt = invokePort(
    trustedOutputRootPort,
    'allocateRoot',
    allocationRequest,
    'K6_TRUSTED_OUTPUT_ROOT_ALLOCATION_REJECTED',
    'The injected port rejected logical output-root allocation',
  );
  const acceptedAllocationReceipt = validateK6OutputRootAllocationReceipt(
    allocationReceipt, portDescriptor, allocationRequest);
  const resolutionRequest = createK6OutputArtifactResolutionRequest({
    portDescriptor,
    rootContract,
    contractBindings,
    allocationRequest,
    allocationReceipt: acceptedAllocationReceipt,
  });
  const resolutionReceipt = invokePort(
    trustedOutputRootPort,
    'resolveArtifact',
    resolutionRequest,
    'K6_TRUSTED_OUTPUT_ROOT_RESOLUTION_REJECTED',
    'The injected port rejected exact artifact resolution',
  );
  const acceptedResolutionReceipt = validateK6OutputArtifactResolutionReceipt(
    resolutionReceipt, portDescriptor, resolutionRequest);
  const boundaryEvidence = createK6TrustedOutputRootBoundaryEvidence({
    portDescriptor,
    rootContract,
    contractBindings,
    allocationRequest,
    allocationReceipt: acceptedAllocationReceipt,
    resolutionRequest,
    resolutionReceipt: acceptedResolutionReceipt,
  });
  return deepFreeze(cloneExecutionJson({
    portDescriptor,
    allocationRequest,
    allocationReceipt: acceptedAllocationReceipt,
    resolutionRequest,
    resolutionReceipt: acceptedResolutionReceipt,
    boundaryEvidence,
  }));
}

export function createK6TrustedOutputRootBoundaryEvidence({
  portDescriptor,
  rootContract,
  contractBindings,
  allocationRequest,
  allocationReceipt,
  resolutionRequest,
  resolutionReceipt,
}) {
  const port = validateK6TrustedOutputRootPortDescriptor(portDescriptor);
  const accepted = validateAcceptedP1(rootContract, contractBindings);
  const request = validateK6OutputRootAllocationRequest(allocationRequest, {
    portDescriptor: port,
    rootContract: accepted.contract,
    contractBindings,
  });
  const receipt = validateK6OutputRootAllocationReceipt(
    allocationReceipt, port, request);
  const artifactRequest = validateK6OutputArtifactResolutionRequest(
    resolutionRequest,
    {
      portDescriptor: port,
      rootContract: accepted.contract,
      contractBindings,
      allocationRequest: request,
      allocationReceipt: receipt,
    },
  );
  const artifactReceipt = validateK6OutputArtifactResolutionReceipt(
    resolutionReceipt, port, artifactRequest);
  const identity = {
    portDigest: port.portDigest,
    rootContractDigest: accepted.contract.contractDigest,
    allocationReceiptDigest: receipt.receiptDigest,
    resolutionReceiptDigest: artifactReceipt.receiptDigest,
  };
  const withoutDigest = {
    schemaVersion: K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6output-root-port-${sha256(identity).slice(0, 20)}`,
    portDigest: port.portDigest,
    rootContractId: accepted.contract.rootContractId,
    rootContractDigest: accepted.contract.contractDigest,
    allocationRequestDigest: request.requestDigest,
    allocationReceiptDigest: receipt.receiptDigest,
    resolutionRequestDigest: artifactRequest.requestDigest,
    resolutionReceiptDigest: artifactReceipt.receiptDigest,
    lifecycle: {
      initialState: 'DECLARED',
      currentState: 'ALLOCATED',
      logicalAllocationCompleted: true,
      realDirectoryCreated: false,
      sealed: false,
      collectionAuthorized: false,
      cleanupAuthorized: false,
    },
    artifact: {
      descriptorId: accepted.descriptor.descriptorId,
      descriptorDigest: accepted.descriptor.descriptorDigest,
      kind: accepted.descriptor.kind,
      relativePath: accepted.descriptor.relativePath,
      allocationHandle: receipt.allocationHandle,
      artifactHandle: artifactReceipt.artifactHandle,
      resolved: true,
      regularFileVerified: false,
      opened: false,
      read: false,
      written: false,
    },
    decision: cloneExecutionJson(K6_OUTPUT_ROOT_P2_DECISION),
    safetyBoundary: cloneExecutionJson(K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY),
  };
  const evidence = freezeWithDigest(withoutDigest, 'evidenceDigest');
  validateBoundaryEvidenceSelfConsistency(evidence);
  return evidence;
}

export function validateK6TrustedOutputRootBoundaryEvidence(input, bindings) {
  validateBoundaryEvidenceSelfConsistency(input);
  const expected = createK6TrustedOutputRootBoundaryEvidence(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_MISMATCH',
    'Trusted output-root boundary Evidence does not match its accepted chain');
  return expected;
}

export function computeK6TrustedOutputRootBoundaryEvidenceDigest(input) {
  validateBoundaryEvidenceSelfConsistency(input, false);
  return digestWithout(input, 'evidenceDigest');
}

function validateAcceptedP1(rootContract, contractBindings) {
  const contract = validateK6GovernedOutputRootContract(
    rootContract, contractBindings);
  outputRootInvariant(contract.artifacts.length === 1,
    'K6_OUTPUT_ROOT_P2_ARTIFACT_SET_MISMATCH',
    'P2 requires exactly one accepted P1 artifact descriptor');
  const descriptor = validateK6OutputArtifactDescriptor(contract.artifacts[0]);
  outputRootInvariant(
    contract.lifecycle.initialState === 'DECLARED'
      && contract.lifecycle.currentState === 'DECLARED'
      && contract.lifecycle.allocationAuthorized === false
      && contract.lifecycle.collectionAuthorized === false
      && contract.lifecycle.cleanupAuthorized === false
      && Object.values(contract.effects).every((value) => value === false),
    'K6_OUTPUT_ROOT_P1_PREDECESSOR_NOT_ACCEPTED',
    'P2 requires the accepted effect-free P1 output-root contract');
  return deepFreeze({
    contract: cloneExecutionJson(contract),
    descriptor: cloneExecutionJson(descriptor),
  });
}

function invokePort(port, method, request, code, message) {
  try {
    return port[method](deepFreeze(cloneExecutionJson(request)));
  } catch (error) {
    throw new K6OutputRootContractError(code, message, {
      causeName: typeof error?.name === 'string' ? error.name : 'Error',
    });
  }
}

function validatePortSelfConsistency(input, requireDigest = true) {
  exactFields(input, PORT_FIELDS,
    'INVALID_K6_TRUSTED_OUTPUT_ROOT_PORT', 'Trusted output-root port');
  exactFields(input.capabilities, CAPABILITY_FIELDS,
    'INVALID_K6_TRUSTED_OUTPUT_ROOT_PORT', 'Trusted output-root capabilities');
  outputRootInvariant(
    input.schemaVersion === K6_TRUSTED_OUTPUT_ROOT_PORT_SCHEMA_VERSION
      && PORT_ID.test(input.portId)
      && input.portVersion === K6_TRUSTED_OUTPUT_ROOT_PORT_VERSION
      && input.implementationStatus === 'INJECTED_FAKE_ONLY'
      && input.ownership === 'PLATFORM_OWNED'
      && input.capabilities.allocateLogicalRoot === true
      && input.capabilities.resolveDeclaredArtifact === true
      && input.capabilities.createRealDirectory === false
      && input.capabilities.accessRealFilesystem === false
      && input.capabilities.returnHostPath === false
      && input.capabilities.openFile === false
      && input.capabilities.readFile === false
      && input.capabilities.writeFile === false
      && input.capabilities.recursivelyDiscover === false,
    'K6_TRUSTED_OUTPUT_ROOT_PORT_ESCALATION',
    'Trusted output-root port widens the fake-only boundary');
  validateOwnDigest(input, 'portDigest', requireDigest,
    'Trusted output-root port');
  return input;
}

function validateAllocationRequestSelfConsistency(input, requireDigest = true) {
  exactFields(input, ALLOCATION_REQUEST_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_ALLOCATION_REQUEST', 'Allocation request');
  exactFields(input.transition, TRANSITION_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_ALLOCATION_REQUEST', 'Allocation transition');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ROOT_ALLOCATION_REQUEST_SCHEMA_VERSION
      && ALLOCATION_REQUEST_ID.test(input.requestId)
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && Array.isArray(input.artifactDescriptorDigests)
      && input.artifactDescriptorDigests.length === 1
      && input.logicalName === 'execution-output-root'
      && input.ownership === 'PLATFORM_OWNED'
      && input.role === 'EXECUTION_SCOPED_WRITABLE_RESULTS'
      && input.transition.from === 'DECLARED'
      && input.transition.to === 'ALLOCATED'
      && input.callerPathAccepted === false
      && input.absolutePathAccepted === false
      && input.hostPathIncluded === false
      && input.sourceBundleMutationAllowed === false,
    'K6_OUTPUT_ROOT_ALLOCATION_REQUEST_ESCALATION',
    'Allocation request widens the fixed P2 boundary');
  for (const [field, value] of [
    ['portDigest', input.portDigest],
    ['rootContractDigest', input.rootContractDigest],
    ['policyDigest', input.policyDigest],
    ['artifactDescriptorDigests[0]', input.artifactDescriptorDigests[0]],
  ]) validateDigest(value, `allocationRequest.${field}`);
  validateOwnDigest(input, 'requestDigest', requireDigest,
    'Output-root allocation request');
  return input;
}

function validateAllocationReceiptSelfConsistency(input, requireDigest = true) {
  exactFields(input, ALLOCATION_RECEIPT_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_ALLOCATION_RECEIPT', 'Allocation receipt');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_SCHEMA_VERSION
      && ALLOCATION_RECEIPT_ID.test(input.receiptId)
      && PORT_ID.test(input.portId)
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && ALLOCATION_HANDLE.test(input.allocationHandle)
      && input.accepted === true
      && input.delegated === true
      && input.logicalRootAllocated === true
      && input.currentState === 'ALLOCATED'
      && input.realDirectoryCreated === false
      && input.realFilesystemAccessed === false
      && input.hostPathIncluded === false
      && input.callerPathAccepted === false
      && input.sourceBundleMutated === false,
    'K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_ESCALATION',
    'Allocation receipt reports an unsupported host effect');
  for (const [field, value] of [
    ['portDigest', input.portDigest],
    ['allocationRequestDigest', input.allocationRequestDigest],
  ]) validateDigest(value, `allocationReceipt.${field}`);
  validateOwnDigest(input, 'receiptDigest', requireDigest,
    'Output-root allocation receipt');
  return input;
}

function validateResolutionRequestSelfConsistency(input, requireDigest = true) {
  exactFields(input, RESOLUTION_REQUEST_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST', 'Resolution request');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_SCHEMA_VERSION
      && RESOLUTION_REQUEST_ID.test(input.requestId)
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && ALLOCATION_HANDLE.test(input.allocationHandle)
      && input.descriptorId === 'k6-output-summary-json'
      && input.kind === 'k6-run-summary-json'
      && input.relativePath === 'outputs/summary.json'
      && input.required === true
      && input.regularFileRequired === true
      && input.symbolicLinkAllowed === false
      && input.hardLinkAllowed === false
      && input.specialFileAllowed === false
      && input.openAuthorized === false
      && input.readAuthorized === false
      && input.writeAuthorized === false,
    'K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_ESCALATION',
    'Artifact resolution request widens the exact allow-list');
  for (const [field, value] of [
    ['portDigest', input.portDigest],
    ['rootContractDigest', input.rootContractDigest],
    ['allocationRequestDigest', input.allocationRequestDigest],
    ['allocationReceiptDigest', input.allocationReceiptDigest],
    ['descriptorDigest', input.descriptorDigest],
  ]) validateDigest(value, `resolutionRequest.${field}`);
  validateOwnDigest(input, 'requestDigest', requireDigest,
    'Artifact resolution request');
  return input;
}

function validateResolutionReceiptSelfConsistency(input, requireDigest = true) {
  exactFields(input, RESOLUTION_RECEIPT_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT', 'Resolution receipt');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_SCHEMA_VERSION
      && RESOLUTION_RECEIPT_ID.test(input.receiptId)
      && PORT_ID.test(input.portId)
      && ALLOCATION_HANDLE.test(input.allocationHandle)
      && ARTIFACT_HANDLE.test(input.artifactHandle)
      && input.relativePath === 'outputs/summary.json'
      && input.accepted === true
      && input.delegated === true
      && input.resolved === true
      && input.opaqueHandleReturned === true
      && input.regularFileVerified === false
      && input.objectOpened === false
      && input.fileRead === false
      && input.fileWritten === false
      && input.realFilesystemAccessed === false
      && input.hostPathIncluded === false,
    'K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_ESCALATION',
    'Artifact resolution receipt reports an unsupported host effect');
  for (const [field, value] of [
    ['portDigest', input.portDigest],
    ['resolutionRequestDigest', input.resolutionRequestDigest],
    ['descriptorDigest', input.descriptorDigest],
  ]) validateDigest(value, `resolutionReceipt.${field}`);
  validateOwnDigest(input, 'receiptDigest', requireDigest,
    'Artifact resolution receipt');
  return input;
}

function validateBoundaryEvidenceSelfConsistency(input, requireDigest = true) {
  exactFields(input, EVIDENCE_FIELDS,
    'INVALID_K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE',
    'Trusted output-root boundary Evidence');
  exactFields(input.lifecycle, LIFECYCLE_FIELDS,
    'INVALID_K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE',
    'Trusted output-root lifecycle');
  exactFields(input.artifact, ARTIFACT_FIELDS,
    'INVALID_K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE',
    'Trusted output-root artifact');
  outputRootInvariant(
    input.schemaVersion
      === K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_SCHEMA_VERSION
      && EVIDENCE_ID.test(input.evidenceId)
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && input.lifecycle.initialState === 'DECLARED'
      && input.lifecycle.currentState === 'ALLOCATED'
      && input.lifecycle.logicalAllocationCompleted === true
      && input.lifecycle.realDirectoryCreated === false
      && input.lifecycle.sealed === false
      && input.lifecycle.collectionAuthorized === false
      && input.lifecycle.cleanupAuthorized === false
      && input.artifact.descriptorId === 'k6-output-summary-json'
      && input.artifact.kind === 'k6-run-summary-json'
      && input.artifact.relativePath === 'outputs/summary.json'
      && ALLOCATION_HANDLE.test(input.artifact.allocationHandle)
      && ARTIFACT_HANDLE.test(input.artifact.artifactHandle)
      && input.artifact.resolved === true
      && input.artifact.regularFileVerified === false
      && input.artifact.opened === false
      && input.artifact.read === false
      && input.artifact.written === false
      && canonicalStringify(input.decision)
        === canonicalStringify(K6_OUTPUT_ROOT_P2_DECISION)
      && canonicalStringify(input.safetyBoundary)
        === canonicalStringify(K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY),
    'K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_ESCALATION',
    'Trusted output-root boundary Evidence widens the P2 boundary');
  for (const [field, value] of [
    ['portDigest', input.portDigest],
    ['rootContractDigest', input.rootContractDigest],
    ['allocationRequestDigest', input.allocationRequestDigest],
    ['allocationReceiptDigest', input.allocationReceiptDigest],
    ['resolutionRequestDigest', input.resolutionRequestDigest],
    ['resolutionReceiptDigest', input.resolutionReceiptDigest],
    ['artifact.descriptorDigest', input.artifact.descriptorDigest],
  ]) validateDigest(value, `boundaryEvidence.${field}`);
  validateOwnDigest(input, 'evidenceDigest', requireDigest,
    'Trusted output-root boundary Evidence');
  return input;
}

function exactFields(input, expected, code, label) {
  outputRootInvariant(input && typeof input === 'object' && !Array.isArray(input),
    code, `${label} must be an object`);
  outputRootInvariant(
    canonicalStringify(Object.keys(input).sort())
      === canonicalStringify([...expected].sort()),
    code, `${label} fields are not exact`);
}

function validateOwnDigest(input, field, requireDigest, label) {
  if (!requireDigest) return;
  validateDigest(input[field], `${label}.${field}`);
  outputRootInvariant(digestWithout(input, field) === input[field],
    `K6_${field.toUpperCase()}_MISMATCH`,
    `${label} digest is invalid`);
}

function digestWithout(input, field) {
  const copy = cloneExecutionJson(input);
  delete copy[field];
  return sha256(copy);
}

function freezeWithDigest(input, field) {
  return deepFreeze({ ...input, [field]: sha256(input) });
}

function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
