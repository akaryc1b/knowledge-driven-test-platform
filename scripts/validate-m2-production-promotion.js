import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize, canonicalStringify, sha256 } from '../packages/knowledge-core/src/index.js';
import { resolveEvidenceBranch } from './release-evidence-environment.js';

export const M2_PRODUCTION_PROMOTION_SCHEMA_VERSION = 'm2-production-promotion/v1';
export const M2_PRODUCTION_PROMOTION_EVIDENCE_SCHEMA_VERSION = 'm2-production-promotion-evidence/v1';

const ROOT = process.cwd();
const PROMOTION_PATH = join(ROOT, 'releases/m2/production-promotion.json');
const CANDIDATE_PATH = join(ROOT, 'releases/m2/planning-release-candidate.json');
const POST_MERGE_PATH = join(ROOT, 'releases/m2/post-merge-acceptance.json');
const CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';
const POST_MERGE_DIGEST = 'd073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25';
const PROMOTION_MAIN_SHA = 'edf09333d9be9ea6839b8cf4d18efed95cfba821';
const IMAGE_REPOSITORY = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service';
const CI_ARTIFACT_KEYS = Object.freeze([
  'm1ReleaseEvidence',
  'm2ReleaseEvidence',
  'm2PostMergeEvidence',
  'postgresValidation',
  'repositoryValidation',
  'deploymentValidation',
]);
const BLOCKERS = Object.freeze([
  'main-branch-final-ci-not-verified',
  'external-registry-digest-missing',
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
]);
const SECRET_PROVIDERS = new Set([
  'aws-secrets-manager',
  'azure-key-vault',
  'gcp-secret-manager',
  'hashicorp-vault',
  'kubernetes-external-secrets',
]);
const PLACEHOLDER_PATTERN = /(?:example|placeholder|sample|dummy|fake|todo|tbd|changeme|replace[-_ ]?me|not[-_ ]?set|unknown)/i;

export async function loadM2ProductionPromotion(path = PROMOTION_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2ProductionPromotion(options = {}) {
  const promotion = options.promotion ?? await loadM2ProductionPromotion(options.path);
  const candidate = options.candidate
    ?? JSON.parse(await readFile(options.candidatePath ?? CANDIDATE_PATH, 'utf8'));
  const postMergeAcceptance = options.postMergeAcceptance
    ?? JSON.parse(await readFile(options.postMergePath ?? POST_MERGE_PATH, 'utf8'));

  assertObject(promotion, 'M2 production promotion');
  assertExactKeys(promotion, [
    'schemaVersion',
    'releaseId',
    'version',
    'phase',
    'sourceEvidence',
    'promotionSource',
    'mainBranchFinalCi',
    'imageRelease',
    'secrets',
    'targetClusterValidation',
    'approvals',
    'decision',
  ], 'M2 production promotion');
  assert(promotion.schemaVersion === M2_PRODUCTION_PROMOTION_SCHEMA_VERSION,
    'M2 production promotion schemaVersion is invalid');
  assert(promotion.releaseId === 'M2-RC1', 'M2 production promotion releaseId must be M2-RC1');
  assert(promotion.version === '0.12.0', 'M2 production promotion version must be 0.12.0');
  assert(promotion.phase === 'PRODUCTION_PROMOTION', 'M2 production promotion phase is invalid');

  validateSourceEvidence(promotion.sourceEvidence, candidate, postMergeAcceptance);
  validatePromotionSource(promotion.promotionSource);
  const proofs = [
    validateMainCi(promotion.mainBranchFinalCi),
    validateImageRelease(promotion.imageRelease),
    validateSecrets(promotion.secrets),
    validateTargetCluster(promotion.targetClusterValidation, promotion.imageRelease),
    validateApproval(promotion.approvals?.change, 'change approval'),
    validateApproval(promotion.approvals?.releaseOwner, 'release owner approval'),
  ];
  assertObject(promotion.approvals, 'production approvals');
  assertExactKeys(promotion.approvals, ['change', 'releaseOwner'], 'production approvals');

  const expectedResolved = BLOCKERS.filter((_, index) => proofs[index]);
  const expectedOpen = BLOCKERS.filter((_, index) => !proofs[index]);
  validateDecision(promotion.decision, expectedResolved, expectedOpen);
  assertNoSensitiveMaterial(promotion);

  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString());
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || isSha(commitSha), 'M2 production promotion evidence commit SHA is invalid');
  if (commitSha !== 'local') assertNotPlaceholderSha(commitSha, 'M2 production promotion evidence commit SHA');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    fallback: 'agent/m2-rc1-production-promotion-contract',
    label: 'M2 production promotion evidence branch',
  });

  const evidence = {
    schemaVersion: M2_PRODUCTION_PROMOTION_EVIDENCE_SCHEMA_VERSION,
    releaseId: promotion.releaseId,
    version: promotion.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      productionPromotion: sha256(canonicalize(promotion)),
      candidate: CANDIDATE_DIGEST,
      postMergeAcceptance: POST_MERGE_DIGEST,
    },
    promotionSource: structuredClone(promotion.promotionSource),
    mainBranchFinalCi: structuredClone(promotion.mainBranchFinalCi),
    imageRelease: structuredClone(promotion.imageRelease),
    secrets: structuredClone(promotion.secrets),
    targetClusterValidation: structuredClone(promotion.targetClusterValidation),
    approvals: structuredClone(promotion.approvals),
    decision: structuredClone(promotion.decision),
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

