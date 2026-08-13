import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { K6_OUTPUT_ROOT_LIMITS } from './constants.js';
import { outputRootInvariant } from './errors.js';
import {
  K6_BOUNDED_RESULT_COLLECTOR_PORT_ID,
  K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION,
  K6_BOUNDED_RESULT_COLLECTOR_PORT_VERSION,
  K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION,
  SEAL_TRANSITION_PATH,
  digestWithout,
  freezeWithDigest,
} from './bounded-result-collector-definitions.js';
import {
  validateAcceptedP2,
  validateCollectorPortSelfConsistency,
  validateInspectionReceiptSelfConsistency,
  validateInspectionRequestSelfConsistency,
  validatePayloadReceiptSelfConsistency,
  validatePayloadRequestSelfConsistency,
  validateSealReceiptSelfConsistency,
  validateSealRequestSelfConsistency,
} from './bounded-result-collector-validation.js';
import {
  rawSha256,
  validateTransientBytes,
} from './bounded-json-result-payload.js';

export function createK6BoundedResultCollectorPortDescriptor() {
  const withoutDigest = {
    schemaVersion: K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION,
    portId: K6_BOUNDED_RESULT_COLLECTOR_PORT_ID,
    portVersion: K6_BOUNDED_RESULT_COLLECTOR_PORT_VERSION,
    implementationStatus: 'INJECTED_FAKE_ONLY',
    ownership: 'PLATFORM_OWNED',
    capabilities: {
      sealLogicalRoot: true,
      inspectDeclaredArtifact: true,
      provideTransientPayload: true,
      accessRealFilesystem: false,
      returnHostPath: false,
      recursivelyDiscover: false,
      persistRawPayload: false,
    },
  };
  return freezeWithDigest(withoutDigest, 'portDigest');
}

export function validateK6BoundedResultCollectorPortDescriptor(input) {
  validateCollectorPortSelfConsistency(input);
  const expected = createK6BoundedResultCollectorPortDescriptor();
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_BOUNDED_RESULT_COLLECTOR_PORT_MISMATCH',
    'Bounded result collector port does not match the fixed fake-only contract');
  return expected;
}

export function computeK6BoundedResultCollectorPortDigest(input) {
  validateCollectorPortSelfConsistency(input, false);
  return digestWithout(input, 'portDigest');
}

export function createK6OutputRootSealRequest(bindings) {
  const accepted = validateAcceptedP2(bindings);
  const collectorPort = validateK6BoundedResultCollectorPortDescriptor(
    bindings.collectorPortDescriptor);
  const identity = {
    collectorPortDigest: collectorPort.portDigest,
    p2BoundaryEvidenceDigest: accepted.boundaryEvidence.evidenceDigest,
    rootContractDigest: accepted.rootContract.contractDigest,
    allocationHandle: accepted.allocationReceipt.allocationHandle,
  };
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION,
    requestId: `k6root-seal-${sha256(identity).slice(0, 20)}`,
    collectorPortDigest: collectorPort.portDigest,
    p2BoundaryEvidenceDigest: accepted.boundaryEvidence.evidenceDigest,
    rootContractId: accepted.rootContract.rootContractId,
    rootContractDigest: accepted.rootContract.contractDigest,
    allocationHandle: accepted.allocationReceipt.allocationHandle,
    terminalOutcomeDigest:
      accepted.rootContract.predecessor.runtimeOutcomeDigest,
    sourceBundleDigest: accepted.rootContract.predecessor.sourceBundleDigest,
    transitionPath: SEAL_TRANSITION_PATH.map((item) => ({ ...item })),
  };
  const request = freezeWithDigest(withoutDigest, 'requestDigest');
  validateSealRequestSelfConsistency(request);
  return request;
}

export function validateK6OutputRootSealRequest(input, bindings) {
  validateSealRequestSelfConsistency(input);
  const expected = createK6OutputRootSealRequest(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ROOT_SEAL_REQUEST_MISMATCH',
    'Output-root seal request does not match the accepted P2 chain');
  return expected;
}

export function computeK6OutputRootSealRequestDigest(input) {
  validateSealRequestSelfConsistency(input, false);
  return digestWithout(input, 'requestDigest');
}

export function createK6OutputRootSealReceipt(
  collectorPortDescriptor,
  sealRequest,
) {
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  validateSealRequestSelfConsistency(sealRequest);
  outputRootInvariant(sealRequest.collectorPortDigest === port.portDigest,
    'K6_OUTPUT_ROOT_SEAL_PORT_MISMATCH',
    'Seal request is not bound to the injected collector port');
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION,
    receiptId: `k6root-seal-receipt-${sealRequest.requestDigest.slice(0, 20)}`,
    collectorPortDigest: port.portDigest,
    sealRequestDigest: sealRequest.requestDigest,
    allocationHandle: sealRequest.allocationHandle,
    accepted: true,
    delegated: true,
    sealed: true,
    currentState: 'SEALED',
    realDirectoryCreated: false,
    realFilesystemAccessed: false,
    hostPathIncluded: false,
    sourceBundleMutated: false,
  };
  const receipt = freezeWithDigest(withoutDigest, 'receiptDigest');
  validateSealReceiptSelfConsistency(receipt);
  return receipt;
}

