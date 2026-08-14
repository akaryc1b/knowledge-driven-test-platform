import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  computeK6BoundedFileResultDigest,
  computeK6BoundedResultCollectorPortDigest,
} from '../packages/k6-api-adapter/src/index.js';
import { boundedFileResultCollectorFixture } from '../packages/k6-api-adapter/test/bounded-file-result-collector-test-helpers.js';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { validateJsonSchemaDraft202012 } from './json-schema-draft-2020.js';
import {
  computeP3SchemaCatalogDigest,
  loadP3Repository,
} from './validate-m3-r4-p3-bounded-result-collector.js';
import {
  ACCEPTED_M3_R4_P3,
  M3_R4_P4_ACCEPTANCE_PROFILE,
  M3_R4_P4_ACCEPTED_THREAT_RESULTS,
  M3_R4_P4_ARTIFACT_NAME,
  M3_R4_P4_ARTIFACT_PATHS,
  M3_R4_P4_DECISION,
  M3_R4_P4_EVIDENCE_SCHEMA_VERSION,
  M3_R4_P4_LINUX_BOUNDARY,
  M3_R4_P4_SAFETY_BOUNDARY,
} from './m3-r4-p4/constants.js';

const EVIDENCE_SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/m3-r4-output-root-p4-evidence.schema.json';

const REQUIRED_DOCUMENT_MARKERS = Object.freeze([
  'slice=M3-R4-P4',
  'issue=85',
  'm3R4P3ExactHeadAcceptanceComplete=true',
  'm3R4P3ArtifactIndependentlyVerified=true',
  'm3R4P4Started=true',
  'm3R4P4ImplementationComplete=true',
  'm3R4P4ExactHeadAcceptanceComplete=false',
  'implementationStatus=ACCEPTANCE_ONLY',
  'p3CollectorProductChanged=false',
  'realFilesystemImplementationEvaluated=true',
  'realFilesystemImplementationAuthorized=false',
  'realFilesystemCollectorImplemented=false',
  'platformCompatibility=linux-contract-baseline',
  'windowsCompatibilityClaimed=false',
  'macosCompatibilityClaimed=false',
  'm3R4G1Started=false',
  'nextRequiredSlice=M3-R4-G1',
]);

const WORKFLOW_MARKERS = Object.freeze([
  'name: m3-r4-p4-fault-security-compatibility-acceptance',
  'pull_request:',
  'push:',
  '- main',
  'permissions:',
  'contents: read',
  "node-version: '22'",
  "node-version: '24'",
  'M3_R4_P4_SCOPE_GUARD=success',
  'm3-r4-p4-fault-security-compatibility-evidence',
  'artifactPathCount: 32',
  'retention-days: 90',
  'overwrite: false',
]);

