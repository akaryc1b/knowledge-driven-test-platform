import { canonicalStringify } from '@kdtp/knowledge-core';
import { validateDigest } from '@kdtp/execution-contract';
import { K6_OUTPUT_ROOT_LIMITS } from './constants.js';
import { outputRootInvariant } from './errors.js';
import {
  ALLOCATION_HANDLE,
  ARTIFACT_FIELDS,
  ARTIFACT_HANDLE,
  CAPABILITY_FIELDS,
  INSPECTION_RECEIPT_FIELDS,
  INSPECTION_RECEIPT_ID,
  INSPECTION_REQUEST_FIELDS,
  INSPECTION_REQUEST_ID,
  K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION,
  K6_BOUNDED_RESULT_COLLECTOR_PORT_ID,
  K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION,
  K6_BOUNDED_RESULT_COLLECTOR_PORT_VERSION,
  K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_P3_DECISION,
  K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY,
  K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION,
  LIFECYCLE_FIELDS,
  LIMIT_FIELDS,
  PAYLOAD_RECEIPT_FIELDS,
  PAYLOAD_RECEIPT_ID,
  PAYLOAD_REQUEST_FIELDS,
  PAYLOAD_REQUEST_ID,
  PORT_FIELDS,
  PORT_ID,
  RESULT_FIELDS,
  RESULT_ID,
  RESULT_TRANSITION_PATH,
  ROOT_CONTRACT_ID,
  SEAL_RECEIPT_FIELDS,
  SEAL_RECEIPT_ID,
  SEAL_REQUEST_FIELDS,
  SEAL_REQUEST_ID,
  SEAL_TRANSITION_PATH,
  TRANSITION_FIELDS,
  exactFields,
  validateOwnDigest,
} from './bounded-result-collector-definitions.js';
import {
  invokePort,
  readClock,
  validateAcceptedP2,
  validateMonotonicClock,
} from './bounded-result-collector-predecessor.js';

export {
  invokePort,
  readClock,
  validateAcceptedP2,
  validateMonotonicClock,
};

export function validateCollectorPortSelfConsistency(input, requireDigest = true) {
  exactFields(input, PORT_FIELDS,
    'INVALID_K6_BOUNDED_RESULT_COLLECTOR_PORT',
    'Bounded result collector port');
  exactFields(input.capabilities, CAPABILITY_FIELDS,
    'INVALID_K6_BOUNDED_RESULT_COLLECTOR_PORT',
    'Bounded result collector capabilities');
  outputRootInvariant(
    input.schemaVersion === K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION
      && PORT_ID.test(input.portId)
      && input.portId === K6_BOUNDED_RESULT_COLLECTOR_PORT_ID
      && input.portVersion === K6_BOUNDED_RESULT_COLLECTOR_PORT_VERSION
      && input.implementationStatus === 'INJECTED_FAKE_ONLY'
      && input.ownership === 'PLATFORM_OWNED'
      && input.capabilities.sealLogicalRoot === true
      && input.capabilities.inspectDeclaredArtifact === true
      && input.capabilities.provideTransientPayload === true
      && input.capabilities.accessRealFilesystem === false
      && input.capabilities.returnHostPath === false
      && input.capabilities.recursivelyDiscover === false
      && input.capabilities.persistRawPayload === false,
    'K6_BOUNDED_RESULT_COLLECTOR_PORT_ESCALATION',
    'Bounded result collector port widens the fake-only boundary');
  validateOwnDigest(input, 'portDigest', requireDigest,
    'Bounded result collector port');
  return input;
}

export function validateSealRequestSelfConsistency(input, requireDigest = true) {
  exactFields(input, SEAL_REQUEST_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_SEAL_REQUEST', 'Output-root seal request');
  validateTransitionPath(input.transitionPath, SEAL_TRANSITION_PATH,
    'INVALID_K6_OUTPUT_ROOT_SEAL_REQUEST', 'Output-root seal transition path');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION
      && SEAL_REQUEST_ID.test(input.requestId)
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && ALLOCATION_HANDLE.test(input.allocationHandle),
    'K6_OUTPUT_ROOT_SEAL_REQUEST_ESCALATION',
    'Output-root seal request widens the accepted lifecycle boundary');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['p2BoundaryEvidenceDigest', input.p2BoundaryEvidenceDigest],
    ['rootContractDigest', input.rootContractDigest],
    ['terminalOutcomeDigest', input.terminalOutcomeDigest],
    ['sourceBundleDigest', input.sourceBundleDigest],
  ], 'sealRequest');
  validateOwnDigest(input, 'requestDigest', requireDigest,
    'Output-root seal request');
  return input;
}

