#!/usr/bin/env node
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@kdtp/knowledge-core';
import {
  computeK6ApiSourcePublicationBundleDigest,
  computeK6ApiSourcePublicationEvidenceDigest,
  computeK6ApiSourcePublicationManifestDigest,
  computeK6ApiSourcePublicationReceiptDigest,
  createK6ApiSourcePublicationBundle,
  createK6ApiSourcePublicationEvidence,
  publishK6ApiSourceBundle,
  validateK6ApiSourcePublicationBundle,
  validateK6ApiSourcePublicationEvidence,
  validateK6ApiSourcePublicationReceipt,
  verifyPublishedK6ApiSourceBundle,
} from '../packages/k6-api-adapter/src/index.js';
import {
  ACCEPTED_P3,
  ACCEPTED_P3_ARTIFACT_BUNDLE_PATH,
  ACCEPTED_P3_BRANCH,
  ACCEPTED_P3_EVIDENCE_PATH,
  ACCEPTED_P3_GENERATED_AT,
  M3_R2_P4_EVIDENCE_SCHEMA_VERSION,
  assertP4,
  resolveP4Branch,
} from './m3-r2-p4-baseline.js';
import { loadP4Repository, validateP4Repository } from './m3-r2-p4-repository.js';

export async function loadAcceptedP3Bindings() {
  const [evidenceRaw, artifactReceiptRaw] = await Promise.all([
    readFile(ACCEPTED_P3_EVIDENCE_PATH, 'utf8'),
    readFile(ACCEPTED_P3_ARTIFACT_BUNDLE_PATH, 'utf8'),
  ]);
  assertP4(createHash('sha256').update(evidenceRaw, 'utf8').digest('hex')
      === ACCEPTED_P3.evidenceReceiptFileDigest,
  'Accepted M3-R2 P3 Evidence receipt file digest changed');
  assertP4(gitBlobSha(artifactReceiptRaw) === ACCEPTED_P3.artifactReceiptBlobSha,
    'Accepted M3-R2 P3 Artifact receipt Git blob SHA changed');

  const p3Evidence = parseJson(evidenceRaw, 'Accepted M3-R2 P3 Evidence receipt');
  const artifactReceipt = parseJson(artifactReceiptRaw,
    'Accepted M3-R2 P3 Artifact receipt');
  const { evidenceDigest, ...evidenceClaims } = p3Evidence;
  assertP4(evidenceDigest === ACCEPTED_P3.evidenceDigest
      && sha256(evidenceClaims) === evidenceDigest,
  'Accepted M3-R2 P3 Evidence canonical digest changed');
  assertP4(p3Evidence.generatedAt === ACCEPTED_P3_GENERATED_AT
      && p3Evidence.source?.branch === ACCEPTED_P3_BRANCH
      && p3Evidence.source?.commitSha === ACCEPTED_P3.headSha,
  'Accepted M3-R2 P3 Evidence source binding changed');
  assertP4(p3Evidence.sourceArtifact?.artifactDigest === ACCEPTED_P3.sourceArtifactDigest
      && p3Evidence.validationEvidence?.evidenceDigest
        === ACCEPTED_P3.validationEvidenceDigest
      && p3Evidence.sourceArtifact?.sourceDigest === ACCEPTED_P3.sourceDigest,
  'Accepted M3-R2 P3 Evidence Artifact binding changed');

  const sourceArtifact = artifactReceipt.sourceArtifact;
  const validationEvidence = artifactReceipt.validationEvidence;
  assertP4(sourceArtifact?.artifactDigest === ACCEPTED_P3.sourceArtifactDigest
      && sourceArtifact?.sourceDigest === ACCEPTED_P3.sourceDigest
      && sha256(stripDigest(sourceArtifact, 'artifactDigest'))
        === sourceArtifact.artifactDigest,
  'Accepted M3-R2 P3 Source Artifact changed');
  assertP4(validationEvidence?.evidenceDigest === ACCEPTED_P3.validationEvidenceDigest
      && validationEvidence?.artifactDigest === sourceArtifact.artifactDigest
      && sha256(stripDigest(validationEvidence, 'evidenceDigest'))
        === validationEvidence.evidenceDigest,
  'Accepted M3-R2 P3 validation Evidence changed');

  const bindings = { sourceArtifact, validationEvidence, p3Evidence };
  validateK6ApiSourcePublicationBundle(
    createK6ApiSourcePublicationBundle(bindings), bindings);
  return bindings;
}