function validateSourceEvidence(sourceEvidence, candidate, postMergeAcceptance) {
  assertObject(sourceEvidence, 'source evidence');
  assertExactKeys(sourceEvidence, ['candidate', 'postMergeAcceptance'], 'source evidence');
  validateHistoricalReference(
    sourceEvidence.candidate,
    'releases/m2/planning-release-candidate.json',
    CANDIDATE_DIGEST,
    'candidate',
  );
  validateHistoricalReference(
    sourceEvidence.postMergeAcceptance,
    'releases/m2/post-merge-acceptance.json',
    POST_MERGE_DIGEST,
    'post-merge acceptance',
  );
  assert(sha256(canonicalize(candidate)) === CANDIDATE_DIGEST,
    'Original M2-RC1 candidate was modified');
  assert(sha256(canonicalize(postMergeAcceptance)) === POST_MERGE_DIGEST,
    'Original M2 post-merge acceptance was modified');
  assert(postMergeAcceptance.sourceCandidate?.digest === CANDIDATE_DIGEST,
    'M2 post-merge acceptance no longer binds the original candidate');
  assert(candidate.releaseId === 'M2-RC1' && postMergeAcceptance.releaseId === 'M2-RC1',
    'M2 historical release identity changed');
}

function validateHistoricalReference(reference, expectedPath, expectedDigest, label) {
  assertObject(reference, `${label} reference`);
  assertExactKeys(reference, ['path', 'digest'], `${label} reference`);
  assert(reference.path === expectedPath, `${label} reference path is invalid`);
  assert(reference.digest === expectedDigest, `${label} reference digest changed`);
}

function validatePromotionSource(source) {
  assertObject(source, 'promotion source');
  assertExactKeys(source, ['branch', 'mainSha'], 'promotion source');
  assert(source.branch === 'main', 'M2 production promotion source branch must be main');
  assert(source.mainSha === PROMOTION_MAIN_SHA, 'M2 production promotion main SHA changed');
  assertNotPlaceholderSha(source.mainSha, 'M2 production promotion main SHA');
}

function validateMainCi(mainCi) {
  assertObject(mainCi, 'main branch final CI');
  assertExactKeys(mainCi, ['status', 'event', 'sourceSha', 'runId', 'artifacts'], 'main branch final CI');
  assert(mainCi.event === 'push', 'M2 final main CI must be a push workflow');
  assert(mainCi.sourceSha === PROMOTION_MAIN_SHA,
    'M2 final main CI source SHA must match the promotion source');
  assertNotPlaceholderSha(mainCi.sourceSha, 'M2 final main CI source SHA');
  assertObject(mainCi.artifacts, 'main branch final CI artifacts');
  assertExactKeys(mainCi.artifacts, CI_ARTIFACT_KEYS, 'main branch final CI artifacts');
  assert(mainCi.status === 'UNVERIFIED' || mainCi.status === 'PASSED',
    'M2 final main CI status is invalid');
  if (mainCi.status === 'UNVERIFIED') {
    assert(mainCi.runId === null, 'Unverified main CI cannot contain a run ID');
    for (const key of CI_ARTIFACT_KEYS) {
      assert(mainCi.artifacts[key] === null, `Unverified main CI cannot contain ${key}`);
    }
    return false;
  }
  assertPositiveInteger(mainCi.runId, 'Passed main CI run ID');
  for (const key of CI_ARTIFACT_KEYS) {
    assertArtifactDigest(mainCi.artifacts[key], `Passed main CI ${key}`);
  }
  return true;
}