export function validateSealReceiptSelfConsistency(input, requireDigest = true) {
  exactFields(input, SEAL_RECEIPT_FIELDS,
    'INVALID_K6_OUTPUT_ROOT_SEAL_RECEIPT', 'Output-root seal receipt');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION
      && SEAL_RECEIPT_ID.test(input.receiptId)
      && ALLOCATION_HANDLE.test(input.allocationHandle)
      && input.accepted === true
      && input.delegated === true
      && input.sealed === true
      && input.currentState === 'SEALED'
      && input.realDirectoryCreated === false
      && input.realFilesystemAccessed === false
      && input.hostPathIncluded === false
      && input.sourceBundleMutated === false,
    'K6_OUTPUT_ROOT_SEAL_RECEIPT_ESCALATION',
    'Output-root seal receipt reports an unsupported host effect');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['sealRequestDigest', input.sealRequestDigest],
  ], 'sealReceipt');
  validateOwnDigest(input, 'receiptDigest', requireDigest,
    'Output-root seal receipt');
  return input;
}

export function validateInspectionRequestSelfConsistency(
  input,
  requireDigest = true,
) {
  exactFields(input, INSPECTION_REQUEST_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST',
    'Output artifact inspection request');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION
      && INSPECTION_REQUEST_ID.test(input.requestId)
      && ALLOCATION_HANDLE.test(input.allocationHandle)
      && ARTIFACT_HANDLE.test(input.artifactHandle)
      && input.descriptorId === 'k6-output-summary-json'
      && input.kind === 'k6-run-summary-json'
      && input.relativePath === 'outputs/summary.json'
      && input.maxBytes === K6_OUTPUT_ROOT_LIMITS.maxFileBytes
      && input.regularFileRequired === true
      && input.symbolicLinkAllowed === false
      && input.hardLinkAllowed === false
      && input.specialFileAllowed === false,
    'K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_ESCALATION',
    'Output artifact inspection request widens the exact allow-list');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['sealReceiptDigest', input.sealReceiptDigest],
    ['resolutionReceiptDigest', input.resolutionReceiptDigest],
    ['descriptorDigest', input.descriptorDigest],
  ], 'inspectionRequest');
  validateOwnDigest(input, 'requestDigest', requireDigest,
    'Output artifact inspection request');
  return input;
}

export function validateInspectionReceiptSelfConsistency(
  input,
  requireDigest = true,
) {
  exactFields(input, INSPECTION_RECEIPT_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT',
    'Output artifact inspection receipt');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION
      && INSPECTION_RECEIPT_ID.test(input.receiptId)
      && ARTIFACT_HANDLE.test(input.artifactHandle)
      && input.accepted === true
      && input.delegated === true
      && input.objectType === 'REGULAR_FILE'
      && input.regularFileAttested === true
      && input.symbolicLink === false
      && input.hardLink === false
      && input.specialFile === false
      && input.stableObjectAttested === true
      && Number.isInteger(input.byteLength)
      && input.byteLength >= 0
      && input.byteLength <= K6_OUTPUT_ROOT_LIMITS.maxFileBytes
      && input.encoding === 'UTF-8'
      && input.bomPresent === false
      && input.realFilesystemAccessed === false
      && input.hostPathIncluded === false,
    'K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_ESCALATION',
    'Output artifact inspection receipt reports an unsupported object or effect');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['inspectionRequestDigest', input.inspectionRequestDigest],
  ], 'inspectionReceipt');
  validateOwnDigest(input, 'receiptDigest', requireDigest,
    'Output artifact inspection receipt');
  return input;
}

export function validatePayloadRequestSelfConsistency(
  input,
  requireDigest = true,
) {
  exactFields(input, PAYLOAD_REQUEST_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST',
    'Output artifact payload request');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION
      && PAYLOAD_REQUEST_ID.test(input.requestId)
      && ARTIFACT_HANDLE.test(input.artifactHandle)
      && input.maxBytes === K6_OUTPUT_ROOT_LIMITS.maxFileBytes
      && input.maxDepth === K6_OUTPUT_ROOT_LIMITS.maxJsonDepth
      && input.maxCollectionDurationMs
        === K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs
      && input.encoding === 'UTF-8'
      && input.duplicateKeyPolicy === 'REJECT'
      && input.bomAllowed === false,
    'K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_ESCALATION',
    'Output artifact payload request widens the bounded parser contract');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['inspectionReceiptDigest', input.inspectionReceiptDigest],
  ], 'payloadRequest');
  validateOwnDigest(input, 'requestDigest', requireDigest,
    'Output artifact payload request');
  return input;
}

export function validatePayloadReceiptSelfConsistency(
  input,
  requireDigest = true,
) {
  exactFields(input, PAYLOAD_RECEIPT_FIELDS,
    'INVALID_K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT',
    'Output artifact payload receipt');
  outputRootInvariant(
    input.schemaVersion === K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION
      && PAYLOAD_RECEIPT_ID.test(input.receiptId)
      && ARTIFACT_HANDLE.test(input.artifactHandle)
      && input.accepted === true
      && input.delegated === true
      && Number.isInteger(input.byteLength)
      && input.byteLength >= 0
      && input.byteLength <= K6_OUTPUT_ROOT_LIMITS.maxFileBytes
      && input.encoding === 'UTF-8'
      && input.complete === true
      && input.rawPayloadPersisted === false
      && input.realFilesystemAccessed === false
      && input.hostPathIncluded === false,
    'K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_ESCALATION',
    'Output artifact payload receipt reports an unsupported effect');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['payloadRequestDigest', input.payloadRequestDigest],
    ['contentDigest', input.contentDigest],
  ], 'payloadReceipt');
  validateOwnDigest(input, 'receiptDigest', requireDigest,
    'Output artifact payload receipt');
  return input;
}

