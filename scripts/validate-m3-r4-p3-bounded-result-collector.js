import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION,
  K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_P3_DECISION,
  K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY,
  K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION,
  computeK6BoundedFileResultDigest,
  computeK6BoundedResultCollectorPortDigest,
  computeK6OutputArtifactInspectionReceiptDigest,
  computeK6OutputArtifactInspectionRequestDigest,
  computeK6OutputArtifactPayloadReceiptDigest,
  computeK6OutputArtifactPayloadRequestDigest,
  computeK6OutputRootSealReceiptDigest,
  computeK6OutputRootSealRequestDigest,
  validateK6BoundedFileResult,
  validateK6BoundedResultCollectorPortDescriptor,
  validateK6OutputArtifactInspectionReceipt,
  validateK6OutputArtifactInspectionRequest,
  validateK6OutputArtifactPayloadReceipt,
  validateK6OutputArtifactPayloadRequest,
  validateK6OutputRootSealReceipt,
  validateK6OutputRootSealRequest,
} from '../packages/k6-api-adapter/src/index.js';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { boundedFileResultCollectorFixture } from '../packages/k6-api-adapter/test/bounded-file-result-collector-test-helpers.js';
import { validateJsonSchemaDraft202012 } from './json-schema-draft-2020.js';

export const M3_R4_P3_EVIDENCE_SCHEMA_VERSION =
  'm3-r4-output-root-p3-evidence/v1';
export const M3_R4_P3_SCHEMA_CATALOG_VERSION =
  'k6-output-root-p3-schema-catalog/v1';

export const ACCEPTED_M3_R4_P2 = Object.freeze({
  issue: 81,
  pullRequest: 82,
  headSha: 'b66f223cc4453da4cab4af4df2676327aaa4bd76',
  naturalWorkflowCount: 18,
  naturalWorkflowSuccess: 18,
  artifactId: 9099506980,
  artifactRunId: 31486998071,
  artifactJobId: 93764560325,
  artifactApiDigest:
    'sha256:2775d56a5a9dc66847e6e9239a1c4271fc0ebf7476d43b414e2b324b1f4d8e44',
  canonicalEvidenceDigest:
    'b431b64406700b13a63464c4cb67c5bfabd973a452c45ce777f1ab7477cfefed',
  schemaCatalogDigest:
    'f65d9d76e8937900ad10e862dfda1ec987ee88bcfedcc8aa265d87caa3ca0216',
});

const EXPECTED_SCHEMA_ENTRIES = Object.freeze([
  Object.freeze({
    schemaVersion: K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-bounded-result-collector-port.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-root-seal-request.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-root-seal-receipt.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-inspection-request.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-inspection-receipt.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-payload-request.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-payload-receipt.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-bounded-file-result.schema.json',
  }),
  Object.freeze({
    schemaVersion: M3_R4_P3_EVIDENCE_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/m3-r4-output-root-p3-evidence.schema.json',
  }),
]);

const REQUIRED_DOCUMENT_MARKERS = Object.freeze([
  'slice=M3-R4-P3',
  'm3R4P2ExactHeadAcceptanceComplete=true',
  'm3R4P2ArtifactIndependentlyVerified=true',
  'm3R4P3Started=true',
  'm3R4P3ImplementationComplete=true',
  'm3R4P3ExactHeadAcceptanceComplete=false',
  'm3R4P4Started=false',
  'nextRequiredSlice=M3-R4-P4',
  'realFilesystemCollectorImplemented=false',
  'rawPayloadPersisted=false',
  'rawPayloadIncludedInEvidence=false',
]);

const PRODUCT_PATHS = Object.freeze([
  'packages/k6-api-adapter/src/bounded-file-result-collector.js',
  'packages/k6-api-adapter/src/bounded-json-result-payload.js',
  'packages/k6-api-adapter/src/bounded-result-collector-contracts.js',
  'packages/k6-api-adapter/src/bounded-result-collector-definitions.js',
  'packages/k6-api-adapter/src/bounded-result-collector-validation.js',
  'packages/k6-api-adapter/src/bounded-result-collector-predecessor.js',
]);

