import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_OUTPUT_ROOT_LIMITS,
  K6_OUTPUT_ROOT_P3_DECISION,
  K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY,
  computeK6BoundedFileResultDigest,
  computeK6BoundedResultCollectorPortDigest,
  computeK6OutputArtifactInspectionReceiptDigest,
  computeK6OutputArtifactInspectionRequestDigest,
  computeK6OutputArtifactPayloadReceiptDigest,
  computeK6OutputArtifactPayloadRequestDigest,
  computeK6OutputRootSealReceiptDigest,
  computeK6OutputRootSealRequestDigest,
  createK6BoundedResultCollectorPortDescriptor,
  parseK6BoundedJsonPayload,
  validateK6BoundedFileResult,
} from '../src/index.js';
import { validateJsonSchemaDraft202012 } from '../../../scripts/json-schema-draft-2020.js';
import {
  boundedFileResultCollectorFixture,
  encodeK6SummaryJson,
} from './bounded-file-result-collector-test-helpers.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

test('P3 collector descriptor is deterministic, platform-owned and fake-only', () => {
  const first = createK6BoundedResultCollectorPortDescriptor();
  const second = createK6BoundedResultCollectorPortDescriptor();
  assert.deepEqual(first, second);
  assert.equal(first.implementationStatus, 'INJECTED_FAKE_ONLY');
  assert.equal(first.ownership, 'PLATFORM_OWNED');
  assert.equal(first.capabilities.sealLogicalRoot, true);
  assert.equal(first.capabilities.inspectDeclaredArtifact, true);
  assert.equal(first.capabilities.provideTransientPayload, true);
  assert.equal(first.capabilities.accessRealFilesystem, false);
  assert.equal(first.capabilities.returnHostPath, false);
  assert.equal(first.capabilities.persistRawPayload, false);
});

test('P3 collector descriptor digest independently recomputes', () => {
  const descriptor = createK6BoundedResultCollectorPortDescriptor();
  assert.equal(computeK6BoundedResultCollectorPortDigest(descriptor),
    descriptor.portDigest);
});

test('P3 seal request binds the exact accepted P2 chain', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const request = fixture.sealRequest;
  assert.equal(request.p2BoundaryEvidenceDigest,
    fixture.p2.boundaryEvidence.evidenceDigest);
  assert.equal(request.rootContractDigest,
    fixture.p2.p1.outputRootContract.contractDigest);
  assert.equal(request.allocationHandle,
    fixture.p2.allocationReceipt.allocationHandle);
  assert.equal(request.terminalOutcomeDigest,
    fixture.p2.p1.outputRootContract.predecessor.runtimeOutcomeDigest);
  assert.equal(request.sourceBundleDigest,
    fixture.p2.p1.outputRootContract.predecessor.sourceBundleDigest);
  assert.deepEqual(request.transitionPath, [
    { from: 'ALLOCATED', to: 'ACTIVE' },
    { from: 'ACTIVE', to: 'TERMINAL_OBSERVED' },
    { from: 'TERMINAL_OBSERVED', to: 'SEALED' },
  ]);
  assert.equal(computeK6OutputRootSealRequestDigest(request),
    request.requestDigest);
});

test('P3 seal receipt records only a logical sealed state', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const receipt = fixture.sealReceipt;
  assert.equal(receipt.sealed, true);
  assert.equal(receipt.currentState, 'SEALED');
  assert.equal(receipt.realDirectoryCreated, false);
  assert.equal(receipt.realFilesystemAccessed, false);
  assert.equal(receipt.hostPathIncluded, false);
  assert.equal(receipt.sourceBundleMutated, false);
  assert.equal(computeK6OutputRootSealReceiptDigest(receipt),
    receipt.receiptDigest);
});

test('P3 inspection request remains bound to the exact summary artifact', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const request = fixture.inspectionRequest;
  assert.equal(request.descriptorId, 'k6-output-summary-json');
  assert.equal(request.kind, 'k6-run-summary-json');
  assert.equal(request.relativePath, 'outputs/summary.json');
  assert.equal(request.maxBytes, 1_048_576);
  assert.equal(request.regularFileRequired, true);
  assert.equal(request.symbolicLinkAllowed, false);
  assert.equal(request.hardLinkAllowed, false);
  assert.equal(request.specialFileAllowed, false);
  assert.equal(computeK6OutputArtifactInspectionRequestDigest(request),
    request.requestDigest);
});