function validateImageRelease(imageRelease) {
  assertObject(imageRelease, 'image release');
  assertExactKeys(imageRelease, [
    'status',
    'repository',
    'immutableReference',
    'registryDigest',
    'sourceSha',
    'buildRunId',
    'sbom',
    'provenanceAttestation',
    'sbomAttestation',
    'pullVerification',
  ], 'image release');
  assert(imageRelease.repository === IMAGE_REPOSITORY, 'M2 image repository is invalid');
  assert(imageRelease.status === 'MISSING' || imageRelease.status === 'PUBLISHED',
    'M2 image release status is invalid');
  if (imageRelease.status === 'MISSING') {
    for (const key of ['immutableReference', 'registryDigest', 'sourceSha', 'buildRunId']) {
      assert(imageRelease[key] === null, `Missing image release cannot contain ${key}`);
    }
    validateMissingSbom(imageRelease.sbom);
    validateMissingAttestation(imageRelease.provenanceAttestation, 'provenance attestation');
    validateMissingAttestation(imageRelease.sbomAttestation, 'SBOM attestation');
    validateMissingPullVerification(imageRelease.pullVerification);
    return false;
  }

  assertArtifactDigest(imageRelease.registryDigest, 'Registry digest');
  const expectedReference = `${IMAGE_REPOSITORY}@${imageRelease.registryDigest}`;
  assert(imageRelease.immutableReference === expectedReference,
    'Published image must use the complete immutable Registry reference');
  assert(!imageRelease.immutableReference.includes(':0.12.0')
    && !imageRelease.immutableReference.includes(':m2-rc1'),
  'A mutable image tag cannot be used as production evidence');
  assert(imageRelease.sourceSha === PROMOTION_MAIN_SHA, 'Published image source SHA is invalid');
  assertNotPlaceholderSha(imageRelease.sourceSha, 'Published image source SHA');
  assertPositiveInteger(imageRelease.buildRunId, 'Published image build run ID');
  validateGeneratedSbom(imageRelease.sbom);
  validateVerifiedAttestation(imageRelease.provenanceAttestation, 'provenance attestation');
  validateVerifiedAttestation(imageRelease.sbomAttestation, 'SBOM attestation');
  validatePassedPullVerification(
    imageRelease.pullVerification,
    expectedReference,
    imageRelease.registryDigest,
  );
  return true;
}

function validateMissingSbom(sbom) {
  assertObject(sbom, 'SBOM');
  assertExactKeys(sbom, ['status', 'format', 'digest'], 'SBOM');
  assert(sbom.status === 'MISSING' && sbom.format === null && sbom.digest === null,
    'Missing image release must contain an empty SBOM record');
}

function validateGeneratedSbom(sbom) {
  assertObject(sbom, 'SBOM');
  assertExactKeys(sbom, ['status', 'format', 'digest'], 'SBOM');
  assert(sbom.status === 'GENERATED', 'Published image requires a generated SBOM');
  assert(sbom.format === 'spdx-json' || sbom.format === 'cyclonedx-json',
    'Published image SBOM format is invalid');
  assertArtifactDigest(sbom.digest, 'SBOM digest');
}

function validateMissingAttestation(attestation, label) {
  assertObject(attestation, label);
  assertExactKeys(attestation, ['status', 'attestationId', 'url', 'bundleDigest'], label);
  assert(attestation.status === 'MISSING', `Missing image release ${label} status is invalid`);
  assert(attestation.attestationId === null
    && attestation.url === null
    && attestation.bundleDigest === null,
  `Missing image release cannot contain ${label} evidence`);
}

function validateVerifiedAttestation(attestation, label) {
  assertObject(attestation, label);
  assertExactKeys(attestation, ['status', 'attestationId', 'url', 'bundleDigest'], label);
  assert(attestation.status === 'VERIFIED', `Published image requires a verified ${label}`);
  assertExternalId(attestation.attestationId, `${label} ID`);
  assertHttpsUrl(attestation.url, `${label} URL`);
  assertArtifactDigest(attestation.bundleDigest, `${label} bundle digest`);
}

