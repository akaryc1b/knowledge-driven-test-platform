import test from 'node:test';
import assert from 'node:assert/strict';
import {
  lstat, mkdir, mkdtemp, readFile, rm, symlink, writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  publishK6ApiSourceBundle,
  verifyPublishedK6ApiSourceBundle,
} from '../src/source-bundle-publisher.js';
import {
  materializeK6ApiSourcePublicationBundle,
} from '../src/source-publication-bundle.js';
import {
  clone, loadAcceptedP5Fixture, verifySafety,
} from './p5-test-helpers.js';

function anchor(fixture) {
  const p3 = fixture.evidence.acceptedP3;
  return { evidenceDigest: p3.evidenceDigest, sourceArtifactDigest: p3.sourceArtifactDigest,
    validationEvidenceDigest: p3.validationEvidenceDigest, sourceDigest: p3.sourceDigest };
}
async function temporaryRoot(t) {
  const root = await mkdtemp(join(tmpdir(), 'kdtp-p5-'));
  t.after(() => rm(root, { recursive: true, force: true })); return root;
}
async function exists(path) { try { await lstat(path); return true; } catch (e) {
  if (e?.code === 'ENOENT') return false; throw e;
} }

test('P5 preserves exact accepted Source, Manifest, Bundle and schema identities', async () => {
  const fixture = await loadAcceptedP5Fixture();
  assert.deepEqual(fixture.identity, {
    sourceDigest: 'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9',
    sourceIdentity: 'd2d75729802aa6a21d3f2deec9ba85bf31e35358e94b643004326067a0450f73',
    sourceArtifactDigest: '56d121390b08aee343c3ad49fd63d5d36c9d067a56ccbebba66fa65115588d13',
    validationEvidenceDigest: 'a7324d928ca56c48428d67cb8329adc532c65f461f98dbbc61969341030f70bd',
    p3EvidenceDigest: 'b013a5a14ad88a4b3fa97f1574dfe3006d0047776b95b7770a8c88a1aeb7e490',
    manifestDigest: 'fce734d0244118919e1927b17041200228b0010aa667b4d041c9bc4979860c36',
    bundleDigest: 'be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f',
  });
  assert.equal(fixture.receipt.publication.bundle.schemaVersion,
    'k6-api-source-publication-bundle/v1');
  assert.equal(fixture.evidence.schemaVersion, 'm3-r2-source-generation-p4-evidence/v1');
});

test('P5 preserves the local-only publication and non-execution boundary', async () => {
  const fixture = await loadAcceptedP5Fixture();
  verifySafety(fixture.evidence.decision, fixture.evidence.safetyBoundary, 'M3-R2-P5');
  assert.equal(fixture.evidence.safetyBoundary.artifactPublished, true);
  assert.equal(fixture.evidence.safetyBoundary.remoteArtifactPublished, false);
});

test('P5 independently replays first publication and idempotent repeat publication', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const root = await temporaryRoot(t);
  const options = { rootDirectory: root, publishedAt: '2026-08-01T09:00:00.000Z',
    acceptedP3: anchor(fixture) };
  const first = await publishK6ApiSourceBundle(fixture.receipt.publication.bundle, options);
  const second = await publishK6ApiSourceBundle(fixture.receipt.publication.bundle, options);
  assert.equal(first.receiptDigest, fixture.receipt.publication.receipt.receiptDigest);
  assert.deepEqual(second, first);
});

test('P5 concurrent publication leaves exactly one consistent content-addressed Store', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const root = await temporaryRoot(t);
  const options = { rootDirectory: root, publishedAt: '2026-08-01T09:00:00.000Z',
    acceptedP3: anchor(fixture) };
  const results = await Promise.allSettled([
    publishK6ApiSourceBundle(fixture.receipt.publication.bundle, options),
    publishK6ApiSourceBundle(fixture.receipt.publication.bundle, options),
  ]);
  assert.ok(results.some((result) => result.status === 'fulfilled'));
  for (const failure of results.filter((result) => result.status === 'rejected')) {
    assert.ok(['K6_API_SOURCE_PUBLICATION_BUSY', 'EEXIST'].includes(failure.reason?.code));
  }
  const verified = await verifyPublishedK6ApiSourceBundle(
    fixture.receipt.publication.bundle, { rootDirectory: root, acceptedP3: anchor(fixture) });
  assert.equal(verified.receiptDigest, fixture.receipt.publication.receipt.receiptDigest);
});