export function validateBoundedFileResultSelfConsistency(
  input,
  requireDigest = true,
) {
  exactFields(input, RESULT_FIELDS,
    'INVALID_K6_BOUNDED_FILE_RESULT', 'Bounded file result');
  exactFields(input.lifecycle, LIFECYCLE_FIELDS,
    'INVALID_K6_BOUNDED_FILE_RESULT', 'Bounded file result lifecycle');
  exactFields(input.artifact, ARTIFACT_FIELDS,
    'INVALID_K6_BOUNDED_FILE_RESULT', 'Bounded file result artifact');
  exactFields(input.limits, LIMIT_FIELDS,
    'INVALID_K6_BOUNDED_FILE_RESULT', 'Bounded file result limits');
  validateTransitionPath(input.lifecycle.transitionPath, RESULT_TRANSITION_PATH,
    'INVALID_K6_BOUNDED_FILE_RESULT', 'Bounded file result transition path');
  outputRootInvariant(
    input.schemaVersion === K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION
      && RESULT_ID.test(input.resultId)
      && ROOT_CONTRACT_ID.test(input.rootContractId)
      && input.lifecycle.initialState === 'ALLOCATED'
      && input.lifecycle.currentState === 'COLLECTED'
      && input.lifecycle.sealed === true
      && input.lifecycle.collected === true
      && input.lifecycle.cleanupAuthorized === false
      && input.lifecycle.cleaned === false
      && input.artifact.descriptorId === 'k6-output-summary-json'
      && input.artifact.kind === 'k6-run-summary-json'
      && input.artifact.relativePath === 'outputs/summary.json'
      && ALLOCATION_HANDLE.test(input.artifact.allocationHandle)
      && ARTIFACT_HANDLE.test(input.artifact.artifactHandle)
      && Number.isInteger(input.artifact.byteLength)
      && input.artifact.byteLength >= 0
      && input.artifact.byteLength <= K6_OUTPUT_ROOT_LIMITS.maxFileBytes
      && input.artifact.encoding === 'UTF-8'
      && Number.isInteger(input.artifact.maxDepthObserved)
      && input.artifact.maxDepthObserved >= 1
      && input.artifact.maxDepthObserved <= K6_OUTPUT_ROOT_LIMITS.maxJsonDepth
      && Number.isInteger(input.artifact.topLevelKeyCount)
      && input.artifact.topLevelKeyCount >= 0
      && input.artifact.regularFileAttested === true
      && input.artifact.symbolicLink === false
      && input.artifact.hardLink === false
      && input.artifact.specialFile === false
      && input.artifact.rawPayloadIncluded === false
      && canonicalStringify(input.limits)
        === canonicalStringify(K6_OUTPUT_ROOT_LIMITS)
      && Number.isInteger(input.collectionDurationMs)
      && input.collectionDurationMs >= 0
      && input.collectionDurationMs
        <= K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs
      && canonicalStringify(input.decision)
        === canonicalStringify(K6_OUTPUT_ROOT_P3_DECISION)
      && canonicalStringify(input.safetyBoundary)
        === canonicalStringify(K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY),
    'K6_BOUNDED_FILE_RESULT_ESCALATION',
    'Bounded file result widens the accepted P3 boundary');
  validateDigests([
    ['collectorPortDigest', input.collectorPortDigest],
    ['rootContractDigest', input.rootContractDigest],
    ['p2BoundaryEvidenceDigest', input.p2BoundaryEvidenceDigest],
    ['sealRequestDigest', input.sealRequestDigest],
    ['sealReceiptDigest', input.sealReceiptDigest],
    ['inspectionRequestDigest', input.inspectionRequestDigest],
    ['inspectionReceiptDigest', input.inspectionReceiptDigest],
    ['payloadRequestDigest', input.payloadRequestDigest],
    ['payloadReceiptDigest', input.payloadReceiptDigest],
    ['artifact.descriptorDigest', input.artifact.descriptorDigest],
    ['artifact.contentDigest', input.artifact.contentDigest],
    ['artifact.canonicalJsonDigest', input.artifact.canonicalJsonDigest],
  ], 'boundedFileResult');
  validateOwnDigest(input, 'resultDigest', requireDigest,
    'Bounded file result');
  return input;
}

function validateTransitionPath(input, expected, code, label) {
  outputRootInvariant(Array.isArray(input) && input.length === expected.length,
    code, `${label} length is invalid`);
  input.forEach((transition, index) => {
    exactFields(transition, TRANSITION_FIELDS, code, `${label}[${index}]`);
  });
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    code, `${label} is not exact`);
}

function validateDigests(entries, label) {
  for (const [field, value] of entries) {
    validateDigest(value, `${label}.${field}`);
  }
}
