import {
  createExecutionAdapterDescriptor,
  createExecutionEvidence,
  createExecutionRequest,
  createExecutionResult,
} from '../packages/execution-contract/src/index.js';

const digest = (character) => character.repeat(64);

export function buildExecutionContractExample() {
  const descriptor = createExecutionAdapterDescriptor({
    adapterType: 'k6-api',
    version: '1.0.0',
    implementationStatus: 'CONTRACT_ONLY',
    supportedCapabilities: [
      { capabilityId: 'api.functional', version: '1.0.0' },
      { capabilityId: 'http.performance', version: '1.0.0' },
    ],
    acceptedIntentKinds: ['api-functional', 'api-performance'],
    outputArtifactKinds: ['execution-log', 'summary-json'],
    cancellationMode: 'COOPERATIVE',
  });

  const request = createExecutionRequest({
    idempotencyKey: digest('1'),
    projectId: 'approval-platform',
    environment: {
      environmentId: 'staging-us-east-1',
      version: '3.2.1',
      digest: digest('2'),
    },
    frozenTestPlan: {
      planId: 'tp-approval-platform-abcdef123456',
      projectId: 'approval-platform',
      environmentId: 'staging-us-east-1',
      revision: 7,
      status: 'FROZEN',
      digest: digest('3'),
      inputFingerprint: digest('4'),
      knowledgeSnapshot: {
        snapshotId: 'kb-approval-platform-abcdef123456',
        digest: digest('5'),
      },
    },
    adapter: {
      adapterId: descriptor.adapterId,
      adapterType: descriptor.adapterType,
      version: descriptor.version,
      descriptorDigest: descriptor.descriptorDigest,
    },
    requestedCapabilities: [
      { capabilityId: 'api.functional', version: '1.0.0' },
    ],
    inputArtifacts: [{
      artifactId: 'artifact-test-data-v1',
      kind: 'test-data',
      mediaType: 'application/json',
      digest: digest('6'),
      uri: `artifact://sha256/${digest('6')}`,
    }],
    limits: {
      maxDurationSeconds: 300,
      maxVirtualUsers: 50,
      maxArtifactBytes: 10_000_000,
    },
    createdAt: '2026-07-30T10:00:00.000Z',
    createdBy: 'release-engineer',
  }, descriptor);

  const result = createExecutionResult({
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    adapter: {
      adapterId: descriptor.adapterId,
      adapterType: descriptor.adapterType,
      version: descriptor.version,
      descriptorDigest: descriptor.descriptorDigest,
    },
    state: 'SUCCEEDED',
    startedAt: '2026-07-30T10:00:01.000Z',
    completedAt: '2026-07-30T10:00:03.000Z',
    stateHistory: [
      { state: 'PENDING', at: '2026-07-30T10:00:00.000Z' },
      { state: 'VALIDATED', at: '2026-07-30T10:00:01.000Z' },
      { state: 'RUNNING', at: '2026-07-30T10:00:02.000Z' },
      { state: 'SUCCEEDED', at: '2026-07-30T10:00:03.000Z' },
    ],
    outputArtifacts: [{
      artifactId: 'artifact-summary-v1',
      kind: 'summary-json',
      mediaType: 'application/json',
      digest: digest('7'),
      uri: `artifact://sha256/${digest('7')}`,
    }],
    measurements: [
      { name: 'checks.failed', unit: 'count', value: 0 },
      { name: 'checks.passed', unit: 'count', value: 12 },
    ],
    failure: null,
    cancellation: null,
  }, request, descriptor);

  const evidence = createExecutionEvidence({
    requestId: request.requestId,
    requestDigest: request.requestDigest,
    resultId: result.resultId,
    resultDigest: result.resultDigest,
    adapterDescriptorDigest: descriptor.descriptorDigest,
    frozenTestPlanDigest: request.frozenTestPlan.digest,
    knowledgeSnapshotDigest: request.frozenTestPlan.knowledgeSnapshot.digest,
    environmentDigest: request.environment.digest,
    inputArtifactDigests: request.inputArtifacts.map(({ digest: value }) => value),
    outputArtifactDigests: result.outputArtifacts.map(({ digest: value }) => value),
    generatedAt: '2026-07-30T10:00:04.000Z',
    generatedBy: 'evidence-recorder',
  }, request, result, descriptor);

  return { descriptor, request, result, evidence };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.stdout.write(`${JSON.stringify(buildExecutionContractExample(), null, 2)}\n`);
}
