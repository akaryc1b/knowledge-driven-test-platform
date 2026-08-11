import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_OUTPUT_ROOT_P2_DECISION,
  K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY,
  computeK6OutputArtifactResolutionReceiptDigest,
  computeK6OutputArtifactResolutionRequestDigest,
  computeK6OutputRootAllocationReceiptDigest,
  computeK6OutputRootAllocationRequestDigest,
  computeK6TrustedOutputRootBoundaryEvidenceDigest,
  computeK6TrustedOutputRootPortDigest,
  createK6OutputArtifactResolutionRequest,
  createK6OutputRootAllocationRequest,
  createK6TrustedOutputRootPortDescriptor,
  prepareK6TrustedOutputRoot,
  validateK6OutputArtifactResolutionReceipt,
  validateK6OutputArtifactResolutionRequest,
  validateK6OutputRootAllocationReceipt,
  validateK6OutputRootAllocationRequest,
  validateK6TrustedOutputRootBoundaryEvidence,
  validateK6TrustedOutputRootPortDescriptor,
} from '../src/index.js';
import { validateJsonSchemaDraft202012 } from '../../../scripts/json-schema-draft-2020.js';
import {
  createTrustedOutputRootFake,
  trustedOutputRootPortFixture,
} from './trusted-output-root-port-test-helpers.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function redigest(value, field) {
  const copy = clone(value);
  delete copy[field];
  value[field] = sha256(copy);
}

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

test('P2 port descriptor is deterministic, platform-owned and fake-only', () => {
  const first = createK6TrustedOutputRootPortDescriptor();
  const second = createK6TrustedOutputRootPortDescriptor();
  assert.deepEqual(first, second);
  assert.equal(first.implementationStatus, 'INJECTED_FAKE_ONLY');
  assert.equal(first.ownership, 'PLATFORM_OWNED');
  assert.equal(first.capabilities.allocateLogicalRoot, true);
  assert.equal(first.capabilities.resolveDeclaredArtifact, true);
  assert.equal(first.capabilities.createRealDirectory, false);
  assert.equal(first.capabilities.accessRealFilesystem, false);
  assert.equal(first.capabilities.returnHostPath, false);
});

test('P2 port descriptor digest independently recomputes', () => {
  const descriptor = createK6TrustedOutputRootPortDescriptor();
  assert.equal(computeK6TrustedOutputRootPortDigest(descriptor),
    descriptor.portDigest);
});

test('P2 allocation request binds the exact P1 root contract and descriptor', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const request = fixture.allocationRequest;
  assert.equal(request.rootContractId, fixture.p1.outputRootContract.rootContractId);
  assert.equal(request.rootContractDigest,
    fixture.p1.outputRootContract.contractDigest);
  assert.deepEqual(request.artifactDescriptorDigests, [
    fixture.p1.outputRootContract.artifacts[0].descriptorDigest,
  ]);
  assert.deepEqual(request.transition, { from: 'DECLARED', to: 'ALLOCATED' });
  assert.equal(request.callerPathAccepted, false);
  assert.equal(request.absolutePathAccepted, false);
  assert.equal(request.hostPathIncluded, false);
  assert.equal(computeK6OutputRootAllocationRequestDigest(request),
    request.requestDigest);
});

test('P2 injected fake receives immutable allocation and resolution requests', async () => {
  const fixture = await trustedOutputRootPortFixture();
  assert.equal(fixture.trustedOutputRootPort.calls.allocateRoot.length, 1);
  assert.equal(fixture.trustedOutputRootPort.calls.resolveArtifact.length, 1);
  const allocation = fixture.trustedOutputRootPort.calls.allocateRoot[0];
  const resolution = fixture.trustedOutputRootPort.calls.resolveArtifact[0];
  assert.equal(Object.isFrozen(allocation), true);
  assert.equal(Object.isFrozen(allocation.transition), true);
  assert.equal(Object.isFrozen(resolution), true);
  assert.throws(() => {
    resolution.relativePath = 'outputs/other.json';
  }, TypeError);
});