export async function validateM3R4P4FaultSecurityCompatibility(options = {}) {
  const repository = options.repository ?? await loadP4Repository();
  validateM3R4P4Repository(repository);
  const p3Repository = options.p3Repository ?? await loadP3Repository();
  const fixture = options.fixture ?? await boundedFileResultCollectorFixture();

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R4-P4 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R4_P4_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  invariant(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R4-P4 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? process.env.GITHUB_HEAD_REF
    ?? process.env.GITHUB_REF_NAME ?? 'local';

  const p3SchemaCatalogDigest = computeP3SchemaCatalogDigest(p3Repository);
  const compatibilityProductDigest = sha256(compatibilityProduct(fixture));
  invariant(p3SchemaCatalogDigest === ACCEPTED_M3_R4_P3.schemaCatalogDigest,
    'M3-R4-P4 P3 Schema Catalog replay digest changed');
  invariant(compatibilityProductDigest
      === ACCEPTED_M3_R4_P3.compatibilityProductDigest,
  'M3-R4-P4 P3 compatibility product replay digest changed');

  const testResults = options.testResults
    ?? readTestResults(compatibilityProductDigest);
  validateTestResults(testResults, compatibilityProductDigest);

  const acceptanceProfile = structuredClone(M3_R4_P4_ACCEPTANCE_PROFILE);
  const acceptedThreatResults =
    structuredClone(M3_R4_P4_ACCEPTED_THREAT_RESULTS);
  const linuxBoundary = structuredClone(M3_R4_P4_LINUX_BOUNDARY);
  const decision = structuredClone(M3_R4_P4_DECISION);
  const safetyBoundary = structuredClone(M3_R4_P4_SAFETY_BOUNDARY);

  const claims = {
    schemaVersion: M3_R4_P4_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP3: structuredClone(ACCEPTED_M3_R4_P3),
    p3Replay: {
      collectorPortDigest: computeK6BoundedResultCollectorPortDigest(
        fixture.collectorPortDescriptor),
      boundedFileResultDigest: computeK6BoundedFileResultDigest(fixture.result),
      p3SchemaCatalogDigest,
      compatibilityProductDigest,
    },
    acceptanceProfile,
    acceptanceProfileDigest: sha256(acceptanceProfile),
    acceptedThreatResults,
    acceptedThreatResultsDigest: sha256(acceptedThreatResults),
    linuxBoundary,
    linuxBoundaryDigest: sha256(linuxBoundary),
    testResults,
    artifact: {
      name: M3_R4_P4_ARTIFACT_NAME,
      expectedPathCount: M3_R4_P4_ARTIFACT_PATHS.length,
      expectedPathsDigest: sha256(M3_R4_P4_ARTIFACT_PATHS),
    },
    decision,
    safetyBoundary,
  };

  invariant(claims.acceptedP3.headSha === ACCEPTED_M3_R4_P3.headSha
      && claims.acceptedP3.naturalWorkflowSuccess
        === claims.acceptedP3.naturalWorkflowCount
      && claims.acceptedP3.permanentFailedRuns.length === 2
      && claims.acceptedP3.permanentFailedJobs.length === 2
      && claims.acceptanceProfile.p3CollectorProductChanged === false
      && claims.acceptanceProfile.p3SchemasChanged === false
      && claims.acceptanceProfile.realFilesystemImplementationAuthorized
        === false
      && claims.linuxBoundary.implementationAuthorized === false
      && claims.linuxBoundary.separateAuthorizationRequired === true
      && Object.values(claims.safetyBoundary)
        .every((value) => value === false),
  'M3-R4-P4 acceptance boundary is not exact');

  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  validateM3R4P4Evidence(evidence, repository.evidenceSchema);
  scanSensitiveValues(evidence, 'M3-R4-P4 Evidence');
  return evidence;
}

export async function loadP4Repository() {
  const evidenceSchema = await readJson(`../${EVIDENCE_SCHEMA_PATH}`);
  const documents = await Promise.all([
    readText('../docs/02-development/m3-r4-p4-fault-security-compatibility-handoff.md'),
    readText('../docs/03-roadmap/m3-r4-governed-output-root.md'),
    readText('../docs/03-roadmap/roadmap.md'),
    readText('../docs/04-governance/m3-r4-p4-fault-security-compatibility-acceptance.md'),
    readText('../docs/05-adr/ADR-0036-m3-r4-linux-filesystem-boundary.md'),
    readText('../docs/06-security/m3-r4-p4-output-root-threat-model.md'),
    readText('../docs/releases/M3-R4-P4-fault-security-compatibility-acceptance.md'),
    readText('../docs/m3-r4-p4-index.md'),
  ]);
  return {
    evidenceSchema,
    packageDocument: await readJson('../package.json'),
    workflow: await readText(
      '../.github/workflows/m3-r4-p4-fault-security-compatibility-acceptance.yml'),
    constants: await readText('../scripts/m3-r4-p4/constants.js'),
    artifactBuilder: await readText('../scripts/m3-r4-p4/artifact.js'),
    testSource: await readText(
      '../packages/k6-api-adapter/test/m3-r4-p4-fault-security-compatibility.test.js'),
    schemaReadme: await readText(
      '../schemas/execution/k6-api-runtime/README.md'),
    documents,
  };
}

export function validateM3R4P4Repository(repository) {
  invariant(repository && typeof repository === 'object',
    'M3-R4-P4 repository snapshot is missing');
  invariant(repository.evidenceSchema?.$schema
      === 'https://json-schema.org/draft/2020-12/schema'
      && repository.evidenceSchema.additionalProperties === false,
  'M3-R4-P4 Evidence Schema is not closed Draft 2020-12');

  const validateCommand = repository.packageDocument?.scripts?.validate;
  invariant(typeof validateCommand === 'string'
      && validateCommand.includes(
        'node scripts/validate-m3-r4-p4-fault-security-compatibility.js'),
  'M3-R4-P4 permanent Validator is not bound to npm run validate');
  invariant(validateCommand.indexOf(
    'node scripts/validate-m3-r4-p3-bounded-result-collector.js')
      < validateCommand.indexOf(
        'node scripts/validate-m3-r4-p4-fault-security-compatibility.js')
      && validateCommand.indexOf(
        'node scripts/validate-m3-r4-p4-fault-security-compatibility.js')
        < validateCommand.indexOf(
          'node scripts/validate-m2-final-release-closure.js'),
  'M3-R4-P4 permanent Validator order is invalid');

  for (const marker of WORKFLOW_MARKERS) {
    invariant(repository.workflow.includes(marker),
      `M3-R4-P4 Workflow marker is missing: ${marker}`);
  }
  invariant(repository.constants.includes(
    "nextRequiredSlice: 'M3-R4-G1'")
      && repository.constants.includes(
        'realFilesystemCollectorImplemented: false')
      && repository.artifactBuilder.includes('M3_R4_P4_ARTIFACT_PATHS')
      && repository.testSource.includes(
        'P4 rejects caller path, traversal, absolute, URI and mixed-separator substitutions'),
  'M3-R4-P4 permanent acceptance surface is incomplete');

  const documentText = repository.documents.join('\n');
  for (const marker of REQUIRED_DOCUMENT_MARKERS) {
    invariant(documentText.includes(marker),
      `M3-R4-P4 document marker is missing: ${marker}`);
  }
  invariant(repository.schemaReadme.includes(
    'v1/m3-r4-output-root-p4-evidence.schema.json')
      && repository.schemaReadme.includes(
        'm3-r4-output-root-p4-evidence/v1'),
  'M3-R4-P4 Evidence Schema is not registered');
  return repository;
}

export function validateM3R4P4Evidence(evidence, schema) {
  validateJsonSchemaDraft202012(
    evidence, schema, 'M3-R4-P4 Evidence');
  invariant(canonicalStringify(evidence.acceptedP3)
      === canonicalStringify(ACCEPTED_M3_R4_P3),
  'M3-R4-P4 accepted P3 identity changed');
  invariant(evidence.acceptanceProfileDigest
      === sha256(evidence.acceptanceProfile)
      && evidence.acceptedThreatResultsDigest
        === sha256(evidence.acceptedThreatResults)
      && evidence.linuxBoundaryDigest === sha256(evidence.linuxBoundary)
      && evidence.artifact.expectedPathCount
        === M3_R4_P4_ARTIFACT_PATHS.length
      && evidence.artifact.expectedPathsDigest
        === sha256(M3_R4_P4_ARTIFACT_PATHS)
      && evidence.testResults.compatibilityProductDigest
        === ACCEPTED_M3_R4_P3.compatibilityProductDigest
      && Object.values(evidence.safetyBoundary)
        .every((value) => value === false),
  'M3-R4-P4 Evidence contract binding changed');
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  invariant(evidence.evidenceDigest === sha256(claims),
    'M3-R4-P4 canonical Evidence digest mismatch');
  return true;
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

function readTestResults(fallbackDigest) {
  return {
    focusedNode22: result('M3_R4_P4_FOCUSED_NODE22', 17),
    focusedNode24: result('M3_R4_P4_FOCUSED_NODE24', 17),
    k6ApiAdapter: result('M3_R4_P4_ADAPTER', 17),
    fullNode: result('M3_R4_P4_FULL', 17),
    repositoryValidator: {
      status: process.env.M3_R4_P4_REPOSITORY_VALIDATOR ?? 'success',
    },
    scopeGuard: {
      status: process.env.M3_R4_P4_SCOPE_GUARD ?? 'success',
    },
    compatibilityProductDigest:
      process.env.M3_R4_P4_COMPATIBILITY_PRODUCT_DIGEST ?? fallbackDigest,
  };
}

function validateTestResults(results, expectedDigest) {
  for (const key of [
    'focusedNode22', 'focusedNode24', 'k6ApiAdapter', 'fullNode',
  ]) {
    const item = results[key];
    invariant(item.total > 0
        && item.passed + item.skipped + item.failed === item.total
        && item.failed === 0,
    `M3-R4-P4 ${key} tests are not fully accepted`);
  }
  invariant(results.repositoryValidator.status === 'success',
    'M3-R4-P4 Repository Validator did not succeed');
  invariant(results.scopeGuard.status === 'success',
    'M3-R4-P4 exact changed-path scope guard did not succeed');
  invariant(results.compatibilityProductDigest === expectedDigest,
    'M3-R4-P4 compatibility product digest changed');
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
    await validateM3R4P4FaultSecurityCompatibility(), null, 2)}\n`);
}
