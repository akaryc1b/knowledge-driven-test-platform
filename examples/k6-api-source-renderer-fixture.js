import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
} from '../packages/k6-api-adapter/src/constants.js';
import { computeK6ApiCompilationEvidenceDigest } from '../packages/k6-api-adapter/src/compiler.js';
import {
  createK6ApiSourceGenerationRequest,
  createK6ApiSourceGeneratorDescriptor,
} from '../packages/k6-api-adapter/src/source-contract.js';
import {
  ACCEPTED_COMPILER_DECISION,
  ACCEPTED_COMPILER_SAFETY_BOUNDARY,
  D,
  createRenderableSpecWithoutDigest,
} from './k6-api-source-renderer-fixture-data.js';

export * from './k6-api-source-renderer-fixture-data.js';

export function rendererBindings(options = {}) {
  const descriptor = options.descriptor ?? createK6ApiSourceGeneratorDescriptor();
  const specWithoutDigest = structuredClone(options.specWithoutDigest
    ?? createRenderableSpecWithoutDigest());
  options.transformSpec?.(specWithoutDigest);
  const spec = { ...specWithoutDigest, specDigest: sha256(specWithoutDigest) };

  const specArtifact = {
    artifactId: `artifact-${spec.specId}`,
    kind: 'k6-api-execution-spec',
    mediaType: 'application/vnd.kdtp.k6-api-execution-spec+json',
    digest: spec.specDigest,
    uri: `artifact://sha256/${spec.specDigest}`,
  };
  const artifactManifest = [...spec.inputArtifacts, specArtifact]
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  const bundleWithoutDigest = {
    schemaVersion: K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
    specId: spec.specId,
    specDigest: spec.specDigest,
    artifactManifest,
    bundleId: `k6bundle-${'c'.repeat(20)}`,
  };
  options.transformBundle?.(bundleWithoutDigest);
  const bundle = { ...bundleWithoutDigest, bundleDigest: sha256(bundleWithoutDigest) };

  const sourceIntentIds = spec.requestGroups.flatMap((group) =>
    group.operations.map((item) => item.sourceIntentId)).sort();
  const evidenceWithoutDigest = {
    schemaVersion: K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
    compilerVersion: spec.compilerVersion,
    inputContractDigest: spec.inputContractDigest,
    adapterDescriptorDigest: spec.adapter.descriptorDigest,
    executionRequestDigest: D('9'),
    testPlanDigest: spec.frozenTestPlan.contentDigest,
    knowledgeSnapshotDigest: spec.knowledgeSnapshot.digest,
    environmentDigest: spec.environment.digest,
    capabilityDigest: sha256(spec.capabilities),
    artifactManifestDigest: sha256(bundle.artifactManifest),
    specId: spec.specId,
    specDigest: spec.specDigest,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.bundleDigest,
    sourceIntentIds,
    evidenceId: `k6evidence-${'d'.repeat(20)}`,
    metadata: { compiledAt: '2026-07-31T01:06:00.000Z', compiledBy: 'm3-r2-p2-test' },
    decision: { ...ACCEPTED_COMPILER_DECISION, repositoryBlockers: [] },
    safetyBoundary: { ...ACCEPTED_COMPILER_SAFETY_BOUNDARY },
  };
  options.transformEvidence?.(evidenceWithoutDigest);
  const compilationEvidence = {
    ...evidenceWithoutDigest,
    evidenceDigest: computeK6ApiCompilationEvidenceDigest(evidenceWithoutDigest),
  };
  const generationRequest = createK6ApiSourceGenerationRequest({
    descriptor,
    spec,
    bundle,
    compilationEvidence,
    requestedAt: options.requestedAt ?? '2026-07-31T07:00:00.000Z',
    requestedBy: options.requestedBy ?? 'm3-r2-p2-test',
  });
  const result = { descriptor, generationRequest, spec, bundle, compilationEvidence };
  options.transformBoundInput?.(result);
  return result;
}

export function reverseObjectKeys(value) {
  if (Array.isArray(value)) return value.map(reverseObjectKeys);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).reverse()
    .map((key) => [key, reverseObjectKeys(value[key])]));
}
