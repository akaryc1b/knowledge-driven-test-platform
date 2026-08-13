import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson } from '@kdtp/execution-contract';
import { K6_OUTPUT_ROOT_LIMITS } from './constants.js';
import { outputRootInvariant } from './errors.js';
import {
  K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_P3_DECISION,
  K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY,
  RESULT_TRANSITION_PATH,
  deepFreeze,
  digestWithout,
  exactFields,
  freezeWithDigest,
} from './bounded-result-collector-definitions.js';
import {
  computeK6BoundedResultCollectorPortDigest,
  computeK6OutputArtifactInspectionReceiptDigest,
  computeK6OutputArtifactInspectionRequestDigest,
  computeK6OutputArtifactPayloadReceiptDigest,
  computeK6OutputArtifactPayloadRequestDigest,
  computeK6OutputRootSealReceiptDigest,
  computeK6OutputRootSealRequestDigest,
  createK6BoundedResultCollectorPortDescriptor,
  createK6OutputArtifactInspectionRequest,
  createK6OutputArtifactInspectionReceipt,
  createK6OutputArtifactPayloadRequest,
  createK6OutputArtifactPayloadReceipt,
  createK6OutputRootSealRequest,
  createK6OutputRootSealReceipt,
  validateK6BoundedResultCollectorPortDescriptor,
  validateK6OutputArtifactInspectionRequest,
  validateK6OutputArtifactInspectionReceipt,
  validateK6OutputArtifactPayloadRequest,
  validateK6OutputArtifactPayloadReceipt,
  validateK6OutputRootSealRequest,
  validateK6OutputRootSealReceipt,
} from './bounded-result-collector-contracts.js';
import {
  parseK6BoundedJsonPayload,
  rawSha256,
  validateTransientBytes,
} from './bounded-json-result-payload.js';
import {
  invokePort,
  readClock,
  validateAcceptedP2,
  validateBoundedFileResultSelfConsistency,
  validateInspectionRequestSelfConsistency,
  validateMonotonicClock,
  validatePayloadRequestSelfConsistency,
  validateSealRequestSelfConsistency,
} from './bounded-result-collector-validation.js';

export {
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
} from './bounded-result-collector-definitions.js';
export {
  computeK6BoundedResultCollectorPortDigest,
  computeK6OutputArtifactInspectionReceiptDigest,
  computeK6OutputArtifactInspectionRequestDigest,
  computeK6OutputArtifactPayloadReceiptDigest,
  computeK6OutputArtifactPayloadRequestDigest,
  computeK6OutputRootSealReceiptDigest,
  computeK6OutputRootSealRequestDigest,
  createK6BoundedResultCollectorPortDescriptor,
  createK6OutputArtifactInspectionRequest,
  createK6OutputArtifactInspectionReceipt,
  createK6OutputArtifactPayloadRequest,
  createK6OutputArtifactPayloadReceipt,
  createK6OutputRootSealRequest,
  createK6OutputRootSealReceipt,
  validateK6BoundedResultCollectorPortDescriptor,
  validateK6OutputArtifactInspectionRequest,
  validateK6OutputArtifactInspectionReceipt,
  validateK6OutputArtifactPayloadRequest,
  validateK6OutputArtifactPayloadReceipt,
  validateK6OutputRootSealRequest,
  validateK6OutputRootSealReceipt,
} from './bounded-result-collector-contracts.js';
export { parseK6BoundedJsonPayload } from './bounded-json-result-payload.js';

