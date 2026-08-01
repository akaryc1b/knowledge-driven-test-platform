import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson } from '@kdtp/execution-contract';
import {
  K6_API_SOURCE_PUBLICATION_BUNDLE_KIND,
  K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_FORMAT_VERSION,
  K6_API_SOURCE_PUBLICATION_MANIFEST_SCHEMA_VERSION,
  K6_API_SOURCE_PROVENANCE_SCHEMA_VERSION,
} from './constants.js';
import { sourcePublicationInvariant } from './errors.js';
import {
  DIGEST,
  validationCountLines,
  validationDeepFreeze,
  validationExactFields,
  validationSha256Utf8,
} from './source-validation-shared.js';

const BUNDLE_FIELDS = Object.freeze([
  'schemaVersion', 'bundleId', 'bundleKind', 'formatVersion', 'immutable',
  'contentAddressed', 'sourceArtifactDigest', 'validationEvidenceDigest',
  'p3EvidenceDigest', 'provenance', 'manifest', 'files', 'bundleDigest',
]);
const MANIFEST_FIELDS = Object.freeze([
  'schemaVersion', 'formatVersion', 'entries', 'fileCount',
  'totalByteLength', 'manifestDigest',
]);
const ENTRY_FIELDS = Object.freeze(['path', 'mediaType', 'encoding', 'digest', 'byteLength']);
const FILE_FIELDS = Object.freeze(['path', 'content']);
const PROVENANCE_FIELDS = Object.freeze([
  'schemaVersion', 'sourceIdentity', 'sourceDigest', 'sourceResultDigest',
  'sourceArtifactDigest', 'validationReportDigest', 'validationEvidenceDigest',
  'p2EvidenceDigest', 'p3EvidenceDigest', 'generationRequestDigest',
  'renderingPolicyDigest', 'generatorDescriptorDigest', 'specDigest',
  'compilationEvidenceDigest', 'inputArtifactBundleDigest',
]);
const ACCEPTED_P3_FIELDS = Object.freeze([
  'evidenceDigest', 'sourceArtifactDigest', 'validationEvidenceDigest', 'sourceDigest',
]);
const P3_EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'generatedAt', 'source', 'acceptedP2', 'sourceArtifact',
  'validationEvidence', 'decision', 'safetyBoundary', 'evidenceDigest',
]);
const P3_DECISION_FIELDS = Object.freeze([
  'independentStaticValidatorReady', 'sourceArtifactContractReady',
  'sourceGenerated', 'sourceStaticallyValidated', 'sourceArtifactCreated',
  'sourcePersisted', 'artifactPublished', 'sourceExecuted',
  'executionRuntimeStarted', 'nextRequiredSlice', 'repositoryBlockers',
]);
const P3_SAFETY_FIELDS = Object.freeze([
  'sourcePersisted', 'artifactPublished', 'sourceExecuted',
  'executionRuntimeStarted', 'k6Invoked', 'xk6Invoked',
  'playwrightInvoked', 'externalProcessExecuted', 'nodeVmUsed', 'evalUsed',
  'dynamicImportUsed', 'targetNetworkAccessed', 'databaseAccessed',
  'secretAccessed', 'filesystemCredentialAccessed',
  'temporaryExecutionDirectoryCreated', 'containerStarted',
  'kubernetesResourceCreated', 'workerAdded', 'queueAdded', 'schedulerAdded',
  'runtimeResultCollected', 'allureImplemented',
]);
const P3_SOURCE_ARTIFACT_SUMMARY_FIELDS = Object.freeze([
  'artifactId', 'artifactDigest', 'sourceIdentity', 'sourceDigest',
  'sourceByteLength', 'sourceLineCount', 'persistence', 'published',
  'validationReportDigest',
]);
const P3_VALIDATION_EVIDENCE_SUMMARY_FIELDS = Object.freeze([
  'evidenceId', 'evidenceDigest', 'validatorId', 'validatorVersion',
  'checkCount', 'artifactDigest',
]);

const FIXED_FILE_LAYOUT = Object.freeze([
  Object.freeze({ path: 'metadata/p3-evidence.json', mediaType: 'application/json' }),
  Object.freeze({ path: 'metadata/provenance.json', mediaType: 'application/json' }),
  Object.freeze({ path: 'metadata/source-artifact.json', mediaType: 'application/json' }),
  Object.freeze({ path: 'metadata/source-validation-evidence.json', mediaType: 'application/json' }),
  Object.freeze({ path: 'source/main.js', mediaType: 'application/javascript' }),
]);

