import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  loadM2ProductionPromotion,
  validateM2ProductionPromotion,
} from '../../../scripts/validate-m2-production-promotion-r1b.js';

const CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';
const POST_MERGE_DIGEST = 'd073efec5aa587caf7f54eedd219a494b876d2913cb8e110981c374e79501e25';
const SOURCE_SHA = '6bef789da58bbb7f2edd2a2024ba9a0bbf8e22a7';
const REGISTRY_DIGEST = 'sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13';
const IMAGE_REPOSITORY = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service';
const IMMUTABLE_REFERENCE = `${IMAGE_REPOSITORY}@${REGISTRY_DIGEST}`;
const RESOLVED_BLOCKERS = [
  'main-branch-final-ci-not-verified',
  'external-registry-digest-missing',
];
const OPEN_BLOCKERS = [
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
];

async function validationOptions(overrides = {}) {
  return {
    generatedAt: '2026-07-29T10:15:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-r1b-immutable-image-binding',
    ...overrides,
  };
}

test('M2 production promotion binds the real immutable image and closes only R1-B', async () => {
  const evidence = await validateM2ProductionPromotion(await validationOptions());
  assert.equal(evidence.schemaVersion, 'm2-production-promotion-evidence/v1');
  assert.equal(evidence.digests.candidate, CANDIDATE_DIGEST);
  assert.equal(evidence.digests.postMergeAcceptance, POST_MERGE_DIGEST);
  assert.equal(evidence.promotionSource.mainSha, SOURCE_SHA);
  assert.equal(evidence.mainBranchFinalCi.runId, 30440545497);
  assert.equal(evidence.imageRelease.status, 'PUBLISHED');
  assert.equal(evidence.imageRelease.immutableReference, IMMUTABLE_REFERENCE);
  assert.equal(evidence.imageRelease.registryDigest, REGISTRY_DIGEST);
  assert.equal(evidence.imageRelease.buildRunId, 30440674461);
  assert.equal(evidence.imageRelease.pullVerification.status, 'PASSED');
  assert.deepEqual(evidence.decision.resolvedBlockers, RESOLVED_BLOCKERS);
  assert.deepEqual(evidence.decision.openBlockers, OPEN_BLOCKERS);
  assert.equal(evidence.decision.productionEligible, false);
});

test('M2 production promotion preserves the original candidate and post-merge records', async () => {
  const candidate = JSON.parse(await readFile('releases/m2/planning-release-candidate.json', 'utf8'));
  const postMerge = JSON.parse(await readFile('releases/m2/post-merge-acceptance.json', 'utf8'));
  assert.equal(sha256(canonicalize(candidate)), CANDIDATE_DIGEST);
  assert.equal(sha256(canonicalize(postMerge)), POST_MERGE_DIGEST);

  const changedCandidate = structuredClone(candidate);
  changedCandidate.version = '0.12.1';
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ candidate: changedCandidate })),
    /candidate was modified/,
  );

  const changedPostMerge = structuredClone(postMerge);
  changedPostMerge.decision.productionEligible = true;
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ postMergeAcceptance: changedPostMerge })),
    /post-merge acceptance was modified/,
  );
});

test('M2 production promotion rejects mutable images and fabricated release evidence', async () => {
  const mutable = structuredClone(await loadM2ProductionPromotion());
  mutable.imageRelease.immutableReference = `${IMAGE_REPOSITORY}:0.12.0`;
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ promotion: mutable })),
    /published image binding|immutable image references/,
  );

  const fabricatedRun = structuredClone(await loadM2ProductionPromotion());
  fabricatedRun.imageRelease.buildRunId = 30449999999;
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ promotion: fabricatedRun })),
    /published image binding|release run IDs/,
  );

  const fabricatedCi = structuredClone(await loadM2ProductionPromotion());
  fabricatedCi.mainBranchFinalCi.artifacts.repositoryValidation = `sha256:${'a'.repeat(64)}`;
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ promotion: fabricatedCi })),
    /Artifact digests changed/,
  );
});

test('M2 production promotion keeps Secrets, cluster and approvals unresolved', async () => {
  const premature = structuredClone(await loadM2ProductionPromotion());
  premature.decision.productionEligible = true;
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ promotion: premature })),
    /cannot make the release production eligible/,
  );

  const fakeSecret = structuredClone(await loadM2ProductionPromotion());
  fakeSecret.secrets = {
    status: 'CONFIGURED',
    provider: 'gcp-secret-manager',
    references: [{
      name: 'database-connection',
      reference: 'projects/kdtp/secrets/database/versions/42',
    }],
    configuredAt: '2026-07-29T10:20:00.000Z',
  };
  await assert.rejects(
    validateM2ProductionPromotion(await validationOptions({ promotion: fakeSecret })),
    /must not configure production Secrets/,
  );
});
