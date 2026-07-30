#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { resolveEvidenceBranch } from './release-evidence-environment.js';
import {
  canonicalDigest,
  validateM2PortableReleaseReadiness,
} from './validate-m2-portable-release-readiness.js';

export const M2_FINAL_RELEASE_CLOSURE_SCHEMA_VERSION = 'm2-final-release-closure/v1';
export const M2_FINAL_RELEASE_CLOSURE_EVIDENCE_SCHEMA_VERSION =
  'm2-final-release-closure-evidence/v1';

const ROOT = process.cwd();
const PATHS = Object.freeze({
  closure: 'releases/m2/final-release-closure.json',
  readiness: 'releases/m2/portable-release-readiness.json',
  package: 'package.json',
  catalog: 'schemas/release/schema-catalog.json',
  validationWorkflow: '.github/workflows/validation.yml',
  dedicatedWorkflow: '.github/workflows/m2-r3-final-release-closure.yml',
  releaseDoc: 'docs/releases/M2-RC1.md',
  closureDoc: 'docs/releases/M2-RC1-final-release-closure.md',
  handoff: 'docs/02-development/development-handoff.md',
  roadmap: 'docs/03-roadmap/m2-rc1-production-promotion.md',
  m3Roadmap: 'docs/03-roadmap/m3-r0-execution-adapter-foundation.md',
  matrix: 'docs/04-governance/m2-production-promotion-acceptance-matrix.md',
  docsIndex: 'docs/README.md',
});
const FIXED = Object.freeze({
  closureDigest: 'sha256:7b4c3165e3913d857e45cb22f918cde0ae6cbacdd0f8298b45209c87ca297f2b',
  readinessDigest: 'sha256:32a5487c9e83edebc7f3d84b192cdfedf17f58edab904991555d922b5e2d5995',
  closureBaseSha: '70b06e28e48c38d8b7feed29177144d35cb96069',
  expectedHeadSha: '7880dc9e95e80327960030e9e003189202c4a85f',
  observationDigest: 'sha256:38263d550408d8ca96e9c951ec2f22ccfde2bc587229ae991dfc8f1eca8fad24',
});

export async function loadM2FinalReleaseClosure(path = join(ROOT, PATHS.closure)) {
  return loadJson(path);
}

export async function validateM2FinalReleaseClosure(options = {}) {
  const closure = options.closure ?? await loadM2FinalReleaseClosure(options.path);
  const readiness = options.readiness ?? await loadJson(join(ROOT, PATHS.readiness));
  const packageJson = options.packageJson ?? await loadJson(join(ROOT, PATHS.package));
  const catalog = options.catalog ?? await loadJson(join(ROOT, PATHS.catalog));
  const validationWorkflow = options.validationWorkflow
    ?? await readFile(join(ROOT, PATHS.validationWorkflow), 'utf8');
  const dedicatedWorkflow = options.dedicatedWorkflow
    ?? await readFile(join(ROOT, PATHS.dedicatedWorkflow), 'utf8');
  const releaseDoc = options.releaseDoc ?? await readFile(join(ROOT, PATHS.releaseDoc), 'utf8');
  const closureDoc = options.closureDoc ?? await readFile(join(ROOT, PATHS.closureDoc), 'utf8');
  const handoff = options.handoff ?? await readFile(join(ROOT, PATHS.handoff), 'utf8');
  const roadmap = options.roadmap ?? await readFile(join(ROOT, PATHS.roadmap), 'utf8');
  const m3Roadmap = options.m3Roadmap ?? await readFile(join(ROOT, PATHS.m3Roadmap), 'utf8');
  const matrix = options.matrix ?? await readFile(join(ROOT, PATHS.matrix), 'utf8');
  const docsIndex = options.docsIndex ?? await readFile(join(ROOT, PATHS.docsIndex), 'utf8');

  validateClosureRecord(closure);
  assert(canonicalDigest(closure) === FIXED.closureDigest,
    'M2 final release closure canonical digest changed');
  assert(canonicalDigest(readiness) === FIXED.readinessDigest,
    'M2 portable readiness canonical digest changed');

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M2 final closure generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M2 final closure evidence commit SHA is invalid');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    headRef: options.headRef,
    refName: options.refName,
    fallback: 'agent/m2-rc1-r3-final-release-closure',
    label: 'M2 final closure evidence branch',
  });

  const readinessEvidence = await validateM2PortableReleaseReadiness({
    readiness,
    generatedAt,
    commitSha,
    branch,
  });
  assert(readinessEvidence.decision?.repositoryReleaseReady === true
      && readinessEvidence.decision?.environmentPromotionEvaluated === false
      && readinessEvidence.decision?.environmentPromotionEligible === null
      && readinessEvidence.decision?.repositoryBlockers?.length === 0,
  'portable readiness decision no longer supports M2 closure');

  validateRepositoryWiring({
    packageJson, catalog, validationWorkflow, dedicatedWorkflow,
    releaseDoc, closureDoc, handoff, roadmap, m3Roadmap, matrix, docsIndex,
  });
  rejectSensitiveLiterals(closure);

  return {
    schemaVersion: M2_FINAL_RELEASE_CLOSURE_EVIDENCE_SCHEMA_VERSION,
    releaseId: closure.releaseId,
    version: closure.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      finalReleaseClosure: canonicalDigest(closure),
      portableReleaseReadiness: canonicalDigest(readiness),
    },
    decision: structuredClone(closure.decision),
    safetyBoundary: structuredClone(closure.safetyBoundary),
  };
}

