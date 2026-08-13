import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson, validateDigest } from '@kdtp/execution-contract';
import { outputRootInvariant } from './errors.js';

export const K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION =
  'k6-bounded-result-collector-port/v1';
export const K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION =
  'k6-output-root-seal-request/v1';
export const K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION =
  'k6-output-root-seal-receipt/v1';
export const K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION =
  'k6-output-artifact-inspection-request/v1';
export const K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION =
  'k6-output-artifact-inspection-receipt/v1';
export const K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION =
  'k6-output-artifact-payload-request/v1';
export const K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION =
  'k6-output-artifact-payload-receipt/v1';
export const K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION =
  'k6-bounded-file-result/v1';
export const K6_BOUNDED_RESULT_COLLECTOR_PORT_ID =
  'k6-bounded-result-collector-port';
export const K6_BOUNDED_RESULT_COLLECTOR_PORT_VERSION = '1.0.0';

export const PORT_FIELDS = Object.freeze([
  'schemaVersion', 'portId', 'portVersion', 'implementationStatus',
  'ownership', 'capabilities', 'portDigest',
]);
export const CAPABILITY_FIELDS = Object.freeze([
  'sealLogicalRoot', 'inspectDeclaredArtifact', 'provideTransientPayload',
  'accessRealFilesystem', 'returnHostPath', 'recursivelyDiscover',
  'persistRawPayload',
]);
export const SEAL_REQUEST_FIELDS = Object.freeze([
  'schemaVersion', 'requestId', 'collectorPortDigest',
  'p2BoundaryEvidenceDigest', 'rootContractId', 'rootContractDigest',
  'allocationHandle', 'terminalOutcomeDigest', 'sourceBundleDigest',
  'transitionPath', 'requestDigest',
]);
export const TRANSITION_FIELDS = Object.freeze(['from', 'to']);
export const SEAL_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'collectorPortDigest', 'sealRequestDigest',
  'allocationHandle', 'accepted', 'delegated', 'sealed', 'currentState',
  'realDirectoryCreated', 'realFilesystemAccessed', 'hostPathIncluded',
  'sourceBundleMutated', 'receiptDigest',
]);
export const INSPECTION_REQUEST_FIELDS = Object.freeze([
  'schemaVersion', 'requestId', 'collectorPortDigest', 'sealReceiptDigest',
  'resolutionReceiptDigest', 'allocationHandle', 'artifactHandle',
  'descriptorId', 'descriptorDigest', 'kind', 'relativePath', 'maxBytes',
  'regularFileRequired', 'symbolicLinkAllowed', 'hardLinkAllowed',
  'specialFileAllowed', 'requestDigest',
]);
export const INSPECTION_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'collectorPortDigest',
  'inspectionRequestDigest', 'artifactHandle', 'accepted', 'delegated',
  'objectType', 'regularFileAttested', 'symbolicLink', 'hardLink',
  'specialFile', 'stableObjectAttested', 'byteLength', 'encoding',
  'bomPresent', 'realFilesystemAccessed', 'hostPathIncluded',
  'receiptDigest',
]);
export const PAYLOAD_REQUEST_FIELDS = Object.freeze([
  'schemaVersion', 'requestId', 'collectorPortDigest',
  'inspectionReceiptDigest', 'artifactHandle', 'maxBytes', 'maxDepth',
  'maxCollectionDurationMs', 'encoding', 'duplicateKeyPolicy',
  'bomAllowed', 'requestDigest',
]);
export const PAYLOAD_RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'collectorPortDigest',
  'payloadRequestDigest', 'artifactHandle', 'accepted', 'delegated',
  'byteLength', 'contentDigest', 'encoding', 'complete',
  'rawPayloadPersisted', 'realFilesystemAccessed', 'hostPathIncluded',
  'receiptDigest',
]);
export const RESULT_FIELDS = Object.freeze([
  'schemaVersion', 'resultId', 'collectorPortDigest', 'rootContractId',
  'rootContractDigest', 'p2BoundaryEvidenceDigest', 'sealRequestDigest',
  'sealReceiptDigest', 'inspectionRequestDigest', 'inspectionReceiptDigest',
  'payloadRequestDigest', 'payloadReceiptDigest', 'lifecycle', 'artifact',
  'limits', 'collectionDurationMs', 'decision', 'safetyBoundary',
  'resultDigest',
]);
export const LIFECYCLE_FIELDS = Object.freeze([
  'initialState', 'currentState', 'transitionPath', 'sealed', 'collected',
  'cleanupAuthorized', 'cleaned',
]);
export const ARTIFACT_FIELDS = Object.freeze([
  'descriptorId', 'descriptorDigest', 'kind', 'relativePath',
  'allocationHandle', 'artifactHandle', 'byteLength', 'encoding',
  'contentDigest', 'canonicalJsonDigest', 'maxDepthObserved',
  'topLevelKeyCount', 'regularFileAttested', 'symbolicLink', 'hardLink',
  'specialFile', 'rawPayloadIncluded',
]);
export const LIMIT_FIELDS = Object.freeze([
  'maxFiles', 'maxFileBytes', 'maxTotalBytes', 'maxJsonDepth',
  'maxCollectionDurationMs',
]);

