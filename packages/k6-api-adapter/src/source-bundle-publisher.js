import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  writeFile,
} from 'node:fs/promises';
import { isAbsolute, join, relative, resolve, sep } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson } from '@kdtp/execution-contract';
import {
  K6_API_SOURCE_PUBLICATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_STORAGE_KIND,
} from './constants.js';
import { sourcePublicationInvariant } from './errors.js';
import {
  computeK6ApiSourcePublicationBundleDigest,
  computeK6ApiSourcePublicationManifestDigest,
  materializeK6ApiSourcePublicationBundle,
  validateK6ApiSourcePublicationBundleIntegrity,
} from './source-publication-bundle.js';
import { DIGEST, validationDeepFreeze, validationExactFields } from './source-validation-shared.js';

const RECEIPT_FIELDS = Object.freeze([
  'schemaVersion', 'receiptId', 'bundleId', 'bundleDigest', 'manifestDigest',
  'sourceArtifactDigest', 'validationEvidenceDigest', 'p3EvidenceDigest',
  'storage', 'publishedAt', 'receiptDigest',
]);
const STORAGE_FIELDS = Object.freeze([
  'kind', 'logicalUri', 'contentAddressed', 'immutable', 'remote',
  'payloadFileCount', 'storedFileCount', 'totalPayloadByteLength',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'bundleId', 'bundleDigest', 'manifestDigest',
  'receiptId', 'receiptDigest', 'sourceArtifactDigest',
  'validationEvidenceDigest', 'p3EvidenceDigest', 'decision',
  'safetyBoundary', 'evidenceDigest',
]);

export const K6_API_SOURCE_PUBLICATION_DECISION = Object.freeze({
  sourceBundleContractReady: true,
  sourceBundleCreated: true,
  sourceManifestCreated: true,
  sourceProvenanceBound: true,
  sourcePersisted: true,
  artifactPublished: true,
  remoteArtifactPublished: false,
  sourceExecuted: false,
  executionRuntimeStarted: false,
  nextRequiredSlice: 'M3-R2-P5',
  repositoryBlockers: Object.freeze([]),
});

export const K6_API_SOURCE_PUBLICATION_SAFETY_BOUNDARY = Object.freeze({
  artifactStorageAccessed: true,
  artifactStorageDirectoryCreated: true,
  sourcePersisted: true,
  artifactPublished: true,
  remoteArtifactPublished: false,
  sourceExecuted: false,
  executionRuntimeStarted: false,
  k6Invoked: false,
  xk6Invoked: false,
  playwrightInvoked: false,
  externalProcessExecuted: false,
  nodeVmUsed: false,
  evalUsed: false,
  dynamicImportUsed: false,
  targetNetworkAccessed: false,
  databaseAccessed: false,
  secretAccessed: false,
  filesystemCredentialAccessed: false,
  temporaryExecutionDirectoryCreated: false,
  containerStarted: false,
  kubernetesResourceCreated: false,
  workerAdded: false,
  queueAdded: false,
  schedulerAdded: false,
  runtimeResultCollected: false,
  allureImplemented: false,
});

