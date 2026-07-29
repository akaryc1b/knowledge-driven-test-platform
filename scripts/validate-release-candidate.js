import { readFile, readdir } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize, sha256 } from '../packages/knowledge-core/src/index.js';
import { resolveEvidenceBranch } from './release-evidence-environment.js';

export const RELEASE_CANDIDATE_SCHEMA_VERSION = 'm1-read-only-release-candidate/v1';
export const RELEASE_EVIDENCE_SCHEMA_VERSION = 'm1-read-only-release-evidence/v1';
const ROOT = process.cwd();
const CANDIDATE_PATH = join(ROOT, 'releases/m1/read-only-release-candidate.json');
const MANIFEST_DIRECTORY = join(ROOT, 'deploy/kubernetes/read-only-governance-service');
const EXPECTED_SLICES = Object.freeze(Array.from({ length: 10 }, (_, index) => `M1-${String.fromCharCode(65 + index)}`));
const REQUIRED_CHECKS = Object.freeze([
  'node-workspace',
  'repository-validation',
  'postgresql-18',
  'read-only-e2e',
  'deployment-manifests',
  'hardened-container',
]);
const EXPECTED_ROUTES = Object.freeze([
  'GET /v1/projects/{projectId}/knowledge',
  'GET /v1/projects/{projectId}/knowledge/{id}/versions/{version}',
  'GET /v1/projects/{projectId}/knowledge/{id}/versions/{version}/timeline',
  'GET /v1/projects/{projectId}/snapshots',
  'GET /v1/projects/{projectId}/snapshots/{snapshotId}',
]);

export async function loadReleaseCandidate(path = CANDIDATE_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateReleaseCandidate(options = {}) {
  const candidate = options.candidate ?? await loadReleaseCandidate(options.path);
  assertObject(candidate, 'release candidate');
  assert(candidate.schemaVersion === RELEASE_CANDIDATE_SCHEMA_VERSION, 'release candidate schemaVersion is invalid');
  assert(candidate.releaseId === 'M1-RC1', 'releaseId must be M1-RC1');
  assert(candidate.version === '0.12.0', 'release candidate version must be 0.12.0');
  assert(candidate.status === 'CANDIDATE', 'release candidate status must be CANDIDATE');
  assert(candidate.candidateBranch === 'agent/m1-k-release-acceptance', 'candidate branch is invalid');
  assert(/^[a-f0-9]{40}$/.test(candidate.predecessorHeadSha), 'predecessorHeadSha is invalid');
  assert(Array.isArray(candidate.stack) && candidate.stack.length === 10, 'release stack must contain ten slices');

  for (const [index, entry] of candidate.stack.entries()) {
    assertObject(entry, `stack entry ${index}`);
    assert(entry.slice === EXPECTED_SLICES[index], `stack slice ${index} is out of order`);
    assert(entry.pr === index + 1, `stack PR ${index} is out of order`);
    assert(typeof entry.base === 'string' && entry.base.length > 0, `stack base ${index} is invalid`);
    assert(typeof entry.head === 'string' && /^agent\/m1-[a-z0-9-]+$/.test(entry.head), `stack head ${index} is invalid`);
    assert(/^[a-f0-9]{40}$/.test(entry.headSha), `stack head SHA ${index} is invalid`);
    if (index === 0) assert(entry.base === 'main', 'M1-A must target main');
    else assert(entry.base === candidate.stack[index - 1].head, `${entry.slice} base does not match predecessor head`);
  }
  assert(candidate.predecessorHeadSha === candidate.stack.at(-1).headSha, 'predecessor head SHA does not match M1-J');
  assertSet(candidate.requiredChecks, REQUIRED_CHECKS, 'required checks');
  assertSet(candidate.businessRoutes, EXPECTED_ROUTES, 'business routes');
  assertObject(candidate.decision, 'release decision');
  assert(candidate.decision.productionEligible === false, 'candidate cannot be production eligible');
  assert(Array.isArray(candidate.decision.blockers) && candidate.decision.blockers.length > 0, 'production blockers are required');

  const manifests = await readDeploymentManifests(options.manifestDirectory ?? MANIFEST_DIRECTORY);
  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString());
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha), 'source commit SHA is invalid');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    fallback: candidate.candidateBranch,
    label: 'Release source branch',
  });
  const imageId = nullableDigest(options.imageId ?? process.env.KDTP_RELEASE_IMAGE_ID ?? null, 'local image ID');
  const registryDigest = nullableDigest(options.registryDigest ?? process.env.KDTP_RELEASE_REGISTRY_DIGEST ?? null, 'registry digest');

  return {
    schemaVersion: RELEASE_EVIDENCE_SCHEMA_VERSION,
    releaseId: candidate.releaseId,
    version: candidate.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      candidate: sha256(canonicalize(candidate)),
      deploymentManifests: sha256(canonicalize(manifests)),
    },
    stack: {
      slices: candidate.stack.length,
      pullRequests: candidate.stack.map((entry) => entry.pr),
      continuous: true,
    },
    verification: {
      requiredChecks: [...candidate.requiredChecks],
      businessRoutes: [...candidate.businessRoutes],
    },
    artifacts: {
      image: {
        reference: options.imageReference ?? 'kdtp-read-only-service:test',
        localImageId: imageId,
        registryDigest,
      },
      deployment: {
        resourceCount: manifests.length,
        namespace: 'kdtp-system',
      },
    },
    decision: {
      status: candidate.status,
      productionEligible: false,
      blockers: [...candidate.decision.blockers],
    },
  };
}

async function readDeploymentManifests(directory) {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith('.yaml'))
    .sort();
  const manifests = [];
  for (const name of names) {
    manifests.push({ name, document: JSON.parse(await readFile(join(directory, name), 'utf8')) });
  }
  assert(manifests.length === 7, 'deployment evidence must contain seven YAML documents');
  return manifests;
}

function nullableDigest(value, label) {
  if (value === null || value === undefined || value === '') return null;
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), `${label} is invalid`);
  return value;
}
function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'generatedAt is invalid');
  return new Date(value).toISOString();
}
function assertSet(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${label} count is invalid`);
  assert(actual.every((value, index) => value === expected[index]), `${label} order is invalid`);
}
function assertObject(value, label) { assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`); }
function assert(condition, message) { if (!condition) throw new Error(message); }

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.stdout.write(`${JSON.stringify(await validateReleaseCandidate(), null, 2)}\n`);
