import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  cloneExecutionJson,
  validateExecutionAdapterDescriptor,
  validateExecutionRequest,
  validateNonEmptyString,
  validateSemver,
  validateUtcTimestamp,
} from '@kdtp/execution-contract';
import { validatePlanRecord } from '@kdtp/test-plan-registry';
import {
  K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_COMPILER_VERSION,
  K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
} from './constants.js';
import { compilerInvariant } from './errors.js';
import { assertK6ApiCompilationSafe } from './safety.js';
import { validateCompilerBindings, compareCapability, exactFields } from './validation.js';
import { normalizeIntent, createRequestGroups } from './mapping.js';

export function compileK6ApiExecutionSpec(input) {
  compilerInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_K6_API_COMPILER_INPUT', 'Compiler input must be an object');
  exactFields(input, [
    'descriptor', 'executionRequest', 'frozenTestPlan', 'compilerVersion',
    'compiledAt', 'compiledBy',
  ], 'INVALID_K6_API_COMPILER_INPUT', 'Compiler input');
  assertK6ApiCompilationSafe(input, '$.compilerInput');

  const descriptor = validateExecutionAdapterDescriptor(input.descriptor);
  compilerInvariant(descriptor.adapterType === 'k6-api', 'K6_API_ADAPTER_REQUIRED',
    'Compiler requires adapterType=k6-api');
  const executionRequest = validateExecutionRequest(input.executionRequest, descriptor);
  const frozenTestPlan = validatePlanRecord(input.frozenTestPlan);
  const compilerVersion = validateSemver(input.compilerVersion, 'compilerVersion');
  compilerInvariant(compilerVersion === K6_API_COMPILER_VERSION,
    'K6_API_COMPILER_VERSION_MISMATCH', 'Compiler version is unsupported');
  const compiledAt = validateUtcTimestamp(input.compiledAt, 'compiledAt');
  const compiledBy = validateNonEmptyString(input.compiledBy, 'compiledBy', 256);

  validateCompilerBindings(descriptor, executionRequest, frozenTestPlan);
  const capabilities = executionRequest.requestedCapabilities
    .map((value) => ({ ...value })).sort(compareCapability);
  const capabilityDigest = sha256(capabilities);
  const inputContractDigest = sha256({
    adapterDescriptorDigest: descriptor.descriptorDigest,
    executionRequestDigest: executionRequest.requestDigest,
    testPlanDigest: frozenTestPlan.contentDigest,
    knowledgeSnapshotDigest: frozenTestPlan.knowledgeSnapshot.digest,
    environmentDigest: executionRequest.environment.digest,
    capabilityDigest,
    compilerVersion,
  });

  const intents = frozenTestPlan.planningResult.plan.intents
    .map((intent) => normalizeIntent(intent, descriptor, executionRequest))
    .sort((left, right) => left.sourceIntentId.localeCompare(right.sourceIntentId));
  compilerInvariant(intents.length > 0, 'K6_API_NO_OPERATIONS',
    'FROZEN Test Plan contains no k6 API operations');
  const intentIds = new Set(intents.map(({ sourceIntentId }) => sourceIntentId));
  for (const operation of intents) {
    for (const dependency of operation.sourceDependencyIntentIds) {
      compilerInvariant(intentIds.has(dependency), 'K6_API_DEPENDENCY_OUTSIDE_SPEC',
        'Operation dependency is outside the compiled intent set', {
          sourceIntentId: operation.sourceIntentId,
          dependency,
        });
    }
  }
  const operationIdByIntent = new Map(intents.map((item) => [item.sourceIntentId, item.operationId]));
  const operations = intents.map((operation) => ({
    ...operation,
    dependencyOperationIds: operation.sourceDependencyIntentIds
      .map((intentId) => operationIdByIntent.get(intentId)).sort(),
  }));
  const groups = createRequestGroups(operations);
  const inputArtifacts = executionRequest.inputArtifacts.map((artifact) => ({ ...artifact }))
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  const specIdentity = {
    schemaVersion: K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    compilerVersion,
    inputContractDigest,
    projectId: executionRequest.projectId,
    environment: executionRequest.environment,
    frozenTestPlan: {
      planId: frozenTestPlan.planId,
      revision: frozenTestPlan.revision,
      contentDigest: frozenTestPlan.contentDigest,
      inputFingerprint: frozenTestPlan.inputFingerprint,
    },
    knowledgeSnapshot: frozenTestPlan.knowledgeSnapshot,
    adapter: executionRequest.adapter,
    capabilities,
    requestGroups: groups,
    inputArtifacts,
  };
  const specId = `k6spec-${sha256(specIdentity).slice(0, 20)}`;
  const specWithoutDigest = { ...specIdentity, specId };
  const spec = { ...specWithoutDigest, specDigest: sha256(specWithoutDigest) };

  const specArtifact = {
    artifactId: `artifact-${specId}`,
    kind: 'k6-api-execution-spec',
    mediaType: 'application/vnd.kdtp.k6-api-execution-spec+json',
    digest: spec.specDigest,
    uri: `artifact://sha256/${spec.specDigest}`,
  };
  const artifactManifest = [...inputArtifacts, specArtifact]
    .sort((left, right) => left.artifactId.localeCompare(right.artifactId));
  const bundleIdentity = {
    schemaVersion: K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
    specId: spec.specId,
    specDigest: spec.specDigest,
    artifactManifest,
  };
  const bundleId = `k6bundle-${sha256(bundleIdentity).slice(0, 20)}`;
  const bundleWithoutDigest = { ...bundleIdentity, bundleId };
  const bundle = { ...bundleWithoutDigest, bundleDigest: sha256(bundleWithoutDigest) };

  const evidenceIdentity = {
    schemaVersion: K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
    compilerVersion,
    inputContractDigest,
    adapterDescriptorDigest: descriptor.descriptorDigest,
    executionRequestDigest: executionRequest.requestDigest,
    testPlanDigest: frozenTestPlan.contentDigest,
    knowledgeSnapshotDigest: frozenTestPlan.knowledgeSnapshot.digest,
    environmentDigest: executionRequest.environment.digest,
    capabilityDigest,
    artifactManifestDigest: sha256(artifactManifest),
    specId: spec.specId,
    specDigest: spec.specDigest,
    bundleId: bundle.bundleId,
    bundleDigest: bundle.bundleDigest,
    sourceIntentIds: operations.map(({ sourceIntentId }) => sourceIntentId).sort(),
  };
  const evidenceId = `k6evidence-${sha256(evidenceIdentity).slice(0, 20)}`;
  const evidence = {
    ...evidenceIdentity,
    evidenceId,
    metadata: { compiledAt, compiledBy },
    decision: {
      apiAdapterCompilerReady: true,
      executionRuntimeStarted: false,
      k6Invoked: false,
      externalProcessExecuted: false,
      nextRequiredSlice: 'M3-R2',
      repositoryBlockers: [],
    },
    safetyBoundary: {
      k6Invoked: false,
      xk6Invoked: false,
      playwrightInvoked: false,
      externalProcessExecuted: false,
      networkEndpointAccessed: false,
      secretAccessed: false,
      filesystemCredentialAccessed: false,
      runnableJavaScriptGenerated: false,
      temporaryExecutionDirectoryCreated: false,
      containerStarted: false,
      kubernetesResourceCreated: false,
      workerAdded: false,
      queueAdded: false,
      schedulerAdded: false,
      runtimeResultCollected: false,
    },
    evidenceDigest: sha256({ evidenceId, ...evidenceIdentity }),
  };
  assertK6ApiCompilationSafe({ spec, bundle, evidence }, '$.compilerOutput');
  return cloneExecutionJson({ spec, bundle, evidence });
}

export function canonicalStringifyK6ApiCompilation(value) {
  return canonicalStringify(value);
}