export function createK6ApiSourcePublicationBundle({
  sourceArtifact,
  validationEvidence,
  p3Evidence,
  acceptedP3,
}) {
  validateAcceptedP3Bindings({ sourceArtifact, validationEvidence, p3Evidence, acceptedP3 });
  const provenance = createProvenance({ sourceArtifact, validationEvidence, p3Evidence });
  const contents = new Map([
    ['metadata/p3-evidence.json', canonicalJsonFile(p3Evidence)],
    ['metadata/provenance.json', canonicalJsonFile(provenance)],
    ['metadata/source-artifact.json', canonicalJsonFile(sourceArtifact)],
    ['metadata/source-validation-evidence.json', canonicalJsonFile(validationEvidence)],
    ['source/main.js', sourceArtifact.source],
  ]);
  const files = FIXED_FILE_LAYOUT.map(({ path }) => ({ path, content: contents.get(path) }));
  const entries = FIXED_FILE_LAYOUT.map(({ path, mediaType }) => {
    const content = contents.get(path);
    return {
      path,
      mediaType,
      encoding: 'UTF-8',
      digest: validationSha256Utf8(content),
      byteLength: Buffer.byteLength(content, 'utf8'),
    };
  });
  const manifestWithoutDigest = {
    schemaVersion: K6_API_SOURCE_PUBLICATION_MANIFEST_SCHEMA_VERSION,
    formatVersion: K6_API_SOURCE_PUBLICATION_FORMAT_VERSION,
    entries,
    fileCount: entries.length,
    totalByteLength: entries.reduce((total, entry) => total + entry.byteLength, 0),
  };
  const manifest = {
    ...manifestWithoutDigest,
    manifestDigest: sha256(manifestWithoutDigest),
  };
  const bundleWithoutDigest = {
    schemaVersion: K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION,
    bundleId: `k6source-bundle-${manifest.manifestDigest.slice(0, 20)}`,
    bundleKind: K6_API_SOURCE_PUBLICATION_BUNDLE_KIND,
    formatVersion: K6_API_SOURCE_PUBLICATION_FORMAT_VERSION,
    immutable: true,
    contentAddressed: true,
    sourceArtifactDigest: sourceArtifact.artifactDigest,
    validationEvidenceDigest: validationEvidence.evidenceDigest,
    p3EvidenceDigest: p3Evidence.evidenceDigest,
    provenance,
    manifest,
    files,
  };
  return validationDeepFreeze(cloneExecutionJson({
    ...bundleWithoutDigest,
    bundleDigest: sha256(bundleWithoutDigest),
  }));
}

