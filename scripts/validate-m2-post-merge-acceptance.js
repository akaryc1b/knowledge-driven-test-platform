import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize, canonicalStringify, sha256 } from '../packages/knowledge-core/src/index.js';
import { resolveEvidenceBranch } from './release-evidence-environment.js';

export const M2_POST_MERGE_ACCEPTANCE_SCHEMA_VERSION = 'm2-governed-planning-post-merge-acceptance/v1';
export const M2_POST_MERGE_EVIDENCE_SCHEMA_VERSION = 'm2-governed-planning-post-merge-evidence/v1';

const ROOT = process.cwd();
const ACCEPTANCE_PATH = join(ROOT, 'releases/m2/post-merge-acceptance.json');
const CANDIDATE_PATH = join(ROOT, 'releases/m2/planning-release-candidate.json');
const SOURCE_CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';
const SOURCE_CANDIDATE_HEAD = 'e0ee22c30df06e676a9f677d38f57e974018e2e2';
const MERGED_MAIN_SHA = '8b004fa0617a470fb777bbd58b3cf8600e661a5c';
const EXPECTED_MERGES = Object.freeze([
  [12, '1fa1e5deac9883416f1d33b12a6135a9db81b8db'],
  [13, '2076209b0088d845b8aa483335a1fcdd561c5d70'],
  [14, '7aec919fcf474b4558b74fa98a11ec8b29bed45a'],
  [15, 'd66e8ed82de78d7799a189a45f1a39878b3d5b1f'],
  [16, '59a7d4c40667473d278fdf5efd38d1f3b9efcc7a'],
  [17, 'ec4607b96ecdeadf15c310dc133ee5f01fcd2010'],
  [18, '349481f13107161f4a00862e84e9e256f6f602ea'],
  [19, '91c42351c6fb03892cd90dc2c545a8d59542e2f7'],
  [20, MERGED_MAIN_SHA],
]);
const RESOLVED_BLOCKERS = Object.freeze(['m2-stack-prs-not-merged']);
const UNVERIFIED_OPEN_BLOCKERS = Object.freeze([
  'main-branch-final-ci-not-verified',
  'external-registry-digest-missing',
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
]);
const VERIFIED_OPEN_BLOCKERS = Object.freeze(UNVERIFIED_OPEN_BLOCKERS.slice(1));
const SUPERSEDED_BLOCKER = Object.freeze({
  from: 'main-branch-final-ci-not-run',
  to: 'main-branch-final-ci-not-verified',
});

export async function loadM2PostMergeAcceptance(path = ACCEPTANCE_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2PostMergeAcceptance(options = {}) {
  const acceptance = options.acceptance ?? await loadM2PostMergeAcceptance(options.path);
  const candidate = options.candidate ?? JSON.parse(await readFile(options.candidatePath ?? CANDIDATE_PATH, 'utf8'));
  assertObject(acceptance, 'M2 post-merge acceptance');
  assert(acceptance.schemaVersion === M2_POST_MERGE_ACCEPTANCE_SCHEMA_VERSION,
    'M2 post-merge acceptance schemaVersion is invalid');
  assert(acceptance.releaseId === 'M2-RC1', 'M2 post-merge releaseId must be M2-RC1');
  assert(acceptance.version === '0.12.0', 'M2 post-merge version must be 0.12.0');
  assert(acceptance.phase === 'POST_MERGE_ACCEPTANCE', 'M2 post-merge phase is invalid');

  assertObject(acceptance.sourceCandidate, 'source candidate');
  assert(acceptance.sourceCandidate.path === 'releases/m2/planning-release-candidate.json',
    'M2 post-merge source candidate path is invalid');
  assert(acceptance.sourceCandidate.digest === SOURCE_CANDIDATE_DIGEST,
    'M2 post-merge source candidate digest changed');
  assert(acceptance.sourceCandidate.headSha === SOURCE_CANDIDATE_HEAD,
    'M2 post-merge source candidate head changed');
  assert(sha256(canonicalize(candidate)) === SOURCE_CANDIDATE_DIGEST,
    'Original M2-RC1 candidate was modified');
  assert(candidate.decision?.blockers?.includes('m2-stack-prs-not-merged'),
    'Original M2-RC1 merge blocker history was modified');
  assert(candidate.decision?.blockers?.includes('main-branch-final-ci-not-run'),
    'Original M2-RC1 main CI blocker history was modified');

  validateMergeEvidence(acceptance.merge);
  validateVerification(acceptance.verification);
  validateDecision(acceptance.decision, acceptance.verification.mainBranchFinalCi.status);
  assertNoSensitiveMaterial(acceptance);

  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString());
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || isSha(commitSha), 'M2 post-merge source commit SHA is invalid');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    fallback: 'agent/m2-rc1-post-merge-acceptance',
    label: 'M2 post-merge source branch',
  });

  const evidence = {
    schemaVersion: M2_POST_MERGE_EVIDENCE_SCHEMA_VERSION,
    releaseId: acceptance.releaseId,
    version: acceptance.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      acceptance: sha256(canonicalize(acceptance)),
      sourceCandidate: SOURCE_CANDIDATE_DIGEST,
    },
    merge: structuredClone(acceptance.merge),
    verification: structuredClone(acceptance.verification),
    decision: structuredClone(acceptance.decision),
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