export const PORT_ID = /^k6-bounded-result-collector-port$/u;
export const ROOT_CONTRACT_ID = /^k6output-root-contract-[a-f0-9]{20}$/u;
export const ALLOCATION_HANDLE = /^k6root-handle-[a-f0-9]{20}$/u;
export const ARTIFACT_HANDLE = /^k6artifact-handle-[a-f0-9]{20}$/u;
export const SEAL_REQUEST_ID = /^k6root-seal-[a-f0-9]{20}$/u;
export const SEAL_RECEIPT_ID = /^k6root-seal-receipt-[a-f0-9]{20}$/u;
export const INSPECTION_REQUEST_ID = /^k6artifact-inspect-[a-f0-9]{20}$/u;
export const INSPECTION_RECEIPT_ID =
  /^k6artifact-inspect-receipt-[a-f0-9]{20}$/u;
export const PAYLOAD_REQUEST_ID = /^k6artifact-payload-[a-f0-9]{20}$/u;
export const PAYLOAD_RECEIPT_ID =
  /^k6artifact-payload-receipt-[a-f0-9]{20}$/u;
export const RESULT_ID = /^k6bounded-result-[a-f0-9]{20}$/u;

export const SEAL_TRANSITION_PATH = Object.freeze([
  Object.freeze({ from: 'ALLOCATED', to: 'ACTIVE' }),
  Object.freeze({ from: 'ACTIVE', to: 'TERMINAL_OBSERVED' }),
  Object.freeze({ from: 'TERMINAL_OBSERVED', to: 'SEALED' }),
]);
export const RESULT_TRANSITION_PATH = Object.freeze([
  ...SEAL_TRANSITION_PATH,
  Object.freeze({ from: 'SEALED', to: 'COLLECTED' }),
]);

export const K6_OUTPUT_ROOT_P3_DECISION = deepFreeze({
  boundedResultCollectorReady: true,
  logicalRootSealSupported: true,
  logicalRootSealed: true,
  exactArtifactInspectionSupported: true,
  exactArtifactInspected: true,
  transientPayloadVerificationSupported: true,
  boundedJsonResultCollected: true,
  realFilesystemCollectorImplemented: false,
  realHostFileReadPerformed: false,
  rawPayloadPersisted: false,
  nextRequiredSlice: 'M3-R4-P4',
  repositoryBlockers: [],
});

export const K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY = deepFreeze({
  callerPathAccepted: false,
  absolutePathAccepted: false,
  hostPathIncluded: false,
  hostPathResolved: false,
  realDirectoryCreated: false,
  realFilesystemAccessed: false,
  realHostFileOpened: false,
  realHostFileRead: false,
  realHostFileWritten: false,
  recursiveDiscoveryPerformed: false,
  symbolicLinkFollowed: false,
  hardLinkTrusted: false,
  specialFileAccepted: false,
  rawPayloadPersisted: false,
  rawPayloadIncludedInEvidence: false,
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


export function exactFields(input, expected, code, label) {
  outputRootInvariant(input && typeof input === 'object' && !Array.isArray(input),
    code, `${label} must be an object`);
  outputRootInvariant(
    canonicalStringify(Object.keys(input).sort())
      === canonicalStringify([...expected].sort()),
    code, `${label} fields are not exact`);
}

export function validateOwnDigest(input, field, requireDigest, label) {
  if (!requireDigest) return;
  validateDigest(input[field], `${label}.${field}`);
  outputRootInvariant(digestWithout(input, field) === input[field],
    `K6_${field.toUpperCase()}_MISMATCH`, `${label} digest is invalid`);
}

export function digestWithout(input, field) {
  const copy = cloneExecutionJson(input);
  delete copy[field];
  return sha256(copy);
}

export function freezeWithDigest(input, field) {
  return deepFreeze({ ...input, [field]: sha256(input) });
}

export function deepFreeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
