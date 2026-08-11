import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES,
  K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_TRANSITIONS,
  K6_OUTPUT_ROOT_LIMITS,
  K6_OUTPUT_ROOT_P1_DECISION,
  K6_OUTPUT_ROOT_P1_SAFETY_BOUNDARY,
  computeK6GovernedOutputRootContractDigest,
  computeK6GovernedOutputRootPolicyDigest,
  computeK6OutputArtifactDescriptorDigest,
  createK6GovernedOutputRootContract,
  createK6GovernedOutputRootPolicy,
  createK6OutputArtifactDescriptor,
  validateK6GovernedOutputRootContract,
  validateK6GovernedOutputRootPolicy,
  validateK6OutputArtifactDescriptor,
  validateK6OutputArtifactRelativePath,
} from '../src/index.js';
import { validateJsonSchemaDraft202012 } from '../../../scripts/json-schema-draft-2020.js';
import { outputRootContractFixture } from './output-root-contract-test-helpers.js';

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

test('P1 policy is deterministic, platform-owned and contract-only', () => {
  const first = createK6GovernedOutputRootPolicy();
  const second = createK6GovernedOutputRootPolicy();
  assert.deepEqual(first, second);
  assert.equal(first.implementationStatus, 'CONTRACT_ONLY');
  assert.equal(first.ownership, 'PLATFORM_OWNED');
  assert.equal(first.role, 'EXECUTION_SCOPED_WRITABLE_RESULTS');
  assert.equal(first.hostPathIncluded, false);
  assert.equal(first.callerPathAccepted, false);
  assert.equal(first.recursiveDiscoveryAllowed, false);
  assert.deepEqual(first.limits, K6_OUTPUT_ROOT_LIMITS);
});

test('P1 policy digest independently recomputes', () => {
  const policy = createK6GovernedOutputRootPolicy();
  assert.equal(computeK6GovernedOutputRootPolicyDigest(policy), policy.policyDigest);
});

test('P1 artifact descriptor fixes the exact summary allow-list', () => {
  const descriptor = createK6OutputArtifactDescriptor();
  assert.equal(descriptor.kind, 'k6-run-summary-json');
  assert.equal(descriptor.relativePath, 'outputs/summary.json');
  assert.equal(descriptor.mediaType, 'application/json');
  assert.equal(descriptor.encoding, 'UTF-8');
  assert.equal(descriptor.regularFileRequired, true);
  assert.equal(descriptor.symbolicLinkAllowed, false);
  assert.equal(descriptor.hardLinkAllowed, false);
  assert.equal(descriptor.specialFileAllowed, false);
  assert.equal(descriptor.maxBytes, 1_048_576);
  assert.equal(descriptor.parser.maxDepth, 32);
  assert.equal(computeK6OutputArtifactDescriptorDigest(descriptor),
    descriptor.descriptorDigest);
});

test('P1 path grammar rejects traversal, absolute, URI, drive, UNC, NUL and mixed separators', () => {
  assert.equal(validateK6OutputArtifactRelativePath('outputs/summary.json'),
    'outputs/summary.json');
  for (const path of [
    '../summary.json',
    'outputs/../summary.json',
    '/outputs/summary.json',
    'file:///outputs/summary.json',
    'C:/outputs/summary.json',
    'C:\\outputs\\summary.json',
    '\\\\server\\share\\summary.json',
    'outputs\\summary.json',
    'outputs//summary.json',
    'outputs/./summary.json',
    'outputs/summary.json\0suffix',
    'outputs/Σ.json',
  ]) {
    assert.throws(() => validateK6OutputArtifactRelativePath(path),
      /artifact path|unsafe segment|relative path/u, path);
  }
});

test('P1 contract binds the accepted runtime chain and logical root identity', async () => {
  const fixture = await outputRootContractFixture();
  const contract = fixture.outputRootContract;
  assert.equal(contract.predecessor.runtimePolicyDigest,
    fixture.contractBindings.runtimePolicy.policyDigest);
  assert.equal(contract.predecessor.runtimeAdmissionRequestDigest,
    fixture.contractBindings.admissionRequest.admissionDigest);
  assert.equal(contract.predecessor.invocationPlanDigest,
    fixture.contractBindings.invocationPlan.planDigest);
  assert.equal(contract.predecessor.runtimeAdmissionEvidenceDigest,
    fixture.contractBindings.admissionEvidence.evidenceDigest);
  assert.equal(contract.predecessor.runtimeExecutionEvidenceDigest,
    fixture.runtimeEvidence.evidenceDigest);
  assert.equal(contract.predecessor.runtimeOutcomeDigest,
    fixture.runtimeEvidence.outcomeDigest);
  assert.match(contract.rootContractId, /^k6output-root-contract-[a-f0-9]{20}$/u);
});

