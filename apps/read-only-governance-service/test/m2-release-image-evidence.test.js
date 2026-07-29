import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { generateM2ReleaseImageEvidence } from '../../../scripts/generate-m2-release-image-evidence.js';

const SOURCE_SHA = '37f74c9f08199cc074206f79e9214cacd25aa9e9';
const IMAGE_REPOSITORY = 'ghcr.io/akaryc1b/knowledge-driven-test-platform/read-only-governance-service';

function digest(label) {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

function releaseEnvironment() {
  const imageDigest = digest('published-image');
  return {
    KDTP_RELEASE_ID: 'M2-RC1',
    KDTP_RELEASE_VERSION: '0.12.0',
    KDTP_RELEASE_SOURCE_SHA: SOURCE_SHA,
    KDTP_RELEASE_BUILD_RUN_ID: '30371000001',
    KDTP_RELEASE_IMAGE_REPOSITORY: IMAGE_REPOSITORY,
    KDTP_RELEASE_IMAGE_DIGEST: imageDigest,
    KDTP_RELEASE_IMAGE_REFERENCE: `${IMAGE_REPOSITORY}@${imageDigest}`,
    KDTP_RELEASE_SBOM_DIGEST: digest('spdx-sbom'),
    KDTP_RELEASE_PROVENANCE_ATTESTATION_ID: 'attestation-provenance-71001',
    KDTP_RELEASE_PROVENANCE_ATTESTATION_URL: 'https://github.com/akaryc1b/knowledge-driven-test-platform/attestations/71001',
    KDTP_RELEASE_PROVENANCE_BUNDLE_DIGEST: digest('provenance-bundle'),
    KDTP_RELEASE_SBOM_ATTESTATION_ID: 'attestation-sbom-71002',
    KDTP_RELEASE_SBOM_ATTESTATION_URL: 'https://github.com/akaryc1b/knowledge-driven-test-platform/attestations/71002',
    KDTP_RELEASE_SBOM_BUNDLE_DIGEST: digest('sbom-bundle'),
    KDTP_RELEASE_PULL_VERIFIED_AT: '2026-07-28T15:10:00.000Z',
    KDTP_RELEASE_GENERATED_AT: '2026-07-28T15:12:00.000Z',
  };
}

test('M2 release image evidence binds a real Registry digest, source SHA, SBOM and attestations', async () => {
  const evidence = await generateM2ReleaseImageEvidence({ env: releaseEnvironment() });
  assert.equal(evidence.schemaVersion, 'm2-release-image-evidence/v1');
  assert.equal(evidence.source.sha, SOURCE_SHA);
  assert.equal(evidence.image.immutableReference, `${IMAGE_REPOSITORY}@${evidence.image.registryDigest}`);
  assert.deepEqual(evidence.image.tags, ['0.12.0', 'm2-rc1', `sha-${SOURCE_SHA.slice(0, 12)}`]);
  assert.equal(evidence.image.pullVerification.status, 'PASSED');
  assert.equal(evidence.sbom.format, 'spdx-json');
  assert.equal(evidence.decision.externalRegistryDigestAvailable, true);
  assert.equal(evidence.decision.eligibleForDigestBinding, true);
});

test('M2 release image evidence accepts a valid later main SHA and defers promotion binding to R1-B', async () => {
  const environment = releaseEnvironment();
  const laterMainSha = createHash('sha1').update('later-governed-main-source').digest('hex');
  environment.KDTP_RELEASE_SOURCE_SHA = laterMainSha;
  const evidence = await generateM2ReleaseImageEvidence({ env: environment });
  assert.equal(evidence.source.sha, laterMainSha);
  assert.equal(evidence.image.tags.at(-1), `sha-${laterMainSha.slice(0, 12)}`);
});

test('M2 release image evidence rejects mutable references, local image IDs and fake digests', async () => {
  const mutable = releaseEnvironment();
  mutable.KDTP_RELEASE_IMAGE_REFERENCE = `${IMAGE_REPOSITORY}:0.12.0`;
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: mutable }),
    /immutable Registry reference/,
  );

  const local = releaseEnvironment();
  local.KDTP_RELEASE_IMAGE_REFERENCE = `docker-image://${local.KDTP_RELEASE_IMAGE_DIGEST}`;
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: local }),
    /immutable Registry reference/,
  );

  const fakeDigest = releaseEnvironment();
  fakeDigest.KDTP_RELEASE_IMAGE_DIGEST = `sha256:${'a'.repeat(64)}`;
  fakeDigest.KDTP_RELEASE_IMAGE_REFERENCE = `${IMAGE_REPOSITORY}@${fakeDigest.KDTP_RELEASE_IMAGE_DIGEST}`;
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: fakeDigest }),
    /placeholder/,
  );
});