test('P2 allocation receipt creates only a logical opaque allocation', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const receipt = fixture.allocationReceipt;
  assert.match(receipt.allocationHandle, /^k6root-handle-[a-f0-9]{20}$/u);
  assert.equal(receipt.logicalRootAllocated, true);
  assert.equal(receipt.currentState, 'ALLOCATED');
  assert.equal(receipt.realDirectoryCreated, false);
  assert.equal(receipt.realFilesystemAccessed, false);
  assert.equal(receipt.hostPathIncluded, false);
  assert.equal(receipt.sourceBundleMutated, false);
  assert.equal(computeK6OutputRootAllocationReceiptDigest(receipt),
    receipt.receiptDigest);
});

test('P2 resolution request remains bound to the exact summary descriptor', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const request = fixture.resolutionRequest;
  assert.equal(request.descriptorId, 'k6-output-summary-json');
  assert.equal(request.kind, 'k6-run-summary-json');
  assert.equal(request.relativePath, 'outputs/summary.json');
  assert.equal(request.regularFileRequired, true);
  assert.equal(request.symbolicLinkAllowed, false);
  assert.equal(request.hardLinkAllowed, false);
  assert.equal(request.specialFileAllowed, false);
  assert.equal(request.openAuthorized, false);
  assert.equal(request.readAuthorized, false);
  assert.equal(request.writeAuthorized, false);
  assert.equal(computeK6OutputArtifactResolutionRequestDigest(request),
    request.requestDigest);
});

test('P2 resolution receipt returns an opaque handle without opening an object', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const receipt = fixture.resolutionReceipt;
  assert.match(receipt.artifactHandle, /^k6artifact-handle-[a-f0-9]{20}$/u);
  assert.equal(receipt.resolved, true);
  assert.equal(receipt.opaqueHandleReturned, true);
  assert.equal(receipt.regularFileVerified, false);
  assert.equal(receipt.objectOpened, false);
  assert.equal(receipt.fileRead, false);
  assert.equal(receipt.fileWritten, false);
  assert.equal(receipt.realFilesystemAccessed, false);
  assert.equal(computeK6OutputArtifactResolutionReceiptDigest(receipt),
    receipt.receiptDigest);
});

test('P2 boundary Evidence binds every request and receipt digest', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const evidence = fixture.boundaryEvidence;
  assert.equal(evidence.portDigest, fixture.portDescriptor.portDigest);
  assert.equal(evidence.rootContractDigest,
    fixture.p1.outputRootContract.contractDigest);
  assert.equal(evidence.allocationRequestDigest,
    fixture.allocationRequest.requestDigest);
  assert.equal(evidence.allocationReceiptDigest,
    fixture.allocationReceipt.receiptDigest);
  assert.equal(evidence.resolutionRequestDigest,
    fixture.resolutionRequest.requestDigest);
  assert.equal(evidence.resolutionReceiptDigest,
    fixture.resolutionReceipt.receiptDigest);
  assert.deepEqual(evidence.lifecycle, {
    initialState: 'DECLARED',
    currentState: 'ALLOCATED',
    logicalAllocationCompleted: true,
    realDirectoryCreated: false,
    sealed: false,
    collectionAuthorized: false,
    cleanupAuthorized: false,
  });
  assert.equal(computeK6TrustedOutputRootBoundaryEvidenceDigest(evidence),
    evidence.evidenceDigest);
});

test('P2 products are deterministic for cloned accepted inputs', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const port = createTrustedOutputRootFake();
  const recreated = prepareK6TrustedOutputRoot({
    trustedOutputRootPort: port,
    rootContract: clone(fixture.p1.outputRootContract),
    contractBindings: clone(fixture.p1.contractBindings),
  });
  assert.deepEqual(recreated.portDescriptor, fixture.portDescriptor);
  assert.deepEqual(recreated.allocationRequest, fixture.allocationRequest);
  assert.deepEqual(recreated.allocationReceipt, fixture.allocationReceipt);
  assert.deepEqual(recreated.resolutionRequest, fixture.resolutionRequest);
  assert.deepEqual(recreated.resolutionReceipt, fixture.resolutionReceipt);
  assert.deepEqual(recreated.boundaryEvidence, fixture.boundaryEvidence);
});

