import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  loadM2ProductionPromotion,
  validateM2ProductionPromotion,
} from '../../../scripts/validate-m2-production-promotion.js';

const CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';
const POST_MERGE_DIGEST = 'd073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25';
const MAIN_SHA = '991b5f0f9cfa3a382f9aff3c600f98b76aed9c08';
const IMAGE_REPOSITORY = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service';
const BLOCKERS = [
  'main-branch-final-ci-not-verified',
  'external-registry-digest-missing',
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
];

function digest(label) {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

async function completedPromotion() {
  const promotion = structuredClone(await loadM2ProductionPromotion());
  const imageDigest = digest('m2-registry-image');
  const immutableReference = `${IMAGE_REPOSITORY}@${imageDigest}`;
  promotion.mainBranchFinalCi = {
    status: 'PASSED',
    event: 'push',
    sourceSha: MAIN_SHA,
    runId: 30360001234,
    artifacts: {
      m1ReleaseEvidence: digest('m1-release-evidence'),
      m2ReleaseEvidence: digest('m2-release-evidence'),
      m2PostMergeEvidence: digest('m2-post-merge-evidence'),
      postgresValidation: digest('postgres-validation'),
      repositoryValidation: digest('repository-validation'),
      deploymentValidation: digest('deployment-validation'),
    },
  };
  promotion.imageRelease = {
    status: 'PUBLISHED',
    repository: IMAGE_REPOSITORY,
    immutableReference,
    registryDigest: imageDigest,
    sourceSha: MAIN_SHA,
    buildRunId: 30360004567,
    sbom: {
      status: 'GENERATED',
      format: 'spdx-json',
      digest: digest('image-sbom'),
    },
    provenanceAttestation: {
      status: 'VERIFIED',
      attestationId: 'attestation-provenance-84291',
      url: 'https://github.com/akaryc1b/knowledge-driven-test-platform/attestations/84291',
      bundleDigest: digest('provenance-bundle'),
    },
    sbomAttestation: {
      status: 'VERIFIED',
      attestationId: 'attestation-sbom-84292',
      url: 'https://github.com/akaryc1b/knowledge-driven-test-platform/attestations/84292',
      bundleDigest: digest('sbom-bundle'),
    },
    pullVerification: {
      status: 'PASSED',
      verifiedReference: immutableReference,
      resolvedDigest: imageDigest,
      verifiedAt: '2026-07-28T13:10:00.000Z',
    },
  };
  promotion.secrets = {
    status: 'CONFIGURED',
    provider: 'gcp-secret-manager',
    references: [
      {
        name: 'database-connection',
        reference: 'projects/kdtp-production/secrets/database-connection/versions/42',
      },
      {
        name: 'oidc-subject-mapping',
        reference: 'projects/kdtp-production/secrets/oidc-subject-mapping/versions/17',
      },
    ],
    configuredAt: '2026-07-28T13:15:00.000Z',
  };
  promotion.targetClusterValidation = {
    status: 'PASSED',
    clusterRef: 'cluster:kdtp-production-us-east-1',
    validationRunId: 'cluster-validation-20260728-0017',
    sourceSha: MAIN_SHA,
    imageDigest,
    deploymentManifestDigest: digest('production-deployment-manifest'),
    validatedAt: '2026-07-28T13:20:00.000Z',
  };
  promotion.approvals = {
    change: {
      status: 'APPROVED',
      system: 'change-management',
      approvalId: 'CHG-2026-000842',
      approvedAt: '2026-07-28T13:25:00.000Z',
    },
    releaseOwner: {
      status: 'APPROVED',
      system: 'release-governance',
      approvalId: 'REL-2026-000119',
      approvedAt: '2026-07-28T13:30:00.000Z',
    },
  };
  promotion.decision = {
    productionEligible: true,
    resolvedBlockers: [...BLOCKERS],
    openBlockers: [],
  };
  return promotion;
}

test('M2 production promotion preserves immutable historical evidence and safe blockers', async () => {
  const evidence = await validateM2ProductionPromotion({
    generatedAt: '2026-07-28T12:30:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-production-promotion-contract',
  });
  assert.equal(evidence.schemaVersion, 'm2-production-promotion-evidence/v1');
  assert.equal(evidence.digests.candidate, CANDIDATE_DIGEST);
  assert.equal(evidence.digests.postMergeAcceptance, POST_MERGE_DIGEST);
  assert.equal(evidence.promotionSource.mainSha, MAIN_SHA);
  assert.deepEqual(evidence.decision.resolvedBlockers, []);
  assert.deepEqual(evidence.decision.openBlockers, BLOCKERS);
  assert.equal(evidence.decision.productionEligible, false);
});

test('M2 production promotion independently recomputes candidate and post-merge digests', async () => {
  const candidate = JSON.parse(await readFile('releases/m2/planning-release-candidate.json', 'utf8'));
  const postMerge = JSON.parse(await readFile('releases/m2/post-merge-acceptance.json', 'utf8'));
  assert.equal(sha256(canonicalize(candidate)), CANDIDATE_DIGEST);
  assert.equal(sha256(canonicalize(postMerge)), POST_MERGE_DIGEST);

  const changedCandidate = structuredClone(candidate);
  changedCandidate.version = '0.12.1';
  await assert.rejects(
    validateM2ProductionPromotion({ candidate: changedCandidate }),
    /candidate was modified/,
  );

  const changedPostMerge = structuredClone(postMerge);
  changedPostMerge.decision.productionEligible = true;
  await assert.rejects(
    validateM2ProductionPromotion({ postMergeAcceptance: changedPostMerge }),
    /post-merge acceptance was modified/,
  );
});

test('M2 production promotion rejects fabricated CI, mutable images and local image IDs', async () => {
  const promotion = await loadM2ProductionPromotion();

  const fabricatedCi = structuredClone(promotion);
  fabricatedCi.mainBranchFinalCi.status = 'PASSED';
  fabricatedCi.mainBranchFinalCi.runId = 30360009999;
  for (const key of Object.keys(fabricatedCi.mainBranchFinalCi.artifacts)) {
    fabricatedCi.mainBranchFinalCi.artifacts[key] = `sha256:${'a'.repeat(64)}`;
  }
  fabricatedCi.decision.resolvedBlockers = [BLOCKERS[0]];
  fabricatedCi.decision.openBlockers = BLOCKERS.slice(1);
  await assert.rejects(
    validateM2ProductionPromotion({ promotion: fabricatedCi }),
    /placeholder digest/,
  );

  const mutableImage = structuredClone(await completedPromotion());
  mutableImage.imageRelease.immutableReference = `${IMAGE_REPOSITORY}:0.12.0`;
  await assert.rejects(
    validateM2ProductionPromotion({ promotion: mutableImage }),
    /immutable Registry reference|mutable image tag/,
  );

  const localImageId = structuredClone(await completedPromotion());
  localImageId.imageRelease.immutableReference = `docker-image://${localImageId.imageRelease.registryDigest}`;
  await assert.rejects(
    validateM2ProductionPromotion({ promotion: localImageId }),
    /immutable Registry reference/,
  );
});

test('M2 production promotion rejects placeholder approvals and sensitive material', async () => {
  const placeholderApproval = await completedPromotion();
  placeholderApproval.approvals.change.approvalId = 'CHG-PLACEHOLDER';
  await assert.rejects(
    validateM2ProductionPromotion({ promotion: placeholderApproval }),
    /cannot be a placeholder/,
  );

  const secret = await loadM2ProductionPromotion();
  secret.secrets = {
    status: 'CONFIGURED',
    provider: 'gcp-secret-manager',
    references: [{
      name: 'database-connection',
      reference: 'postgresql://release:secret@database.internal/kdtp',
    }],
    configuredAt: '2026-07-28T13:15:00.000Z',
  };
  await assert.rejects(
    validateM2ProductionPromotion({ promotion: secret }),
    /versioned provider reference|sensitive material/,
  );
});

test('M2 production promotion permits eligibility only after every evidence domain is complete', async () => {
  const promotion = await completedPromotion();
  const evidence = await validateM2ProductionPromotion({
    promotion,
    generatedAt: '2026-07-28T13:35:00.000Z',
    commitSha: MAIN_SHA,
    branch: 'agent/m2-rc1-production-promotion-contract',
  });
  assert.equal(evidence.decision.productionEligible, true);
  assert.deepEqual(evidence.decision.resolvedBlockers, BLOCKERS);
  assert.deepEqual(evidence.decision.openBlockers, []);

  const premature = structuredClone(promotion);
  premature.targetClusterValidation.status = 'NOT_RUN';
  for (const key of [
    'clusterRef',
    'validationRunId',
    'sourceSha',
    'imageDigest',
    'deploymentManifestDigest',
    'validatedAt',
  ]) premature.targetClusterValidation[key] = null;
  premature.decision.productionEligible = true;
  premature.decision.resolvedBlockers = BLOCKERS.filter((blocker) => blocker !== 'target-cluster-validation-not-run');
  premature.decision.openBlockers = ['target-cluster-validation-not-run'];
  await assert.rejects(
    validateM2ProductionPromotion({ promotion: premature }),
    /Open blockers require productionEligible=false/,
  );
});