export async function validateM3R2SourceGenerationP4(options = {}) {
  const repository = options.repository ?? await loadP4Repository();
  validateP4Repository(repository);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  validateIsoTime(generatedAt, 'M3-R2 P4 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assertP4(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R2 P4 source commit SHA is invalid');
  const branch = options.branch ?? resolveP4Branch(options);
  const bindings = options.bindings ?? await loadAcceptedP3Bindings();
  const bundle = options.bundle ?? createK6ApiSourcePublicationBundle(bindings);
  validateK6ApiSourcePublicationBundle(bundle, bindings);
  assertP4(computeK6ApiSourcePublicationBundleDigest(bundle) === bundle.bundleDigest,
    'M3-R2 P4 Source Bundle digest cannot be independently recomputed');
  assertP4(computeK6ApiSourcePublicationManifestDigest(bundle.manifest)
      === bundle.manifest.manifestDigest,
  'M3-R2 P4 Source Manifest digest cannot be independently recomputed');

  const suppliedRoot = options.rootDirectory ?? process.env.M3_R2_P4_STORE_ROOT;
  const ownsRoot = !suppliedRoot;
  const rootDirectory = suppliedRoot
    ?? await mkdtemp(join(tmpdir(), 'kdtp-m3-r2-p4-validator-'));
  const publishedAt = options.publishedAt ?? process.env.M3_R2_P4_PUBLISHED_AT
    ?? generatedAt;
  validateIsoTime(publishedAt, 'M3-R2 P4 publishedAt is invalid');
  try {
    const receipt = options.receipt ?? await publishK6ApiSourceBundle(bundle, {
      rootDirectory,
      publishedAt,
    });
    validateK6ApiSourcePublicationReceipt(receipt, bundle);
    const verifiedReceipt = await verifyPublishedK6ApiSourceBundle(bundle, { rootDirectory });
    assertP4(verifiedReceipt.receiptDigest === receipt.receiptDigest,
      'M3-R2 P4 persisted receipt changed after publication');
    assertP4(computeK6ApiSourcePublicationReceiptDigest(receipt) === receipt.receiptDigest,
      'M3-R2 P4 publication Receipt digest cannot be independently recomputed');

    const publicationEvidence = options.publicationEvidence
      ?? createK6ApiSourcePublicationEvidence({ bundle, receipt });
    validateK6ApiSourcePublicationEvidence(publicationEvidence, { bundle, receipt });
    assertP4(computeK6ApiSourcePublicationEvidenceDigest(publicationEvidence)
        === publicationEvidence.evidenceDigest,
    'M3-R2 P4 publication Evidence digest cannot be independently recomputed');
    assertP4(!JSON.stringify({ receipt, publicationEvidence }).includes(rootDirectory),
      'M3-R2 P4 public evidence leaks the server-owned storage path');

    const evidenceClaims = {
      schemaVersion: M3_R2_P4_EVIDENCE_SCHEMA_VERSION,
      generatedAt,
      source: { branch, commitSha },
      acceptedP3: { ...ACCEPTED_P3 },
      publicationBundle: {
        bundleId: bundle.bundleId,
        bundleDigest: bundle.bundleDigest,
        manifestDigest: bundle.manifest.manifestDigest,
        fileCount: bundle.manifest.fileCount,
        totalByteLength: bundle.manifest.totalByteLength,
        sourceArtifactDigest: bundle.sourceArtifactDigest,
        validationEvidenceDigest: bundle.validationEvidenceDigest,
        p3EvidenceDigest: bundle.p3EvidenceDigest,
      },
      publicationReceipt: {
        receiptId: receipt.receiptId,
        receiptDigest: receipt.receiptDigest,
        logicalUri: receipt.storage.logicalUri,
        publishedAt: receipt.publishedAt,
        storageKind: receipt.storage.kind,
        remote: receipt.storage.remote,
      },
      publicationEvidence: {
        evidenceId: publicationEvidence.evidenceId,
        evidenceDigest: publicationEvidence.evidenceDigest,
      },
      decision: structuredClone(publicationEvidence.decision),
      safetyBoundary: structuredClone(publicationEvidence.safetyBoundary),
    };
    return { ...evidenceClaims, evidenceDigest: sha256(evidenceClaims) };
  } finally {
    if (ownsRoot) await rm(rootDirectory, { recursive: true, force: true });
  }
}

function validateIsoTime(value, message) {
  assertP4(typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
      && !Number.isNaN(Date.parse(value)), message);
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch { throw new Error(`${label} is not valid JSON`); }
}

function gitBlobSha(raw) {
  const length = Buffer.byteLength(raw, 'utf8');
  return createHash('sha1').update(`blob ${length}\0`, 'utf8').update(raw, 'utf8').digest('hex');
}

function stripDigest(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return copy;
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R2SourceGenerationP4(), null, 2)}\n`);
}
