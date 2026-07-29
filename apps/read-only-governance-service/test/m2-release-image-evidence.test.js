import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile as execFileCallback } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { promisify } from 'node:util';
import { generateM2ReleaseImageEvidence } from '../../../scripts/generate-m2-release-image-evidence.js';

const execFile = promisify(execFileCallback);
const SOURCE_SHA = createHash('sha1').update('r1-a-governed-main-source').digest('hex');
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
    KDTP_RELEASE_BUILD_RUN_ID: '30430000001',
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
    KDTP_RELEASE_PULL_VERIFIED_AT: '2026-07-29T05:30:00.000Z',
    KDTP_RELEASE_GENERATED_AT: '2026-07-29T05:32:00.000Z',
  };
}

test('M2 release image evidence binds Registry digest, source SHA, SBOM and attestations', async () => {
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

test('M2 release image evidence rejects invalid sources, placeholder attestations and sensitive URLs', async () => {
  const invalidSource = releaseEnvironment();
  invalidSource.KDTP_RELEASE_SOURCE_SHA = 'not-a-git-sha';
  await assert.rejects(
    generateM2ReleaseImageEvidence({ env: invalidSource }),
    /source SHA is invalid/,
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

test('manual release metadata executes every governed release evidence example', async () => {
  const env = {
    ...process.env,
    KDTP_RELEASE_SOURCE_SHA: SOURCE_SHA,
    KDTP_RELEASE_SOURCE_BRANCH: 'main',
    KDTP_RELEASE_GENERATED_AT: '2026-07-29T05:32:00.000Z',
  };
  for (const script of [
    'examples/read-only-release-candidate.js',
    'examples/m2-release-candidate.js',
    'examples/m2-post-merge-acceptance.js',
    'examples/m2-production-promotion.js',
  ]) {
    const { stdout, stderr } = await execFile(process.execPath, [script], {
      cwd: process.cwd(),
      env,
      maxBuffer: 1024 * 1024,
    });
    assert.equal(stderr, '');
    const evidence = JSON.parse(stdout);
    assert.equal(evidence.source.branch, 'main');
    assert.equal(evidence.source.commitSha, SOURCE_SHA);
  }
});

test('M2 GHCR workflow is manual, exact-SHA, closure-gated and evidence-producing', async () => {
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
  assert.match(workflow, /releases\/m2\/r0-main-ci-closure\.json/);
  assert.match(workflow, /npm run validate:m2-production-promotion/);
  assert.match(workflow, /npm run validate:m2-r0-main-ci-closure/);
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

  const exampleStepStart = workflow.indexOf('- name: Run non-PostgreSQL examples');
  const exampleStepEnd = workflow.indexOf('- name: Install PostgreSQL driver for integration validation');
  assert(exampleStepStart >= 0 && exampleStepEnd > exampleStepStart);
  const exampleStep = workflow.slice(exampleStepStart, exampleStepEnd);
  assert.match(exampleStep, /KDTP_RELEASE_SOURCE_SHA:\s*\$\{\{ inputs\.source_sha \}\}/);
  assert.match(exampleStep, /KDTP_RELEASE_SOURCE_BRANCH:\s*main/);
  assert.match(exampleStep, /export KDTP_RELEASE_GENERATED_AT=/);

  assert.doesNotMatch(workflow, /secrets\.[A-Z0-9_]*(?:TOKEN|PASSWORD|KEY)/);
});