function validateClosureRecord(value) {
  exactKeys(value, [
    'schemaVersion', 'releaseId', 'version', 'phase', 'closureBaseSha', 'source',
    'portableReadiness', 'postMergeVerification', 'historicalEvidence', 'decision',
    'safetyBoundary',
  ], 'M2 final release closure');
  assert(value.schemaVersion === M2_FINAL_RELEASE_CLOSURE_SCHEMA_VERSION,
    'M2 final closure schemaVersion is invalid');
  assert(value.releaseId === 'M2-RC1' && value.version === '0.12.0',
    'M2 final closure identity is invalid');
  assert(value.phase === 'FINAL_RELEASE_CLOSURE', 'M2 final closure phase is invalid');
  assert(value.closureBaseSha === FIXED.closureBaseSha,
    'M2 final closure base SHA changed');
  same(value.source, {
    mergePullRequest: 38,
    expectedHeadSha: FIXED.expectedHeadSha,
    mergeSha: FIXED.closureBaseSha,
  }, 'M2 final closure source');
  same(value.portableReadiness, {
    path: PATHS.readiness,
    canonicalDigest: FIXED.readinessDigest,
    repositoryReleaseReady: true,
    environmentPromotionEvaluated: false,
    environmentPromotionEligible: null,
  }, 'M2 final closure portable readiness');

  const observer = value.postMergeVerification?.observer;
  assert(observer?.controlPullRequest === 39 && observer?.closedWithoutMerge === true,
    'M2 final closure observer PR boundary changed');
  assert(observer?.runId === 30524112914 && observer?.jobId === 90810968107,
    'M2 final closure observer run identity changed');
  assert(observer?.artifact?.id === 8751973494
      && observer?.artifact?.digest === FIXED.observationDigest,
  'M2 final closure observer Artifact changed');
  validateRun(value.postMergeVerification?.generalValidation, 30523601698,
    90809365725, 90809365768, 4, 'General Validation');
  validateRun(value.postMergeVerification?.portableReadiness, 30523600767,
    90809362714, 90809362694, 2, 'Portable Readiness');
  validateRun(value.postMergeVerification?.historicalR2A, 30523600763,
    90809363100, 90809363031, 2, 'Historical R2-A');

  same(value.historicalEvidence, {
    productionPromotionDigest: 'sha256:4125d5f08ec559e2bc6012ab501879432493af012b4d70665eb1d653c4190f5d',
    externalEvidenceIntakeDigest: 'sha256:54413977a3030847fdef7e3aa77c2a1c2924677f0555a4fabdba888f829a6d18',
    imageBindingDigest: 'sha256:adb6374bee157b7b64d25b6fdfe1b35ea2d4e5e92a08b029c0fbc5e66c33c0a7',
    deploymentDigest: 'sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45',
  }, 'M2 final closure historical evidence');
  same(value.decision, {
    m2Rc1Closed: true,
    repositoryReleaseReady: true,
    environmentPromotionEvaluated: false,
    environmentPromotionEligible: null,
    m3PlanningReady: true,
    m3ImplementationStarted: false,
    nextRequiredSlice: 'M3-R0',
    repositoryBlockers: [],
  }, 'M2 final closure decision');
  same(value.safetyBoundary, {
    secretAccessed: false,
    secretCreated: false,
    targetClusterAccessed: false,
    targetClusterModified: false,
    approvalCreated: false,
    rolloutExecuted: false,
    imagePublished: false,
    registryDigestChanged: false,
    executionAdapterImplemented: false,
    externalProcessExecuted: false,
    workerAdded: false,
    queueAdded: false,
    schedulerAdded: false,
  }, 'M2 final closure safety boundary');
}

function validateRun(run, runId, validateJobId, postgresJobId, artifactCount, label) {
  assert(run?.runId === runId && run?.validateJobId === validateJobId
      && run?.postgresJobId === postgresJobId,
  `${label} run identity changed`);
  const artifacts = Object.values(run.artifacts ?? {});
  assert(artifacts.length === artifactCount, `${label} Artifact count changed`);
  for (const artifact of artifacts) {
    assert(Number.isSafeInteger(artifact.id) && artifact.id > 0,
      `${label} Artifact ID is invalid`);
    assert(/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? ''),
      `${label} Artifact digest is invalid`);
  }
}

