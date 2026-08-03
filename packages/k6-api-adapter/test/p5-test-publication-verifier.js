import {
  ACCEPTED_P3, ACCEPTED_P4, ACCEPTED_SOURCE, FIXED_STORE_FILES,
} from '../../../scripts/m3-r2-p5-baseline.js';
import {
  canonicalStringify, clone, gitBlobSha, invariant, sha256, stripDigest,
} from './p5-test-canonical.js';
import {
  scanSensitiveValues, validateStorePath, verifySafety,
} from './p5-test-security-boundary.js';

export function verifyAcceptedP4({ receipt, compactReceipt = receipt, receiptRaw, evidence, evidenceRaw }) {
  invariant(sha256(receiptRaw) === ACCEPTED_P4.artifactReceiptRawSha256,
    'P4 accepted Artifact receipt raw SHA-256 mismatch');
  invariant(gitBlobSha(receiptRaw) === ACCEPTED_P4.artifactReceiptBlobSha,
    'P4 accepted Artifact receipt Git blob SHA mismatch');
  invariant(sha256(evidenceRaw) === ACCEPTED_P4.evidenceRawSha256,
    'P4 accepted Evidence raw SHA-256 mismatch');
  invariant(gitBlobSha(evidenceRaw) === ACCEPTED_P4.evidenceBlobSha,
    'P4 accepted Evidence Git blob SHA mismatch');
  invariant(compactReceipt.acceptedEvidence.rawSha256 === ACCEPTED_P4.evidenceRawSha256
      && compactReceipt.acceptedEvidence.gitBlobSha === ACCEPTED_P4.evidenceBlobSha
      && compactReceipt.acceptedEvidence.evidenceDigest === ACCEPTED_P4.evidenceDigest,
  'P4 accepted Evidence receipt binding mismatch');
  const { evidenceDigest, ...claims } = evidence;
  invariant(evidenceDigest === ACCEPTED_P4.evidenceDigest && sha256(claims) === evidenceDigest,
    'P4 accepted Evidence canonical digest mismatch');
  const a = receipt.acceptedArtifact;
  for (const [key, value] of Object.entries({
    headSha: ACCEPTED_P4.headSha, runId: ACCEPTED_P4.runId, artifactId: ACCEPTED_P4.artifactId,
    artifactApiDigest: ACCEPTED_P4.artifactApiDigest, uploadedZipDigest: ACCEPTED_P4.uploadedZipDigest,
    downloadedArchiveSha256: ACCEPTED_P4.downloadedArchiveSha256,
    downloadedFileCount: ACCEPTED_P4.downloadedFileCount,
    postgresArtifactId: ACCEPTED_P4.postgresArtifactId,
    postgresArtifactApiDigest: ACCEPTED_P4.postgresArtifactApiDigest,
    postgresDownloadedArchiveSha256: ACCEPTED_P4.postgresDownloadedArchiveSha256,
  })) invariant(a[key] === value, `P4 Head, Run, Artifact or layered digest mismatch: ${key}`);
  verifyP3(evidence.acceptedP3); verifyPublication(receipt, evidence); verifyStore(receipt);
  verifySafety(evidence.decision, evidence.safetyBoundary, 'M3-R2-P5');
  scanSensitiveValues({ evidence, receipt }); return true;
}