test('P3 inspection receipt attests a stable regular file without host access', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const receipt = fixture.inspectionReceipt;
  assert.equal(receipt.objectType, 'REGULAR_FILE');
  assert.equal(receipt.regularFileAttested, true);
  assert.equal(receipt.symbolicLink, false);
  assert.equal(receipt.hardLink, false);
  assert.equal(receipt.specialFile, false);
  assert.equal(receipt.stableObjectAttested, true);
  assert.equal(receipt.byteLength,
    fixture.boundedResultCollectorPort.bytes.byteLength);
  assert.equal(receipt.realFilesystemAccessed, false);
  assert.equal(receipt.hostPathIncluded, false);
  assert.equal(computeK6OutputArtifactInspectionReceiptDigest(receipt),
    receipt.receiptDigest);
});

test('P3 payload request fixes all byte, parser and duration bounds', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const request = fixture.payloadRequest;
  assert.equal(request.maxBytes, K6_OUTPUT_ROOT_LIMITS.maxFileBytes);
  assert.equal(request.maxDepth, K6_OUTPUT_ROOT_LIMITS.maxJsonDepth);
  assert.equal(request.maxCollectionDurationMs,
    K6_OUTPUT_ROOT_LIMITS.maxCollectionDurationMs);
  assert.equal(request.encoding, 'UTF-8');
  assert.equal(request.duplicateKeyPolicy, 'REJECT');
  assert.equal(request.bomAllowed, false);
  assert.equal(computeK6OutputArtifactPayloadRequestDigest(request),
    request.requestDigest);
});

test('P3 payload receipt contains only bounded metadata', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const receipt = fixture.payloadReceipt;
  assert.equal(receipt.byteLength,
    fixture.boundedResultCollectorPort.bytes.byteLength);
  assert.match(receipt.contentDigest, /^[a-f0-9]{64}$/u);
  assert.equal(receipt.complete, true);
  assert.equal(receipt.rawPayloadPersisted, false);
  assert.equal(receipt.realFilesystemAccessed, false);
  assert.equal(receipt.hostPathIncluded, false);
  assert.equal(computeK6OutputArtifactPayloadReceiptDigest(receipt),
    receipt.receiptDigest);
});

test('P3 result advances only through the adjacent sealed collection path', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  assert.deepEqual(fixture.result.lifecycle, {
    initialState: 'ALLOCATED',
    currentState: 'COLLECTED',
    transitionPath: [
      { from: 'ALLOCATED', to: 'ACTIVE' },
      { from: 'ACTIVE', to: 'TERMINAL_OBSERVED' },
      { from: 'TERMINAL_OBSERVED', to: 'SEALED' },
      { from: 'SEALED', to: 'COLLECTED' },
    ],
    sealed: true,
    collected: true,
    cleanupAuthorized: false,
    cleaned: false,
  });
});

test('P3 result exposes metadata and digests but no raw payload', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const artifact = fixture.result.artifact;
  assert.equal(artifact.relativePath, 'outputs/summary.json');
  assert.equal(artifact.byteLength,
    fixture.boundedResultCollectorPort.bytes.byteLength);
  assert.match(artifact.contentDigest, /^[a-f0-9]{64}$/u);
  assert.match(artifact.canonicalJsonDigest, /^[a-f0-9]{64}$/u);
  assert.equal(artifact.maxDepthObserved > 0, true);
  assert.equal(artifact.topLevelKeyCount, 2);
  assert.equal(artifact.rawPayloadIncluded, false);
  assert.equal(JSON.stringify(fixture.result).includes('"passes"'), false);
});

test('P3 result digest and exact predecessor chain independently validate', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  assert.equal(computeK6BoundedFileResultDigest(fixture.result),
    fixture.result.resultDigest);
  assert.deepEqual(validateK6BoundedFileResult(fixture.result, {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    p2Bindings: fixture.p2Bindings,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
    inspectionRequest: fixture.inspectionRequest,
    inspectionReceipt: fixture.inspectionReceipt,
    payloadRequest: fixture.payloadRequest,
    payloadReceipt: fixture.payloadReceipt,
  }), fixture.result);
});

test('P3 products are deterministic for cloned accepted inputs', async () => {
  const first = await boundedFileResultCollectorFixture();
  const second = await boundedFileResultCollectorFixture({
    p2Fixture: clone(first.p2),
    bytes: Uint8Array.from(first.boundedResultCollectorPort.bytes),
    clockValues: [1_000, 1_005],
  });
  assert.deepEqual(second.collectorPortDescriptor, first.collectorPortDescriptor);
  assert.deepEqual(second.sealRequest, first.sealRequest);
  assert.deepEqual(second.sealReceipt, first.sealReceipt);
  assert.deepEqual(second.inspectionRequest, first.inspectionRequest);
  assert.deepEqual(second.inspectionReceipt, first.inspectionReceipt);
  assert.deepEqual(second.payloadRequest, first.payloadRequest);
  assert.deepEqual(second.payloadReceipt, first.payloadReceipt);
  assert.deepEqual(second.result, first.result);
});