export async function publishK6ApiSourceBundle(bundle, {
  rootDirectory,
  publishedAt,
  acceptedP3,
}) {
  validateBundleForPublication(bundle, acceptedP3);
  validatePublishedAt(publishedAt);
  const root = await prepareRoot(rootDirectory);
  const target = join(root, bundle.bundleDigest);
  const existing = await statIfPresent(target);
  if (existing) {
    sourcePublicationInvariant(existing.isDirectory() && !existing.isSymbolicLink(),
      'K6_API_SOURCE_PUBLICATION_TARGET_UNSAFE', 'Existing publication target is unsafe');
    return verifyPublishedK6ApiSourceBundle(bundle, { rootDirectory: root, acceptedP3 });
  }
  const staging = join(root, `.staging-${bundle.bundleDigest}`);
  sourcePublicationInvariant(!(await statIfPresent(staging)),
    'K6_API_SOURCE_PUBLICATION_BUSY', 'Source bundle publication is already in progress');
  await mkdir(staging, { mode: 0o700 });
  const receipt = createReceipt(bundle, publishedAt);
  try {
    for (const file of materializeK6ApiSourcePublicationBundle(bundle)) {
      const path = safeChild(staging, file.path);
      await mkdir(resolve(path, '..'), { recursive: true, mode: 0o700 });
      await writeFile(path, file.content, { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    }
    await writeFile(safeChild(staging, 'receipt.json'), `${canonicalStringify(receipt)}\n`,
      { encoding: 'utf8', flag: 'wx', mode: 0o600 });
    await rename(staging, target);
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
  return verifyPublishedK6ApiSourceBundle(bundle, { rootDirectory: root, acceptedP3 });
}

export async function verifyPublishedK6ApiSourceBundle(bundle, {
  rootDirectory,
  acceptedP3,
}) {
  validateBundleForPublication(bundle, acceptedP3);
  const root = await prepareRoot(rootDirectory);
  const target = safeChild(root, bundle.bundleDigest);
  const targetStat = await statIfPresent(target);
  sourcePublicationInvariant(targetStat?.isDirectory() && !targetStat.isSymbolicLink(),
    'K6_API_SOURCE_PUBLICATION_NOT_FOUND', 'Published Source bundle was not found');
  for (const file of materializeK6ApiSourcePublicationBundle(bundle)) {
    const content = await readUtf8File(safeChild(target, file.path));
    sourcePublicationInvariant(content === file.content,
      'K6_API_SOURCE_PUBLICATION_DRIFT', 'Published Source bundle content changed',
      { path: file.path });
  }
  const expectedFiles = [
    ...materializeK6ApiSourcePublicationBundle(bundle).map((file) => file.path),
    'receipt.json',
  ].sort();
  const actualFiles = (await listStoredFiles(target)).sort();
  sourcePublicationInvariant(canonicalStringify(actualFiles) === canonicalStringify(expectedFiles),
    'K6_API_SOURCE_PUBLICATION_LAYOUT_DRIFT',
    'Published Source bundle contains missing, extra or unsafe files',
    { expectedFiles, actualFiles });
  const receipt = JSON.parse(await readUtf8File(safeChild(target, 'receipt.json')));
  validateK6ApiSourcePublicationReceipt(receipt, bundle, { acceptedP3 });
  return receipt;
}

export function validateK6ApiSourcePublicationReceipt(receipt, bundle, { acceptedP3 } = {}) {
  validationExactFields(receipt, RECEIPT_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_RECEIPT', 'Source publication receipt');
  validateBundleForPublication(bundle, acceptedP3);
  validationExactFields(receipt.storage, STORAGE_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_RECEIPT', 'Source publication storage receipt');
  const { receiptDigest, ...withoutDigest } = receipt;
  sourcePublicationInvariant(DIGEST.test(receiptDigest) && sha256(withoutDigest) === receiptDigest
      && receipt.schemaVersion === K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION
      && receipt.receiptId === `k6source-receipt-${bundle.bundleDigest.slice(0, 20)}`
      && receipt.bundleId === bundle.bundleId
      && receipt.bundleDigest === bundle.bundleDigest
      && receipt.manifestDigest === bundle.manifest.manifestDigest
      && receipt.sourceArtifactDigest === bundle.sourceArtifactDigest
      && receipt.validationEvidenceDigest === bundle.validationEvidenceDigest
      && receipt.p3EvidenceDigest === bundle.p3EvidenceDigest
      && receipt.storage?.kind === K6_API_SOURCE_PUBLICATION_STORAGE_KIND
      && receipt.storage?.logicalUri === `kdtp-source-bundle://sha256/${bundle.bundleDigest}`
      && receipt.storage?.contentAddressed === true
      && receipt.storage?.immutable === true
      && receipt.storage?.remote === false
      && receipt.storage?.payloadFileCount === bundle.manifest.fileCount
      && receipt.storage?.storedFileCount === bundle.manifest.fileCount + 3
      && receipt.storage?.totalPayloadByteLength === bundle.manifest.totalByteLength,
  'K6_API_SOURCE_PUBLICATION_RECEIPT_MISMATCH',
  'Source publication receipt does not match the bundle');
  validatePublishedAt(receipt.publishedAt);
  return validationDeepFreeze(cloneExecutionJson(receipt));
}

export function createK6ApiSourcePublicationEvidence({ bundle, receipt, acceptedP3 }) {
  const acceptedReceipt = validateK6ApiSourcePublicationReceipt(
    receipt, bundle, { acceptedP3 });
  const evidenceWithoutDigest = {
    schemaVersion: K6_API_SOURCE_PUBLICATION_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6source-publication-${bundle.bundleDigest.slice(0, 20)}`,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.bundleDigest,
    manifestDigest: bundle.manifest.manifestDigest,
    receiptId: acceptedReceipt.receiptId,
    receiptDigest: acceptedReceipt.receiptDigest,
    sourceArtifactDigest: bundle.sourceArtifactDigest,
    validationEvidenceDigest: bundle.validationEvidenceDigest,
    p3EvidenceDigest: bundle.p3EvidenceDigest,
    decision: cloneExecutionJson(K6_API_SOURCE_PUBLICATION_DECISION),
    safetyBoundary: cloneExecutionJson(K6_API_SOURCE_PUBLICATION_SAFETY_BOUNDARY),
  };
  return validationDeepFreeze(cloneExecutionJson({
    ...evidenceWithoutDigest,
    evidenceDigest: sha256(evidenceWithoutDigest),
  }));
}

export function validateK6ApiSourcePublicationEvidence(evidence, {
  bundle,
  receipt,
  acceptedP3,
}) {
  validationExactFields(evidence, EVIDENCE_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_EVIDENCE', 'Source publication evidence');
  const expected = createK6ApiSourcePublicationEvidence({ bundle, receipt, acceptedP3 });
  sourcePublicationInvariant(canonicalStringify(evidence) === canonicalStringify(expected),
    'K6_API_SOURCE_PUBLICATION_EVIDENCE_MISMATCH',
    'Source publication evidence does not match the immutable publication receipt');
  return expected;
}

export function computeK6ApiSourcePublicationReceiptDigest(receipt) {
  validationExactFields(receipt, RECEIPT_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_RECEIPT', 'Source publication receipt');
  const { receiptDigest: _receiptDigest, ...withoutDigest } = receipt;
  return sha256(withoutDigest);
}

export function computeK6ApiSourcePublicationEvidenceDigest(evidence) {
  validationExactFields(evidence, EVIDENCE_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_EVIDENCE', 'Source publication evidence');
  const { evidenceDigest: _evidenceDigest, ...withoutDigest } = evidence;
  return sha256(withoutDigest);
}

function createReceipt(bundle, publishedAt) {
  const withoutDigest = {
    schemaVersion: K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION,
    receiptId: `k6source-receipt-${bundle.bundleDigest.slice(0, 20)}`,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.bundleDigest,
    manifestDigest: bundle.manifest.manifestDigest,
    sourceArtifactDigest: bundle.sourceArtifactDigest,
    validationEvidenceDigest: bundle.validationEvidenceDigest,
    p3EvidenceDigest: bundle.p3EvidenceDigest,
    storage: {
      kind: K6_API_SOURCE_PUBLICATION_STORAGE_KIND,
      logicalUri: `kdtp-source-bundle://sha256/${bundle.bundleDigest}`,
      contentAddressed: true,
      immutable: true,
      remote: false,
      payloadFileCount: bundle.manifest.fileCount,
      storedFileCount: bundle.manifest.fileCount + 3,
      totalPayloadByteLength: bundle.manifest.totalByteLength,
    },
    publishedAt,
  };
  return validationDeepFreeze({ ...withoutDigest, receiptDigest: sha256(withoutDigest) });
}

function validateBundleForPublication(bundle, acceptedP3) {
  const accepted = validateK6ApiSourcePublicationBundleIntegrity(bundle, acceptedP3);
  sourcePublicationInvariant(DIGEST.test(accepted.bundleDigest)
      && computeK6ApiSourcePublicationBundleDigest(accepted) === accepted.bundleDigest
      && computeK6ApiSourcePublicationManifestDigest(accepted.manifest)
        === accepted.manifest.manifestDigest
      && accepted.immutable === true && accepted.contentAddressed === true,
  'K6_API_SOURCE_PUBLICATION_BUNDLE_NOT_ACCEPTED',
  'Source publication bundle is not accepted for persistence');
  return accepted;
}

async function prepareRoot(rootDirectory) {
  sourcePublicationInvariant(typeof rootDirectory === 'string'
      && rootDirectory.length > 1 && rootDirectory.length <= 4096
      && isAbsolute(rootDirectory) && !rootDirectory.includes('\u0000'),
  'K6_API_SOURCE_PUBLICATION_ROOT_INVALID',
  'Source publication root must be a server-owned absolute directory');
  await mkdir(rootDirectory, { recursive: true, mode: 0o700 });
  const stat = await lstat(rootDirectory);
  sourcePublicationInvariant(stat.isDirectory() && !stat.isSymbolicLink(),
    'K6_API_SOURCE_PUBLICATION_ROOT_UNSAFE',
    'Source publication root must not be a symbolic link');
  return realpath(rootDirectory);
}

function safeChild(root, child) {
  sourcePublicationInvariant(typeof child === 'string' && child.length > 0
      && !isAbsolute(child) && !child.includes('\u0000') && !child.includes('\\'),
  'K6_API_SOURCE_PUBLICATION_PATH_INVALID', 'Source publication path is invalid');
  const candidate = resolve(root, child);
  const suffix = relative(root, candidate);
  sourcePublicationInvariant(suffix.length > 0 && suffix !== '..'
      && !suffix.startsWith(`..${sep}`) && !isAbsolute(suffix),
  'K6_API_SOURCE_PUBLICATION_PATH_ESCAPE',
  'Source publication path escapes the governed root');
  return candidate;
}

async function listStoredFiles(root, prefix = '') {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    sourcePublicationInvariant(!entry.isSymbolicLink(),
      'K6_API_SOURCE_PUBLICATION_FILE_UNSAFE',
      'Published Source bundle contains a symbolic link');
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const path = safeChild(root, entry.name);
    if (entry.isDirectory()) files.push(...await listStoredFiles(path, relativePath));
    else {
      sourcePublicationInvariant(entry.isFile(),
        'K6_API_SOURCE_PUBLICATION_FILE_UNSAFE',
        'Published Source bundle contains a non-file entry');
      files.push(relativePath);
    }
  }
  return files;
}

async function readUtf8File(path) {
  const stat = await lstat(path);
  sourcePublicationInvariant(stat.isFile() && !stat.isSymbolicLink(),
    'K6_API_SOURCE_PUBLICATION_FILE_UNSAFE', 'Published Source bundle file is unsafe');
  return readFile(path, 'utf8');
}

async function statIfPresent(path) {
  try { return await lstat(path); } catch (error) {
    if (error?.code === 'ENOENT') return null;
    throw error;
  }
}

function validatePublishedAt(value) {
  sourcePublicationInvariant(typeof value === 'string'
      && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
      && !Number.isNaN(Date.parse(value)),
  'K6_API_SOURCE_PUBLICATION_TIME_INVALID', 'Source publication time is invalid');
}
