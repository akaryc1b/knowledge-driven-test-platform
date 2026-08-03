import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { cloneExecutionJson } from '@kdtp/execution-contract';
import {
  K6_API_SOURCE_ARTIFACT_KIND,
  K6_API_SOURCE_ARTIFACT_MEDIA_TYPE,
  K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION,
  K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_SOURCE_STATIC_VALIDATOR_ID,
  K6_API_SOURCE_STATIC_VALIDATOR_VERSION,
} from './constants.js';
import { sourceValidationInvariant } from './errors.js';
import {
  DIGEST,
  validationDeepFreeze,
  validationExactFields,
} from './source-validation-shared.js';
import {
  K6_API_SOURCE_STATIC_CHECK_IDS,
  computeK6ApiSourceStaticValidationReportDigest,
  validateK6ApiSourceStatically,
} from './source-static-validator.js';

const P2_EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'generatedAt', 'source', 'acceptedFoundation', 'fixedDigests',
  'sourceResult', 'decision', 'safetyBoundary', 'evidenceDigest',
]);
const P2_DECISION_FIELDS = Object.freeze([
  'sourceGenerationContractReady', 'deterministicSourceRendererReady',
  'sourceGenerationStarted', 'sourceGenerated', 'sourceExecuted',
  'executionRuntimeStarted', 'nextRequiredSlice', 'repositoryBlockers',
]);
const P2_SAFETY_FIELDS = Object.freeze([
  'k6Invoked', 'xk6Invoked', 'playwrightInvoked', 'externalProcessExecuted',
  'nodeVmUsed', 'evalUsed', 'dynamicImportUsed', 'targetNetworkAccessed',
  'databaseAccessed', 'secretAccessed', 'filesystemCredentialAccessed',
  'temporaryExecutionDirectoryCreated', 'containerStarted',
  'kubernetesResourceCreated', 'workerAdded', 'queueAdded', 'schedulerAdded',
  'runtimeResultCollected', 'allureImplemented',
]);
const P2_SOURCE_RESULT_FIELDS = Object.freeze([
  'sourceIdentity', 'sourceDigest', 'sourceByteLength', 'sourceLineCount',
  'operationCount', 'assertionCount', 'thresholdCount', 'renderingPolicyDigest',
  'generatorDescriptorDigest', 'generationRequestDigest',
  'sourceResultSchemaCatalogDigest', 'resultDigest',
]);
const ARTIFACT_FIELDS = Object.freeze([
  'schemaVersion', 'artifactId', 'artifactKind', 'mediaType', 'encoding',
  'lineEnding', 'immutable', 'persistence', 'published', 'sourceIdentity',
  'sourceDigest', 'sourceByteLength', 'sourceLineCount', 'moduleImports',
  'provenance', 'validationReport', 'safetyBoundary', 'source', 'artifactDigest',
]);
const PROVENANCE_FIELDS = Object.freeze([
  'sourceResultDigest', 'generationRequestDigest', 'renderingPolicyDigest',
  'generatorDescriptorDigest', 'specDigest', 'bundleDigest',
  'compilationEvidenceDigest', 'p2EvidenceDigest',
]);
const EVIDENCE_FIELDS = Object.freeze([
  'schemaVersion', 'evidenceId', 'validator', 'artifactId', 'artifactDigest',
  'sourceIdentity', 'sourceDigest', 'p2EvidenceDigest', 'validationReportDigest',
  'decision', 'safetyBoundary', 'evidenceDigest',
]);

