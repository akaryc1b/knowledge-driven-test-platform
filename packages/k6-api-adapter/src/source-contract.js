import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  cloneExecutionJson,
  validateDigest,
  validateNonEmptyString,
  validateSemver,
  validateUtcTimestamp,
} from '@kdtp/execution-contract';
import {
  K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_COMPILER_VERSION,
  K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
  K6_API_SOURCE_ALLOWED_MODULES,
  K6_API_SOURCE_FORMAT_VERSION,
  K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
  K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
  K6_API_SOURCE_GENERATOR_ID,
  K6_API_SOURCE_GENERATOR_VERSION,
  K6_API_SOURCE_IDENTITY_EXCLUDED_FIELDS,
  K6_API_SOURCE_IMPLEMENTATION_STATUS,
  K6_API_SOURCE_LIMITS,
  K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
  K6_API_SOURCE_UNORDERED_SET_FIELDS,
} from './constants.js';
import { computeK6ApiCompilationEvidenceDigest } from './compiler.js';
import { sourceContractInvariant } from './errors.js';
import { assertK6ApiCompilationSafe } from './safety.js';
import { exactFields } from './validation.js';

const ACCEPTED_COMPILER_DECISION = Object.freeze({
  apiAdapterCompilerReady: true,
  executionRuntimeStarted: false,
  k6Invoked: false,
  externalProcessExecuted: false,
  nextRequiredSlice: 'M3-R2',
  repositoryBlockers: Object.freeze([]),
});

export function createK6ApiSourceRenderingPolicy() {
  const policyWithoutDigest = {
    schemaVersion: K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
    encoding: 'UTF-8',
    bom: false,
    lineEnding: 'LF',
    indentationSpaces: 2,
    quoteStyle: 'SINGLE',
    trailingNewline: true,
    objectKeyOrdering: 'LEXICOGRAPHIC',
    moduleOrdering: 'LEXICOGRAPHIC',
    groupOrdering: 'GROUP_ID',
    operationOrdering: 'DEPENDENCY_THEN_OPERATION_ID',
    assertionOrdering: 'KIND_PATH_EXPECTED',
    thresholdOrdering: 'METRIC_OPERATOR_VALUE',
    unorderedSetFields: [...K6_API_SOURCE_UNORDERED_SET_FIELDS],
    variableNameDerivation: 'IMMUTABLE_ID_SHA256_12',
    identityExcludedFields: [...K6_API_SOURCE_IDENTITY_EXCLUDED_FIELDS],
  };
  return cloneExecutionJson({
    ...policyWithoutDigest,
    policyDigest: sha256(policyWithoutDigest),
  });
}

export function validateK6ApiSourceRenderingPolicy(input) {
  exactFields(input, [
    'schemaVersion', 'encoding', 'bom', 'lineEnding', 'indentationSpaces',
    'quoteStyle', 'trailingNewline', 'objectKeyOrdering', 'moduleOrdering',
    'groupOrdering', 'operationOrdering', 'assertionOrdering', 'thresholdOrdering',
    'unorderedSetFields', 'variableNameDerivation', 'identityExcludedFields',
    'policyDigest',
  ], 'INVALID_K6_API_SOURCE_RENDERING_POLICY', 'Source rendering policy');
  const expected = createK6ApiSourceRenderingPolicy();
  sourceContractInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_SOURCE_RENDERING_POLICY_MISMATCH',
    'Source rendering policy does not match the versioned canonical policy');
  return expected;
}

export function createK6ApiSourceGeneratorDescriptor() {
  const renderingPolicy = createK6ApiSourceRenderingPolicy();
  const limits = cloneExecutionJson(K6_API_SOURCE_LIMITS);
  const allowedModules = [...K6_API_SOURCE_ALLOWED_MODULES];
  const generatorConfigurationDigest = sha256({
    sourceFormatVersion: K6_API_SOURCE_FORMAT_VERSION,
    allowedModules,
    renderingPolicyDigest: renderingPolicy.policyDigest,
    limits,
  });
  const descriptorWithoutDigest = {
    schemaVersion: K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
    generatorId: K6_API_SOURCE_GENERATOR_ID,
    generatorVersion: K6_API_SOURCE_GENERATOR_VERSION,
    implementationStatus: K6_API_SOURCE_IMPLEMENTATION_STATUS,
    sourceFormatVersion: K6_API_SOURCE_FORMAT_VERSION,
    allowedModules,
    renderingPolicy,
    limits,
    generatorConfigurationDigest,
  };
  return cloneExecutionJson({
    ...descriptorWithoutDigest,
    descriptorDigest: sha256(descriptorWithoutDigest),
  });
}

