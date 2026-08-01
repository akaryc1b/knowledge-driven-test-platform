import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, symlink, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { test } from 'node:test';
import { createK6ApiSourcePublicationBundle } from '../src/source-publication-bundle.js';
import {
  computeK6ApiSourcePublicationEvidenceDigest,
  computeK6ApiSourcePublicationReceiptDigest,
  createK6ApiSourcePublicationEvidence,
  publishK6ApiSourceBundle,
  validateK6ApiSourcePublicationEvidence,
  validateK6ApiSourcePublicationReceipt,
  verifyPublishedK6ApiSourceBundle,
} from '../src/source-bundle-publisher.js';
import { clone, p4AcceptedBindings } from './p4-test-helpers.js';

const PUBLISHED_AT = '2026-08-01T09:00:00.000Z';

async function withStore(callback) {
  const root = await mkdtemp(join(tmpdir(), 'kdtp-p4-store-'));
  try { return await callback(root); } finally { await rm(root, { recursive: true, force: true }); }
}

test('P4 publisher persists the exact content-addressed bundle', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  const receipt = await publishK6ApiSourceBundle(bundle, { rootDirectory: root, publishedAt: PUBLISHED_AT });
  assert.equal(receipt.bundleDigest, bundle.bundleDigest);
  assert.equal(receipt.storage.logicalUri, `kdtp-source-bundle://sha256/${bundle.bundleDigest}`);
  assert.equal(receipt.storage.remote, false);
  assert.equal(receipt.storage.payloadFileCount, 5);
  assert.equal(receipt.storage.storedFileCount, 8);
  assert.equal(computeK6ApiSourcePublicationReceiptDigest(receipt), receipt.receiptDigest);
  assert.equal(validateK6ApiSourcePublicationReceipt(receipt, bundle).receiptDigest,
    receipt.receiptDigest);
  const source = await readFile(join(root, bundle.bundleDigest, 'source/main.js'), 'utf8');
  assert.equal(source, bundle.files.find((file) => file.path === 'source/main.js').content);
}));

test('P4 publication is idempotent and preserves the first receipt', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  const first = await publishK6ApiSourceBundle(bundle, { rootDirectory: root, publishedAt: PUBLISHED_AT });
  const second = await publishK6ApiSourceBundle(bundle, {
    rootDirectory: root,
    publishedAt: '2026-08-01T10:00:00.000Z',
  });
  assert.deepEqual(second, first);
  assert.deepEqual(await verifyPublishedK6ApiSourceBundle(bundle, { rootDirectory: root }), first);
}));

test('P4 publisher detects persisted content drift', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  await publishK6ApiSourceBundle(bundle, { rootDirectory: root, publishedAt: PUBLISHED_AT });
  await writeFile(join(root, bundle.bundleDigest, 'source/main.js'), 'tampered\n', 'utf8');
  await assert.rejects(() => verifyPublishedK6ApiSourceBundle(bundle, { rootDirectory: root }));
}));

test('P4 publisher rejects symbolic-link storage roots', async () => {
  const parent = await mkdtemp(join(tmpdir(), 'kdtp-p4-parent-'));
  const real = join(parent, 'real');
  const link = join(parent, 'link');
  try {
    const { mkdir } = await import('node:fs/promises');
    await mkdir(real);
    await symlink(real, link, 'dir');
    const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
    await assert.rejects(() => publishK6ApiSourceBundle(bundle, {
      rootDirectory: link,
      publishedAt: PUBLISHED_AT,
    }));
  } finally { await rm(parent, { recursive: true, force: true }); }
});

test('P4 publication Evidence binds local publication and preserves non-execution', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  const receipt = await publishK6ApiSourceBundle(bundle, { rootDirectory: root, publishedAt: PUBLISHED_AT });
  const evidence = createK6ApiSourcePublicationEvidence({ bundle, receipt });
  assert.equal(evidence.decision.sourcePersisted, true);
  assert.equal(evidence.decision.artifactPublished, true);
  assert.equal(evidence.decision.remoteArtifactPublished, false);
  assert.equal(evidence.decision.sourceExecuted, false);
  assert.equal(evidence.decision.executionRuntimeStarted, false);
  assert.equal(evidence.decision.nextRequiredSlice, 'M3-R2-P5');
  assert.equal(evidence.safetyBoundary.artifactStorageAccessed, true);
  assert.equal(evidence.safetyBoundary.targetNetworkAccessed, false);
  assert.equal(computeK6ApiSourcePublicationEvidenceDigest(evidence), evidence.evidenceDigest);
  assert.deepEqual(validateK6ApiSourcePublicationEvidence(evidence, { bundle, receipt }), evidence);
}));