test('P5 fails closed for existing Store drift and extra files', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const root = await temporaryRoot(t);
  const options = { rootDirectory: root, publishedAt: '2026-08-01T09:00:00.000Z',
    acceptedP3: anchor(fixture) };
  await publishK6ApiSourceBundle(fixture.receipt.publication.bundle, options);
  const target = join(root, fixture.identity.bundleDigest);
  await writeFile(join(target, 'source/main.js'), '// drift\n', 'utf8');
  await assert.rejects(() => verifyPublishedK6ApiSourceBundle(
    fixture.receipt.publication.bundle, { rootDirectory: root, acceptedP3: anchor(fixture) }),
  /content changed/u);
  await writeFile(join(target, 'source/main.js'), fixture.receipt.publication.bundle.files.find(
    (file) => file.path === 'source/main.js').content, 'utf8');
  await writeFile(join(target, 'extra.txt'), 'extra', 'utf8');
  await assert.rejects(() => verifyPublishedK6ApiSourceBundle(
    fixture.receipt.publication.bundle, { rootDirectory: root, acceptedP3: anchor(fixture) }),
  /missing, extra or unsafe/u);
});

test('P5 rejects staging conflicts without creating an accepted target or Receipt', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const root = await temporaryRoot(t);
  const staging = join(root, `.staging-${fixture.identity.bundleDigest}`);
  await mkdir(staging); await writeFile(join(staging, 'partial'), 'partial');
  await assert.rejects(() => publishK6ApiSourceBundle(fixture.receipt.publication.bundle, {
    rootDirectory: root, publishedAt: '2026-08-01T09:00:00.000Z',
    acceptedP3: anchor(fixture),
  }), (error) => error?.code === 'K6_API_SOURCE_PUBLICATION_BUSY');
  assert.equal(await exists(join(root, fixture.identity.bundleDigest)), false);
  assert.equal(await exists(join(staging, 'receipt.json')), false);
});

test('P5 rejects incomplete targets and never treats a missing Receipt as published', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const root = await temporaryRoot(t);
  const target = join(root, fixture.identity.bundleDigest); await mkdir(target);
  for (const file of materializeK6ApiSourcePublicationBundle(fixture.receipt.publication.bundle)) {
    const path = join(target, file.path); await mkdir(join(path, '..'), { recursive: true });
    await writeFile(path, file.content, 'utf8');
  }
  await assert.rejects(() => verifyPublishedK6ApiSourceBundle(
    fixture.receipt.publication.bundle, { rootDirectory: root, acceptedP3: anchor(fixture) }),
  /missing, extra or unsafe/u);
  assert.equal(await exists(join(target, 'receipt.json')), false);
});

test('P5 rejects Store symlinks and different Bundle identity substitution', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const root = await temporaryRoot(t);
  const target = join(root, fixture.identity.bundleDigest); await mkdir(target);
  await symlink('/dev/null', join(target, 'bundle.json'));
  await assert.rejects(() => verifyPublishedK6ApiSourceBundle(
    fixture.receipt.publication.bundle, { rootDirectory: root, acceptedP3: anchor(fixture) }),
  /unsafe|content changed|ENOENT/u);
  const other = clone(fixture.receipt.publication.bundle); other.bundleDigest = 'f'.repeat(64);
  await assert.rejects(() => publishK6ApiSourceBundle(other, {
    rootDirectory: root, publishedAt: '2026-08-01T09:00:00.000Z',
    acceptedP3: anchor(fixture),
  }), /digest|accepted|match/i);
  assert.equal(await exists(join(root, other.bundleDigest)), false);
});

test('P5 filesystem setup failure leaves no formal Store or Receipt', async (t) => {
  const fixture = await loadAcceptedP5Fixture(); const parent = await temporaryRoot(t);
  const blockedRoot = join(parent, 'not-a-directory');
  await writeFile(blockedRoot, 'blocked', 'utf8');
  await assert.rejects(() => publishK6ApiSourceBundle(fixture.receipt.publication.bundle, {
    rootDirectory: blockedRoot, publishedAt: '2026-08-01T09:00:00.000Z',
    acceptedP3: anchor(fixture),
  }));
  assert.equal(await exists(join(parent, fixture.identity.bundleDigest)), false);
  assert.equal(await readFile(blockedRoot, 'utf8'), 'blocked');
});