export function validateK6ApiSourceGeneratorDescriptor(input) {
  exactFields(input, [
    'schemaVersion', 'generatorId', 'generatorVersion', 'implementationStatus',
    'sourceFormatVersion', 'allowedModules', 'renderingPolicy', 'limits',
    'generatorConfigurationDigest', 'descriptorDigest',
  ], 'INVALID_K6_API_SOURCE_GENERATOR_DESCRIPTOR', 'Source generator descriptor');
  const expected = createK6ApiSourceGeneratorDescriptor();
  sourceContractInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_SOURCE_GENERATOR_DESCRIPTOR_MISMATCH',
    'Source generator descriptor attempts to change the fixed P1 contract');
  return expected;
}

export function createK6ApiSourceGenerationRequest(command) {
  exactFields(command, [
    'descriptor', 'spec', 'bundle', 'compilationEvidence', 'requestedAt', 'requestedBy',
  ], 'INVALID_K6_API_SOURCE_GENERATION_COMMAND', 'Source generation command');
  assertK6ApiCompilationSafe(command, '$.sourceGenerationCommand');

  const descriptor = validateK6ApiSourceGeneratorDescriptor(command.descriptor);
  const bindings = validateCompilationBindings({
    spec: command.spec,
    bundle: command.bundle,
    compilationEvidence: command.compilationEvidence,
    limits: descriptor.limits,
  });
  const requestedAt = validateUtcTimestamp(command.requestedAt, 'requestedAt');
  const requestedBy = validateNonEmptyString(command.requestedBy, 'requestedBy', 256);

  const input = {
    compilerVersion: bindings.spec.compilerVersion,
    inputContractDigest: bindings.spec.inputContractDigest,
    specId: bindings.spec.specId,
    specDigest: bindings.spec.specDigest,
    bundleId: bindings.bundle.bundleId,
    bundleDigest: bindings.bundle.bundleDigest,
    compilationEvidenceId: bindings.compilationEvidence.evidenceId,
    compilationEvidenceDigest: bindings.compilationEvidence.evidenceDigest,
    projectId: bindings.spec.projectId,
    environmentDigest: bindings.spec.environment.digest,
    testPlanDigest: bindings.spec.frozenTestPlan.contentDigest,
    knowledgeSnapshotDigest: bindings.spec.knowledgeSnapshot.digest,
    capabilityDigest: bindings.compilationEvidence.capabilityDigest,
    artifactManifestDigest: bindings.compilationEvidence.artifactManifestDigest,
    sourceIntentIds: [...bindings.compilationEvidence.sourceIntentIds],
  };
  const generator = {
    generatorId: descriptor.generatorId,
    generatorVersion: descriptor.generatorVersion,
    generatorConfigurationDigest: descriptor.generatorConfigurationDigest,
    descriptorDigest: descriptor.descriptorDigest,
  };
  const sourceIdentityWithoutDigest = {
    generatorId: descriptor.generatorId,
    generatorVersion: descriptor.generatorVersion,
    generatorConfigurationDigest: descriptor.generatorConfigurationDigest,
    specDigest: bindings.spec.specDigest,
    bundleDigest: bindings.bundle.bundleDigest,
    compilationEvidenceDigest: bindings.compilationEvidence.evidenceDigest,
    sourceFormatVersion: descriptor.sourceFormatVersion,
    canonicalRenderingPolicyDigest: descriptor.renderingPolicy.policyDigest,
    allowedModulesDigest: sha256(descriptor.allowedModules),
  };
  const sourceIdentity = {
    ...sourceIdentityWithoutDigest,
    identityDigest: sha256(sourceIdentityWithoutDigest),
  };
  const requestId = `k6source-request-${sha256(sourceIdentity).slice(0, 20)}`;
  const requestWithoutDigest = {
    schemaVersion: K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
    requestId,
    generator,
    input,
    sourceIdentity,
    metadata: { requestedAt, requestedBy },
  };
  const request = {
    ...requestWithoutDigest,
    requestDigest: sha256(requestWithoutDigest),
  };
  assertK6ApiCompilationSafe(request, '$.sourceGenerationRequest');
  return cloneExecutionJson(request);
}

