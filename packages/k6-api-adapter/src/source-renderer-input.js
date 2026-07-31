import { cloneExecutionJson } from '@kdtp/execution-contract';
import { K6_API_SOURCE_ALLOWED_MODULES } from './constants.js';
import { sourceRendererInvariant } from './errors.js';
import {
  validateK6ApiSourceGenerationRequest,
  validateK6ApiSourceGeneratorDescriptor,
} from './source-contract.js';
import {
  RENDER_INPUT_FIELDS,
  capabilityKey,
  exactFields,
  validateDigestFields,
  validateSafeString,
} from './source-renderer-shared.js';
import {
  validateArtifact,
  validateDependencyGraph,
  validateGroup,
} from './source-renderer-operation-validation.js';
import { orderGroups } from './source-renderer-order.js';

const SPEC_FIELDS = Object.freeze([
  'schemaVersion', 'compilerVersion', 'inputContractDigest', 'projectId',
  'environment', 'frozenTestPlan', 'knowledgeSnapshot', 'adapter', 'capabilities',
  'requestGroups', 'inputArtifacts', 'specId', 'specDigest',
]);
const CAPABILITY_FIELDS = Object.freeze(['capabilityId', 'version']);

export function validateRendererInput(input) {
  exactFields(input, RENDER_INPUT_FIELDS, 'INVALID_K6_API_SOURCE_RENDER_INPUT',
    'Source render input');
  const descriptor = validateK6ApiSourceGeneratorDescriptor(input.descriptor);
  const generationRequest = validateK6ApiSourceGenerationRequest(input.generationRequest, {
    descriptor,
    spec: input.spec,
    bundle: input.bundle,
    compilationEvidence: input.compilationEvidence,
  });
  const spec = validateRenderableSpec(input.spec, descriptor.limits);
  const bundle = cloneExecutionJson(input.bundle);
  const compilationEvidence = cloneExecutionJson(input.compilationEvidence);
  sourceRendererInvariant(generationRequest.input.specDigest === spec.specDigest
      && generationRequest.input.bundleDigest === bundle.bundleDigest
      && generationRequest.input.compilationEvidenceDigest
        === compilationEvidence.evidenceDigest,
  'K6_API_SOURCE_RENDER_BINDING_MISMATCH',
  'Renderer inputs do not match the validated Source Generation Request');
  const groups = orderGroups(spec.requestGroups);
  const operations = groups.flatMap((group) => group.operations);
  return {
    descriptor,
    generationRequest,
    spec,
    bundle,
    compilationEvidence,
    groups,
    operations,
    assertionCount: operations.reduce((sum, operation) => sum + operation.assertions.length, 0),
    thresholdCount: operations.reduce((sum, operation) => sum + operation.thresholds.length, 0),
    moduleImports: [...K6_API_SOURCE_ALLOWED_MODULES],
  };
}

function validateRenderableSpec(input, limits) {
  const spec = cloneExecutionJson(input, '$.spec');
  exactFields(spec, SPEC_FIELDS, 'INVALID_K6_API_RENDERABLE_SPEC', 'Execution Spec');
  validateSafeString(spec.projectId, '$.spec.projectId', limits);
  exactFields(spec.environment, ['environmentId', 'version', 'digest'],
    'INVALID_K6_API_RENDERABLE_SPEC', 'Spec environment');
  exactFields(spec.frozenTestPlan,
    ['planId', 'revision', 'contentDigest', 'inputFingerprint'],
    'INVALID_K6_API_RENDERABLE_SPEC', 'Spec FROZEN Test Plan');
  exactFields(spec.knowledgeSnapshot, ['snapshotId', 'digest'],
    'INVALID_K6_API_RENDERABLE_SPEC', 'Spec Knowledge Snapshot');
  exactFields(spec.adapter, ['adapterId', 'adapterType', 'version', 'descriptorDigest'],
    'INVALID_K6_API_RENDERABLE_SPEC', 'Spec adapter');
  validateDigestFields([
    spec.inputContractDigest, spec.environment.digest,
    spec.frozenTestPlan.contentDigest, spec.frozenTestPlan.inputFingerprint,
    spec.knowledgeSnapshot.digest, spec.adapter.descriptorDigest, spec.specDigest,
  ]);
  sourceRendererInvariant(spec.adapter.adapterType === 'k6-api',
    'K6_API_SOURCE_ADAPTER_MISMATCH', 'Renderer requires adapterType=k6-api');
  sourceRendererInvariant(Array.isArray(spec.capabilities) && spec.capabilities.length > 0,
    'INVALID_K6_API_RENDERABLE_SPEC', 'Spec capabilities must be a non-empty array');
  for (const capability of spec.capabilities) {
    exactFields(capability, CAPABILITY_FIELDS, 'INVALID_K6_API_RENDERABLE_SPEC',
      'Spec capability');
    validateSafeString(capability.capabilityId, '$.spec.capabilities.capabilityId', limits);
    validateSafeString(capability.version, '$.spec.capabilities.version', limits);
  }
  sourceRendererInvariant(Array.isArray(spec.requestGroups)
      && spec.requestGroups.length > 0
      && spec.requestGroups.length <= limits.maxRequestGroups,
  'K6_API_SOURCE_INVALID_GROUP_COUNT', 'Spec request group count is invalid');
  const state = {
    groups: new Set(), operations: new Set(), intents: new Set(),
    assertions: new Set(), thresholds: new Set(),
  };
  let totalOperations = 0;
  for (const group of spec.requestGroups) {
    validateGroup(group, limits, state);
    totalOperations += group.operations.length;
  }
  sourceRendererInvariant(totalOperations > 0 && totalOperations <= limits.maxOperations,
    'K6_API_SOURCE_INVALID_OPERATION_COUNT', 'Spec operation count is invalid');
  validateDependencyGraph(spec.requestGroups, state.operations);
  sourceRendererInvariant(Array.isArray(spec.inputArtifacts)
      && spec.inputArtifacts.length <= limits.maxArtifactManifestEntries,
  'INVALID_K6_API_RENDERABLE_SPEC', 'Spec inputArtifacts must be a bounded array');
  const inputArtifacts = new Map();
  for (const artifact of spec.inputArtifacts) {
    validateArtifact(artifact, limits);
    sourceRendererInvariant(!inputArtifacts.has(artifact.artifactId),
      'INVALID_K6_API_RENDERABLE_ARTIFACT', 'Spec input Artifact IDs must be unique');
    inputArtifacts.set(artifact.artifactId, artifact);
  }
  const capabilities = new Set(spec.capabilities.map(capabilityKey));
  for (const group of spec.requestGroups) {
    for (const operation of group.operations) {
      sourceRendererInvariant(capabilities.has(capabilityKey(operation.capability)),
        'K6_API_SOURCE_CAPABILITY_BINDING_MISMATCH',
        'Operation capability is not bound by the accepted Spec capability set');
      if (operation.requestBodyArtifact !== null) {
        const bound = inputArtifacts.get(operation.requestBodyArtifact.artifactId);
        sourceRendererInvariant(bound
            && bound.digest === operation.requestBodyArtifact.digest
            && bound.uri === operation.requestBodyArtifact.uri
            && bound.mediaType === operation.requestBodyArtifact.mediaType,
        'K6_API_SOURCE_BODY_ARTIFACT_BINDING_MISMATCH',
        'Request body Artifact reference is not bound by the accepted Spec');
      }
    }
  }
  return spec;
}
