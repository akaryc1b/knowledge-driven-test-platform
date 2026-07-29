import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadM2R1BImageBinding,
  validateM2R1BImageBinding,
} from '../../../scripts/validate-m2-r1b-image-binding.js';

const IMMUTABLE_REFERENCE = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service@sha256:9ea3d4ac1ece9aa3d47c658a0781e15ce9eafdfc56a20eb041251298b465ab13';

async function json(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function options(overrides = {}) {
  return {
    generatedAt: '2026-07-29T10:15:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-r1b-immutable-image-binding',
    ...overrides,
  };
}

test('R1-B binds main CI, release Artifact, immutable image and Deployment', async () => {
  const evidence = await validateM2R1BImageBinding(options());
  assert.equal(evidence.schemaVersion, 'm2-r1b-image-binding-evidence/v1');
  assert.deepEqual(evidence.digests, {
    binding: 'sha256:adb6374bee157b7b64d25b6fdfe1b35ea2d4e5e92a08b029c0fbc5e66c33c0a7',
    releaseImageEvidence: 'sha256:dcc912aada0bb5f4337cec0682ee081ac40fe4e1bf2cb6ad6203df3b3c45492a',
    productionPromotion: 'sha256:4125d5f08ec559e2bc6012ab501879432493af012b4d70665eb1d653c4190f5d',
    deploymentManifest: 'sha256:fb2cb10f42f8d3473c1997c514ec11eb66bfb06f7542c3404c328c39f8763a45',
  });
  assert.equal(evidence.release.runId, 30440674461);
  assert.equal(evidence.release.artifactId, 8719335176);
  assert.equal(evidence.image.immutableReference, IMMUTABLE_REFERENCE);
  assert.equal(evidence.deployment.image, IMMUTABLE_REFERENCE);
  assert.equal(evidence.decision.eligibleForProductionEvidenceBinding, true);
  assert.equal(evidence.decision.productionEligible, false);
  assert.equal(evidence.decision.remainingBlockers.length, 4);
});

test('R1-B rejects fabricated release Artifact and Registry evidence', async () => {
  const binding = structuredClone(await loadM2R1BImageBinding());
  binding.release.evidenceArtifact.digest = `sha256:${'a'.repeat(64)}`;
  await assert.rejects(
    validateM2R1BImageBinding(options({ binding })),
    /release Artifact evidence is invalid/,
  );

  const releaseEvidence = await json('releases/m2/release-image-evidence.json');
  releaseEvidence.image.registryDigest = `sha256:${'b'.repeat(64)}`;
  await assert.rejects(
    validateM2R1BImageBinding(options({ releaseEvidence })),
    /Registry image evidence is invalid|release evidence digest changed/,
  );
});

test('R1-B rejects mutable or mismatched Deployment images', async () => {
  const deployment = await json('deploy/kubernetes/read-only-governance-service/deployment.yaml');
  deployment.spec.template.spec.containers[0].image = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service:0.12.0';
  await assert.rejects(
    validateM2R1BImageBinding(options({ deployment })),
    /Deployment image does not match|Deployment manifest digest changed/,
  );

  const binding = structuredClone(await loadM2R1BImageBinding());
  binding.deployment.manifestDigest = `sha256:${'c'.repeat(64)}`;
  await assert.rejects(
    validateM2R1BImageBinding(options({ binding })),
    /deployment binding is invalid/,
  );
});

test('R1-B cannot claim Secrets, cluster validation, approvals or production eligibility', async () => {
  const promotion = await json('releases/m2/production-promotion.json');
  promotion.decision.productionEligible = true;
  await assert.rejects(
    validateM2R1BImageBinding(options({ promotion })),
    /cannot make the release production eligible/,
  );

  const binding = structuredClone(await loadM2R1BImageBinding());
  binding.decision.remainingBlockers = ['target-cluster-validation-not-run'];
  await assert.rejects(
    validateM2R1BImageBinding(options({ binding })),
    /remaining blockers count is invalid/,
  );
});
