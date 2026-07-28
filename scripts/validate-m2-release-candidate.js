import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize, canonicalStringify, sha256 } from '../packages/knowledge-core/src/index.js';

export const M2_RELEASE_CANDIDATE_SCHEMA_VERSION = 'm2-governed-planning-release-candidate/v1';
export const M2_RELEASE_EVIDENCE_SCHEMA_VERSION = 'm2-governed-planning-release-evidence/v1';
const ROOT = process.cwd();
const CANDIDATE_PATH = join(ROOT, 'releases/m2/planning-release-candidate.json');
const MANIFEST_DIRECTORY = join(ROOT, 'deploy/kubernetes/read-only-governance-service');
const EXPECTED_SLICES = Object.freeze(Array.from({ length: 8 }, (_, index) => `M2-${String.fromCharCode(65 + index)}`));
const EXPECTED_PRS = Object.freeze([12, 13, 14, 15, 16, 17, 18, 19]);
const REQUIRED_CHECKS = Object.freeze([
  'node-workspace', 'repository-validation', 'postgresql-18', 'deterministic-planning',
  'governed-plan-lifecycle', 'unified-read-only-e2e', 'deployment-manifests', 'hardened-container',
]);
const EXPECTED_ROUTES = Object.freeze([
  'GET /v1/projects/{projectId}/knowledge',
  'GET /v1/projects/{projectId}/knowledge/{id}/versions/{version}',
  'GET /v1/projects/{projectId}/knowledge/{id}/versions/{version}/timeline',
  'GET /v1/projects/{projectId}/snapshots',
  'GET /v1/projects/{projectId}/snapshots/{snapshotId}',
  'GET /v1/projects/{projectId}/test-plans',
  'GET /v1/projects/{projectId}/test-plans/{planId}',
  'GET /v1/projects/{projectId}/test-plans/{planId}/coverage',
  'GET /v1/projects/{projectId}/test-plans/{planId}/provenance',
  'GET /v1/projects/{projectId}/test-plans/{planId}/timeline',
]);
const EXPECTED_LIFECYCLE = Object.freeze([
  'PUBLISHED_SNAPSHOT', 'GENERATED', 'SUBMITTED', 'REVIEWED', 'APPROVED', 'FROZEN', 'RELOADED',
]);