test('P1 contract digest independently recomputes', async () => {
  const { outputRootContract } = await outputRootContractFixture();
  assert.equal(computeK6GovernedOutputRootContractDigest(outputRootContract),
    outputRootContract.contractDigest);
});

test('P1 contract is byte-stable for semantically identical cloned bindings', async () => {
  const fixture = await outputRootContractFixture();
  const recreated = createK6GovernedOutputRootContract(clone(fixture.contractBindings));
  assert.deepEqual(recreated, fixture.outputRootContract);
});

test('P1 contracts are defensively copied and deeply frozen', async () => {
  const fixture = await outputRootContractFixture();
  const values = [
    fixture.outputRootPolicy,
    fixture.outputRootContract,
    fixture.outputRootContract.predecessor,
    fixture.outputRootContract.artifacts,
    fixture.outputRootContract.artifacts[0],
    fixture.outputRootContract.lifecycle,
    fixture.outputRootContract.effects,
  ];
  assert.equal(values.every(Object.isFrozen), true);
  assert.throws(() => {
    fixture.outputRootContract.effects.fileRead = true;
  }, TypeError);
});

test('P1 rejects self-redigested policy boundary escalation', () => {
  const policy = clone(createK6GovernedOutputRootPolicy());
  policy.callerPathAccepted = true;
  redigest(policy, 'policyDigest');
  assert.throws(() => validateK6GovernedOutputRootPolicy(policy),
    /policy|boundary|mismatch/u);
});

test('P1 rejects self-redigested artifact path substitution', () => {
  const descriptor = clone(createK6OutputArtifactDescriptor());
  descriptor.relativePath = 'outputs/other.json';
  redigest(descriptor, 'descriptorDigest');
  assert.throws(() => validateK6OutputArtifactDescriptor(descriptor),
    /descriptor|allow-list/u);
});

test('P1 rejects self-redigested predecessor substitution', async () => {
  const fixture = await outputRootContractFixture();
  const forged = clone(fixture.outputRootContract);
  forged.predecessor.runtimeExecutionEvidenceDigest = 'a'.repeat(64);
  redigest(forged, 'contractDigest');
  assert.throws(() => validateK6GovernedOutputRootContract(
    forged, fixture.contractBindings), /contract|predecessor|mismatch/u);
});

test('P1 rejects lifecycle reordering and transition widening', async () => {
  const fixture = await outputRootContractFixture();
  const reordered = clone(fixture.outputRootContract);
  reordered.lifecycle.states.reverse();
  redigest(reordered, 'contractDigest');
  assert.throws(() => validateK6GovernedOutputRootContract(
    reordered, fixture.contractBindings), /lifecycle/u);

  const widened = clone(fixture.outputRootContract);
  widened.lifecycle.transitions.push({ from: 'DECLARED', to: 'COLLECTED' });
  redigest(widened, 'contractDigest');
  assert.throws(() => validateK6GovernedOutputRootContract(
    widened, fixture.contractBindings), /lifecycle/u);
});

test('P1 lifecycle grammar is ordered but authorizes no transition effect', async () => {
  const { outputRootContract } = await outputRootContractFixture();
  assert.deepEqual(outputRootContract.lifecycle.states,
    K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES);
  assert.deepEqual(outputRootContract.lifecycle.transitions,
    K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_TRANSITIONS);
  assert.equal(outputRootContract.lifecycle.initialState, 'DECLARED');
  assert.equal(outputRootContract.lifecycle.currentState, 'DECLARED');
  assert.equal(outputRootContract.lifecycle.allocationAuthorized, false);
  assert.equal(outputRootContract.lifecycle.collectionAuthorized, false);
  assert.equal(outputRootContract.lifecycle.cleanupAuthorized, false);
});

