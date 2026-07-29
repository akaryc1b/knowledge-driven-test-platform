import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalize, canonicalStringify, sha256 } from '../packages/knowledge-core/src/index.js';
import { resolveEvidenceBranch } from './release-evidence-environment.js';

export const M2_R1B_IMAGE_BINDING_SCHEMA_VERSION = 'm2-r1b-image-binding/v1';
export const M2_R1B_IMAGE_BINDING_EVIDENCE_SCHEMA_VERSION = 'm2-r1b-image-binding-evidence/v1';

const ROOT = process.cwd();
const BINDING_PATH = join(ROOT, 'releases/m2/r1b-image-binding.json');
const RELEASE_EVIDENCE_PATH = join(ROOT, 'releases/m2/release-image-evidence.json');
const PROMOTION_PATH = join(ROOT, 'releases/m2/production-promotion.json');
const DEPLOYMENT_PATH = join(ROOT, 'deploy/kubernetes/read-only-governance-service/deployment.yaml');
const CANDIDATE_PATH = join(ROOT, 'releases/m2/planning-release-candidate.json');
const POST_MERGE_PATH = join(ROOT, 'releases/m2/post-merge-acceptance.json');
const SOURCE_SHA = '6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7';
const MAIN_CI_RUN_ID = 30440545497;
const VALIDATE_JOB_ID = 90538558839;
const POSTGRES_JOB_ID = 90538558723;
const RELEASE_RUN_ID = 30440674461;
const RELEASE_ARTIFACT_ID = 8719335176;
const RELEASE_ARTIFACT_NAME = 'm2-release-image-evidence-6bef789da58b';
const RELEASE_ARTIFACT_DIGEST = 'sha256:03d7a7aa35b99436237494dae1f1048b828812651e4b39b4c8c82ea41a6aeef5';
const RELEASE_EVIDENCE_DIGEST = 'sha256:dcc912aada0bb5f4337cec0682ee081ac40fe4e1bf2cb6ad6203df3b3c45492a';
const DEPLOYMENT_DIGEST = 'sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45';
const CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';
const POST_MERGE_DIGEST = 'd073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25';
const IMAGE_REPOSITORY = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service';
const REGISTRY_DIGEST = 'sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13';
const IMMUTABLE_REFERENCE = `${IMAGE_REPOSITORY}@${REGISTRY_DIGEST}`;
const MAIN_CI_ARTIFACTS = Object.freeze({
  m1ReleaseEvidence: 'sha256:0be9d9ff76be9fe05e7acf45c62eb2ec6dd5742d2568ddc0586bed74e105ccb7',
  m2ReleaseEvidence: 'sha256:c0c257db57e9a8b98b24d2c27da343289654d84627c547055cfa68ac72f449cf',
  m2PostMergeEvidence: 'sha256:937a97d6dd782b80c9ee6ae2d90472d1e21a9d086a4d16db960739988a1c2ab4',
  postgresValidation: 'sha256:db2892e2d22c39cf782042cbd447f81b386b8f9a47366f189470834f6e9a3fa1',
  repositoryValidation: 'sha256:8cb381ea153ebbc12ee3eccff5ef3ea7ece8e99d9ea57e4d036ca19ede0bdaf3',
  deploymentValidation: 'sha256:7be5a15fb53eabef201fa9b7eadf5f234f0f6c69205359e05237db683c750b3c',
});
const RESOLVED_BLOCKERS = Object.freeze([
  'main-branch-final-ci-not-verified',
  'external-registry-digest-missing',
]);
const REMAINING_BLOCKERS = Object.freeze([
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
]);