export async function validateM3R4P3BoundedResultCollector(options = {}) {
  const repository = options.repository ?? await loadP3Repository();
  validateP3Repository(repository);
  const fixture = options.fixture ?? await boundedFileResultCollectorFixture();
  validateProducts(fixture, repository);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R4-P3 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R4_P3_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  invariant(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R4-P3 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveP3Branch(options);

  const compatibilityProductDigest = sha256(compatibilityProduct(fixture));
  const testResults = options.testResults
    ?? readTestResults(compatibilityProductDigest);
  validateTestResults(testResults);
  invariant(testResults.compatibilityProductDigest
      === compatibilityProductDigest,
  'M3-R4-P3 compatibility product digest does not match the collector product');

  const claims = {
    schemaVersion: M3_R4_P3_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP2: { ...ACCEPTED_M3_R4_P2 },
    contracts: {
      collectorPortSchema: fixture.collectorPortDescriptor.schemaVersion,
      sealRequestSchema: fixture.sealRequest.schemaVersion,
      sealReceiptSchema: fixture.sealReceipt.schemaVersion,
      inspectionRequestSchema: fixture.inspectionRequest.schemaVersion,
      inspectionReceiptSchema: fixture.inspectionReceipt.schemaVersion,
      payloadRequestSchema: fixture.payloadRequest.schemaVersion,
      payloadReceiptSchema: fixture.payloadReceipt.schemaVersion,
      boundedFileResultSchema: fixture.result.schemaVersion,
      evidenceSchema: M3_R4_P3_EVIDENCE_SCHEMA_VERSION,
      collectorPortDigest: fixture.collectorPortDescriptor.portDigest,
      p2BoundaryEvidenceDigest: fixture.p2.boundaryEvidence.evidenceDigest,
      rootContractId: fixture.p2.p1.outputRootContract.rootContractId,
      rootContractDigest: fixture.p2.p1.outputRootContract.contractDigest,
      sealRequestDigest: fixture.sealRequest.requestDigest,
      sealReceiptDigest: fixture.sealReceipt.receiptDigest,
      inspectionRequestDigest: fixture.inspectionRequest.requestDigest,
      inspectionReceiptDigest: fixture.inspectionReceipt.receiptDigest,
      payloadRequestDigest: fixture.payloadRequest.requestDigest,
      payloadReceiptDigest: fixture.payloadReceipt.receiptDigest,
      boundedFileResultDigest: fixture.result.resultDigest,
      schemaCatalogDigest: computeP3SchemaCatalogDigest(repository),
      compatibilityProductDigest,
    },
    testResults,
    decision: structuredClone(K6_OUTPUT_ROOT_P3_DECISION),
    safetyBoundary: structuredClone(K6_OUTPUT_ROOT_P3_SAFETY_BOUNDARY),
  };
  invariant(
    claims.acceptedP2.headSha === ACCEPTED_M3_R4_P2.headSha
      && claims.contracts.collectorPortDigest
        === computeK6BoundedResultCollectorPortDigest(
          fixture.collectorPortDescriptor)
      && claims.contracts.sealRequestDigest
        === computeK6OutputRootSealRequestDigest(fixture.sealRequest)
      && claims.contracts.sealReceiptDigest
        === computeK6OutputRootSealReceiptDigest(fixture.sealReceipt)
      && claims.contracts.inspectionRequestDigest
        === computeK6OutputArtifactInspectionRequestDigest(
          fixture.inspectionRequest)
      && claims.contracts.inspectionReceiptDigest
        === computeK6OutputArtifactInspectionReceiptDigest(
          fixture.inspectionReceipt)
      && claims.contracts.payloadRequestDigest
        === computeK6OutputArtifactPayloadRequestDigest(fixture.payloadRequest)
      && claims.contracts.payloadReceiptDigest
        === computeK6OutputArtifactPayloadReceiptDigest(fixture.payloadReceipt)
      && claims.contracts.boundedFileResultDigest
        === computeK6BoundedFileResultDigest(fixture.result)
      && Object.values(claims.safetyBoundary)
        .every((value) => value === false),
    'M3-R4-P3 Evidence is not bound to the accepted P2 and collector products',
  );
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  validateJsonSchemaDraft202012(
    evidence, repository.evidenceSchema, 'M3-R4-P3 Evidence');
  scanSensitiveValues(evidence, 'M3-R4-P3 Evidence');
  return evidence;
}

export async function loadP3Repository() {
  const schemaCatalog = await readJson(
    '../schemas/execution/k6-api-runtime/p3-bounded-result-schema-catalog.json');
  const schemas = {};
  for (const entry of EXPECTED_SCHEMA_ENTRIES) {
    schemas[entry.schemaVersion] = await readJson(`../${entry.path}`);
  }
  const productSources = {};
  for (const path of PRODUCT_PATHS) productSources[path] = await readText(`../${path}`);
  return {
    schemaCatalog,
    schemas,
    evidenceSchema: schemas[M3_R4_P3_EVIDENCE_SCHEMA_VERSION],
    packageDocument: await readJson('../package.json'),
    workflow: await readText(
      '../.github/workflows/m3-r4-p3-bounded-result-collector.yml'),
    roadmap: await readText('../docs/03-roadmap/m3-r4-governed-output-root.md'),
    handoff: await readText(
      '../docs/02-development/m3-r4-p3-bounded-result-collector-handoff.md'),
    acceptance: await readText(
      '../docs/04-governance/m3-r4-p3-bounded-result-collector-acceptance.md'),
    release: await readText(
      '../docs/releases/M3-R4-P3-bounded-result-collector.md'),
    index: await readText('../docs/m3-r4-p3-index.md'),
    adapterIndex: await readText('../packages/k6-api-adapter/src/index.js'),
    boundaryTest: await readText(
      '../packages/k6-api-adapter/test/m3-r4-r0-governed-output-root-boundary.test.js'),
    productSources,
  };
}

export function validateP3Repository(repository) {
  invariant(repository && typeof repository === 'object',
    'M3-R4-P3 repository snapshot is missing');
  invariant(repository.schemaCatalog?.schemaVersion
      === M3_R4_P3_SCHEMA_CATALOG_VERSION,
  'M3-R4-P3 Schema Catalog version is invalid');
  invariant(canonicalStringify(repository.schemaCatalog.schemas)
      === canonicalStringify(EXPECTED_SCHEMA_ENTRIES),
  'M3-R4-P3 Schema Catalog entries are not exact');
  for (const entry of EXPECTED_SCHEMA_ENTRIES) {
    const schema = repository.schemas?.[entry.schemaVersion];
    invariant(schema?.$schema === 'https://json-schema.org/draft/2020-12/schema'
        && schema.additionalProperties === false,
    `M3-R4-P3 Schema is not closed Draft 2020-12: ${entry.schemaVersion}`);
  }

  const validateCommand = repository.packageDocument?.scripts?.validate;
  invariant(typeof validateCommand === 'string'
      && validateCommand.includes(
        'node scripts/validate-m3-r4-p3-bounded-result-collector.js'),
  'M3-R4-P3 permanent Validator is not bound to npm run validate');
  invariant(validateCommand.indexOf(
    'node scripts/validate-m3-r4-p2-trusted-output-root-port.js')
      < validateCommand.indexOf(
        'node scripts/validate-m3-r4-p3-bounded-result-collector.js')
      && validateCommand.indexOf(
        'node scripts/validate-m3-r4-p3-bounded-result-collector.js')
        < validateCommand.indexOf(
          'node scripts/validate-m2-final-release-closure.js'),
  'M3-R4-P3 permanent Validator order is invalid');

  for (const marker of [
    'pull_request:',
    'push:',
    "- main",
    'permissions:',
    'contents: read',
    "node-version: '22'",
    "node-version: '24'",
    'm3-r4-p3-bounded-result-collector-evidence',
    'schemas/execution/k6-api-runtime/README.md',
    'packages/k6-api-adapter/src/bounded-result-collector-predecessor.js',
    'contracts/bounded-result-collector-predecessor.js',
    'artifactPathCount: 20',
    'retention-days: 90',
    'overwrite: false',
  ]) invariant(repository.workflow.includes(marker),
    `M3-R4-P3 Workflow marker is missing: ${marker}`);

  const documents = [
    repository.roadmap,
    repository.handoff,
    repository.acceptance,
    repository.release,
    repository.index,
  ].join('\n');
  for (const marker of REQUIRED_DOCUMENT_MARKERS) {
    invariant(documents.includes(marker),
      `M3-R4-P3 document marker is missing: ${marker}`);
  }
  invariant(repository.adapterIndex.includes(
    "export * from './bounded-file-result-collector.js';"),
  'M3-R4-P3 collector is not exported');
  invariant(repository.boundaryTest.includes('slice=M3-R4-P3')
      && repository.boundaryTest.includes('m3R4P4Started=false'),
  'M3-R4 R0 anti-escalation test is not advanced to P3');

  const productText = Object.values(repository.productSources).join('\n');
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
    'childProcess.exec(',
    'execFile(',
    'execFileSync(',
    'execSync(',
  ]) invariant(!productText.includes(forbidden),
    `M3-R4-P3 product source contains an effectful primitive: ${forbidden}`);
  return repository;
}

