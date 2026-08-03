import {
  clone, expectedStoreContent, parseBundle, setBundle, sha256, stripDigest,
} from './p5-test-anchor.js';
export {
  canonicalStringify, clone, gitBlobSha, invariant, loadAcceptedP5Fixture,
  productIdentity, rejectExecutableMaterial, replayAcceptedProductIdentity,
  scanSensitiveValues, sha256, stripDigest, validateStorePath,
  verifyAcceptedP4, verifyPublication, verifySafety, verifyStore,
} from './p5-test-anchor.js';

export function recomputeSelfConsistentForgery(fixture) {
  const forged = clone(fixture.receipt); const bundle = forged.publication.bundle;
  const source = bundle.files.find((f) => f.path === 'source/main.js'); source.content += '// tampered\n';
  const artifact = parseBundle(bundle, 'metadata/source-artifact.json');
  artifact.sourceDigest = sha256(source.content); artifact.sourceByteLength = Buffer.byteLength(source.content);
  artifact.sourceIdentity = { ...artifact.sourceIdentity,
    identityDigest: sha256({ ...artifact.sourceIdentity, identityDigest: undefined, sourceDigest: artifact.sourceDigest }) };
  artifact.artifactDigest = sha256(stripDigest(artifact, 'artifactDigest'));
  setBundle(bundle, 'metadata/source-artifact.json', artifact);
  const validation = parseBundle(bundle, 'metadata/source-validation-evidence.json');
  validation.sourceDigest = artifact.sourceDigest; validation.artifactDigest = artifact.artifactDigest;
  validation.evidenceDigest = sha256(stripDigest(validation, 'evidenceDigest'));
  setBundle(bundle, 'metadata/source-validation-evidence.json', validation);
  const p3 = parseBundle(bundle, 'metadata/p3-evidence.json');
  p3.sourceArtifact = { ...p3.sourceArtifact, artifactDigest: artifact.artifactDigest,
    sourceDigest: artifact.sourceDigest, sourceIdentity: artifact.sourceIdentity.identityDigest };
  p3.validationEvidence = { ...p3.validationEvidence, artifactDigest: artifact.artifactDigest,
    evidenceDigest: validation.evidenceDigest };
  p3.evidenceDigest = sha256(stripDigest(p3, 'evidenceDigest')); setBundle(bundle, 'metadata/p3-evidence.json', p3);
  Object.assign(bundle, { sourceArtifactDigest: artifact.artifactDigest,
    validationEvidenceDigest: validation.evidenceDigest, p3EvidenceDigest: p3.evidenceDigest });
  Object.assign(bundle.provenance, { sourceDigest: artifact.sourceDigest,
    sourceIdentity: artifact.sourceIdentity.identityDigest, sourceArtifactDigest: artifact.artifactDigest,
    validationEvidenceDigest: validation.evidenceDigest, p3EvidenceDigest: p3.evidenceDigest });
  setBundle(bundle, 'metadata/provenance.json', bundle.provenance);
  const fileMap = new Map(bundle.files.map((f) => [f.path, f.content])); let total = 0;
  for (const entry of bundle.manifest.entries) {
    const content = fileMap.get(entry.path); entry.digest = sha256(content);
    entry.byteLength = Buffer.byteLength(content); total += entry.byteLength;
  }
  bundle.manifest.totalByteLength = total;
  bundle.manifest.manifestDigest = sha256(stripDigest(bundle.manifest, 'manifestDigest'));
  bundle.bundleId = `k6source-bundle-${bundle.manifest.manifestDigest.slice(0, 20)}`;
  bundle.bundleDigest = sha256(stripDigest(bundle, 'bundleDigest'));
  const r = forged.publication.receipt;
  Object.assign(r, { bundleId: bundle.bundleId, bundleDigest: bundle.bundleDigest,
    manifestDigest: bundle.manifest.manifestDigest, sourceArtifactDigest: artifact.artifactDigest,
    validationEvidenceDigest: validation.evidenceDigest, p3EvidenceDigest: p3.evidenceDigest,
    receiptId: `k6source-receipt-${bundle.bundleDigest.slice(0, 20)}` });
  r.storage.logicalUri = `kdtp-source-bundle://sha256/${bundle.bundleDigest}`;
  r.receiptDigest = sha256(stripDigest(r, 'receiptDigest'));
  const e = forged.publication.publicationEvidence;
  Object.assign(e, { bundleId: bundle.bundleId, bundleDigest: bundle.bundleDigest,
    manifestDigest: bundle.manifest.manifestDigest, receiptId: r.receiptId,
    receiptDigest: r.receiptDigest, sourceArtifactDigest: artifact.artifactDigest,
    validationEvidenceDigest: validation.evidenceDigest, p3EvidenceDigest: p3.evidenceDigest });
  e.evidenceDigest = sha256(stripDigest(e, 'evidenceDigest'));
  for (const record of forged.store.files) { const content = expectedStoreContent(forged, record.path);
    record.byteLength = Buffer.byteLength(content); record.sha256 = sha256(content); }
  forged.store.directoryName = bundle.bundleDigest; return forged;
}