export function validateK6OutputRootSealReceipt(
  input,
  collectorPortDescriptor,
  sealRequest,
) {
  validateSealReceiptSelfConsistency(input);
  const expected = createK6OutputRootSealReceipt(
    collectorPortDescriptor, sealRequest);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ROOT_SEAL_RECEIPT_MISMATCH',
    'Injected output-root seal receipt is not exact');
  return expected;
}

export function computeK6OutputRootSealReceiptDigest(input) {
  validateSealReceiptSelfConsistency(input, false);
  return digestWithout(input, 'receiptDigest');
}

export function createK6OutputArtifactInspectionRequest({
  collectorPortDescriptor,
  p2Bindings,
  sealRequest,
  sealReceipt,
}) {
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  const accepted = validateAcceptedP2({
    ...p2Bindings,
    collectorPortDescriptor: port,
  });
  const acceptedSealRequest = validateK6OutputRootSealRequest(sealRequest, {
    ...p2Bindings,
    collectorPortDescriptor: port,
  });
  const acceptedSealReceipt = validateK6OutputRootSealReceipt(
    sealReceipt, port, acceptedSealRequest);
  const descriptor = accepted.descriptor;
  const identity = {
    collectorPortDigest: port.portDigest,
    sealReceiptDigest: acceptedSealReceipt.receiptDigest,
    resolutionReceiptDigest: accepted.resolutionReceipt.receiptDigest,
    descriptorDigest: descriptor.descriptorDigest,
  };
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION,
    requestId: `k6artifact-inspect-${sha256(identity).slice(0, 20)}`,
    collectorPortDigest: port.portDigest,
    sealReceiptDigest: acceptedSealReceipt.receiptDigest,
    resolutionReceiptDigest: accepted.resolutionReceipt.receiptDigest,
    allocationHandle: accepted.allocationReceipt.allocationHandle,
    artifactHandle: accepted.resolutionReceipt.artifactHandle,
    descriptorId: descriptor.descriptorId,
    descriptorDigest: descriptor.descriptorDigest,
    kind: descriptor.kind,
    relativePath: descriptor.relativePath,
    maxBytes: descriptor.maxBytes,
    regularFileRequired: descriptor.regularFileRequired,
    symbolicLinkAllowed: descriptor.symbolicLinkAllowed,
    hardLinkAllowed: descriptor.hardLinkAllowed,
    specialFileAllowed: descriptor.specialFileAllowed,
  };
  const request = freezeWithDigest(withoutDigest, 'requestDigest');
  validateInspectionRequestSelfConsistency(request);
  return request;
}

export function validateK6OutputArtifactInspectionRequest(input, bindings) {
  validateInspectionRequestSelfConsistency(input);
  const expected = createK6OutputArtifactInspectionRequest(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_MISMATCH',
    'Artifact inspection request does not match the sealed P2 artifact');
  return expected;
}

export function computeK6OutputArtifactInspectionRequestDigest(input) {
  validateInspectionRequestSelfConsistency(input, false);
  return digestWithout(input, 'requestDigest');
}

export function createK6OutputArtifactInspectionReceipt(
  collectorPortDescriptor,
  inspectionRequest,
  byteLength,
) {
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  validateInspectionRequestSelfConsistency(inspectionRequest);
  outputRootInvariant(inspectionRequest.collectorPortDigest === port.portDigest,
    'K6_OUTPUT_ARTIFACT_INSPECTION_PORT_MISMATCH',
    'Inspection request is not bound to the injected collector port');
  outputRootInvariant(Number.isInteger(byteLength)
      && byteLength >= 0 && byteLength <= inspectionRequest.maxBytes,
  'K6_OUTPUT_ARTIFACT_SIZE_EXCEEDED',
  'Artifact byte length exceeds the accepted descriptor limit');
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION,
    receiptId:
      `k6artifact-inspect-receipt-${inspectionRequest.requestDigest.slice(0, 20)}`,
    collectorPortDigest: port.portDigest,
    inspectionRequestDigest: inspectionRequest.requestDigest,
    artifactHandle: inspectionRequest.artifactHandle,
    accepted: true,
    delegated: true,
    objectType: 'REGULAR_FILE',
    regularFileAttested: true,
    symbolicLink: false,
    hardLink: false,
    specialFile: false,
    stableObjectAttested: true,
    byteLength,
    encoding: 'UTF-8',
    bomPresent: false,
    realFilesystemAccessed: false,
    hostPathIncluded: false,
  };
  const receipt = freezeWithDigest(withoutDigest, 'receiptDigest');
  validateInspectionReceiptSelfConsistency(receipt);
  return receipt;
}