export function validateK6ApiSourceGenerationRequest(input, bindings) {
  exactFields(input, [
    'schemaVersion', 'requestId', 'generator', 'input', 'sourceIdentity',
    'metadata', 'requestDigest',
  ], 'INVALID_K6_API_SOURCE_GENERATION_REQUEST', 'Source generation request');
  exactFields(bindings, ['descriptor', 'spec', 'bundle', 'compilationEvidence'],
    'INVALID_K6_API_SOURCE_GENERATION_BINDINGS', 'Source generation bindings');
  exactFields(input.metadata, ['requestedAt', 'requestedBy'],
    'INVALID_K6_API_SOURCE_GENERATION_REQUEST', 'Source generation request metadata');
  const expected = createK6ApiSourceGenerationRequest({
    ...bindings,
    requestedAt: input.metadata.requestedAt,
    requestedBy: input.metadata.requestedBy,
  });
  sourceContractInvariant(canonicalStringify(input) === canonicalStringify(expected),
    'K6_API_SOURCE_GENERATION_REQUEST_MISMATCH',
    'Source generation request does not match its immutable compilation bindings');
  return expected;
}

export function computeK6ApiSourceGenerationRequestDigest(request) {
  exactFields(request, [
    'schemaVersion', 'requestId', 'generator', 'input', 'sourceIdentity',
    'metadata', 'requestDigest',
  ], 'INVALID_K6_API_SOURCE_GENERATION_REQUEST', 'Source generation request');
  const { requestDigest: _requestDigest, ...withoutDigest } = request;
  return sha256(withoutDigest);
}

export function canonicalStringifyK6ApiSourceContract(value) {
  return canonicalStringify(value);
}

function validateCompilationBindings({ spec: specInput, bundle: bundleInput,
  compilationEvidence: evidenceInput, limits }) {
  const spec = cloneExecutionJson(specInput, '$.spec');
  const bundle = cloneExecutionJson(bundleInput, '$.bundle');
  const compilationEvidence = cloneExecutionJson(evidenceInput, '$.compilationEvidence');

  sourceContractInvariant(spec.schemaVersion === K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    'K6_API_SOURCE_SPEC_SCHEMA_MISMATCH', 'Source generation requires the accepted Spec schema');
  sourceContractInvariant(bundle.schemaVersion === K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
    'K6_API_SOURCE_BUNDLE_SCHEMA_MISMATCH',
    'Source generation requires the accepted Bundle schema');
  sourceContractInvariant(
    compilationEvidence.schemaVersion === K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
    'K6_API_SOURCE_COMPILATION_EVIDENCE_SCHEMA_MISMATCH',
    'Source generation requires the accepted Compilation Evidence schema');
  sourceContractInvariant(validateSemver(spec.compilerVersion, 'spec.compilerVersion')
      === K6_API_COMPILER_VERSION,
  'K6_API_SOURCE_COMPILER_VERSION_MISMATCH',
  'Source generation requires the accepted compiler version');

  validateDigest(spec.specDigest, 'spec.specDigest');
  const { specDigest, ...specWithoutDigest } = spec;
  sourceContractInvariant(sha256(specWithoutDigest) === specDigest,
    'K6_API_SOURCE_SPEC_DIGEST_MISMATCH', 'Spec digest is invalid');

  validateDigest(bundle.bundleDigest, 'bundle.bundleDigest');
  const { bundleDigest, ...bundleWithoutDigest } = bundle;
  sourceContractInvariant(sha256(bundleWithoutDigest) === bundleDigest,
    'K6_API_SOURCE_BUNDLE_DIGEST_MISMATCH', 'Bundle digest is invalid');

  validateDigest(compilationEvidence.evidenceDigest,
    'compilationEvidence.evidenceDigest');
  sourceContractInvariant(
    computeK6ApiCompilationEvidenceDigest(compilationEvidence)
      === compilationEvidence.evidenceDigest,
    'K6_API_SOURCE_COMPILATION_EVIDENCE_DIGEST_MISMATCH',
    'Compilation Evidence digest is invalid');

  sourceContractInvariant(bundle.specId === spec.specId
      && bundle.specDigest === spec.specDigest,
  'K6_API_SOURCE_SPEC_BUNDLE_BINDING_MISMATCH',
  'Bundle does not bind the exact accepted Spec');
  sourceContractInvariant(compilationEvidence.specId === spec.specId
      && compilationEvidence.specDigest === spec.specDigest
      && compilationEvidence.bundleId === bundle.bundleId
      && compilationEvidence.bundleDigest === bundle.bundleDigest,
  'K6_API_SOURCE_COMPILATION_BINDING_MISMATCH',
  'Compilation Evidence does not bind the exact Spec and Bundle');
  sourceContractInvariant(compilationEvidence.compilerVersion === spec.compilerVersion
      && compilationEvidence.inputContractDigest === spec.inputContractDigest
      && compilationEvidence.testPlanDigest === spec.frozenTestPlan.contentDigest
      && compilationEvidence.knowledgeSnapshotDigest === spec.knowledgeSnapshot.digest
      && compilationEvidence.environmentDigest === spec.environment.digest
      && compilationEvidence.capabilityDigest === sha256(spec.capabilities)
      && compilationEvidence.artifactManifestDigest === sha256(bundle.artifactManifest),
  'K6_API_SOURCE_CONTEXT_BINDING_MISMATCH',
  'Compilation Evidence context does not match the accepted Spec and Bundle');
  const sourceIntentIds = spec.requestGroups
    .flatMap((group) => group.operations.map((operation) => operation.sourceIntentId))
    .sort();
  sourceContractInvariant(
    canonicalStringify(compilationEvidence.sourceIntentIds)
      === canonicalStringify(sourceIntentIds),
    'K6_API_SOURCE_INTENT_BINDING_MISMATCH',
    'Compilation Evidence source intents do not match the accepted Spec');
  sourceContractInvariant(
    canonicalStringify(compilationEvidence.decision)
      === canonicalStringify(ACCEPTED_COMPILER_DECISION),
    'K6_API_SOURCE_COMPILER_DECISION_NOT_ACCEPTED',
    'Compilation Evidence decision is not accepted for P1');
  sourceContractInvariant(
    Object.values(compilationEvidence.safetyBoundary ?? {})
      .every((value) => value === false),
    'K6_API_SOURCE_COMPILER_SAFETY_BOUNDARY_CHANGED',
    'Compilation Evidence safety boundary changed');

  validateBounds(spec, bundle, limits);
  assertK6ApiCompilationSafe({ spec, bundle, evidence: compilationEvidence },
    '$.sourceGenerationBindings');
  return { spec, bundle, compilationEvidence };
}