export function collectK6BoundedFileResult({
  boundedResultCollectorPort,
  monotonicClock,
  p2Bindings,
}) {
  outputRootInvariant(boundedResultCollectorPort
      && typeof boundedResultCollectorPort === 'object',
  'K6_BOUNDED_RESULT_COLLECTOR_PORT_UNAVAILABLE',
  'An injected BoundedResultCollectorPort is required');
  outputRootInvariant(
    typeof boundedResultCollectorPort.sealRoot === 'function'
      && typeof boundedResultCollectorPort.inspectArtifact === 'function'
      && typeof boundedResultCollectorPort.provideArtifactPayload === 'function',
    'K6_BOUNDED_RESULT_COLLECTOR_PORT_UNAVAILABLE',
    'The injected collector port must seal, inspect and provide a payload');
  const clock = validateMonotonicClock(monotonicClock);
  const startedAtMs = readClock(clock);
  const collectorPortDescriptor = validateK6BoundedResultCollectorPortDescriptor(
    boundedResultCollectorPort.descriptor);
  const sealRequest = createK6OutputRootSealRequest({
    ...p2Bindings,
    collectorPortDescriptor,
  });
  const sealReceipt = invokePort(
    boundedResultCollectorPort,
    'sealRoot',
    sealRequest,
    'K6_OUTPUT_ROOT_SEAL_REJECTED',
    'The injected collector port rejected logical root sealing',
  );
  const acceptedSealReceipt = validateK6OutputRootSealReceipt(
    sealReceipt, collectorPortDescriptor, sealRequest);
  const inspectionRequest = createK6OutputArtifactInspectionRequest({
    collectorPortDescriptor,
    p2Bindings,
    sealRequest,
    sealReceipt: acceptedSealReceipt,
  });
  const inspectionReceipt = invokePort(
    boundedResultCollectorPort,
    'inspectArtifact',
    inspectionRequest,
    'K6_OUTPUT_ARTIFACT_INSPECTION_REJECTED',
    'The injected collector port rejected exact artifact inspection',
  );
  const acceptedInspectionReceipt = validateK6OutputArtifactInspectionReceipt(
    inspectionReceipt, collectorPortDescriptor, inspectionRequest);
  const payloadRequest = createK6OutputArtifactPayloadRequest({
    collectorPortDescriptor,
    inspectionRequest,
    inspectionReceipt: acceptedInspectionReceipt,
  });
  const provided = invokePort(
    boundedResultCollectorPort,
    'provideArtifactPayload',
    payloadRequest,
    'K6_OUTPUT_ARTIFACT_PAYLOAD_REJECTED',
    'The injected collector port rejected transient payload delivery',
  );
  outputRootInvariant(provided && typeof provided === 'object'
      && !Array.isArray(provided)
      && Object.keys(provided).sort().join(',') === 'bytes,receipt',
  'K6_OUTPUT_ARTIFACT_PAYLOAD_RESPONSE_INVALID',
  'The injected collector port must return only bytes and a receipt');
  const acceptedPayloadReceipt = validateK6OutputArtifactPayloadReceipt(
    provided.receipt, collectorPortDescriptor, payloadRequest);
  const bytes = validateTransientBytes(provided.bytes, payloadRequest.maxBytes);
  outputRootInvariant(bytes.byteLength === acceptedPayloadReceipt.byteLength
      && rawSha256(bytes) === acceptedPayloadReceipt.contentDigest
      && bytes.byteLength === acceptedInspectionReceipt.byteLength,
  'K6_OUTPUT_ARTIFACT_PAYLOAD_BINDING_MISMATCH',
  'Transient payload bytes do not match inspection and receipt metadata');
  const parsed = parseK6BoundedJsonPayload(bytes, {
    maxBytes: payloadRequest.maxBytes,
    maxDepth: payloadRequest.maxDepth,
    bomAllowed: payloadRequest.bomAllowed,
    duplicateKeyPolicy: payloadRequest.duplicateKeyPolicy,
  });
  const finishedAtMs = readClock(clock);
  outputRootInvariant(finishedAtMs >= startedAtMs,
    'K6_OUTPUT_RESULT_CLOCK_INVALID',
    'Injected monotonic clock moved backwards');
  const collectionDurationMs = finishedAtMs - startedAtMs;
  outputRootInvariant(collectionDurationMs
      <= payloadRequest.maxCollectionDurationMs,
  'K6_OUTPUT_RESULT_COLLECTION_TIMEOUT',
  'Bounded result collection exceeded its duration limit');
  const acceptedP2 = validateAcceptedP2({
    ...p2Bindings,
    collectorPortDescriptor,
  });
  const result = createK6BoundedFileResult({
    acceptedP2,
    collectorPortDescriptor,
    sealRequest,
    sealReceipt: acceptedSealReceipt,
    inspectionRequest,
    inspectionReceipt: acceptedInspectionReceipt,
    payloadRequest,
    payloadReceipt: acceptedPayloadReceipt,
    parsed,
    collectionDurationMs,
  });
  return deepFreeze(cloneExecutionJson({
    collectorPortDescriptor,
    sealRequest,
    sealReceipt: acceptedSealReceipt,
    inspectionRequest,
    inspectionReceipt: acceptedInspectionReceipt,
    payloadRequest,
    payloadReceipt: acceptedPayloadReceipt,
    result,
  }));
}