export function validateK6OutputArtifactInspectionReceipt(
  input,
  collectorPortDescriptor,
  inspectionRequest,
) {
  validateInspectionReceiptSelfConsistency(input);
  const expected = createK6OutputArtifactInspectionReceipt(
    collectorPortDescriptor, inspectionRequest, input.byteLength);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_MISMATCH',
    'Injected artifact inspection receipt is not exact');
  return expected;
}

export function computeK6OutputArtifactInspectionReceiptDigest(input) {
  validateInspectionReceiptSelfConsistency(input, false);
  return digestWithout(input, 'receiptDigest');
}

export function createK6OutputArtifactPayloadRequest({
  collectorPortDescriptor,
  inspectionRequest,
  inspectionReceipt,
}) {
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  validateInspectionRequestSelfConsistency(inspectionRequest);
  const receipt = validateK6OutputArtifactInspectionReceipt(
    inspectionReceipt, port, inspectionRequest);
  const identity = {
    collectorPortDigest: port.portDigest,
    inspectionReceiptDigest: receipt.receiptDigest,
    artifactHandle: receipt.artifactHandle,
  };
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION,
    requestId: `k6artifact-payload-${sha256(identity).slice(0, 20)}`,
    collectorPortDigest: port.portDigest,
    inspectionReceiptDigest: receipt.receiptDigest,
    artifactHandle: receipt.artifactHandle,
    maxBytes: K6_OUTPUT_ROOT_LIMITS.maxFileBytes,
    maxDepth: K6_OUTPUT_ROOT_LIMITS.maxJsonDepth,
    maxCollectionDurationMs: K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs,
    encoding: 'UTF-8',
    duplicateKeyPolicy: 'REJECT',
    bomAllowed: false,
  };
  const request = freezeWithDigest(withoutDigest, 'requestDigest');
  validatePayloadRequestSelfConsistency(request);
  return request;
}

export function validateK6OutputArtifactPayloadRequest(input, bindings) {
  validatePayloadRequestSelfConsistency(input);
  const expected = createK6OutputArtifactPayloadRequest(bindings);
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_MISMATCH',
    'Artifact payload request does not match the inspected artifact');
  return expected;
}

export function computeK6OutputArtifactPayloadRequestDigest(input) {
  validatePayloadRequestSelfConsistency(input, false);
  return digestWithout(input, 'requestDigest');
}

export function createK6OutputArtifactPayloadReceipt(
  collectorPortDescriptor,
  payloadRequest,
  bytes,
) {
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  validatePayloadRequestSelfConsistency(payloadRequest);
  outputRootInvariant(payloadRequest.collectorPortDigest === port.portDigest,
    'K6_OUTPUT_ARTIFACT_PAYLOAD_PORT_MISMATCH',
    'Payload request is not bound to the injected collector port');
  const normalizedBytes = validateTransientBytes(bytes, payloadRequest.maxBytes);
  const withoutDigest = {
    schemaVersion: K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION,
    receiptId:
      `k6artifact-payload-receipt-${payloadRequest.requestDigest.slice(0, 20)}`,
    collectorPortDigest: port.portDigest,
    payloadRequestDigest: payloadRequest.requestDigest,
    artifactHandle: payloadRequest.artifactHandle,
    accepted: true,
    delegated: true,
    byteLength: normalizedBytes.byteLength,
    contentDigest: rawSha256(normalizedBytes),
    encoding: 'UTF-8',
    complete: true,
    rawPayloadPersisted: false,
    realFilesystemAccessed: false,
    hostPathIncluded: false,
  };
  const receipt = freezeWithDigest(withoutDigest, 'receiptDigest');
  validatePayloadReceiptSelfConsistency(receipt);
  return receipt;
}

export function validateK6OutputArtifactPayloadReceipt(
  input,
  collectorPortDescriptor,
  payloadRequest,
) {
  validatePayloadRequestSelfConsistency(payloadRequest);
  validatePayloadReceiptSelfConsistency(input);
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  outputRootInvariant(input.collectorPortDigest === port.portDigest
      && input.payloadRequestDigest === payloadRequest.requestDigest
      && input.artifactHandle === payloadRequest.artifactHandle
      && input.byteLength <= payloadRequest.maxBytes,
  'K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_MISMATCH',
  'Injected artifact payload receipt is not bound to the payload request');
  return input;
}

export function computeK6OutputArtifactPayloadReceiptDigest(input) {
  validatePayloadReceiptSelfConsistency(input, false);
  return digestWithout(input, 'receiptDigest');
}