test('P4 receipt rejects recomputed storage extensions and host-path leakage', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  const receipt = clone(await publishK6ApiSourceBundle(bundle, {
    rootDirectory: root, publishedAt: PUBLISHED_AT,
  }));
  receipt.storage.hostPath = root;
  const { receiptDigest: _old, ...withoutDigest } = receipt;
  const { sha256 } = await import('@kdtp/knowledge-core');
  receipt.receiptDigest = sha256(withoutDigest);
  assert.throws(() => validateK6ApiSourcePublicationReceipt(receipt, bundle));
}));

test('P4 publisher rejects a self-rehashed bundle with replaced trusted metadata', async () => withStore(async (root) => {
  const bundle = clone(createK6ApiSourcePublicationBundle(await p4AcceptedBindings()));
  const sourceFile = bundle.files.find((file) => file.path === 'source/main.js');
  sourceFile.content = `${sourceFile.content}\n`;
  const sourceEntry = bundle.manifest.entries.find((entry) => entry.path === 'source/main.js');
  const { createHash } = await import('node:crypto');
  sourceEntry.digest = createHash('sha256').update(sourceFile.content, 'utf8').digest('hex');
  sourceEntry.byteLength = Buffer.byteLength(sourceFile.content, 'utf8');
  bundle.manifest.totalByteLength = bundle.manifest.entries
    .reduce((total, entry) => total + entry.byteLength, 0);
  const { sha256 } = await import('@kdtp/knowledge-core');
  const { manifestDigest: _manifest, ...manifestClaims } = bundle.manifest;
  bundle.manifest.manifestDigest = sha256(manifestClaims);
  bundle.bundleId = `k6source-bundle-${bundle.manifest.manifestDigest.slice(0, 20)}`;
  const { bundleDigest: _bundle, ...bundleClaims } = bundle;
  bundle.bundleDigest = sha256(bundleClaims);
  await assert.rejects(() => publishK6ApiSourceBundle(bundle, {
    rootDirectory: root, publishedAt: PUBLISHED_AT,
  }));
}));

test('P4 rejects publication receipt and Evidence tampering', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  const receipt = await publishK6ApiSourceBundle(bundle, { rootDirectory: root, publishedAt: PUBLISHED_AT });
  const changedReceipt = clone(receipt);
  changedReceipt.storage.remote = true;
  assert.throws(() => validateK6ApiSourcePublicationReceipt(changedReceipt, bundle));
  const evidence = clone(createK6ApiSourcePublicationEvidence({ bundle, receipt }));
  evidence.decision.sourceExecuted = true;
  assert.throws(() => validateK6ApiSourcePublicationEvidence(evidence, { bundle, receipt }));
}));

test('P4 publisher rejects relative roots and never exposes host paths', async () => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  await assert.rejects(() => publishK6ApiSourceBundle(bundle, {
    rootDirectory: 'relative-store',
    publishedAt: PUBLISHED_AT,
  }));
  await withStore(async (root) => {
    const receipt = await publishK6ApiSourceBundle(bundle, {
      rootDirectory: root,
      publishedAt: PUBLISHED_AT,
    });
    const serialized = JSON.stringify(receipt);
    assert.equal(serialized.includes(root), false);
    assert.equal(receipt.storage.logicalUri.startsWith('kdtp-source-bundle://sha256/'), true);
  });
});

test('P4 verifier rejects extra files and symbolic links in a published bundle', async () => withStore(async (root) => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  await publishK6ApiSourceBundle(bundle, { rootDirectory: root, publishedAt: PUBLISHED_AT });
  const target = join(root, bundle.bundleDigest);
  await writeFile(join(target, 'extra.js'), 'unexpected\n', 'utf8');
  await assert.rejects(() => verifyPublishedK6ApiSourceBundle(bundle, { rootDirectory: root }));
}));