test('P2 products are deeply frozen', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const values = [
    fixture.portDescriptor,
    fixture.portDescriptor.capabilities,
    fixture.allocationRequest,
    fixture.allocationRequest.transition,
    fixture.allocationReceipt,
    fixture.resolutionRequest,
    fixture.resolutionReceipt,
    fixture.boundaryEvidence,
    fixture.boundaryEvidence.lifecycle,
    fixture.boundaryEvidence.artifact,
    fixture.boundaryEvidence.decision,
    fixture.boundaryEvidence.safetyBoundary,
  ];
  assert.equal(values.every(Object.isFrozen), true);
  assert.throws(() => {
    fixture.boundaryEvidence.lifecycle.currentState = 'COLLECTED';
  }, TypeError);
});

test('P2 rejects a missing or incomplete injected port', async () => {
  const p1 = (await trustedOutputRootPortFixture()).p1;
  assert.throws(() => prepareK6TrustedOutputRoot({
    trustedOutputRootPort: null,
    rootContract: p1.outputRootContract,
    contractBindings: p1.contractBindings,
  }), /injected TrustedOutputRootPort/u);
  assert.throws(() => prepareK6TrustedOutputRoot({
    trustedOutputRootPort: {
      descriptor: createK6TrustedOutputRootPortDescriptor(),
      allocateRoot() {},
    },
    rootContract: p1.outputRootContract,
    contractBindings: p1.contractBindings,
  }), /allocate a logical root and resolve an artifact/u);
});

test('P2 rejects a self-redigested port capability escalation', () => {
  const descriptor = clone(createK6TrustedOutputRootPortDescriptor());
  descriptor.capabilities.accessRealFilesystem = true;
  redigest(descriptor, 'portDigest');
  assert.throws(() => validateK6TrustedOutputRootPortDescriptor(descriptor),
    /fake-only|widens|mismatch/u);
});

test('P2 sanitizes injected allocation failures', async () => {
  const p1 = (await trustedOutputRootPortFixture()).p1;
  const port = createTrustedOutputRootFake({
    allocationError: new Error('SECRET_HOST_PATH=/private/root'),
  });
  assert.throws(() => prepareK6TrustedOutputRoot({
    trustedOutputRootPort: port,
    rootContract: p1.outputRootContract,
    contractBindings: p1.contractBindings,
  }), (error) => {
    assert.equal(error.code, 'K6_TRUSTED_OUTPUT_ROOT_ALLOCATION_REJECTED');
    assert.equal(JSON.stringify(error).includes('SECRET_HOST_PATH'), false);
    return true;
  });
});

test('P2 rejects allocation receipts that disclose a host path', async () => {
  const p1 = (await trustedOutputRootPortFixture()).p1;
  const port = createTrustedOutputRootFake({
    mutateAllocationReceipt(receipt) {
      receipt.hostPath = '/private/output-root';
      redigest(receipt, 'receiptDigest');
      return receipt;
    },
  });
  assert.throws(() => prepareK6TrustedOutputRoot({
    trustedOutputRootPort: port,
    rootContract: p1.outputRootContract,
    contractBindings: p1.contractBindings,
  }), /fields|receipt/u);
});

test('P2 rejects P1 root-contract substitution after self-redigest', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const forged = clone(fixture.p1.outputRootContract);
  forged.rootContractId = 'k6output-root-contract-aaaaaaaaaaaaaaaaaaaa';
  redigest(forged, 'contractDigest');
  assert.throws(() => createK6OutputRootAllocationRequest({
    portDescriptor: fixture.portDescriptor,
    rootContract: forged,
    contractBindings: fixture.p1.contractBindings,
  }), /contract|predecessor|mismatch/u);
});

test('P2 rejects artifact descriptor substitution in a resolution request', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const forged = clone(fixture.resolutionRequest);
  forged.relativePath = 'outputs/other.json';
  redigest(forged, 'requestDigest');
  assert.throws(() => validateK6OutputArtifactResolutionRequest(forged, {
    portDescriptor: fixture.portDescriptor,
    rootContract: fixture.p1.outputRootContract,
    contractBindings: fixture.p1.contractBindings,
    allocationRequest: fixture.allocationRequest,
    allocationReceipt: fixture.allocationReceipt,
  }), /allow-list|resolution request|mismatch/u);
});

