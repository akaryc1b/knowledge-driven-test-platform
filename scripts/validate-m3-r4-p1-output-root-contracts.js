import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  K6_GOVERNED_OUTPUT_ROOT_CONTRACT_SCHEMA_VERSION,
  K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES,
  K6_GOVERNED_OUTPUT_ROOT_POLICY_SCHEMA_VERSION,
  K6_OUTPUT_ARTIFACT_DESCRIPTOR_SCHEMA_VERSION,
  K6_OUTPUT_ROOT_P1_DECISION,
  K6_OUTPUT_ROOT_P1_SAFETY_BOUNDARY,
  computeK6GovernedOutputRootContractDigest,
  computeK6GovernedOutputRootPolicyDigest,
  computeK6OutputArtifactDescriptorDigest,
  createK6OutputArtifactDescriptor,
  validateK6GovernedOutputRootContract,
  validateK6GovernedOutputRootPolicy,
  validateK6OutputArtifactDescriptor,
} from '../packages/k6-api-adapter/src/index.js';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { outputRootContractFixture } from '../packages/k6-api-adapter/test/output-root-contract-test-helpers.js';
import { validateJsonSchemaDraft202012 } from './json-schema-draft-2020.js';

export const M3_R4_P1_EVIDENCE_SCHEMA_VERSION =
  'm3-r4-output-root-p1-evidence/v1';
export const M3_R4_P1_SCHEMA_CATALOG_VERSION =
  'k6-output-root-p1-schema-catalog/v1';

export const ACCEPTED_M3_R4_R0 = Object.freeze({
  issue: 77,
  pullRequest: 78,
  baseMain: '6737436f6c0f46d1ca5a2a48f0adc0c25c0771fa',
  headSha: 'e522c13065dd77770d414a727d030a5108488eae',
  naturalWorkflowCount: 11,
  naturalWorkflowSuccess: 11,
  changedPathCount: 8,
});

const EXPECTED_SCHEMA_ENTRIES = Object.freeze([
  Object.freeze({
    schemaVersion: K6_GOVERNED_OUTPUT_ROOT_POLICY_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-governed-output-root-policy.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_OUTPUT_ARTIFACT_DESCRIPTOR_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-output-artifact-descriptor.schema.json',
  }),
  Object.freeze({
    schemaVersion: K6_GOVERNED_OUTPUT_ROOT_CONTRACT_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/k6-governed-output-root-contract.schema.json',
  }),
  Object.freeze({
    schemaVersion: M3_R4_P1_EVIDENCE_SCHEMA_VERSION,
    path: 'schemas/execution/k6-api-runtime/v1/m3-r4-output-root-p1-evidence.schema.json',
  }),
]);

export async function validateM3R4P1OutputRootContracts(options = {}) {
  const repository = options.repository ?? await loadP1Repository();
  validateP1Repository(repository);
  const fixture = options.fixture ?? await outputRootContractFixture();
  validateProducts(fixture, repository);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R4-P1 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R4_P1_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  invariant(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R4-P1 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? resolveP1Branch(options);
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);

  const descriptor = createK6OutputArtifactDescriptor();
  const compatibilityProductDigest = sha256({
    policy: fixture.outputRootPolicy,
    descriptor,
    contract: fixture.outputRootContract,
  });
  const expectedCompatibilityDigest = options.compatibilityProductDigest
    ?? process.env.M3_R4_P1_COMPATIBILITY_PRODUCT_DIGEST
    ?? compatibilityProductDigest;
  invariant(expectedCompatibilityDigest === compatibilityProductDigest,
    'M3-R4-P1 compatibility product digest does not match the contract product');

  const claims = {
    schemaVersion: M3_R4_P1_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedR0: { ...ACCEPTED_M3_R4_R0 },
    contracts: {
      policySchema: fixture.outputRootPolicy.schemaVersion,
      descriptorSchema: descriptor.schemaVersion,
      rootContractSchema: fixture.outputRootContract.schemaVersion,
      evidenceSchema: M3_R4_P1_EVIDENCE_SCHEMA_VERSION,
      policyDigest: fixture.outputRootPolicy.policyDigest,
      descriptorDigest: descriptor.descriptorDigest,
      rootContractId: fixture.outputRootContract.rootContractId,
      rootContractDigest: fixture.outputRootContract.contractDigest,
      schemaCatalogDigest: computeP1SchemaCatalogDigest(repository),
      artifactDescriptorCount: fixture.outputRootContract.artifacts.length,
      lifecycleStateCount: fixture.outputRootContract.lifecycle.states.length,
      compatibilityProductDigest,
    },
    testResults,
    decision: structuredClone(K6_OUTPUT_ROOT_P1_DECISION),
    safetyBoundary: structuredClone(K6_OUTPUT_ROOT_P1_SAFETY_BOUNDARY),
  };
  invariant(claims.acceptedR0.headSha === ACCEPTED_M3_R4_R0.headSha
      && claims.contracts.policyDigest
        === computeK6GovernedOutputRootPolicyDigest(fixture.outputRootPolicy)
      && claims.contracts.descriptorDigest
        === computeK6OutputArtifactDescriptorDigest(descriptor)
      && claims.contracts.rootContractDigest
        === computeK6GovernedOutputRootContractDigest(fixture.outputRootContract)
      && claims.contracts.artifactDescriptorCount === 1
      && claims.contracts.lifecycleStateCount
        === K6_GOVERNED_OUTPUT_ROOT_LIFECYCLE_STATES.length
      && Object.values(claims.safetyBoundary).every((value) => value === false),
  'M3-R4-P1 Evidence is not bound to the accepted R0 and contract products');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  validateJsonSchemaDraft202012(evidence, repository.evidenceSchema,
    'M3-R4-P1 Evidence');
  scanSensitiveValues(evidence, 'M3-R4-P1 Evidence');
  return evidence;
}