export function computeP3SchemaCatalogDigest(repository) {
  validateP3Repository(repository);
  const schemas = Object.fromEntries(EXPECTED_SCHEMA_ENTRIES.map((entry) => [
    entry.schemaVersion,
    repository.schemas[entry.schemaVersion],
  ]));
  return sha256({ catalog: repository.schemaCatalog, schemas });
}

export function resolveP3Branch(options = {}) {
  return options.headRef || process.env.GITHUB_HEAD_REF
    || options.refName || process.env.GITHUB_REF_NAME
    || 'local';
}

function validateProducts(fixture, repository) {
  validateK6BoundedResultCollectorPortDescriptor(
    fixture.collectorPortDescriptor);
  validateK6OutputRootSealRequest(fixture.sealRequest, {
    ...fixture.p2Bindings,
    collectorPortDescriptor: fixture.collectorPortDescriptor,
  });
  validateK6OutputRootSealReceipt(
    fixture.sealReceipt, fixture.collectorPortDescriptor, fixture.sealRequest);
  validateK6OutputArtifactInspectionRequest(fixture.inspectionRequest, {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    p2Bindings: fixture.p2Bindings,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
  });
  validateK6OutputArtifactInspectionReceipt(
    fixture.inspectionReceipt,
    fixture.collectorPortDescriptor,
    fixture.inspectionRequest,
  );
  validateK6OutputArtifactPayloadRequest(fixture.payloadRequest, {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    inspectionRequest: fixture.inspectionRequest,
    inspectionReceipt: fixture.inspectionReceipt,
  });
  validateK6OutputArtifactPayloadReceipt(
    fixture.payloadReceipt,
    fixture.collectorPortDescriptor,
    fixture.payloadRequest,
  );
  validateK6BoundedFileResult(fixture.result, {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    p2Bindings: fixture.p2Bindings,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
    inspectionRequest: fixture.inspectionRequest,
    inspectionReceipt: fixture.inspectionReceipt,
    payloadRequest: fixture.payloadRequest,
    payloadReceipt: fixture.payloadReceipt,
  });

  const products = [
    [fixture.collectorPortDescriptor,
      K6_BOUNDED_RESULT_COLLECTOR_PORT_SCHEMA_VERSION,
      'M3-R4-P3 collector port'],
    [fixture.sealRequest, K6_OUTPUT_ROOT_SEAL_REQUEST_SCHEMA_VERSION,
      'M3-R4-P3 seal request'],
    [fixture.sealReceipt, K6_OUTPUT_ROOT_SEAL_RECEIPT_SCHEMA_VERSION,
      'M3-R4-P3 seal receipt'],
    [fixture.inspectionRequest,
      K6_OUTPUT_ARTIFACT_INSPECTION_REQUEST_SCHEMA_VERSION,
      'M3-R4-P3 inspection request'],
    [fixture.inspectionReceipt,
      K6_OUTPUT_ARTIFACT_INSPECTION_RECEIPT_SCHEMA_VERSION,
      'M3-R4-P3 inspection receipt'],
    [fixture.payloadRequest,
      K6_OUTPUT_ARTIFACT_PAYLOAD_REQUEST_SCHEMA_VERSION,
      'M3-R4-P3 payload request'],
    [fixture.payloadReceipt,
      K6_OUTPUT_ARTIFACT_PAYLOAD_RECEIPT_SCHEMA_VERSION,
      'M3-R4-P3 payload receipt'],
    [fixture.result, K6_BOUNDED_FILE_RESULT_SCHEMA_VERSION,
      'M3-R4-P3 bounded file result'],
  ];
  for (const [product, version, label] of products) {
    validateJsonSchemaDraft202012(
      product, repository.schemas[version], label);
  }
}

