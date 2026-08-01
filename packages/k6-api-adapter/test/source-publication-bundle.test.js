import assert from 'node:assert/strict';
import { test } from 'node:test';
import { canonicalStringify } from '@kdtp/knowledge-core';
import {
  computeK6ApiSourcePublicationBundleDigest,
  computeK6ApiSourcePublicationManifestDigest,
  createK6ApiSourcePublicationBundle,
  materializeK6ApiSourcePublicationBundle,
  validateK6ApiSourcePublicationBundle,
} from '../src/source-publication-bundle.js';
import { clone, p4AcceptedBindings } from './p4-test-helpers.js';

test('P4 bundle is byte-stable and content-addressed', async () => {
  const bindings = await p4AcceptedBindings();
  const first = createK6ApiSourcePublicationBundle(bindings);
  const second = createK6ApiSourcePublicationBundle(clone(bindings));
  assert.equal(canonicalStringify(first), canonicalStringify(second));
  assert.equal(computeK6ApiSourcePublicationBundleDigest(first), first.bundleDigest);
  assert.equal(computeK6ApiSourcePublicationManifestDigest(first.manifest),
    first.manifest.manifestDigest);
  assert.equal(first.bundleId, `k6source-bundle-${first.manifest.manifestDigest.slice(0, 20)}`);
  assert.equal(first.immutable, true);
  assert.equal(first.contentAddressed, true);
  assert.equal(Object.isFrozen(first), true);
});

test('P4 manifest uses the fixed safe layout and exact bytes', async () => {
  const bundle = createK6ApiSourcePublicationBundle(await p4AcceptedBindings());
  assert.deepEqual(bundle.manifest.entries.map((entry) => entry.path), [
    'metadata/p3-evidence.json',
    'metadata/provenance.json',
    'metadata/source-artifact.json',
    'metadata/source-validation-evidence.json',
    'source/main.js',
  ]);
  assert.equal(bundle.manifest.fileCount, 5);
  assert.equal(bundle.manifest.totalByteLength,
    bundle.manifest.entries.reduce((total, entry) => total + entry.byteLength, 0));
  const materialized = materializeK6ApiSourcePublicationBundle(bundle);
  assert.deepEqual(materialized.map((file) => file.path), [
    'metadata/p3-evidence.json',
    'metadata/provenance.json',
    'metadata/source-artifact.json',
    'metadata/source-validation-evidence.json',
    'source/main.js',
    'manifest.json',
    'bundle.json',
  ]);
});

test('P4 bundle binds the complete P3 provenance chain', async () => {
  const bindings = await p4AcceptedBindings();
  const bundle = createK6ApiSourcePublicationBundle(bindings);
  assert.equal(bundle.sourceArtifactDigest, bindings.sourceArtifact.artifactDigest);
  assert.equal(bundle.validationEvidenceDigest, bindings.validationEvidence.evidenceDigest);
  assert.equal(bundle.p3EvidenceDigest, bindings.p3Evidence.evidenceDigest);
  assert.equal(bundle.provenance.sourceDigest, bindings.sourceArtifact.sourceDigest);
  assert.equal(bundle.provenance.p2EvidenceDigest,
    bindings.sourceArtifact.provenance.p2EvidenceDigest);
  assert.deepEqual(validateK6ApiSourcePublicationBundle(bundle, bindings), bundle);
});

for (const [name, mutate] of [
  ['P3 evidence digest', (b) => { b.p3Evidence.evidenceDigest = '0'.repeat(64); }],
  ['Source Artifact content', (b) => { b.sourceArtifact.source += ' '; }],
  ['validation Evidence binding', (b) => { b.validationEvidence.artifactDigest = '0'.repeat(64); }],
]) test(`P4 rejects tampered ${name}`, async () => {
  const bindings = clone(await p4AcceptedBindings());
  mutate(bindings);
  assert.throws(() => createK6ApiSourcePublicationBundle(bindings));
});

test('P4 rejects bundle layout and payload drift', async () => {
  const bindings = await p4AcceptedBindings();
  const bundle = clone(createK6ApiSourcePublicationBundle(bindings));
  bundle.files[0].path = '../escape';
  assert.throws(() => validateK6ApiSourcePublicationBundle(bundle, bindings));
  const bundle2 = clone(createK6ApiSourcePublicationBundle(bindings));
  bundle2.files[0].content += ' ';
  assert.throws(() => materializeK6ApiSourcePublicationBundle(bundle2));
});