export async function loadP1Repository() {
  const schemaCatalog = await readJson(
    '../schemas/execution/k6-api-runtime/p1-output-root-schema-catalog.json');
  const schemas = {};
  for (const entry of EXPECTED_SCHEMA_ENTRIES) {
    schemas[entry.schemaVersion] = await readJson(`../${entry.path}`);
  }
  return {
    schemaCatalog,
    schemas,
    evidenceSchema: schemas[M3_R4_P1_EVIDENCE_SCHEMA_VERSION],
  };
}

export function validateP1Repository(repository) {
  invariant(repository && typeof repository === 'object',
    'M3-R4-P1 repository snapshot is missing');
  invariant(repository.schemaCatalog?.schemaVersion === M3_R4_P1_SCHEMA_CATALOG_VERSION,
    'M3-R4-P1 Schema Catalog version is invalid');
  invariant(canonicalStringify(repository.schemaCatalog.schemas)
      === canonicalStringify(EXPECTED_SCHEMA_ENTRIES),
  'M3-R4-P1 Schema Catalog entries are not exact');
  for (const entry of EXPECTED_SCHEMA_ENTRIES) {
    const schema = repository.schemas?.[entry.schemaVersion];
    invariant(schema?.$schema === 'https://json-schema.org/draft/2020-12/schema'
        && schema.additionalProperties === false,
    `M3-R4-P1 Schema is not closed Draft 2020-12: ${entry.schemaVersion}`);
  }
  return repository;
}

export function computeP1SchemaCatalogDigest(repository) {
  validateP1Repository(repository);
  const schemas = Object.fromEntries(EXPECTED_SCHEMA_ENTRIES.map((entry) => [
    entry.schemaVersion,
    repository.schemas[entry.schemaVersion],
  ]));
  return sha256({ catalog: repository.schemaCatalog, schemas });
}

export function resolveP1Branch(options = {}) {
  return options.headRef || process.env.GITHUB_HEAD_REF
    || options.refName || process.env.GITHUB_REF_NAME
    || 'local';
}

function validateProducts(fixture, repository) {
  const descriptor = createK6OutputArtifactDescriptor();
  validateK6GovernedOutputRootPolicy(fixture.outputRootPolicy);
  validateK6OutputArtifactDescriptor(descriptor);
  validateK6GovernedOutputRootContract(
    fixture.outputRootContract, fixture.contractBindings);
  validateJsonSchemaDraft202012(
    fixture.outputRootPolicy,
    repository.schemas[K6_GOVERNED_OUTPUT_ROOT_POLICY_SCHEMA_VERSION],
    'M3-R4-P1 policy');
  validateJsonSchemaDraft202012(
    descriptor,
    repository.schemas[K6_OUTPUT_ARTIFACT_DESCRIPTOR_SCHEMA_VERSION],
    'M3-R4-P1 descriptor');
  validateJsonSchemaDraft202012(
    fixture.outputRootContract,
    repository.schemas[K6_GOVERNED_OUTPUT_ROOT_CONTRACT_SCHEMA_VERSION],
    'M3-R4-P1 contract');
}

function readTestResults() {
  return {
    focusedNode22: result('M3_R4_P1_FOCUSED_NODE22', 20),
    focusedNode24: result('M3_R4_P1_FOCUSED_NODE24', 20),
    k6ApiAdapter: result('M3_R4_P1_ADAPTER', 20),
    fullNode: result('M3_R4_P1_FULL', 20),
    repositoryValidator: {
      status: process.env.M3_R4_P1_REPOSITORY_VALIDATOR ?? 'success',
    },
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
  for (const key of ['focusedNode22', 'focusedNode24', 'k6ApiAdapter', 'fullNode']) {
    const item = results[key];
    invariant(item.total > 0
        && item.passed + item.skipped + item.failed === item.total
        && item.failed === 0,
    `M3-R4-P1 ${key} tests are not fully accepted`);
  }
  invariant(results.repositoryValidator.status === 'success',
    'M3-R4-P1 Repository Validator did not succeed');
}

async function readJson(relativePath) {
  return JSON.parse(await readFile(new URL(relativePath, import.meta.url), 'utf8'));
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(
    await validateM3R4P1OutputRootContracts(), null, 2)}\n`);
}
