import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_ALLOCATION_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_P2_DECISION,
  K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY,
  K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_SCHEMA_VERSION,
  K6_TRUSTED_OUTPUT_ROOT_PORT_SCHEMA_VERSION,
  computeK6OutputArtifactResolutionReceiptDigest,
  computeK6OutputArtifactResolutionRequestDigest,
  computeK6OutputRootAllocationReceiptDigest,
  computeK6OutputRootAllocationRequestDigest,
  computeK6TrustedOutputRootBoundaryEvidenceDigest,
  computeK6TrustedOutputRootPortDigest,
  validateK6OutputArtifactResolutionReceipt,
  validateK6OutputArtifactResolutionRequest,
  validateK6OutputRootAllocationReceipt,
  validateK6OutputRootAllocationRequest,
  validateK6TrustedOutputRootBoundaryEvidence,
  validateK6TrustedOutputRootPortDescriptor,
} from '../packages/k6-api-adapter/src/index.js';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { trustedOutputRootPortFixture } from '../packages/k6-api-adapter/test/trusted-output-root-port-test-helpers.js';
import { validateJsonSchemaDraft202012 } from './json-schema-draft-2020.js';

export const M3_R4_P2_EVIDENCE_SCHEMA_VERSION =
  'm3-r4-output-root-p2-evidence/v1';
export const M3_R4_P2_SCHEMA_CATALOG_VERSION =
  'k6-output-root-p2-schema-catalog/v1';

export const ACCEPTED_M3_R4_P1 = Object.freeze({
  issue: 79,
  pullRequest: 80,
  headSha: '3f0459700e5d7e651011f8addeda8e8164a0ccbc',
  naturalWorkflowCount: 17,
  naturalWorkflowSuccess: 17,
  changedPathCount: 21,
  artifactId: 9097350510,
  artifactRunId: 31481359612,
  artifactApiDigest:
    'sha256:99b6a309b3c335d869d21187538285318b57daacc2df78973eb7d422fa2bd84a',
  canonicalEvidenceDigest:
    '9d46327e75671673a9a1cb75beb122135a54eb2508433ebc55ef255aae86fc68',
  schemaCatalogDigest:
    '09a782340e4a8ff0d0335445433ebad9b5a5464c4f654930f964677f618c67bb',
});

const EXPECTED_SCHEMA_ENTRIES = Object.freeze([
  Object.freeze({
    schemaVersion: K6_TRUSTED_OUTPUT_ROOT_PORT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-trusted-output-root-port.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ROOT_ALLOCATION_REQUEST_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-root-allocation-request.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-root-allocation-receipt.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-resolution-request.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-resolution-receipt.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-trusted-output-root-boundary-evidence.schema.json',
  }),
  Object.freeze({
    schemaVersion: M3_R4_P2_EVIDENCE_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/m3-r4-output-root-p2-evidence.schema.json',
  }),
]);