export async function loadM2R1BImageBinding(path = BINDING_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2R1BImageBinding(options = {}) {
  const binding = options.binding ?? await loadM2R1BImageBinding(options.path);
  const releaseEvidence = options.releaseEvidence
    ?? JSON.parse(await readFile(options.releaseEvidencePath ?? RELEASE_EVIDENCE_PATH, 'utf8'));
  const promotion = options.promotion
    ?? JSON.parse(await readFile(options.promotionPath ?? PROMOTION_PATH, 'utf8'));
  const deployment = options.deployment
    ?? JSON.parse(await readFile(options.deploymentPath ?? DEPLOYMENT_PATH, 'utf8'));
  const candidate = options.candidate
    ?? JSON.parse(await readFile(options.candidatePath ?? CANDIDATE_PATH, 'utf8'));
  const postMerge = options.postMerge
    ?? JSON.parse(await readFile(options.postMergePath ?? POST_MERGE_PATH, 'utf8'));

  validateBinding(binding);
  validateReleaseEvidence(releaseEvidence);
  validatePromotion(promotion, releaseEvidence, candidate, postMerge);
  validateDeployment(deployment);
  validateCrossReferences(binding, releaseEvidence, promotion, deployment);
  assertNoSensitiveMaterial({ binding, releaseEvidence, promotion, deployment });

  const generatedAt = normalizeTimestamp(options.generatedAt ?? new Date().toISOString());
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'R1-B binding evidence commit SHA is invalid');
  const branch = resolveEvidenceBranch({
    branch: options.branch,
    fallback: 'agent/m2-rc1-r1b-immutable-image-binding',
    label: 'R1-B binding evidence branch',
  });

  const evidence = {
    schemaVersion: M2_R1B_IMAGE_BINDING_EVIDENCE_SCHEMA_VERSION,
    releaseId: binding.releaseId,
    version: binding.version,
    generatedAt,
    source: { branch, commitSha },
    digests: {
      binding: artifactDigest(binding),
      releaseImageEvidence: artifactDigest(releaseEvidence),
      productionPromotion: artifactDigest(promotion),
      deploymentManifest: artifactDigest(deployment),
    },
    release: {
      runId: binding.release.runId,
      artifactId: binding.release.evidenceArtifact.id,
      artifactDigest: binding.release.evidenceArtifact.digest,
    },
    image: {
      immutableReference: releaseEvidence.image.immutableReference,
      registryDigest: releaseEvidence.image.registryDigest,
      sbomDigest: releaseEvidence.sbom.digest,
      provenanceBundleDigest: releaseEvidence.attestations.provenance.bundleDigest,
      sbomBundleDigest: releaseEvidence.attestations.sbom.bundleDigest,
    },
    deployment: structuredClone(binding.deployment),
    decision: {
      eligibleForProductionEvidenceBinding: true,
      productionEligible: false,
      remainingBlockers: [...REMAINING_BLOCKERS],
    },
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

function validateBinding(binding) {
  assertObject(binding, 'R1-B image binding');
  assertExactKeys(binding, [
    'schemaVersion', 'releaseId', 'version', 'boundAt', 'source', 'release', 'deployment', 'decision',
  ], 'R1-B image binding');
  assert(binding.schemaVersion === M2_R1B_IMAGE_BINDING_SCHEMA_VERSION,
    'R1-B image binding schemaVersion is invalid');
  assert(binding.releaseId === 'M2-RC1' && binding.version === '0.12.0',
    'R1-B release identity is invalid');
  normalizeTimestamp(binding.boundAt);

  assertObject(binding.source, 'R1-B source');
  assertExactKeys(binding.source, ['branch', 'sha', 'mainCi'], 'R1-B source');
  assert(binding.source.branch === 'main' && binding.source.sha === SOURCE_SHA,
    'R1-B source does not match the published image source');
  assertObject(binding.source.mainCi, 'R1-B main CI');
  assertExactKeys(binding.source.mainCi, ['runId', 'validateJobId', 'postgresJobId', 'artifacts'],
    'R1-B main CI');
  assert(binding.source.mainCi.runId === MAIN_CI_RUN_ID
    && binding.source.mainCi.validateJobId === VALIDATE_JOB_ID
    && binding.source.mainCi.postgresJobId === POSTGRES_JOB_ID,
  'R1-B main CI job evidence is invalid');
  assertCanonicalEqual(binding.source.mainCi.artifacts, MAIN_CI_ARTIFACTS,
    'R1-B main CI Artifact digests changed');

  assertObject(binding.release, 'R1-B release');
  assertExactKeys(binding.release, ['workflow', 'runId', 'evidenceArtifact', 'evidence'], 'R1-B release');
  assert(binding.release.workflow === '.github/workflows/m2-release-image.yml'
    && binding.release.runId === RELEASE_RUN_ID,
  'R1-B release Workflow evidence is invalid');
  assertObject(binding.release.evidenceArtifact, 'R1-B release Artifact');
  assertExactKeys(binding.release.evidenceArtifact, ['id', 'name', 'digest'], 'R1-B release Artifact');
  assert(binding.release.evidenceArtifact.id === RELEASE_ARTIFACT_ID
    && binding.release.evidenceArtifact.name === RELEASE_ARTIFACT_NAME
    && binding.release.evidenceArtifact.digest === RELEASE_ARTIFACT_DIGEST,
  'R1-B release Artifact evidence is invalid');
  assertObject(binding.release.evidence, 'R1-B repository release evidence');
  assertExactKeys(binding.release.evidence, ['path', 'digest'], 'R1-B repository release evidence');
  assert(binding.release.evidence.path === 'releases/m2/release-image-evidence.json'
    && binding.release.evidence.digest === RELEASE_EVIDENCE_DIGEST,
  'R1-B repository release evidence reference is invalid');

  assertObject(binding.deployment, 'R1-B deployment binding');
  assertExactKeys(binding.deployment, ['path', 'image', 'manifestDigest'], 'R1-B deployment binding');
  assert(binding.deployment.path === 'deploy/kubernetes/read-only-governance-service/deployment.yaml'
    && binding.deployment.image === IMMUTABLE_REFERENCE
    && binding.deployment.manifestDigest === DEPLOYMENT_DIGEST,
  'R1-B deployment binding is invalid');

  assertObject(binding.decision, 'R1-B decision');
  assertExactKeys(binding.decision, [
    'externalRegistryDigestAvailable',
    'deploymentUsesImmutableDigest',
    'eligibleForProductionEvidenceBinding',
    'productionEligible',
    'remainingBlockers',
  ], 'R1-B decision');
  assert(binding.decision.externalRegistryDigestAvailable === true
    && binding.decision.deploymentUsesImmutableDigest === true
    && binding.decision.eligibleForProductionEvidenceBinding === true,
  'R1-B binding decision is incomplete');
  assert(binding.decision.productionEligible === false,
    'R1-B cannot grant production eligibility');
  assertSet(binding.decision.remainingBlockers, REMAINING_BLOCKERS, 'R1-B remaining blockers');
}

function validateReleaseEvidence(evidence) {
  assertObject(evidence, 'R1-A release image evidence');
  assert(evidence.schemaVersion === 'm2-release-image-evidence/v1'
    && evidence.releaseId === 'M2-RC1'
    && evidence.version === '0.12.0',
  'R1-A release identity is invalid');
  normalizeTimestamp(evidence.generatedAt);
  assert(evidence.source?.branch === 'main' && evidence.source?.sha === SOURCE_SHA,
    'R1-A release source is invalid');
  assert(evidence.build?.repository === 'akaryc1b/knowledge-driven-test-platform'
    && evidence.build?.workflow === '.github/workflows/m2-release-image.yml'
    && evidence.build?.runId === RELEASE_RUN_ID,
  'R1-A release build evidence is invalid');
  assert(evidence.image?.repository === IMAGE_REPOSITORY
    && evidence.image?.immutableReference === IMMUTABLE_REFERENCE
    && evidence.image?.registryDigest === REGISTRY_DIGEST,
  'R1-A Registry image evidence is invalid');
  assertSet(evidence.image.tags, ['0.12.0', 'm2-rc1', 'sha-6bef789da58b'], 'R1-A image tags');
  assert(evidence.image.pullVerification?.status === 'PASSED'
    && evidence.image.pullVerification?.verifiedReference === IMMUTABLE_REFERENCE
    && evidence.image.pullVerification?.resolvedDigest === REGISTRY_DIGEST,
  'R1-A immutable pull verification is invalid');
  normalizeTimestamp(evidence.image.pullVerification.verifiedAt);
  assert(evidence.sbom?.format === 'spdx-json'
    && evidence.sbom?.digest === 'sha256:94a4a77a76f4802c9ff4a238e63854e1619d2ce46fd6a5eaef1e2698eb033702',
  'R1-A SBOM evidence is invalid');
  validateAttestation(evidence.attestations?.provenance, '37705043',
    'sha256:9713617e86d763075dff8e5b1394a1c7a97c0f8ef4d05a2310670daa5d90b6be',
    'provenance');
  validateAttestation(evidence.attestations?.sbom, '37705058',
    'sha256:0191ec23424d1e0128ded4a3a57dc2f489b6ab07629210d84de27e008d5cdc84',
    'SBOM');
  assert(evidence.decision?.externalRegistryDigestAvailable === true
    && evidence.decision?.eligibleForDigestBinding === true,
  'R1-A evidence is not eligible for R1-B binding');
  assert(artifactDigest(evidence) === RELEASE_EVIDENCE_DIGEST,
    'Repository release evidence digest changed');
}

function validatePromotion(promotion, releaseEvidence, candidate, postMerge) {
  assertObject(promotion, 'M2 production promotion');
  assertExactKeys(promotion, [
    'schemaVersion', 'releaseId', 'version', 'phase', 'sourceEvidence', 'promotionSource',
    'mainBranchFinalCi', 'imageRelease', 'secrets', 'targetClusterValidation', 'approvals', 'decision',
  ], 'M2 production promotion');
  assert(promotion.schemaVersion === 'm2-production-promotion/v1'
    && promotion.releaseId === 'M2-RC1'
    && promotion.version === '0.12.0'
    && promotion.phase === 'PRODUCTION_PROMOTION',
  'M2 production promotion identity is invalid');
  assert(sha256(canonicalize(candidate)) === CANDIDATE_DIGEST,
    'Original M2 candidate was modified');
  assert(sha256(canonicalize(postMerge)) === POST_MERGE_DIGEST,
    'Original M2 post-merge acceptance was modified');
  assert(promotion.sourceEvidence?.candidate?.path === 'releases/m2/planning-release-candidate.json'
    && promotion.sourceEvidence?.candidate?.digest === CANDIDATE_DIGEST
    && promotion.sourceEvidence?.postMergeAcceptance?.path === 'releases/m2/post-merge-acceptance.json'
    && promotion.sourceEvidence?.postMergeAcceptance?.digest === POST_MERGE_DIGEST,
  'M2 production promotion historical references are invalid');
  assert(promotion.promotionSource?.branch === 'main'
    && promotion.promotionSource?.mainSha === SOURCE_SHA,
  'M2 promotion source is invalid');
  assert(promotion.mainBranchFinalCi?.status === 'PASSED'
    && promotion.mainBranchFinalCi?.event === 'push'
    && promotion.mainBranchFinalCi?.sourceSha === SOURCE_SHA
    && promotion.mainBranchFinalCi?.runId === MAIN_CI_RUN_ID,
  'M2 final main CI evidence is invalid');
  assertCanonicalEqual(promotion.mainBranchFinalCi.artifacts, MAIN_CI_ARTIFACTS,
    'M2 final main CI Artifact digests changed');

  const image = promotion.imageRelease;
  assert(image?.status === 'PUBLISHED'
    && image.repository === IMAGE_REPOSITORY
    && image.immutableReference === IMMUTABLE_REFERENCE
    && image.registryDigest === REGISTRY_DIGEST
    && image.sourceSha === SOURCE_SHA
    && image.buildRunId === RELEASE_RUN_ID,
  'M2 published image binding is invalid');
  assert(image.sbom?.status === 'GENERATED'
    && image.sbom?.format === releaseEvidence.sbom.format
    && image.sbom?.digest === releaseEvidence.sbom.digest,
  'M2 SBOM binding is invalid');
  validatePromotionAttestation(image.provenanceAttestation, releaseEvidence.attestations.provenance,
    'provenance');
  validatePromotionAttestation(image.sbomAttestation, releaseEvidence.attestations.sbom, 'SBOM');
  assert(image.pullVerification?.status === 'PASSED'
    && image.pullVerification?.verifiedReference === IMMUTABLE_REFERENCE
    && image.pullVerification?.resolvedDigest === REGISTRY_DIGEST
    && image.pullVerification?.verifiedAt === releaseEvidence.image.pullVerification.verifiedAt,
  'M2 pull verification binding is invalid');

  assertCanonicalEqual(promotion.secrets, {
    status: 'NOT_CONFIGURED', provider: null, references: [], configuredAt: null,
  }, 'R1-B must not configure production Secrets');
  assertCanonicalEqual(promotion.targetClusterValidation, {
    status: 'NOT_RUN', clusterRef: null, validationRunId: null, sourceSha: null,
    imageDigest: null, deploymentManifestDigest: null, validatedAt: null,
  }, 'R1-B must not claim target cluster validation');
  assertCanonicalEqual(promotion.approvals, {
    change: { status: 'MISSING', system: null, approvalId: null, approvedAt: null },
    releaseOwner: { status: 'MISSING', system: null, approvalId: null, approvedAt: null },
  }, 'R1-B must not claim production approvals');
  assert(promotion.decision?.productionEligible === false,
    'R1-B cannot make the release production eligible');
  assertSet(promotion.decision?.resolvedBlockers, RESOLVED_BLOCKERS,
    'M2 resolved blockers');
  assertSet(promotion.decision?.openBlockers, REMAINING_BLOCKERS,
    'M2 open blockers');
}

function validateDeployment(deployment) {
  assert(deployment?.apiVersion === 'apps/v1' && deployment?.kind === 'Deployment',
    'R1-B Deployment identity is invalid');
  const containers = deployment?.spec?.template?.spec?.containers;
  assert(Array.isArray(containers) && containers.length === 1,
    'R1-B Deployment must contain exactly one container');
  assert(containers[0].image === IMMUTABLE_REFERENCE,
    'R1-B Deployment image does not match the published immutable image');
  assert(containers[0].imagePullPolicy === 'IfNotPresent',
    'R1-B immutable image must use IfNotPresent');
  assert(artifactDigest(deployment) === DEPLOYMENT_DIGEST,
    'R1-B Deployment manifest digest changed');
}

function validateCrossReferences(binding, releaseEvidence, promotion, deployment) {
  assert(binding.release.evidence.digest === artifactDigest(releaseEvidence),
    'R1-B binding does not match repository release evidence');
  assert(binding.deployment.manifestDigest === artifactDigest(deployment),
    'R1-B binding does not match Deployment manifest');
  assert(binding.deployment.image === releaseEvidence.image.immutableReference
    && binding.deployment.image === promotion.imageRelease.immutableReference,
  'R1-B immutable image references are inconsistent');
  assert(binding.source.sha === promotion.promotionSource.mainSha
    && binding.source.sha === releaseEvidence.source.sha,
  'R1-B source SHAs are inconsistent');
  assert(binding.release.runId === promotion.imageRelease.buildRunId
    && binding.release.runId === releaseEvidence.build.runId,
  'R1-B release run IDs are inconsistent');
}

function validateAttestation(attestation, expectedId, expectedBundleDigest, label) {
  assertObject(attestation, `${label} attestation`);
  assert(attestation.attestationId === expectedId,
    `${label} attestation ID is invalid`);
  assert(attestation.url === `https://github.com/akaryc1b/knowledge-driven-test-platform/attestations/${expectedId}`,
    `${label} attestation URL is invalid`);
  assert(attestation.bundleDigest === expectedBundleDigest,
    `${label} attestation bundle digest is invalid`);
}

function validatePromotionAttestation(actual, expected, label) {
  assert(actual?.status === 'VERIFIED'
    && actual.attestationId === expected.attestationId
    && actual.url === expected.url
    && actual.bundleDigest === expected.bundleDigest,
  `M2 ${label} attestation binding is invalid`);
}

function artifactDigest(value) {
  return `sha256:${sha256(canonicalize(value))}`;
}

function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)),
    'R1-B timestamp is invalid');
  return new Date(value).toISOString();
}

function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /"(?:token|password|privateKey|databaseUrl|connectionString|kubeconfig|clientSecret|secretValue)"\s*:/i,
    /:\/\/[^"@:\s]+:[^"@\s]+@/,
    /"clusters"\s*:\s*\[/,
  ]) assert(!pattern.test(text), 'R1-B evidence contains sensitive material');
}

function assertCanonicalEqual(actual, expected, message) {
  assert(canonicalStringify(actual) === canonicalStringify(expected), message);
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

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value),
    `${label} must be an object`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2R1BImageBinding(), null, 2)}\n`);
}