function createK6BoundedFileResult({
  acceptedP2,
  collectorPortDescriptor,
  sealRequest,
  sealReceipt,
  inspectionRequest,
  inspectionReceipt,
  payloadRequest,
  payloadReceipt,
  parsed,
  collectionDurationMs,
}) {
  const port = validateK6BoundedResultCollectorPortDescriptor(
    collectorPortDescriptor);
  validateSealRequestSelfConsistency(sealRequest);
  validateK6OutputRootSealReceipt(sealReceipt, port, sealRequest);
  validateInspectionRequestSelfConsistency(inspectionRequest);
  validateK6OutputArtifactInspectionReceipt(
    inspectionReceipt, port, inspectionRequest);
  validatePayloadRequestSelfConsistency(payloadRequest);
  validateK6OutputArtifactPayloadReceipt(
    payloadReceipt, port, payloadRequest);
  outputRootInvariant(parsed && typeof parsed === 'object'
      && Number.isInteger(parsed.byteLength)
      && /^[a-f0-9]{64}$/u.test(parsed.contentDigest)
      && /^[a-f0-9]{64}$/u.test(parsed.canonicalJsonDigest)
      && Number.isInteger(parsed.maxDepthObserved)
      && Number.isInteger(parsed.topLevelKeyCount),
  'K6_BOUNDED_JSON_RESULT_INVALID',
  'Parsed bounded JSON result metadata is invalid');
  outputRootInvariant(Number.isInteger(collectionDurationMs)
      && collectionDurationMs >= 0
      && collectionDurationMs <= K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs,
  'K6_OUTPUT_RESULT_COLLECTION_TIMEOUT',
  'Collection duration is invalid');
  const identity = {
    collectorPortDigest: port.portDigest,
    rootContractDigest: acceptedP2.rootContract.contractDigest,
    p2BoundaryEvidenceDigest: acceptedP2.boundaryEvidence.evidenceDigest,
    payloadReceiptDigest: payloadReceipt.receiptDigest,
    canonicalJsonDigest: parsed.canonicalJsonDigest,
  };
  const withoutDigest = {
    schemaVersion: K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION,
    resultId: `k6bounded-result-${sha256(identity).slice(0, 20)}`,
    collectorPortDigest: port.portDigest,
    rootContractId: acceptedP2.rootContract.rootContractId,
    rootContractDigest: acceptedP2.rootContract.contractDigest,
    p2BoundaryEvidenceDigest: acceptedP2.boundaryEvidence.evidenceDigest,
    sealRequestDigest: sealRequest.requestDigest,
    sealReceiptDigest: sealReceipt.receiptDigest,
    inspectionRequestDigest: inspectionRequest.requestDigest,
    inspectionReceiptDigest: inspectionReceipt.receiptDigest,
    payloadRequestDigest: payloadRequest.requestDigest,
    payloadReceiptDigest: payloadReceipt.receiptDigest,
    lifecycle: {
      initialState: 'ALLOCATED',
      currentState: 'COLLECTED',
      transitionPath: RESULT_TRANSITION_PATH.map((item) => ({ ...item })),
      sealed: true,
      collected: true,
      cleanupAuthorized: false,
      cleaned: false,
    },
    artifact: {
      descriptorId: acceptedP2.descriptor.descriptorId,
      descriptorDigest: acceptedP2.descriptor.descriptorDigest,
      kind: acceptedP2.descriptor.kind,
      relativePath: acceptedP2.descriptor.relativePath,
      allocationHandle: acceptedP2.allocationReceipt.allocationHandle,
      artifactHandle: acceptedP2.resolutionReceipt.artifactHandle,
      byteLength: parsed.byteLength,
      encoding: 'UTF-8',
      contentDigest: parsed.contentDigest,
      canonicalJsonDigest: parsed.canonicalJsonDigest,
      maxDepthObserved: parsed.maxDepthObserved,
      topLevelKeyCount: parsed.topLevelKeyCount,
      regularFileAttested: true,
      symbolicLink: false,
      hardLink: false,
      specialFile: false,
      rawPayloadIncluded: false,
    },
    limits: cloneExecutionJson(K6_OUTPUT_ROOT_LIMITS),
    collectionDurationMs,
    decision: cloneExecutionJson(K6_OUTPUT_ROOT_P3_DECISION),
    safetyBoundary: cloneExecutionJson(K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY),
  };
  const result = freezeWithDigest(withoutDigest, 'resultDigest');
  validateBoundedFileResultSelfConsistency(result);
  return result;
}