function validateMissingPullVerification(verification) {
  assertObject(verification, 'image pull verification');
  assertExactKeys(
    verification,
    ['status', 'verifiedReference', 'resolvedDigest', 'verifiedAt'],
    'image pull verification',
  );
  assert(verification.status === 'NOT_RUN',
    'Missing image release pull verification status is invalid');
  assert(verification.verifiedReference === null
    && verification.resolvedDigest === null
    && verification.verifiedAt === null,
  'Missing image release cannot contain pull verification evidence');
}

function validatePassedPullVerification(verification, expectedReference, expectedDigest) {
  assertObject(verification, 'image pull verification');
  assertExactKeys(
    verification,
    ['status', 'verifiedReference', 'resolvedDigest', 'verifiedAt'],
    'image pull verification',
  );
  assert(verification.status === 'PASSED', 'Published image requires digest pull verification');
  assert(verification.verifiedReference === expectedReference,
    'Pulled image reference does not match published image');
  assert(verification.resolvedDigest === expectedDigest,
    'Pulled image digest does not match Registry digest');
  normalizeTimestamp(verification.verifiedAt);
}

function validateSecrets(secrets) {
  assertObject(secrets, 'production Secret configuration');
  assertExactKeys(secrets, ['status', 'provider', 'references', 'configuredAt'],
    'production Secret configuration');
  assert(Array.isArray(secrets.references), 'Production Secret references must be an array');
  assert(secrets.status === 'NOT_CONFIGURED' || secrets.status === 'CONFIGURED',
    'Production Secret status is invalid');
  if (secrets.status === 'NOT_CONFIGURED') {
    assert(secrets.provider === null
      && secrets.references.length === 0
      && secrets.configuredAt === null,
    'Unconfigured production Secrets cannot contain provider evidence');
    return false;
  }
  assert(SECRET_PROVIDERS.has(secrets.provider), 'Production Secret provider is not allowed');
  assert(secrets.references.length > 0,
    'Configured production Secrets require at least one reference');
  const names = new Set();
  for (const [index, reference] of secrets.references.entries()) {
    assertObject(reference, `Secret reference ${index}`);
    assertExactKeys(reference, ['name', 'reference'], `Secret reference ${index}`);
    assertExternalId(reference.name, `Secret reference ${index} name`);
    assertExternalId(reference.reference, `Secret reference ${index}`);
    assert(isVersionedSecretReference(reference.reference),
      `Secret reference ${index} is not a versioned provider reference`);
    assert(!names.has(reference.name), `Secret reference ${index} name is duplicated`);
    names.add(reference.name);
  }
  normalizeTimestamp(secrets.configuredAt);
  return true;
}

function validateTargetCluster(cluster, imageRelease) {
  assertObject(cluster, 'target cluster validation');
  assertExactKeys(cluster, [
    'status',
    'clusterRef',
    'validationRunId',
    'sourceSha',
    'imageDigest',
    'deploymentManifestDigest',
    'validatedAt',
  ], 'target cluster validation');
  assert(cluster.status === 'NOT_RUN' || cluster.status === 'PASSED',
    'Target cluster validation status is invalid');
  if (cluster.status === 'NOT_RUN') {
    for (const key of [
      'clusterRef',
      'validationRunId',
      'sourceSha',
      'imageDigest',
      'deploymentManifestDigest',
      'validatedAt',
    ]) assert(cluster[key] === null, `Unrun target cluster validation cannot contain ${key}`);
    return false;
  }
  assert(imageRelease.status === 'PUBLISHED',
    'Target cluster validation requires a published immutable image');
  assertExternalId(cluster.clusterRef, 'Target cluster reference');
  assertExternalId(cluster.validationRunId, 'Target cluster validation run ID');
  assert(cluster.sourceSha === PROMOTION_MAIN_SHA,
    'Target cluster validation source SHA is invalid');
  assertNotPlaceholderSha(cluster.sourceSha, 'Target cluster validation source SHA');
  assertArtifactDigest(cluster.imageDigest, 'Target cluster image digest');
  assert(cluster.imageDigest === imageRelease.registryDigest,
    'Target cluster image digest does not match Registry digest');
  assertArtifactDigest(cluster.deploymentManifestDigest, 'Deployment manifest digest');
  normalizeTimestamp(cluster.validatedAt);
  return true;
}

