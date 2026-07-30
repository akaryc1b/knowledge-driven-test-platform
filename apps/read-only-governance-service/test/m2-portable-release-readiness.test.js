import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  canonicalDigest,
  loadM2PortableReleaseReadiness,
  validateM2PortableReleaseReadiness,
} from '../../../scripts/validate-m2-portable-release-readiness.js';

const BRANCH = 'agent/m2-rc1-r2-rebaseline-portable-readiness';

async function cloneReadiness() {
  return structuredClone(await loadM2PortableReleaseReadiness());
}

test('portable readiness separates repository release from environment promotion', async () => {
  const evidence = await validateM2PortableReleaseReadiness({
    generatedAt: '2026-07-30T07:00:00.000Z',
    commitSha: 'local',
    branch: BRANCH,
  });
  assert.equal(evidence.schemaVersion, 'm2-portable-release-readiness-evidence/v1');
  assert.equal(evidence.decision.repositoryReleaseReady, true);
  assert.equal(evidence.decision.environmentPromotionEvaluated, false);
  assert.equal(evidence.decision.environmentPromotionEligible, null);
  assert.deepEqual(evidence.decision.repositoryBlockers, []);
  assert.deepEqual(evidence.runtimeConfiguration.requiredInputNames, [
    'KDTP_DATABASE_URL',
    'KDTP_OIDC_ISSUER',
    'KDTP_OIDC_JWKS_URI',
    'KDTP_OIDC_AUDIENCE',
    'KDTP_OIDC_SUBJECT_MAPPINGS_JSON',
  ]);
  assert.equal(evidence.runtimeConfiguration.providerAgnostic, true);
  assert.equal(evidence.runtimeConfiguration.repositoryStoresSecretValues, false);
  assert.equal(evidence.runtimeConfiguration.repositoryRequiresProviderMetadata, false);
  assert.equal(evidence.safetyBoundary.secretAccessed, false);
  assert.equal(evidence.safetyBoundary.targetClusterAccessed, false);
});

test('portable readiness rejects an environment eligibility claim', async () => {
  const readiness = await cloneReadiness();
  readiness.decision.environmentPromotionEvaluated = true;
  readiness.decision.environmentPromotionEligible = true;
  await assert.rejects(
    validateM2PortableReleaseReadiness({
      readiness,
      generatedAt: '2026-07-30T07:00:00.000Z',
      commitSha: 'local',
      branch: BRANCH,
    }),
    /portable readiness decision/,
  );
});

test('portable readiness rejects provider-specific repository requirements', async () => {
  const readiness = await cloneReadiness();
  readiness.runtimeConfiguration.providerAgnostic = false;
  readiness.runtimeConfiguration.repositoryRequiresProviderMetadata = true;
  await assert.rejects(
    validateM2PortableReleaseReadiness({
      readiness,
      generatedAt: '2026-07-30T07:00:00.000Z',
      commitSha: 'local',
      branch: BRANCH,
    }),
    /portable runtime configuration boundary/,
  );
});

test('portable readiness rejects an incomplete runtime input contract', async () => {
  const readiness = await cloneReadiness();
  readiness.runtimeConfiguration.requiredInputs.pop();
  await assert.rejects(
    validateM2PortableReleaseReadiness({
      readiness,
      generatedAt: '2026-07-30T07:00:00.000Z',
      commitSha: 'local',
      branch: BRANCH,
    }),
    /runtime required inputs/,
  );
});

test('portable readiness rejects mutation of historical Promotion evidence', async () => {
  const readiness = await cloneReadiness();
  readiness.historicalEvidence.productionPromotion.canonicalDigest =
    `sha256:${'a'.repeat(64)}`;
  await assert.rejects(
    validateM2PortableReleaseReadiness({
      readiness,
      generatedAt: '2026-07-30T07:00:00.000Z',
      commitSha: 'local',
      branch: BRANCH,
    }),
    /historical evidence/,
  );
});

test('portable readiness rejects provider-specific Deployment coupling', async () => {
  const deployment = JSON.parse(await readFile(
    'deploy/kubernetes/read-only-governance-service/deployment.yaml',
    'utf8',
  ));
  deployment.spec.template.metadata.annotations = {
    'secrets-store.csi.k8s.io/used': 'true',
  };
  await assert.rejects(
    validateM2PortableReleaseReadiness({
      deployment,
      generatedAt: '2026-07-30T07:00:00.000Z',
      commitSha: 'local',
      branch: BRANCH,
    }),
    /provider-specific integration|historical Deployment manifest digest changed/,
  );
});

test('portable readiness rejects explicit blank evidence branch', async () => {
  await assert.rejects(
    validateM2PortableReleaseReadiness({
      generatedAt: '2026-07-30T07:00:00.000Z',
      commitSha: 'local',
      branch: '   ',
    }),
    /evidence branch is invalid/,
  );
});

test('portable readiness canonical digest is stable across object key ordering', () => {
  assert.equal(
    canonicalDigest({ beta: 2, alpha: 1 }),
    canonicalDigest({ alpha: 1, beta: 2 }),
  );
});

test('portable readiness schemas are strict Draft 2020-12 contracts', async () => {
  for (const path of [
    'schemas/release/v3/m2-portable-release-readiness.schema.json',
    'schemas/release/v3/m2-portable-release-readiness-evidence.schema.json',
  ]) {
    const schema = JSON.parse(await readFile(path, 'utf8'));
    assert.equal(schema.$schema, 'https://json-schema.org/draft/2020-12/schema');
    assert.equal(schema.additionalProperties, false);
  }
});