export const K6_API_SOURCE_ARTIFACT_SAFETY_BOUNDARY = Object.freeze({
  sourceArtifactCreated: true,
  sourcePersisted: false,
  artifactPublished: false,
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

export const K6_API_SOURCE_VALIDATION_DECISION = Object.freeze({
  independentStaticValidatorReady: true,
  sourceArtifactContractReady: true,
  sourceGenerated: true,
  sourceStaticallyValidated: true,
  sourceArtifactCreated: true,
  sourcePersisted: false,
  artifactPublished: false,
  sourceExecuted: false,
  executionRuntimeStarted: false,
  nextRequiredSlice: 'M3-R2-P4',
  repositoryBlockers: Object.freeze([]),
});

export function createK6ApiSourceArtifact({ sourceResult, p2Evidence }) {
  const validatedP2 = validateP2Evidence(p2Evidence, sourceResult);
  const validationReport = validateK6ApiSourceStatically(sourceResult);
  const provenance = {
    sourceResultDigest: sourceResult.resultDigest,
    generationRequestDigest: sourceResult.generationRequestDigest,
    renderingPolicyDigest: sourceResult.renderingPolicyDigest,
    generatorDescriptorDigest: sourceResult.generatorDescriptorDigest,
    specDigest: sourceResult.specDigest,
    bundleDigest: sourceResult.bundleDigest,
    compilationEvidenceDigest: sourceResult.compilationEvidenceDigest,
    p2EvidenceDigest: validatedP2.evidenceDigest,
  };
  const artifactWithoutDigest = {
    schemaVersion: K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION,
    artifactId: `k6source-artifact-${sourceResult.sourceDigest.slice(0, 20)}`,
    artifactKind: K6_API_SOURCE_ARTIFACT_KIND,
    mediaType: K6_API_SOURCE_ARTIFACT_MEDIA_TYPE,
    encoding: 'UTF-8',
    lineEnding: 'LF',
    immutable: true,
    persistence: 'IN_MEMORY_ONLY',
    published: false,
    sourceIdentity: cloneExecutionJson(sourceResult.sourceIdentity),
    sourceDigest: sourceResult.sourceDigest,
    sourceByteLength: sourceResult.sourceByteLength,
    sourceLineCount: sourceResult.sourceLineCount,
    moduleImports: [...sourceResult.moduleImports],
    provenance,
    validationReport: cloneExecutionJson(validationReport),
    safetyBoundary: { ...K6_API_SOURCE_ARTIFACT_SAFETY_BOUNDARY },
    source: sourceResult.source,
  };
  return validationDeepFreeze(cloneExecutionJson({
    ...artifactWithoutDigest,
    artifactDigest: sha256(artifactWithoutDigest),
  }));
}

export function validateK6ApiSourceArtifact(artifact, { sourceResult, p2Evidence }) {
  validationExactFields(artifact, ARTIFACT_FIELDS, 'INVALID_K6_API_SOURCE_ARTIFACT', 'Source Artifact');
  const expected = createK6ApiSourceArtifact({ sourceResult, p2Evidence });
  sourceValidationInvariant(canonicalStringify(artifact) === canonicalStringify(expected),
    'K6_API_SOURCE_ARTIFACT_MISMATCH',
    'Source Artifact does not match its immutable Source Result and P2 evidence');
  return expected;
}

export function computeK6ApiSourceArtifactDigest(artifact) {
  validationExactFields(artifact, ARTIFACT_FIELDS, 'INVALID_K6_API_SOURCE_ARTIFACT', 'Source Artifact');
  const { artifactDigest: _artifactDigest, ...withoutDigest } = artifact;
  return sha256(withoutDigest);
}

export function createK6ApiSourceValidationEvidence({ sourceArtifact, sourceResult, p2Evidence }) {
  const artifact = validateK6ApiSourceArtifact(sourceArtifact, { sourceResult, p2Evidence });
  const evidenceWithoutDigest = {
    schemaVersion: K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION,
    evidenceId: `k6source-validation-${artifact.artifactDigest.slice(0, 20)}`,
    validator: {
      validatorId: K6_API_SOURCE_STATIC_VALIDATOR_ID,
      validatorVersion: K6_API_SOURCE_STATIC_VALIDATOR_VERSION,
      checkIds: [...K6_API_SOURCE_STATIC_CHECK_IDS],
    },
    artifactId: artifact.artifactId,
    artifactDigest: artifact.artifactDigest,
    sourceIdentity: artifact.sourceIdentity.identityDigest,
    sourceDigest: artifact.sourceDigest,
    p2EvidenceDigest: artifact.provenance.p2EvidenceDigest,
    validationReportDigest: artifact.validationReport.reportDigest,
    decision: cloneExecutionJson(K6_API_SOURCE_VALIDATION_DECISION),
    safetyBoundary: { ...K6_API_SOURCE_ARTIFACT_SAFETY_BOUNDARY },
  };
  return validationDeepFreeze(cloneExecutionJson({
    ...evidenceWithoutDigest,
    evidenceDigest: sha256(evidenceWithoutDigest),
  }));
}

export function validateK6ApiSourceValidationEvidence(evidence, bindings) {
  validationExactFields(evidence, EVIDENCE_FIELDS,
    'INVALID_K6_API_SOURCE_VALIDATION_EVIDENCE', 'Source validation evidence');
  const expected = createK6ApiSourceValidationEvidence(bindings);
  sourceValidationInvariant(canonicalStringify(evidence) === canonicalStringify(expected),
    'K6_API_SOURCE_VALIDATION_EVIDENCE_MISMATCH',
    'Source validation evidence does not match the immutable Artifact binding');
  return expected;
}

export function computeK6ApiSourceValidationEvidenceDigest(evidence) {
  validationExactFields(evidence, EVIDENCE_FIELDS,
    'INVALID_K6_API_SOURCE_VALIDATION_EVIDENCE', 'Source validation evidence');
  const { evidenceDigest: _evidenceDigest, ...withoutDigest } = evidence;
  return sha256(withoutDigest);
}

function validateP2Evidence(p2Evidence, sourceResult) {
  validationExactFields(p2Evidence, P2_EVIDENCE_FIELDS,
    'INVALID_M3_R2_P2_EVIDENCE', 'M3-R2 P2 Evidence');
  validationExactFields(p2Evidence.sourceResult, P2_SOURCE_RESULT_FIELDS,
    'INVALID_M3_R2_P2_EVIDENCE', 'M3-R2 P2 Source Result evidence');
  validationExactFields(p2Evidence.decision, P2_DECISION_FIELDS,
    'INVALID_M3_R2_P2_EVIDENCE', 'M3-R2 P2 decision');
  validationExactFields(p2Evidence.safetyBoundary, P2_SAFETY_FIELDS,
    'INVALID_M3_R2_P2_EVIDENCE', 'M3-R2 P2 safety boundary');
  const { evidenceDigest, ...withoutDigest } = p2Evidence;
  sourceValidationInvariant(typeof evidenceDigest === 'string' && DIGEST.test(evidenceDigest)
      && sha256(withoutDigest) === evidenceDigest,
  'M3_R2_P2_EVIDENCE_DIGEST_MISMATCH', 'M3-R2 P2 Evidence digest is invalid');
  sourceValidationInvariant(p2Evidence.schemaVersion === 'm3-r2-source-generation-p2-evidence/v1'
      && p2Evidence.decision?.sourceGenerationContractReady === true
      && p2Evidence.decision?.deterministicSourceRendererReady === true
      && p2Evidence.decision?.sourceGenerated === true
      && p2Evidence.decision?.sourceExecuted === false
      && p2Evidence.decision?.executionRuntimeStarted === false
      && p2Evidence.decision?.nextRequiredSlice === 'M3-R2-P3'
      && Array.isArray(p2Evidence.decision?.repositoryBlockers)
      && p2Evidence.decision.repositoryBlockers.length === 0
      && Object.values(p2Evidence.safetyBoundary).every((value) => value === false),
  'M3_R2_P2_EVIDENCE_NOT_ACCEPTED', 'M3-R2 P2 Evidence decision is not accepted');
  sourceValidationInvariant(p2Evidence.sourceResult.sourceIdentity
      === sourceResult.sourceIdentity.identityDigest
      && p2Evidence.sourceResult.sourceDigest === sourceResult.sourceDigest
      && p2Evidence.sourceResult.sourceByteLength === sourceResult.sourceByteLength
      && p2Evidence.sourceResult.sourceLineCount === sourceResult.sourceLineCount
      && p2Evidence.sourceResult.operationCount === sourceResult.operationCount
      && p2Evidence.sourceResult.assertionCount === sourceResult.assertionCount
      && p2Evidence.sourceResult.thresholdCount === sourceResult.thresholdCount
      && p2Evidence.sourceResult.renderingPolicyDigest === sourceResult.renderingPolicyDigest
      && p2Evidence.sourceResult.generatorDescriptorDigest === sourceResult.generatorDescriptorDigest
      && p2Evidence.sourceResult.generationRequestDigest === sourceResult.generationRequestDigest
      && p2Evidence.sourceResult.resultDigest === sourceResult.resultDigest,
  'M3_R2_P2_SOURCE_RESULT_BINDING_MISMATCH',
  'M3-R2 P2 Evidence does not bind the exact Source Result');
  return p2Evidence;
}