function validateRepositoryWiring(value) {
  assert(value.packageJson.scripts?.['validate:m2-final-release-closure'] ===
    'node scripts/validate-m2-final-release-closure.js',
  'package final closure validation script is missing');
  assert(value.packageJson.scripts?.validate?.endsWith(
    '&& node scripts/validate-m2-final-release-closure.js'),
  'repository validation does not end with final closure validation');
  assert(value.packageJson.scripts?.['test:postgres']?.includes(
    'm2-final-release-closure-integration.test.js'),
  'PostgreSQL suite is missing final closure integration');
  assert(value.catalog.m2FinalReleaseClosure === M2_FINAL_RELEASE_CLOSURE_SCHEMA_VERSION
      && value.catalog.m2FinalReleaseClosureEvidence ===
        M2_FINAL_RELEASE_CLOSURE_EVIDENCE_SCHEMA_VERSION,
  'release Schema Catalog final closure keys are invalid');
  for (const [schemaVersion, path] of [
    [M2_FINAL_RELEASE_CLOSURE_SCHEMA_VERSION,
      'schemas/release/v3/m2-final-release-closure.schema.json'],
    [M2_FINAL_RELEASE_CLOSURE_EVIDENCE_SCHEMA_VERSION,
      'schemas/release/v3/m2-final-release-closure-evidence.schema.json'],
  ]) {
    assert(value.catalog.schemas?.some((entry) =>
      entry.schemaVersion === schemaVersion && entry.path === path),
    `release Schema Catalog is missing ${schemaVersion}`);
  }
  for (const required of [
    'validate:m2-final-release-closure',
    'name: m2-final-release-closure-evidence',
  ]) assert(value.validationWorkflow.includes(required),
    `General Validation is missing ${required}`);
  for (const required of [
    'name: m2-r3-final-release-closure',
    'Run focused M2 final closure tests',
    'Run full PostgreSQL 18 integration suite',
    'Verify hardened container runtime',
    'name: m2-final-release-closure-evidence',
  ]) assert(value.dedicatedWorkflow.includes(required),
    `Dedicated final closure Workflow is missing ${required}`);
  for (const forbidden of [
    'kubectl apply', 'helm install', 'helm upgrade', 'packages: write',
    'contents: write', 'child_process', 'spawn(', 'exec(',
  ]) assert(!value.dedicatedWorkflow.toLowerCase().includes(forbidden.toLowerCase()),
    `Dedicated final closure Workflow contains forbidden ${forbidden}`);

  assert(value.releaseDoc.includes('M2-RC1 已完成仓库级发布收口')
      && value.releaseDoc.includes('repositoryReleaseReady=true')
      && !value.releaseDoc.includes('M2 堆叠尚未合并'),
  'M2-RC1 release document remains stale');
  assert(value.closureDoc.includes('m2Rc1Closed=true')
      && value.closureDoc.includes(FIXED.closureBaseSha),
  'M2 final closure release note is incomplete');
  assert(value.handoff.includes('M2-RC1 已正式关闭')
      && value.handoff.includes('M3-R0')
      && value.handoff.includes('不得启动执行器实现'),
  'development handoff is not on the M3-R0 entry gate');
  assert(value.roadmap.includes('## R3 — Final Release Closure and M3 Entry Gate')
      && value.roadmap.includes('M3-R0'),
  'M2 release readiness roadmap is missing R3');
  assert(value.m3Roadmap.includes('Contract-only')
      && value.m3Roadmap.includes('不调用 k6')
      && value.m3Roadmap.includes('不创建 Worker'),
  'M3-R0 contract-only boundary is incomplete');
  assert(value.matrix.includes('## E. M2-RC1 Final Release Closure')
      && value.matrix.includes('m2Rc1Closed=true'),
  'M2 acceptance matrix is missing final closure');
  assert(value.docsIndex.includes('M2-RC1 Final Release Closure')
      && value.docsIndex.includes('M3-R0 Execution Adapter Foundation'),
  'documentation index is missing final closure or M3-R0');
}

function rejectSensitiveLiterals(value) {
  const text = JSON.stringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /\bAKIA[A-Z0-9]{16}\b/, /\bBearer\s+[A-Za-z0-9._-]+/i,
    /"client_secret"\s*:/i, /"password"\s*:/i, /"token"\s*:/i,
  ]) assert(!pattern.test(text), 'M2 final closure contains sensitive material');
}

function same(actual, expected, label) {
  assert(canonicalDigest(actual) === canonicalDigest(expected), `${label} changed`);
}
function exactKeys(value, expected, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} is invalid`);
  same(Object.keys(value).sort(), [...expected].sort(), `${label} fields`);
}
async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}
function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM2FinalReleaseClosure(), null, 2)}\n`);
}