test('M2 release image evidence rejects invalid source SHA, placeholder attestations and sensitive URLs', async () => {
  const invalidSource = releaseEnvironment();
  invalidSource.KDTP_RELEASE_SOURCE_SHA = 'not-a-git-sha';
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: invalidSource }),
    /source SHA is invalid/,
  );

  const placeholderSource = releaseEnvironment();
  placeholderSource.KDTP_RELEASE_SOURCE_SHA = 'a'.repeat(40);
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: placeholderSource }),
    /source SHA cannot be a placeholder/,
  );

  const placeholder = releaseEnvironment();
  placeholder.KDTP_RELEASE_PROVENANCE_ATTESTATION_ID = 'attestation-placeholder';
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: placeholder }),
    /cannot be a placeholder/,
  );

  const credentials = releaseEnvironment();
  credentials.KDTP_RELEASE_SBOM_ATTESTATION_URL = 'https://release:secret@github.com/attestations/71002';
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: credentials }),
    /sensitive material/,
  );
});

test('M2 GHCR workflow is manual, exact-SHA, permission-bounded and evidence-producing', async () => {
  const workflow = await readFile('.github/workflows/m2-release-image.yml', 'utf8');
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /^\s{2}(?:push|pull_request|schedule):/m);
  assert.match(workflow, /source_sha:/);
  assert.match(workflow, /release_id:/);
  assert.match(workflow, /version:/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /packages:\s*write/);
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /attestations:\s*write/);
  assert.match(workflow, /ref:\s*\$\{\{ inputs\.source_sha \}\}/);
  assert.match(workflow, /fetch-depth:\s*0/);
  assert.match(workflow, /merge-base --is-ancestor/);
  assert.match(workflow, /test -f scripts\/validate-m2-production-promotion-entry\.js/);
  assert.match(workflow, /test -f scripts\/generate-m2-release-image-evidence\.js/);
  assert.doesNotMatch(workflow, /PROMOTION_SHA/);
  assert.doesNotMatch(workflow, /test "\$SOURCE_SHA" = "\$PROMOTION_SHA"/);
  assert.match(workflow, /npm run validate:m2-production-promotion/);
  assert.match(workflow, /npm run validate:m2-main-ci-evidence/);
  assert.match(workflow, /postgres:18-alpine/);
  assert.match(workflow, /docker\/login-action@v4/);
  assert.match(workflow, /docker\/setup-buildx-action@v4/);
  assert.match(workflow, /docker\/metadata-action@v6/);
  assert.match(workflow, /docker\/build-push-action@v7/);
  assert.match(workflow, /anchore\/sbom-action@v0/);
  assert.equal((workflow.match(/actions\/attest@v4/g) ?? []).length, 2);
  assert.match(workflow, /push-to-registry:\s*true/);
  assert.match(workflow, /docker pull "\$IMMUTABLE_REFERENCE"/);
  assert.match(workflow, /--read-only/);
  assert.match(workflow, /--cap-drop=ALL/);
  assert.match(workflow, /no-new-privileges/);
  assert.match(workflow, /m2-release-image-evidence/);
  assert.doesNotMatch(workflow, /secrets\.[A-Z0-9_]*(?:TOKEN|PASSWORD|KEY)/);
});
