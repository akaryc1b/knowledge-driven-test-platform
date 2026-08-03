import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clone, loadAcceptedP5Fixture, recomputeSelfConsistentForgery,
  verifyAcceptedP4, verifyPublication,
} from './p5-test-helpers.js';

function rejected(fn, pattern) { assert.throws(fn, pattern); }

test('P5 rejects Source Artifact, Validation Evidence and P3 cross-binding', async () => {
  const fixture = await loadAcceptedP5Fixture();
  for (const mutate of [
    (r) => { r.publication.bundle.sourceArtifactDigest = '0'.repeat(64); },
    (r) => { r.publication.bundle.validationEvidenceDigest = '1'.repeat(64); },
    (r) => { r.publication.bundle.p3EvidenceDigest = '2'.repeat(64); },
    (r) => { r.publication.bundle.provenance.specDigest = '3'.repeat(64); },
  ]) {
    const receipt = clone(fixture.receipt); mutate(receipt);
    rejected(() => verifyPublication(receipt), /digest|bound|anchor|identity|Provenance/i);
  }
});

test('P5 rejects Manifest payload, Receipt and Publication Evidence substitution', async () => {
  const fixture = await loadAcceptedP5Fixture();
  for (const mutate of [
    (r) => { r.publication.bundle.files[0].content += ' '; },
    (r) => { r.publication.receipt.bundleDigest = '4'.repeat(64); },
    (r) => { r.publication.publicationEvidence.receiptDigest = '5'.repeat(64); },
    (r) => { r.publication.bundle.manifest.entries[0].path = 'source/main.js'; },
  ]) {
    const receipt = clone(fixture.receipt); mutate(receipt);
    rejected(() => verifyPublication(receipt), /digest|bound|Manifest|Receipt|Evidence|anchor/i);
  }
});

test('P5 rejects project, environment, plan, snapshot and capability cross-binding', async () => {
  const fixture = await loadAcceptedP5Fixture();
  const sourceArtifactFile = fixture.receipt.publication.bundle.files.find((f) =>
    f.path === 'metadata/source-artifact.json');
  const original = JSON.parse(sourceArtifactFile.content);
  const candidates = [
    ['projectId', 'project-other'], ['environmentId', 'environment-other'],
    ['testPlanId', 'plan-other'], ['knowledgeSnapshotId', 'snapshot-other'],
    ['capabilityDigest', '6'.repeat(64)],
  ];
  for (const [key, value] of candidates) {
    const receipt = clone(fixture.receipt);
    const file = receipt.publication.bundle.files.find((f) =>
      f.path === 'metadata/source-artifact.json');
    const object = JSON.parse(file.content);
    object.sourceIdentity = { ...object.sourceIdentity, [key]: value };
    file.content = JSON.stringify(object);
    rejected(() => verifyAcceptedP4({ receipt, receiptRaw: fixture.receiptRaw,
      evidence: fixture.evidence, evidenceRaw: fixture.evidenceRaw }), /receipt|Store|digest|binding/i);
  }
  assert.ok(original.sourceIdentity);
});

test('P5 rejects Head, Run, Artifact ID and digest replacement', async () => {
  const fixture = await loadAcceptedP5Fixture();
  for (const [field, value] of [
    ['headSha', 'f'.repeat(40)], ['runId', 1], ['artifactId', 2],
    ['artifactApiDigest', `sha256:${'a'.repeat(64)}`],
    ['uploadedZipDigest', `sha256:${'b'.repeat(64)}`],
  ]) {
    const receipt = clone(fixture.receipt); receipt.acceptedArtifact[field] = value;
    const raw = `${JSON.stringify(receipt, null, 2)}\n`;
    rejected(() => verifyAcceptedP4({ receipt, receiptRaw: raw,
      evidence: fixture.evidence, evidenceRaw: fixture.evidenceRaw }), /receipt|Head|Run|Artifact|digest/i);
  }
});

test('P5 rejects a fully rehashed internally self-consistent forged chain', async () => {
  const fixture = await loadAcceptedP5Fixture();
  const forged = recomputeSelfConsistentForgery(fixture);
  assert.notEqual(forged.publication.bundle.bundleDigest, fixture.identity.bundleDigest);
  rejected(() => verifyPublication(forged), /independent accepted|trust anchor|identity/i);
});