function validateBounds(spec, bundle, limits) {
  sourceContractInvariant(
    Buffer.byteLength(canonicalStringify(spec), 'utf8') <= limits.maxSerializedSpecBytes,
    'K6_API_SOURCE_SPEC_TOO_LARGE', 'Spec exceeds the P1 serialized-byte limit');
  sourceContractInvariant(spec.requestGroups.length <= limits.maxRequestGroups,
    'K6_API_SOURCE_TOO_MANY_GROUPS', 'Spec exceeds the P1 request-group limit');
  const operations = spec.requestGroups.flatMap((group) => group.operations);
  sourceContractInvariant(operations.length <= limits.maxOperations,
    'K6_API_SOURCE_TOO_MANY_OPERATIONS', 'Spec exceeds the P1 operation limit');
  for (const operation of operations) {
    sourceContractInvariant(operation.assertions.length <= limits.maxAssertionsPerOperation,
      'K6_API_SOURCE_TOO_MANY_ASSERTIONS',
      'Operation exceeds the P1 assertion limit', { operationId: operation.operationId });
    sourceContractInvariant(operation.thresholds.length <= limits.maxThresholdsPerOperation,
      'K6_API_SOURCE_TOO_MANY_THRESHOLDS',
      'Operation exceeds the P1 threshold limit', { operationId: operation.operationId });
  }
  sourceContractInvariant(bundle.artifactManifest.length
      <= limits.maxArtifactManifestEntries,
  'K6_API_SOURCE_TOO_MANY_ARTIFACTS', 'Bundle exceeds the P1 Artifact limit');
  assertBoundedJson(spec, '$.spec', 0, limits);
  assertBoundedJson(bundle, '$.bundle', 0, limits);
}

function assertBoundedJson(value, path, depth, limits) {
  sourceContractInvariant(depth <= limits.maxNestingDepth,
    'K6_API_SOURCE_MAX_DEPTH_EXCEEDED', 'P1 contract nesting limit exceeded', { path });
  if (typeof value === 'string') {
    sourceContractInvariant(Buffer.byteLength(value, 'utf8') <= limits.maxStringBytes,
      'K6_API_SOURCE_STRING_TOO_LARGE', 'P1 contract string limit exceeded', { path });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) =>
      assertBoundedJson(item, `${path}[${index}]`, depth + 1, limits));
    return;
  }
  if (!value || typeof value !== 'object') return;
  for (const [key, item] of Object.entries(value)) {
    assertBoundedJson(item, `${path}.${key}`, depth + 1, limits);
  }
}