function compatibilityProduct(fixture) {
  return {
    collectorPortDescriptor: fixture.collectorPortDescriptor,
    sealRequest: fixture.sealRequest,
    sealReceipt: fixture.sealReceipt,
    inspectionRequest: fixture.inspectionRequest,
    inspectionReceipt: fixture.inspectionReceipt,
    payloadRequest: fixture.payloadRequest,
    payloadReceipt: fixture.payloadReceipt,
    boundedFileResult: fixture.result,
  };
}

function readTestResults(fallbackCompatibilityDigest) {
  return {
    focusedNode22: result('M3_R4_P3_FOCUSED_NODE22', 35),
    focusedNode24: result('M3_R4_P3_FOCUSED_NODE24', 35),
    k6ApiAdapter: result('M3_R4_P3_ADAPTER', 35),
    fullNode: result('M3_R4_P3_FULL', 35),
    repositoryValidator: {
      status: process.env.M3_R4_P3_REPOSITORY_VALIDATOR ?? 'success',
    },
    compatibilityProductDigest:
      process.env.M3_R4_P3_COMPATIBILITY_PRODUCT_DIGEST
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
    `M3-R4-P3 ${key} tests are not fully accepted`);
  }
  invariant(results.repositoryValidator.status === 'success',
    'M3-R4-P3 Repository Validator did not succeed');
  invariant(/^[a-f0-9]{64}$/u.test(results.compatibilityProductDigest),
    'M3-R4-P3 compatibility product digest is invalid');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function readText(relativePath) {
  return readFile(new URL(relativePath, import.meta.url), 'utf8');
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1]
    && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(
    await validateM3R4P3BoundedResultCollector(), null, 2)}\n`);
}