test('P3 public products are deeply frozen', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const values = [
    fixture.collectorPortDescriptor,
    fixture.collectorPortDescriptor.capabilities,
    fixture.sealRequest,
    fixture.sealRequest.transitionPath,
    fixture.sealReceipt,
    fixture.inspectionRequest,
    fixture.inspectionReceipt,
    fixture.payloadRequest,
    fixture.payloadReceipt,
    fixture.result,
    fixture.result.lifecycle,
    fixture.result.lifecycle.transitionPath,
    fixture.result.artifact,
    fixture.result.limits,
    fixture.result.decision,
    fixture.result.safetyBoundary,
  ];
  assert.equal(values.every(Object.isFrozen), true);
  assert.throws(() => {
    fixture.result.lifecycle.currentState = 'CLEANED';
  }, TypeError);
});

test('P3 injected port receives deeply frozen requests in exact order', async () => {
  const fixture = await boundedFileResultCollectorFixture();
  const calls = fixture.boundedResultCollectorPort.calls;
  assert.equal(calls.sealRoot.length, 1);
  assert.equal(calls.inspectArtifact.length, 1);
  assert.equal(calls.provideArtifactPayload.length, 1);
  for (const request of [
    calls.sealRoot[0],
    calls.inspectArtifact[0],
    calls.provideArtifactPayload[0],
  ]) {
    assert.equal(Object.isFrozen(request), true);
  }
  assert.equal(Object.isFrozen(calls.sealRoot[0].transitionPath), true);
});

test('P3 canonical JSON digest is whitespace and key-order stable', () => {
  const first = parseK6BoundedJsonPayload(
    encodeK6SummaryJson('{"b":2,"a":{"x":1}}'));
  const second = parseK6BoundedJsonPayload(
    encodeK6SummaryJson('{\n  "a": { "x": 1 }, "b": 2\n}'));
  assert.notEqual(first.contentDigest, second.contentDigest);
  assert.equal(first.canonicalJsonDigest, second.canonicalJsonDigest);
  assert.equal(first.topLevelKeyCount, 2);
  assert.equal(second.maxDepthObserved, 2);
});

test('P3 Schema Catalog pins nine closed Draft 2020-12 contracts', async () => {
  const catalog = JSON.parse(await readRepositoryFile(
    'schemas/execution/k6-api-runtime/p3-bounded-result-schema-catalog.json'));
  assert.equal(catalog.schemaVersion,
    'k6-output-root-p3-schema-catalog/v1');
  assert.deepEqual(catalog.schemas.map(({ schemaVersion }) => schemaVersion), [
    'k6-bounded-result-collector-port/v1',
    'k6-output-root-seal-request/v1',
    'k6-output-root-seal-receipt/v1',
    'k6-output-artifact-inspection-request/v1',
    'k6-output-artifact-inspection-receipt/v1',
    'k6-output-artifact-payload-request/v1',
    'k6-output-artifact-payload-receipt/v1',
    'k6-bounded-file-result/v1',
    'm3-r4-output-root-p3-evidence/v1',
  ]);
  const schemas = await Promise.all(catalog.schemas.map(async ({ path }) =>
    JSON.parse(await readRepositoryFile(path))));
  assert.equal(schemas.every((schema) =>
    schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
      && schema.additionalProperties === false), true);
  const fixture = await boundedFileResultCollectorFixture();
  const products = [
    fixture.collectorPortDescriptor,
    fixture.sealRequest,
    fixture.sealReceipt,
    fixture.inspectionRequest,
    fixture.inspectionReceipt,
    fixture.payloadRequest,
    fixture.payloadReceipt,
    fixture.result,
  ];
  products.forEach((product, index) => validateJsonSchemaDraft202012(
    product, schemas[index], `P3 product ${index}`));
});

test('P3 decision advances only to fault and compatibility acceptance', () => {
  assert.equal(K6_OUTPUT_ROOT_P3_DECISION.boundedResultCollectorReady, true);
  assert.equal(K6_OUTPUT_ROOT_P3_DECISION.boundedJsonResultCollected, true);
  assert.equal(K6_OUTPUT_ROOT_P3_DECISION.realFilesystemCollectorImplemented,
    false);
  assert.equal(K6_OUTPUT_ROOT_P3_DECISION.rawPayloadPersisted, false);
  assert.equal(K6_OUTPUT_ROOT_P3_DECISION.nextRequiredSlice, 'M3-R4-P4');
  assert.deepEqual(K6_OUTPUT_ROOT_P3_DECISION.repositoryBlockers, []);
  assert.equal(Object.values(K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY)
    .every((value) => value === false), true);
});