export function validateK6ApiSourcePublicationBundle(bundle, bindings) {
  validationExactFields(bundle, BUNDLE_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_BUNDLE', 'Source publication bundle');
  const expected = createK6ApiSourcePublicationBundle(bindings);
  sourcePublicationInvariant(canonicalStringify(bundle) === canonicalStringify(expected),
    'K6_API_SOURCE_PUBLICATION_BUNDLE_MISMATCH',
    'Source publication bundle does not match the accepted P3 chain');
  return expected;
}

export function validateK6ApiSourcePublicationBundleIntegrity(bundle, acceptedP3) {
  validateBundleIntegrity(bundle);
  const files = new Map(bundle.files.map((file) => [file.path, file.content]));
  let bindings;
  try {
    bindings = {
      p3Evidence: JSON.parse(files.get('metadata/p3-evidence.json')),
      sourceArtifact: JSON.parse(files.get('metadata/source-artifact.json')),
      validationEvidence: JSON.parse(files.get('metadata/source-validation-evidence.json')),
      acceptedP3,
    };
  } catch {
    sourcePublicationInvariant(false,
      'K6_API_SOURCE_PUBLICATION_METADATA_INVALID',
      'Source publication metadata is not valid JSON');
  }
  return validateK6ApiSourcePublicationBundle(bundle, bindings);
}

export function computeK6ApiSourcePublicationBundleDigest(bundle) {
  validationExactFields(bundle, BUNDLE_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_BUNDLE', 'Source publication bundle');
  const { bundleDigest: _bundleDigest, ...withoutDigest } = bundle;
  return sha256(withoutDigest);
}

export function computeK6ApiSourcePublicationManifestDigest(manifest) {
  validateManifestShape(manifest);
  const { manifestDigest: _manifestDigest, ...withoutDigest } = manifest;
  return sha256(withoutDigest);
}

export function materializeK6ApiSourcePublicationBundle(bundle) {
  validateBundleIntegrity(bundle);
  const payload = bundle.files.map((file) => ({ ...file }));
  return validationDeepFreeze([
    ...payload,
    { path: 'manifest.json', content: canonicalJsonFile(bundle.manifest) },
    { path: 'bundle.json', content: canonicalJsonFile(bundle) },
  ]);
}

function createProvenance({ sourceArtifact, validationEvidence, p3Evidence }) {
  return {
    schemaVersion: K6_API_SOURCE_PROVENANCE_SCHEMA_VERSION,
    sourceIdentity: sourceArtifact.sourceIdentity.identityDigest,
    sourceDigest: sourceArtifact.sourceDigest,
    sourceResultDigest: sourceArtifact.provenance.sourceResultDigest,
    sourceArtifactDigest: sourceArtifact.artifactDigest,
    validationReportDigest: sourceArtifact.validationReport.reportDigest,
    validationEvidenceDigest: validationEvidence.evidenceDigest,
    p2EvidenceDigest: sourceArtifact.provenance.p2EvidenceDigest,
    p3EvidenceDigest: p3Evidence.evidenceDigest,
    generationRequestDigest: sourceArtifact.provenance.generationRequestDigest,
    renderingPolicyDigest: sourceArtifact.provenance.renderingPolicyDigest,
    generatorDescriptorDigest: sourceArtifact.provenance.generatorDescriptorDigest,
    specDigest: sourceArtifact.provenance.specDigest,
    compilationEvidenceDigest: sourceArtifact.provenance.compilationEvidenceDigest,
    inputArtifactBundleDigest: sourceArtifact.provenance.bundleDigest,
  };
}

function validateAcceptedP3Bindings({ sourceArtifact, validationEvidence, p3Evidence, acceptedP3 }) {
  validationExactFields(acceptedP3, ACCEPTED_P3_FIELDS,
    'INVALID_M3_R2_P3_TRUST_ANCHOR', 'M3-R2 P3 trust anchor');
  sourcePublicationInvariant(Object.values(acceptedP3).every((value) => DIGEST.test(value)),
    'INVALID_M3_R2_P3_TRUST_ANCHOR', 'M3-R2 P3 trust anchor digests are invalid');
  validationExactFields(p3Evidence, P3_EVIDENCE_FIELDS,
    'INVALID_M3_R2_P3_EVIDENCE', 'M3-R2 P3 Evidence');
  validationExactFields(p3Evidence.decision, P3_DECISION_FIELDS,
    'INVALID_M3_R2_P3_EVIDENCE', 'M3-R2 P3 decision');
  validationExactFields(p3Evidence.safetyBoundary, P3_SAFETY_FIELDS,
    'INVALID_M3_R2_P3_EVIDENCE', 'M3-R2 P3 safety boundary');
  validationExactFields(p3Evidence.sourceArtifact, P3_SOURCE_ARTIFACT_SUMMARY_FIELDS,
    'INVALID_M3_R2_P3_EVIDENCE', 'M3-R2 P3 Source Artifact summary');
  validationExactFields(p3Evidence.validationEvidence,
    P3_VALIDATION_EVIDENCE_SUMMARY_FIELDS,
    'INVALID_M3_R2_P3_EVIDENCE', 'M3-R2 P3 validation Evidence summary');
  const { evidenceDigest, ...evidenceWithoutDigest } = p3Evidence;
  sourcePublicationInvariant(DIGEST.test(evidenceDigest)
      && sha256(evidenceWithoutDigest) === evidenceDigest,
  'M3_R2_P3_EVIDENCE_DIGEST_MISMATCH', 'M3-R2 P3 Evidence digest is invalid');
  sourcePublicationInvariant(p3Evidence.schemaVersion === 'm3-r2-source-generation-p3-evidence/v1'
      && p3Evidence.decision?.independentStaticValidatorReady === true
      && p3Evidence.decision?.sourceArtifactContractReady === true
      && p3Evidence.decision?.sourceStaticallyValidated === true
      && p3Evidence.decision?.sourceArtifactCreated === true
      && p3Evidence.decision?.sourcePersisted === false
      && p3Evidence.decision?.artifactPublished === false
      && p3Evidence.decision?.sourceExecuted === false
      && p3Evidence.decision?.executionRuntimeStarted === false
      && p3Evidence.decision?.nextRequiredSlice === 'M3-R2-P4'
      && Array.isArray(p3Evidence.decision?.repositoryBlockers)
      && p3Evidence.decision.repositoryBlockers.length === 0
      && Object.values(p3Evidence.safetyBoundary ?? {}).every((value) => value === false),
  'M3_R2_P3_EVIDENCE_NOT_ACCEPTED', 'M3-R2 P3 Evidence decision is not accepted');
  sourcePublicationInvariant(sourceArtifact?.persistence === 'IN_MEMORY_ONLY'
      && sourceArtifact?.published === false
      && sourceArtifact?.immutable === true
      && DIGEST.test(sourceArtifact?.artifactDigest)
      && sourceArtifact.artifactDigest === sha256(stripDigest(sourceArtifact, 'artifactDigest'))
      && validationSha256Utf8(sourceArtifact.source) === sourceArtifact.sourceDigest
      && Buffer.byteLength(sourceArtifact.source, 'utf8') === sourceArtifact.sourceByteLength
      && validationCountLines(sourceArtifact.source) === sourceArtifact.sourceLineCount,
  'K6_API_SOURCE_ARTIFACT_NOT_ACCEPTED', 'P3 Source Artifact is not accepted');
  sourcePublicationInvariant(DIGEST.test(validationEvidence?.evidenceDigest)
      && validationEvidence.evidenceDigest
        === sha256(stripDigest(validationEvidence, 'evidenceDigest'))
      && validationEvidence.artifactId === sourceArtifact.artifactId
      && validationEvidence.artifactDigest === sourceArtifact.artifactDigest
      && validationEvidence.sourceDigest === sourceArtifact.sourceDigest
      && validationEvidence.validationReportDigest
        === sourceArtifact.validationReport.reportDigest,
  'K6_API_SOURCE_VALIDATION_EVIDENCE_NOT_ACCEPTED',
  'P3 validation Evidence does not bind the Source Artifact');
  sourcePublicationInvariant(p3Evidence.sourceArtifact?.artifactId === sourceArtifact.artifactId
      && p3Evidence.sourceArtifact?.artifactDigest === sourceArtifact.artifactDigest
      && p3Evidence.sourceArtifact?.sourceDigest === sourceArtifact.sourceDigest
      && p3Evidence.sourceArtifact?.validationReportDigest
        === sourceArtifact.validationReport.reportDigest
      && p3Evidence.validationEvidence?.evidenceId === validationEvidence.evidenceId
      && p3Evidence.validationEvidence?.evidenceDigest === validationEvidence.evidenceDigest
      && p3Evidence.validationEvidence?.artifactDigest === sourceArtifact.artifactDigest,
  'M3_R2_P3_ARTIFACT_BINDING_MISMATCH',
  'M3-R2 P3 Evidence does not bind the exact Artifact and validation Evidence');
  sourcePublicationInvariant(acceptedP3.evidenceDigest === p3Evidence.evidenceDigest
      && acceptedP3.sourceArtifactDigest === sourceArtifact.artifactDigest
      && acceptedP3.validationEvidenceDigest === validationEvidence.evidenceDigest
      && acceptedP3.sourceDigest === sourceArtifact.sourceDigest,
  'M3_R2_P3_TRUST_ANCHOR_MISMATCH',
  'M3-R2 P3 objects do not match the independent accepted trust anchor');
}

function validateBundleIntegrity(bundle) {
  validationExactFields(bundle, BUNDLE_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_BUNDLE', 'Source publication bundle');
  validateManifestShape(bundle.manifest);
  validationExactFields(bundle.provenance, PROVENANCE_FIELDS,
    'INVALID_K6_API_SOURCE_PROVENANCE', 'Source publication provenance');
  sourcePublicationInvariant(bundle.schemaVersion === K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION
      && bundle.bundleKind === K6_API_SOURCE_PUBLICATION_BUNDLE_KIND
      && bundle.formatVersion === K6_API_SOURCE_PUBLICATION_FORMAT_VERSION
      && bundle.immutable === true && bundle.contentAddressed === true
      && DIGEST.test(bundle.bundleDigest)
      && computeK6ApiSourcePublicationBundleDigest(bundle) === bundle.bundleDigest,
  'K6_API_SOURCE_PUBLICATION_BUNDLE_DIGEST_MISMATCH',
  'Source publication bundle digest is invalid');
  sourcePublicationInvariant(bundle.manifest.manifestDigest
      === computeK6ApiSourcePublicationManifestDigest(bundle.manifest),
  'K6_API_SOURCE_PUBLICATION_MANIFEST_DIGEST_MISMATCH',
  'Source publication manifest digest is invalid');
  sourcePublicationInvariant(bundle.bundleId
      === `k6source-bundle-${bundle.manifest.manifestDigest.slice(0, 20)}`,
  'K6_API_SOURCE_PUBLICATION_BUNDLE_ID_MISMATCH', 'Source publication bundle ID is invalid');
  sourcePublicationInvariant(canonicalStringify(bundle.files.map(({ path }) => path))
      === canonicalStringify(FIXED_FILE_LAYOUT.map(({ path }) => path)),
  'K6_API_SOURCE_PUBLICATION_LAYOUT_CHANGED', 'Source publication file layout changed');
  for (let index = 0; index < bundle.files.length; index += 1) {
    const file = bundle.files[index];
    const entry = bundle.manifest.entries[index];
    validationExactFields(file, FILE_FIELDS,
      'INVALID_K6_API_SOURCE_PUBLICATION_FILE', 'Source publication file');
    sourcePublicationInvariant(file.path === entry.path
        && validationSha256Utf8(file.content) === entry.digest
        && Buffer.byteLength(file.content, 'utf8') === entry.byteLength,
    'K6_API_SOURCE_PUBLICATION_FILE_DIGEST_MISMATCH',
    'Source publication file does not match its manifest entry', { path: file.path });
  }
}

function validateManifestShape(manifest) {
  validationExactFields(manifest, MANIFEST_FIELDS,
    'INVALID_K6_API_SOURCE_PUBLICATION_MANIFEST', 'Source publication manifest');
  sourcePublicationInvariant(Array.isArray(manifest.entries)
      && manifest.entries.length === FIXED_FILE_LAYOUT.length,
  'INVALID_K6_API_SOURCE_PUBLICATION_MANIFEST', 'Source publication manifest entries are invalid');
  manifest.entries.forEach((entry, index) => {
    validationExactFields(entry, ENTRY_FIELDS,
      'INVALID_K6_API_SOURCE_PUBLICATION_ENTRY', 'Source publication manifest entry');
    const expected = FIXED_FILE_LAYOUT[index];
    sourcePublicationInvariant(entry.path === expected.path
        && entry.mediaType === expected.mediaType
        && entry.encoding === 'UTF-8'
        && DIGEST.test(entry.digest)
        && Number.isSafeInteger(entry.byteLength) && entry.byteLength > 0
        && !entry.path.startsWith('/') && !entry.path.includes('..')
        && !entry.path.includes('\\') && !entry.path.includes('\u0000'),
    'K6_API_SOURCE_PUBLICATION_LAYOUT_CHANGED',
    'Source publication manifest entry is not accepted', { path: entry.path });
  });
  sourcePublicationInvariant(manifest.schemaVersion
      === K6_API_SOURCE_PUBLICATION_MANIFEST_SCHEMA_VERSION
      && manifest.formatVersion === K6_API_SOURCE_PUBLICATION_FORMAT_VERSION
      && manifest.fileCount === manifest.entries.length
      && manifest.totalByteLength
        === manifest.entries.reduce((total, entry) => total + entry.byteLength, 0)
      && DIGEST.test(manifest.manifestDigest),
  'INVALID_K6_API_SOURCE_PUBLICATION_MANIFEST', 'Source publication manifest totals are invalid');
}

function stripDigest(value, field) {
  const cloned = cloneExecutionJson(value);
  delete cloned[field];
  return cloned;
}

function canonicalJsonFile(value) {
  return `${canonicalStringify(value)}\n`;
}