test('P1 rejects effect authorization after complete self-redigest', async () => {
  const fixture = await outputRootContractFixture();
  const forged = clone(fixture.outputRootContract);
  forged.effects.fileRead = true;
  redigest(forged, 'contractDigest');
  assert.throws(() => validateK6GovernedOutputRootContract(
    forged, fixture.contractBindings), /effect|boundary|contract/u);
});

test('P1 preserves the predecessor file-result deferral without rewriting runtime evidence', async () => {
  const fixture = await outputRootContractFixture();
  assert.deepEqual(fixture.runtimeEvidence.fileResultCollection, {
    supported: false,
    implemented: false,
    decision: 'DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED',
    blockerCode: 'governed-output-root-not-defined',
    sourceBundleRemainsImmutable: true,
    callerPathAccepted: false,
    arbitraryFileReadEnabled: false,
  });
  assert.equal(fixture.outputRootContract.effects.fileRead, false);
  assert.equal(fixture.outputRootContract.effects.fileWritten, false);
});

test('P1 public contracts expose no host path, PID, raw output, environment value or credential', async () => {
  const fixture = await outputRootContractFixture();
  const serialized = JSON.stringify({
    policy: fixture.outputRootPolicy,
    contract: fixture.outputRootContract,
  });
  for (const forbidden of [
    fixture.processFixture.workingDirectoryPath,
    String(fixture.processFixture.child.pid),
    'stdout',
    'stderr',
    'Authorization',
    'Bearer ',
    'K6_LOG_FORMAT',
    '/var/lib/kdtp/',
    'C:\\private\\output',
  ]) {
    assert.equal(serialized.includes(forbidden), false, forbidden);
  }
});

test('P1 decision advances only to the injected trusted root port', () => {
  assert.equal(K6_OUTPUT_ROOT_P1_DECISION.outputRootContractReady, true);
  assert.equal(K6_OUTPUT_ROOT_P1_DECISION.governedOutputRootImplemented, false);
  assert.equal(K6_OUTPUT_ROOT_P1_DECISION.fileResultCollectionImplemented, false);
  assert.equal(K6_OUTPUT_ROOT_P1_DECISION.nextRequiredSlice, 'M3-R4-P2');
  assert.deepEqual(K6_OUTPUT_ROOT_P1_DECISION.repositoryBlockers, []);
  assert.equal(Object.values(K6_OUTPUT_ROOT_P1_SAFETY_BOUNDARY)
    .every((value) => value === false), true);
});

test('P1 production module contains no filesystem, process or environment primitive', async () => {
  const source = await readRepositoryFile(
    'packages/k6-api-adapter/src/output-root-contracts.js');
  for (const forbidden of [
    "node:fs",
    "node:path",
    "node:child_process",
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

test('P1 Schema Catalog pins four closed Draft 2020-12 contracts', async () => {
  const catalog = JSON.parse(await readRepositoryFile(
    'schemas/execution/k6-api-runtime/p1-output-root-schema-catalog.json'));
  assert.equal(catalog.schemaVersion, 'k6-output-root-p1-schema-catalog/v1');
  assert.deepEqual(catalog.schemas.map(({ schemaVersion }) => schemaVersion), [
    'k6-governed-output-root-policy/v1',
    'k6-output-artifact-descriptor/v1',
    'k6-governed-output-root-contract/v1',
    'm3-r4-output-root-p1-evidence/v1',
  ]);
  const schemas = await Promise.all(catalog.schemas.map(async ({ path }) =>
    JSON.parse(await readRepositoryFile(path))));
  assert.equal(schemas.every((schema) =>
    schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
      && schema.additionalProperties === false), true);

  const fixture = await outputRootContractFixture();
  validateJsonSchemaDraft202012(fixture.outputRootPolicy, schemas[0], 'policy');
  validateJsonSchemaDraft202012(
    createK6OutputArtifactDescriptor(), schemas[1], 'descriptor');
  validateJsonSchemaDraft202012(
    fixture.outputRootContract, schemas[2], 'contract');
});

test('P1 rejects missing immutable Runtime Policy binding', async () => {
  const fixture = await outputRootContractFixture();
  const invalid = clone(fixture.contractBindings);
  delete invalid.runtimePolicy;
  assert.throws(() => createK6GovernedOutputRootContract(invalid),
    /fields|Runtime Policy|bindings/u);
});