export function verifyPublication(receipt, evidence = receipt.acceptedEvidence?.evidence) {
  const { bundle, receipt: pubReceipt, publicationEvidence } = receipt.publication;
  const manifest = bundle.manifest;
  invariant(sha256(stripDigest(manifest, 'manifestDigest')) === manifest.manifestDigest,
    'Manifest digest mismatch');
  invariant(sha256(stripDigest(bundle, 'bundleDigest')) === bundle.bundleDigest,
    'Bundle digest mismatch');
  invariant(sha256(stripDigest(pubReceipt, 'receiptDigest')) === pubReceipt.receiptDigest,
    'Publication Receipt digest mismatch');
  invariant(sha256(stripDigest(publicationEvidence, 'evidenceDigest')) === publicationEvidence.evidenceDigest,
    'Publication Evidence digest mismatch');
  invariant(bundle.bundleDigest === ACCEPTED_P4.bundleDigest
      && manifest.manifestDigest === ACCEPTED_P4.manifestDigest
      && pubReceipt.receiptDigest === ACCEPTED_P4.receiptDigest
      && publicationEvidence.evidenceDigest === ACCEPTED_P4.publicationEvidenceDigest,
  'Publication identity differs from independent accepted trust anchor');
  const contents = new Map(bundle.files.map((file) => [file.path, file.content]));
  invariant(contents.size === manifest.fileCount && contents.size === manifest.entries.length,
    'Manifest file count mismatch');
  let bytes = 0;
  for (const entry of manifest.entries) {
    const content = contents.get(entry.path); invariant(typeof content === 'string', 'Manifest payload missing');
    invariant(sha256(content) === entry.digest && Buffer.byteLength(content) === entry.byteLength,
      'Manifest payload digest mismatch'); bytes += entry.byteLength;
  }
  invariant(bytes === manifest.totalByteLength, 'Manifest total byte length mismatch');
  const identity = productIdentity(receipt);
  invariant(identity.sourceDigest === ACCEPTED_SOURCE.sourceDigest
      && identity.sourceIdentity === ACCEPTED_SOURCE.sourceIdentity
      && identity.sourceArtifactDigest === ACCEPTED_P3.sourceArtifactDigest
      && identity.validationEvidenceDigest === ACCEPTED_P3.validationEvidenceDigest
      && identity.p3EvidenceDigest === ACCEPTED_P3.evidenceDigest,
  'Publication Source or P3 identity differs from independent accepted trust anchor');
  const p3File = parseBundle(bundle, 'metadata/p3-evidence.json');
  invariant(p3File.sourceArtifact.validationReportDigest === ACCEPTED_P3.validationReportDigest,
    'Accepted P3 validation report digest differs from independent trust anchor');
  const p = bundle.provenance;
  invariant(p.sourceDigest === identity.sourceDigest && p.sourceIdentity === identity.sourceIdentity
      && p.sourceArtifactDigest === identity.sourceArtifactDigest
      && p.validationEvidenceDigest === identity.validationEvidenceDigest
      && p.p3EvidenceDigest === identity.p3EvidenceDigest,
  'Provenance is not bound to Source, validation and P3 identity');
  invariant(pubReceipt.bundleDigest === bundle.bundleDigest
      && pubReceipt.manifestDigest === manifest.manifestDigest
      && publicationEvidence.bundleDigest === bundle.bundleDigest
      && publicationEvidence.receiptDigest === pubReceipt.receiptDigest,
  'Receipt or Publication Evidence is cross-bound');
  if (evidence) invariant(evidence.publicationBundle.bundleDigest === bundle.bundleDigest
      && evidence.publicationBundle.manifestDigest === manifest.manifestDigest
      && evidence.publicationReceipt.receiptDigest === pubReceipt.receiptDigest
      && evidence.publicationEvidence.evidenceDigest === publicationEvidence.evidenceDigest,
  'P4 Evidence publication summaries are cross-bound');
  return true;
}

export function verifyStore(receipt) {
  const store = receipt.store;
  invariant(store.directoryName === ACCEPTED_P4.bundleDigest && store.fileCount === 8,
    'Store directory or file count mismatch');
  const paths = store.files.map((file) => file.path).sort();
  invariant(canonicalStringify(paths) === canonicalStringify([...FIXED_STORE_FILES].sort()),
    'Store file set is missing, extra or unsafe');
  for (const file of store.files) {
    validateStorePath(file.path); const content = expectedStoreContent(receipt, file.path);
    invariant(file.byteLength === Buffer.byteLength(content) && file.sha256 === sha256(content),
      `Store digest mismatch: ${file.path}`);
  }
  return true;
}

export function replayAcceptedProductIdentity(fixture, ignored = {}) { void ignored; return productIdentity(fixture.receipt); }

export function productIdentity(receipt) {
  const bundle = receipt.publication.bundle;
  const artifact = parseBundle(bundle, 'metadata/source-artifact.json');
  const validation = parseBundle(bundle, 'metadata/source-validation-evidence.json');
  const p3 = parseBundle(bundle, 'metadata/p3-evidence.json');
  return Object.freeze({ sourceDigest: artifact.sourceDigest,
    sourceIdentity: artifact.sourceIdentity.identityDigest, sourceArtifactDigest: artifact.artifactDigest,
    validationEvidenceDigest: validation.evidenceDigest, p3EvidenceDigest: p3.evidenceDigest,
    manifestDigest: bundle.manifest.manifestDigest, bundleDigest: bundle.bundleDigest });
}
function verifyP3(value) {
  for (const [key, expected] of Object.entries(ACCEPTED_P3)) {
    if (key === 'validationReportDigest') continue;
    invariant(value[key] === expected, `Accepted P3 independent trust anchor mismatch: ${key}`);
  }
}
export function expectedStoreContent(receipt, path) {
  const p = receipt.publication;
  if (path === 'bundle.json') return `${canonicalStringify(p.bundle)}\n`;
  if (path === 'manifest.json') return `${canonicalStringify(p.bundle.manifest)}\n`;
  if (path === 'metadata/provenance.json') return `${canonicalStringify(p.bundle.provenance)}\n`;
  if (path === 'receipt.json') return `${canonicalStringify(p.receipt)}\n`;
  const file = p.bundle.files.find((entry) => entry.path === path);
  invariant(file, `Missing Bundle file: ${path}`); return file.content;
}
export function parseBundle(bundle, path) { const file = bundle.files.find((f) => f.path === path);
  invariant(file, `Missing Bundle file: ${path}`); return JSON.parse(file.content); }
export function setBundle(bundle, path, value) { const file = bundle.files.find((f) => f.path === path);
  invariant(file, `Missing Bundle file: ${path}`); file.content = `${canonicalStringify(value)}\n`; }