function validateApproval(approval, label) {
  assertObject(approval, label);
  assertExactKeys(approval, ['status', 'system', 'approvalId', 'approvedAt'], label);
  assert(approval.status === 'MISSING' || approval.status === 'APPROVED',
    `${label} status is invalid`);
  if (approval.status === 'MISSING') {
    assert(approval.system === null
      && approval.approvalId === null
      && approval.approvedAt === null,
    `Missing ${label} cannot contain approval evidence`);
    return false;
  }
  assertExternalId(approval.system, `${label} system`);
  assertExternalId(approval.approvalId, `${label} ID`);
  normalizeTimestamp(approval.approvedAt);
  return true;
}

function validateDecision(decision, expectedResolved, expectedOpen) {
  assertObject(decision, 'production promotion decision');
  assertExactKeys(decision, ['productionEligible', 'resolvedBlockers', 'openBlockers'],
    'production promotion decision');
  assertSet(decision.resolvedBlockers, expectedResolved, 'resolved blockers');
  assertSet(decision.openBlockers, expectedOpen, 'open blockers');
  const resolved = new Set(decision.resolvedBlockers);
  assert(decision.openBlockers.every((blocker) => !resolved.has(blocker)),
    'Resolved production blockers cannot remain open');
  const expectedEligibility = expectedOpen.length === 0;
  assert(decision.productionEligible === expectedEligibility,
    expectedEligibility
      ? 'All mandatory blockers are resolved, so productionEligible must be true'
      : 'Open blockers require productionEligible=false');
}

function isVersionedSecretReference(reference) {
  return /^(?:arn:aws:secretsmanager:[^\s]+|https:\/\/[^\s/]+\.vault\.azure\.net\/secrets\/[^\s/]+\/[^\s/]+|projects\/[^\s/]+\/secrets\/[^\s/]+\/versions\/[^\s/]+|vault:\/\/[^\s#]+#[^\s#]+|external-secret:\/\/[^\s/]+\/[^\s#]+#[^\s#]+)$/.test(reference);
}

function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings|kubeconfig|clientSecret|secretValue)"\s*:/i,
    /:\/\/[^"@:\s]+:[^"@\s]+@/,
    /"clusters"\s*:\s*\[/,
  ]) assert(!pattern.test(text), 'M2 production promotion evidence contains sensitive material');
}

function assertArtifactDigest(value, label) {
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value),
    `${label} is invalid`);
  const digest = value.slice('sha256:'.length);
  assert(!isPlaceholderHex(digest), `${label} cannot be a placeholder digest`);
}

function assertNotPlaceholderSha(value, label) {
  assert(isSha(value), `${label} is invalid`);
  assert(!isPlaceholderHex(value), `${label} cannot be a placeholder SHA`);
}

function isPlaceholderHex(value) {
  const unique = new Set(value).size;
  return unique <= 2
    || /^(?:0123456789abcdef)+$/.test(value)
    || /^(?:abcdef0123456789)+$/.test(value);
}

function assertExternalId(value, label) {
  assert(typeof value === 'string' && value.length >= 4 && value.length <= 512,
    `${label} is invalid`);
  assert(!PLACEHOLDER_PATTERN.test(value), `${label} cannot be a placeholder`);
}

function assertHttpsUrl(value, label) {
  assertExternalId(value, label);
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`${label} is invalid`);
  }
  assert(url.protocol === 'https:', `${label} must use HTTPS`);
}

function assertPositiveInteger(value, label) {
  assert(Number.isInteger(value) && value > 0, `${label} is invalid`);
}

function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)),
    'M2 production promotion timestamp is invalid');
  return new Date(value).toISOString();
}

function assertSet(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length,
    `${label} count is invalid`);
  assert(actual.every((value, index) => value === expected[index]),
    `${label} order is invalid`);
  assert(new Set(actual).size === actual.length, `${label} contains duplicates`);
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  assert(actual.length === normalizedExpected.length
    && actual.every((key, index) => key === normalizedExpected[index]),
  `${label} fields are invalid`);
}

function isSha(value) {
  return typeof value === 'string' && /^[a-f0-9]{40}$/.test(value);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2ProductionPromotion(), null, 2)}\n`);
}