test('P2 rejects resolution receipts that claim a real file read', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const forged = clone(fixture.resolutionReceipt);
  forged.fileRead = true;
  redigest(forged, 'receiptDigest');
  assert.throws(() => validateK6OutputArtifactResolutionReceipt(
    forged, fixture.portDescriptor, fixture.resolutionRequest),
  /unsupported host effect|receipt/u);
});

test('P2 public products disclose no host path, PID, raw output or credential', async () => {
  const fixture = await trustedOutputRootPortFixture();
  const serialized = JSON.stringify({
    port: fixture.portDescriptor,
    allocation: fixture.allocationRequest,
    allocationReceipt: fixture.allocationReceipt,
    resolution: fixture.resolutionRequest,
    resolutionReceipt: fixture.resolutionReceipt,
    evidence: fixture.boundaryEvidence,
  });
  for (const forbidden of [
    fixture.p1.processFixture.workingDirectoryPath,
    String(fixture.p1.processFixture.child.pid),
    '/private/output-root',
    'C:\\private\\output-root',
    'Bearer ',
    'SECRET_HOST_PATH',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('P2 production module contains no filesystem, process or environment primitive', async () => {
  const source = await readRepositoryFile(
    'packages/k6-api-adapter/src/trusted-output-root-port.js');
  for (const forbidden of [
    'node:fs',
    'node:path',
    'node:child_process',
    'process.env',
    'mkdir(',
    'readFile(',
    'writeFile(',
    'readdir(',
    'realpath(',
    'spawn(',
    'exec(',
  ]) {
    assert.equal(source.includes(forbidden), false, forbidden);
  }
});

test('P2 Schema Catalog pins seven closed Draft 2020-12 contracts', async () => {
  const catalog = JSON.parse(await readRepositoryFile(
    'schemas/execution/k6-api-runtime/p2-trusted-output-root-schema-catalog.json'));
  assert.equal(catalog.schemaVersion,
    'k6-output-root-p2-schema-catalog/v1');
  assert.deepEqual(catalog.schemas.map(({ schemaVersion }) => schemaVersion), [
    'k6-trusted-output-root-port/v1',
    'k6-output-root-allocation-request/v1',
    'k6-output-root-allocation-receipt/v1',
    'k6-output-artifact-resolution-request/v1',
    'k6-output-artifact-resolution-receipt/v1',
    'k6-trusted-output-root-boundary-evidence/v1',
    'm3-r4-output-root-p2-evidence/v1',
  ]);
  const schemas = await Promise.all(catalog.schemas.map(async ({ path }) =>
    JSON.parse(await readRepositoryFile(path))));
  assert.equal(schemas.every((schema) =>
    schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
      && schema.additionalProperties === false), true);

  const fixture = await trustedOutputRootPortFixture();
  const products = [
    fixture.portDescriptor,
    fixture.allocationRequest,
    fixture.allocationReceipt,
    fixture.resolutionRequest,
    fixture.resolutionReceipt,
    fixture.boundaryEvidence,
  ];
  products.forEach((product, index) => validateJsonSchemaDraft202012(
    product, schemas[index], `P2 product ${index}`));
});

test('P2 decision advances only to the bounded collector', () => {
  assert.equal(K6_OUTPUT_ROOT_P2_DECISION.trustedOutputRootPortReady, true);
  assert.equal(K6_OUTPUT_ROOT_P2_DECISION.logicalRootAllocated, true);
  assert.equal(K6_OUTPUT_ROOT_P2_DECISION.outputDirectoryCreated, false);
  assert.equal(K6_OUTPUT_ROOT_P2_DECISION.fileResultCollectionImplemented, false);
  assert.equal(K6_OUTPUT_ROOT_P2_DECISION.nextRequiredSlice, 'M3-R4-P3');
  assert.deepEqual(K6_OUTPUT_ROOT_P2_DECISION.repositoryBlockers, []);
  assert.equal(Object.values(K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY)
    .every((value) => value === false), true);
});