function validateMergeEvidence(merge) {
  assertObject(merge, 'M2 merge evidence');
  assert(merge.mainSha === MERGED_MAIN_SHA, 'M2 merged main SHA changed');
  assert(merge.fileTreeMatchesCandidateHead === true, 'M2 merged file tree is not bound to the candidate head');
  assert(merge.fileDeltaCount === 0, 'M2 merged file tree contains unexpected changes');
  assert(Array.isArray(merge.pullRequests) && merge.pullRequests.length === EXPECTED_MERGES.length,
    'M2 post-merge evidence must contain PR #12 through #20');
  for (const [index, entry] of merge.pullRequests.entries()) {
    assertObject(entry, `merge entry ${index}`);
    const [expectedPr, expectedSha] = EXPECTED_MERGES[index];
    assert(entry.pr === expectedPr, `M2 merged PR ${index} is out of order`);
    assert(entry.status === 'MERGED', `M2 PR #${entry.pr} is not marked merged`);
    assert(entry.mergeCommitSha === expectedSha, `M2 PR #${entry.pr} merge commit changed`);
  }
  assert(merge.pullRequests.at(-1).mergeCommitSha === merge.mainSha,
    'M2 final merge commit does not match merged main SHA');
}

function validateVerification(verification) {
  assertObject(verification, 'M2 post-merge verification');
  const pre = verification.preMergeValidation;
  assertObject(pre, 'pre-merge validation');
  assert(pre.status === 'PASSED', 'M2 pre-merge validation must be PASSED');
  assert(pre.runId === 30336009261, 'M2 pre-merge validation run changed');
  assert(pre.sourceSha === SOURCE_CANDIDATE_HEAD, 'M2 pre-merge validation source changed');
  assertArtifactDigest(pre.m2EvidenceArtifactDigest, 'M2 pre-merge evidence artifact digest');
  assertArtifactDigest(pre.postgresArtifactDigest, 'M2 pre-merge PostgreSQL artifact digest');

  const main = verification.mainBranchFinalCi;
  assertObject(main, 'main branch final CI');
  assert(main.commitSha === MERGED_MAIN_SHA, 'M2 main CI commit does not match merged main SHA');
  assert(main.status === 'UNVERIFIED' || main.status === 'PASSED', 'M2 main CI status is invalid');
  if (main.status === 'UNVERIFIED') {
    assert(main.runId === null, 'Unverified main CI cannot contain a run ID');
    assert(main.m2EvidenceArtifactDigest === null, 'Unverified main CI cannot contain M2 artifact evidence');
    assert(main.postgresArtifactDigest === null, 'Unverified main CI cannot contain PostgreSQL artifact evidence');
  } else {
    assert(Number.isInteger(main.runId) && main.runId > 0, 'Passed main CI requires a run ID');
    assertArtifactDigest(main.m2EvidenceArtifactDigest, 'M2 main evidence artifact digest');
    assertArtifactDigest(main.postgresArtifactDigest, 'M2 main PostgreSQL artifact digest');
  }
}

function validateDecision(decision, mainCiStatus) {
  assertObject(decision, 'M2 post-merge decision');
  assert(decision.productionEligible === false, 'M2 post-merge acceptance cannot be production eligible');
  assertSet(decision.resolvedBlockers, RESOLVED_BLOCKERS, 'resolved blockers');
  assert(Array.isArray(decision.supersededBlockers) && decision.supersededBlockers.length === 1,
    'M2 post-merge acceptance requires one superseded blocker mapping');
  assert(decision.supersededBlockers[0].from === SUPERSEDED_BLOCKER.from
      && decision.supersededBlockers[0].to === SUPERSEDED_BLOCKER.to,
    'M2 superseded blocker mapping changed');
  const expectedOpen = mainCiStatus === 'PASSED' ? VERIFIED_OPEN_BLOCKERS : UNVERIFIED_OPEN_BLOCKERS;
  assertSet(decision.openBlockers, expectedOpen, 'open blockers');
  const resolved = new Set(decision.resolvedBlockers);
  assert(decision.openBlockers.every((blocker) => !resolved.has(blocker)),
    'Resolved blockers cannot remain open');
  assert(!decision.openBlockers.includes('m2-stack-prs-not-merged'),
    'Merged M2 stack blocker cannot remain open');
  assert(!decision.openBlockers.includes('main-branch-final-ci-not-run'),
    'Stale main CI blocker cannot remain open');
}

function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings)"\s*:/i,
  ]) assert(!pattern.test(text), 'M2 post-merge evidence contains sensitive material');
}

function assertArtifactDigest(value, label) {
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), `${label} is invalid`);
}
function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'M2 post-merge generatedAt is invalid');
  return new Date(value).toISOString();
}
function assertSet(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${label} count is invalid`);
  assert(actual.every((value, index) => value === expected[index]), `${label} order is invalid`);
  assert(new Set(actual).size === actual.length, `${label} contains duplicates`);
}
function isSha(value) { return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value); }
function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}
function assert(condition, message) { if (!condition) throw new Error(message); }

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) process.stdout.write(`${JSON.stringify(await validateM2PostMergeAcceptance(), null, 2)}\n`);