export async function loadM2ReleaseCandidate(path = CANDIDATE_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2ReleaseCandidate(options = {}) {
  const candidate = options.candidate ?? await loadM2ReleaseCandidate(options.path);
  assertObject(candidate, 'release candidate');
  assert(candidate.schemaVersion === M2_RELEASE_CANDIDATE_SCHEMA_VERSION, 'M2 candidate schemaVersion is invalid');
  assert(candidate.releaseId === 'M2-RC1', 'releaseId must be M2-RC1');
  assert(candidate.version === '0.12.0', 'M2 candidate version must be 0.12.0');
  assert(candidate.status === 'CANDIDATE', 'M2 candidate status must be CANDIDATE');
  assert(candidate.candidateBranch === 'agent/m2-i-release-acceptance', 'M2 candidate branch is invalid');
  assert(/^[a-f0-9]{40}$/.test(candidate.predecessorHeadSha), 'M2 predecessorHeadSha is invalid');
  assert(Array.isArray(candidate.stack) && candidate.stack.length === 8, 'M2 release stack must contain eight slices');
  for (const [index, entry] of candidate.stack.entries()) {
    assertObject(entry, `stack entry ${index}`);
    assert(entry.slice === EXPECTED_SLICES[index], `M2 stack slice ${index} is out of order`);
    assert(entry.pr === EXPECTED_PRS[index], `M2 stack PR ${index} is out of order`);
    assert(typeof entry.head === 'string' && /^agent\/m2-[a-z0-9-]+$/.test(entry.head), `M2 stack head ${index} is invalid`);
    assert(/^[a-f0-9]{40}$/.test(entry.headSha), `M2 stack head SHA ${index} is invalid`);
    if (index === 0) assert(entry.base === 'main', 'M2-A must target main');
    else assert(entry.base === candidate.stack[index - 1].head, `${entry.slice} base does not match predecessor head`);
  }
  assert(candidate.predecessorHeadSha === candidate.stack.at(-1).headSha, 'M2 predecessor head SHA does not match M2-H');
  assertSet(candidate.requiredChecks, REQUIRED_CHECKS, 'M2 required checks');
  assertSet(candidate.businessRoutes, EXPECTED_ROUTES, 'M2 business routes');
  assertSet(candidate.lifecycleEvidence, EXPECTED_LIFECYCLE, 'M2 lifecycle evidence');
  assertObject(candidate.decision, 'M2 release decision');
  assert(candidate.decision.productionEligible === false, 'M2 candidate cannot be production eligible');
  assert(Array.isArray(candidate.decision.blockers) && candidate.decision.blockers.length >= 7, 'M2 production blockers are required');
  assertNoSensitiveMaterial(candidate);

  const [planningSchemas, capabilitySchemas, querySchemas, releaseSchemas, manifests] = await Promise.all([
    readJson(join(ROOT, 'schemas/planning/schema-catalog.json')),
    readJson(join(ROOT, 'schemas/capability/schema-catalog.json')),
    readJson(join(ROOT, 'schemas/query/schema-catalog.json')),
    readJson(join(ROOT, 'schemas/release/schema-catalog.json')),
    readDeploymentManifests(options.manifestDirectory ?? MANIFEST_DIRECTORY),
  ]);
  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString());
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha), 'M2 source commit SHA is invalid');
  const branch = options.branch ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? candidate.candidateBranch;
  const imageId = nullableDigest(options.imageId ?? process.env.KDTP_RELEASE_IMAGE_ID ?? null, 'M2 local image ID');
  const registryDigest = nullableDigest(options.registryDigest ?? process.env.KDTP_RELEASE_REGISTRY_DIGEST ?? null, 'M2 registry digest');

  const evidence = {
    schemaVersion: M2_RELEASE_EVIDENCE_SCHEMA_VERSION,
    releaseId: candidate.releaseId,
    version: candidate.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      candidate: sha256(canonicalize(candidate)),
      planningSchemas: sha256(canonicalize(planningSchemas)),
      capabilitySchemas: sha256(canonicalize(capabilitySchemas)),
      querySchemas: sha256(canonicalize(querySchemas)),
      releaseSchemas: sha256(canonicalize(releaseSchemas)),
      deploymentManifests: sha256(canonicalize(manifests)),
    },
    stack: { slices: 8, pullRequests: [...EXPECTED_PRS], continuous: true },
    verification: {
      requiredChecks: [...candidate.requiredChecks],
      businessRoutes: [...candidate.businessRoutes],
      lifecycleEvidence: [...candidate.lifecycleEvidence],
    },
    artifacts: {
      image: { reference: options.imageReference ?? 'kdtp-read-only-service:test', localImageId: imageId, registryDigest },
      deployment: { resourceCount: manifests.length, namespace: 'kdtp-system' },
    },
    decision: { status: candidate.status, productionEligible: false, blockers: [...candidate.decision.blockers] },
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }
async function readDeploymentManifests(directory) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.yaml')).sort();
  const manifests = [];
  for (const name of names) manifests.push({ name, document: JSON.parse(await readFile(join(directory, name), 'utf8')) });
  assert(manifests.length === 7, 'M2 deployment evidence must contain seven YAML documents');
  return manifests;
}
function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [/postgres(?:ql)?:\/\//i, /-----BEGIN [A-Z ]*PRIVATE KEY-----/, /Bearer\s+[A-Za-z0-9._~-]+/i, /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings)"\s*:/i]) {
    assert(!pattern.test(text), 'M2 release evidence contains sensitive material');
  }
}
function nullableDigest(value, label) {
  if (value === null || value === undefined || value === '') return null;
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), `${label} is invalid`);
  return value;
}
function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'M2 generatedAt is invalid');
  return new Date(value).toISOString();
}
function assertSet(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${label} count is invalid`);
  assert(actual.every((value, index) => value === expected[index]), `${label} order is invalid`);
  assert(new Set(actual).size === actual.length, `${label} contains duplicates`);
}
function assertObject(value, label) { assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.stdout.write(`${JSON.stringify(await validateM2ReleaseCandidate(), null, 2)}\n`);