export function validateK6BoundedFileResult(input, bindings) {
  validateBoundedFileResultSelfConsistency(input);
  exactFields(bindings, [
    'collectorPortDescriptor', 'p2Bindings', 'sealRequest', 'sealReceipt',
    'inspectionRequest', 'inspectionReceipt', 'payloadRequest',
    'payloadReceipt',
  ], 'INVALID_K6_BOUNDED_FILE_RESULT_BINDINGS',
  'Bounded file result bindings');
  const collectorPortDescriptor = validateK6BoundedResultCollectorPortDescriptor(
    bindings.collectorPortDescriptor);
  const acceptedP2 = validateAcceptedP2({
    ...bindings.p2Bindings,
    collectorPortDescriptor,
  });
  const sealRequest = validateK6OutputRootSealRequest(bindings.sealRequest, {
    ...bindings.p2Bindings,
    collectorPortDescriptor,
  });
  const sealReceipt = validateK6OutputRootSealReceipt(
    bindings.sealReceipt, collectorPortDescriptor, sealRequest);
  const inspectionRequest = validateK6OutputArtifactInspectionRequest(
    bindings.inspectionRequest,
    {
      collectorPortDescriptor,
      p2Bindings: bindings.p2Bindings,
      sealRequest,
      sealReceipt,
    },
  );
  const inspectionReceipt = validateK6OutputArtifactInspectionReceipt(
    bindings.inspectionReceipt, collectorPortDescriptor, inspectionRequest);
  const payloadRequest = validateK6OutputArtifactPayloadRequest(
    bindings.payloadRequest,
    { collectorPortDescriptor, inspectionRequest, inspectionReceipt },
  );
  const payloadReceipt = validateK6OutputArtifactPayloadReceipt(
    bindings.payloadReceipt, collectorPortDescriptor, payloadRequest);
  const expected = createK6BoundedFileResult({
    acceptedP2,
    collectorPortDescriptor,
    sealRequest,
    sealReceipt,
    inspectionRequest,
    inspectionReceipt,
    payloadRequest,
    payloadReceipt,
    parsed: {
      byteLength: input.artifact.byteLength,
      contentDigest: input.artifact.contentDigest,
      canonicalJsonDigest: input.artifact.canonicalJsonDigest,
      maxDepthObserved: input.artifact.maxDepthObserved,
      topLevelKeyCount: input.artifact.topLevelKeyCount,
    },
    collectionDurationMs: input.collectionDurationMs,
  });
  outputRootInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_BOUNDED_FILE_RESULT_MISMATCH',
    'Bounded file result does not match the accepted P2 and collector chain');
  return expected;
}

export function validateK6BoundedFileResultShape(input) {
  validateBoundedFileResultSelfConsistency(input);
  return deepFreeze(cloneExecutionJson(input));
}

export function computeK6BoundedFileResultDigest(input) {
  validateBoundedFileResultSelfConsistency(input, false);
  return digestWithout(input, 'resultDigest');
}