export async function validateM3R4P2TrustedOutputRootPort(options = {}) {
  const repository = options.repository ?? await loadP2Repository();
  validateP2Repository(repository);
  const fixture = options.fixture ?? await trustedOutputRootPortFixture();
  validateProducts(fixture, repository);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R4-P2 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R4_P2_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  invariant(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R4-P2 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveP2Branch(options);

  const compatibilityProductDigest = sha256(compatibilityProduct(fixture));
  const testResults = options.testResults
    ?? readTestResults(compatibilityProductDigest);
  validateTestResults(testResults);
  invariant(testResults.compatibilityProductDigest
      === compatibilityProductDigest,
  'M3-R4-P2 compatibility product digest does not match the port product');

  const claims = {
    schemaVersion: M3_R4_P2_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP1: { ...ACCEPTED_M3_R4_P1 },
    contracts: {
      portSchema: fixture.portDescriptor.schemaVersion,
      allocationRequestSchema: fixture.allocationRequest.schemaVersion,
      allocationReceiptSchema: fixture.allocationReceipt.schemaVersion,
      resolutionRequestSchema: fixture.resolutionRequest.schemaVersion,
      resolutionReceiptSchema: fixture.resolutionReceipt.schemaVersion,
      boundaryEvidenceSchema: fixture.boundaryEvidence.schemaVersion,
      evidenceSchema: M3_R4_P2_EVIDENCE_SCHEMA_VERSION,
      portDigest: fixture.portDescriptor.portDigest,
      rootContractId: fixture.p1.outputRootContract.rootContractId,
      rootContractDigest: fixture.p1.outputRootContract.contractDigest,
      allocationRequestDigest: fixture.allocationRequest.requestDigest,
      allocationReceiptDigest: fixture.allocationReceipt.receiptDigest,
      resolutionRequestDigest: fixture.resolutionRequest.requestDigest,
      resolutionReceiptDigest: fixture.resolutionReceipt.receiptDigest,
      boundaryEvidenceDigest: fixture.boundaryEvidence.evidenceDigest,
      schemaCatalogDigest: computeP2SchemaCatalogDigest(repository),
      compatibilityProductDigest,
    },
    testResults,
    decision: structuredClone(K6_OUTPUT_ROOT_P2_DECISION),
    safetyBoundary: structuredClone(K6_OUTPUT_ROOT_P2_SAFETY_BOUNDARY),
  };
  invariant(
    claims.acceptedP1.headSha === ACCEPTED_M3_R4_P1.headSha
      && claims.contracts.portDigest
        === computeK6TrustedOutputRootPortDigest(fixture.portDescriptor)
      && claims.contracts.allocationRequestDigest
        === computeK6OutputRootAllocationRequestDigest(
          fixture.allocationRequest)
      && claims.contracts.allocationReceiptDigest
        === computeK6OutputRootAllocationReceiptDigest(
          fixture.allocationReceipt)
      && claims.contracts.resolutionRequestDigest
        === computeK6OutputArtifactResolutionRequestDigest(
          fixture.resolutionRequest)
      && claims.contracts.resolutionReceiptDigest
        === computeK6OutputArtifactResolutionReceiptDigest(
          fixture.resolutionReceipt)
      && claims.contracts.boundaryEvidenceDigest
        === computeK6TrustedOutputRootBoundaryEvidenceDigest(
          fixture.boundaryEvidence)
      && Object.values(claims.safetyBoundary)
        .every((value) => value === false),
    'M3-R4-P2 Evidence is not bound to the accepted P1 and port products',
  );
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  validateJsonSchemaDraft202012(
    evidence, repository.evidenceSchema, 'M3-R4-P2 Evidence');
  scanSensitiveValues(evidence, 'M3-R4-P2 Evidence');
  return evidence;
}

export async function loadP2Repository() {
  const schemaCatalog = await readJson(
    '../schemas/execution/k6-api-runtime/p2-trusted-output-root-schema-catalog.json');
  const schemas = {};
  for (const entry of EXPECTED_SCHEMA_ENTRIES) {
    schemas[entry.schemaVersion] = await readJson(`../${entry.path}`);
  }
  return {
    schemaCatalog,
    schemas,
    evidenceSchema: schemas[M3_R4_P2_EVIDENCE_SCHEMA_VERSION],
  };
}

export function validateP2Repository(repository) {
  invariant(repository && typeof repository === 'object',
    'M3-R4-P2 repository snapshot is missing');
  invariant(repository.schemaCatalog?.schemaVersion
      === M3_R4_P2_SCHEMA_CATALOG_VERSION,
  'M3-R4-P2 Schema Catalog version is invalid');
  invariant(canonicalStringify(repository.schemaCatalog.schemas)
      === canonicalStringify(EXPECTED_SCHEMA_ENTRIES),
  'M3-R4-P2 Schema Catalog entries are not exact');
  for (const entry of EXPECTED_SCHEMA_ENTRIES) {
    const schema = repository.schemas?.[entry.schemaVersion];
    invariant(schema?.$schema === 'https://json-schema.org/draft/2020-12/schema'
        && schema.additionalProperties === false,
    `M3-R4-P2 Schema is not closed Draft 2020-12: ${entry.schemaVersion}`);
  }
  return repository;
}

export function computeP2SchemaCatalogDigest(repository) {
  validateP2Repository(repository);
  const schemas = Object.fromEntries(EXPECTED_SCHEMA_ENTRIES.map((entry) => [
    entry.schemaVersion,
    repository.schemas[entry.schemaVersion],
  ]));
  return sha256({ catalog: repository.schemaCatalog, schemas });
}

export function resolveP2Branch(options = {}) {
  return options.headRef || process.env.GITHUB_HEAD_REF
    || options.refName || process.env.GITHUB_REF_NAME
    || 'local';
}

function validateProducts(fixture, repository) {
  validateK6TrustedOutputRootPortDescriptor(fixture.portDescriptor);
  validateK6OutputRootAllocationRequest(fixture.allocationRequest, {
    portDescriptor: fixture.portDescriptor,
    rootContract: fixture.p1.outputRootContract,
    contractBindings: fixture.p1.contractBindings,
  });
  validateK6OutputRootAllocationReceipt(
    fixture.allocationReceipt,
    fixture.portDescriptor,
    fixture.allocationRequest,
  );
  validateK6OutputArtifactResolutionRequest(fixture.resolutionRequest, {
    portDescriptor: fixture.portDescriptor,
    rootContract: fixture.p1.outputRootContract,
    contractBindings: fixture.p1.contractBindings,
    allocationRequest: fixture.allocationRequest,
    allocationReceipt: fixture.allocationReceipt,
  });
  validateK6OutputArtifactResolutionReceipt(
    fixture.resolutionReceipt,
    fixture.portDescriptor,
    fixture.resolutionRequest,
  );
  validateK6TrustedOutputRootBoundaryEvidence(
    fixture.boundaryEvidence,
    {
      portDescriptor: fixture.portDescriptor,
      rootContract: fixture.p1.outputRootContract,
      contractBindings: fixture.p1.contractBindings,
      allocationRequest: fixture.allocationRequest,
      allocationReceipt: fixture.allocationReceipt,
      resolutionRequest: fixture.resolutionRequest,
      resolutionReceipt: fixture.resolutionReceipt,
    },
  );

  const products = [
    [fixture.portDescriptor, K6_TRUSTED_OUTPUT_ROOT_PORT_SCHEMA_VERSION,
      'M3-R4-P2 port'],
    [fixture.allocationRequest,
      K6_OUTPUT_ROOT_ALLOCATION_REQUEST_SCHEMA_VERSION,
      'M3-R4-P2 allocation request'],
    [fixture.allocationReceipt,
      K6_OUTPUT_ROOT_ALLOCATION_RECEIPT_SCHEMA_VERSION,
      'M3-R4-P2 allocation receipt'],
    [fixture.resolutionRequest,
      K6_OUTPUT_ARTIFACT_RESOLUTION_REQUEST_SCHEMA_VERSION,
      'M3-R4-P2 resolution request'],
    [fixture.resolutionReceipt,
      K6_OUTPUT_ARTIFACT_RESOLUTION_RECEIPT_SCHEMA_VERSION,
      'M3-R4-P2 resolution receipt'],
    [fixture.boundaryEvidence,
      K6_TRUSTED_OUTPUT_ROOT_BOUNDARY_EVIDENCE_SCHEMA_VERSION,
      'M3-R4-P2 boundary Evidence'],
  ];
  for (const [product, version, label] of products) {
    validateJsonSchemaDraft202012(
      product, repository.schemas[version], label);
  }
}

function compatibilityProduct(fixture) {
  return {
    portDescriptor: fixture.portDescriptor,
    allocationRequest: fixture.allocationRequest,
    allocationReceipt: fixture.allocationReceipt,
    resolutionRequest: fixture.resolutionRequest,
    resolutionReceipt: fixture.resolutionReceipt,
    boundaryEvidence: fixture.boundaryEvidence,
  };
}

function readTestResults(fallbackCompatibilityDigest) {
  return {
    focusedNode22: result('M3_R4_P2_FOCUSED_NODE22', 21),
    focusedNode24: result('M3_R4_P2_FOCUSED_NODE24', 21),
    k6ApiAdapter: result('M3_R4_P2_ADAPTER', 21),
    fullNode: result('M3_R4_P2_FULL', 21),
    repositoryValidator: {
      status: process.env.M3_R4_P2_REPOSITORY_VALIDATOR ?? 'success',
    },
    compatibilityProductDigest:
      process.env.M3_R4_P2_COMPATIBILITY_PRODUCT_DIGEST
      ?? fallbackCompatibilityDigest,
  };
}

function result(prefix, defaultTotal) {
  const total = numberEnv(`${prefix}_TOTAL`, defaultTotal);
  const skipped = numberEnv(`${prefix}_SKIPPED`, 0);
  const failed = numberEnv(`${prefix}_FAILED`, 0);
  const passed = numberEnv(`${prefix}_PASSED`, total - skipped - failed);
  return { total, passed, skipped, failed };
}

function numberEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  invariant(Number.isInteger(value) && value >= 0, `${name} is invalid`);
  return value;
}

function validateTestResults(results) {
  for (const key of [
    'focusedNode22', 'focusedNode24', 'k6ApiAdapter', 'fullNode',
  ]) {
    const item = results[key];
    invariant(item.total > 0
        && item.passed + item.skipped + item.failed === item.total
        && item.failed === 0,
    `M3-R4-P2 ${key} tests are not fully accepted`);
  }
  invariant(results.repositoryValidator.status === 'success',
    'M3-R4-P2 Repository Validator did not succeed');
  invariant(/^[a-f0-9]{64}$/u.test(results.compatibilityProductDigest),
    'M3-R4-P2 compatibility product digest is invalid');
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(
    await validateM3R4P2TrustedOutputRootPort(), null, 2)}\n`);
}
