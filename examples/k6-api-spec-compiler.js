import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import { createSnapshotEnvelope } from '@kdtp/knowledge-governance';
import {
  CAPABILITY_CONTRACT_SCHEMA_VERSION,
  InMemoryCapabilityCatalog,
  createCapability,
  createCapabilityCatalog,
} from '@kdtp/test-capability';
import { createPlanningRequest, createTargetInventory } from '@kdtp/test-plan';
import { DeterministicTestPlanner, validatePlanningResult } from '@kdtp/test-planner';
import { InMemoryTestPlanRegistry, validatePlanRecord } from '@kdtp/test-plan-registry';
import {
  createExecutionAdapterDescriptor,
  createExecutionRequest,
} from '@kdtp/execution-contract';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { K6_API_COMPILER_VERSION, compileK6ApiExecutionSpec } from '../packages/k6-api-adapter/src/index.js';

export const T0 = '2026-07-31T01:00:00.000Z';
export const T1 = '2026-07-31T01:01:00.000Z';
export const T2 = '2026-07-31T01:02:00.000Z';
export const T3 = '2026-07-31T01:03:00.000Z';
export const T4 = '2026-07-31T01:04:00.000Z';
export const T5 = '2026-07-31T01:05:00.000Z';
export const T6 = '2026-07-31T01:06:00.000Z';
export const PROJECT_ID = 'approval-platform';
export const ENVIRONMENT_ID = 'staging-us-east-1';
export const RELEASE_ID = 'm3-r1';
export const BODY_DIGEST = '6'.repeat(64);
export const ENVIRONMENT_DIGEST = '2'.repeat(64);

function contract(fields) {
  return {
    schemaVersion: CAPABILITY_CONTRACT_SCHEMA_VERSION,
    fields,
    additionalProperties: false,
  };
}

function inputContract() {
  return contract([
    { name: 'operationId', required: true, type: 'string' },
    { name: 'method', required: true, type: 'string' },
    { name: 'pathTemplate', required: true, type: 'string' },
    { name: 'requestBodyArtifact', required: false, type: 'object' },
    { name: 'queryParameters', required: false, type: 'array' },
  ]);
}

function assertionContract() {
  return contract([
    { name: 'statusCodes', required: false, type: 'array' },
    { name: 'jsonPathExists', required: false, type: 'array' },
    { name: 'jsonPathEquals', required: false, type: 'array' },
  ]);
}

function thresholdContract() {
  return contract([
    { name: 'maxDurationMs', required: false, type: 'integer' },
    { name: 'maxFailureRate', required: false, type: 'number' },
    { name: 'minChecksRate', required: false, type: 'number' },
  ]);
}

function capability(capabilityId, intentKind) {
  return createCapability({
    capabilityId,
    version: '1.0.0',
    name: `${capabilityId} M3-R1 compiler fixture`,
    targetKinds: ['api'],
    intentKind,
    inputContract: inputContract(),
    assertionContract: assertionContract(),
    thresholdContract: thresholdContract(),
    dependencyRules: [],
    enabled: true,
    source: { kind: 'built-in', reference: 'M3-R1' },
    tags: ['api', 'compiler'],
  });
}

export function capabilityCatalog() {
  return createCapabilityCatalog({
    version: '1.0.0',
    capabilities: [
      capability('api-functional', 'api-functional'),
      capability('api-performance', 'api-performance'),
    ],
  });
}

function knowledgeRule() {
  return {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-APPROVAL-API-001',
    boundaryKey: 'api.approval-submit',
    name: 'Approval API must satisfy governed checks',
    version: '1.0.0',
    status: 'PUBLISHED',
    scope: { level: 'PROJECT', key: PROJECT_ID },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { operationId: 'submitApproval' },
    owner: 'approval-quality-team',
    source: 'M3-R1 compiler fixture',
    riskLevel: 'high',
    tags: ['api', 'approval'],
  };
}

export function snapshotEnvelope() {
  const rule = knowledgeRule();
  const snapshot = buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
      releaseId: RELEASE_ID,
      domainPacks: ['approval-api'],
    },
    rules: [rule],
    resolution: [{ boundaryKey: rule.boundaryKey, sourceRuleId: rule.id }],
  });
  return createSnapshotEnvelope({
    projectId: PROJECT_ID,
    snapshot,
    actor: 'snapshot-publisher',
    at: T0,
    reason: 'M3-R1 deterministic compiler fixture',
  });
}

function planningRequest(catalog, envelope) {
  const inventory = createTargetInventory({
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    releaseId: RELEASE_ID,
    targets: [{
      targetId: 'api:approval-submit',
      kind: 'api',
      name: 'Submit approval API',
      locator: 'POST /v1/approvals/{approvalId}',
      tags: ['approval', 'critical'],
      attributes: { operationId: 'submitApproval' },
    }],
  });
  return createPlanningRequest({
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    releaseId: RELEASE_ID,
    knowledgeSnapshotId: envelope.snapshotId,
    knowledgeSnapshotDigest: envelope.digest,
    knowledgeSnapshot: envelope,
    plannerVersion: '1.0.0',
    capabilityCatalogVersion: catalog.version,
    capabilityCatalogDigest: catalog.digest,
    targetInventory: inventory,
    planningPolicy: {
      policyId: 'policy:m3-r1-api',
      version: '1.0.0',
      entries: [{
        policyEntryId: 'policy-entry:m3-r1-api',
        priority: 10,
        selectors: {
          knowledgeIds: ['PROJECT-APPROVAL-API-001'],
          targetIds: ['api:approval-submit'],
        },
        capabilityRefs: [
          { capabilityId: 'api-functional', version: '1.0.0' },
          { capabilityId: 'api-performance', version: '1.0.0' },
        ],
        mandatory: true,
      }],
      exemptions: [],
    },
    createdAt: T0,
    createdBy: 'planner-service',
  });
}

const strategy = {
  async createIntentSpecs({ capability }) {
    if (capability.capabilityId === 'api-functional') {
      return [{
        intentKey: 'submit-approval-functional',
        input: {
          operationId: 'submitApproval',
          method: 'POST',
          pathTemplate: '/v1/approvals/{approvalId}',
          requestBodyArtifact: {
            artifactId: 'artifact-approval-payload-v1',
            mediaType: 'application/json',
            digest: BODY_DIGEST,
            uri: `artifact://sha256/${BODY_DIGEST}`,
          },
          queryParameters: [
            { name: 'dryRun', required: false, source: 'CONSTANT_METADATA' },
          ],
        },
        assertions: {
          statusCodes: [201, 202],
          jsonPathExists: ['$.id', '$.status'],
          jsonPathEquals: [{ path: '$.status', expected: 'PENDING' }],
        },
        thresholds: { maxDurationMs: 1500, maxFailureRate: 0.01 },
        tags: ['api', 'functional', 'mandatory'],
      }];
    }
    return [{
      intentKey: 'submit-approval-performance',
      input: {
        operationId: 'submitApprovalPerformance',
        method: 'POST',
        pathTemplate: '/v1/approvals/{approvalId}',
        requestBodyArtifact: {
          artifactId: 'artifact-approval-payload-v1',
          mediaType: 'application/json',
          digest: BODY_DIGEST,
          uri: `artifact://sha256/${BODY_DIGEST}`,
        },
        queryParameters: [],
      },
      assertions: { statusCodes: [201, 202], jsonPathExists: ['$.id'], jsonPathEquals: [] },
      thresholds: { maxDurationMs: 1000, maxFailureRate: 0.005, minChecksRate: 0.995 },
      tags: ['api', 'performance', 'mandatory'],
    }];
  },
};

export async function frozenPlanRecord() {
  const catalog = capabilityCatalog();
  const envelope = snapshotEnvelope();
  const planner = new DeterministicTestPlanner({
    capabilityCatalogPort: new InMemoryCapabilityCatalog(catalog),
    strategy,
  });
  const planningResult = validatePlanningResult(await planner.plan({
    planningRequest: planningRequest(catalog, envelope),
  }));
  const registry = new InMemoryTestPlanRegistry();
  let record = await registry.create({
    planningResult,
    actor: 'planner-service',
    at: T1,
    reason: 'register M3-R1 plan',
  });
  for (const [toStatus, at] of [['REVIEWING', T2], ['APPROVED', T3], ['FROZEN', T4]]) {
    record = await registry.transition({
      planId: record.planId,
      expectedRevision: record.revision,
      toStatus,
      actor: 'plan-governor',
      at,
      reason: `transition to ${toStatus}`,
    });
  }
  return validatePlanRecord(record);
}

export function adapterDescriptor() {
  return createExecutionAdapterDescriptor({
    adapterType: 'k6-api',
    version: '1.0.0',
    implementationStatus: 'CONTRACT_ONLY',
    supportedCapabilities: [
      { capabilityId: 'api-performance', version: '1.0.0' },
      { capabilityId: 'api-functional', version: '1.0.0' },
    ],
    acceptedIntentKinds: ['api-performance', 'api-functional'],
    outputArtifactKinds: [
      'k6-api-compilation-evidence',
      'k6-api-artifact-bundle',
      'k6-api-execution-spec',
    ],
    cancellationMode: 'UNSUPPORTED',
  });
}

export function executionRequest(record, descriptor = adapterDescriptor()) {
  return createExecutionRequest({
    idempotencyKey: '1'.repeat(64),
    projectId: record.projectId,
    environment: {
      environmentId: record.environmentId,
      version: '1.0.0',
      digest: ENVIRONMENT_DIGEST,
    },
    frozenTestPlan: {
      planId: record.planId,
      projectId: record.projectId,
      environmentId: record.environmentId,
      revision: record.revision,
      status: 'FROZEN',
      digest: record.contentDigest,
      inputFingerprint: record.inputFingerprint,
      knowledgeSnapshot: { ...record.knowledgeSnapshot },
    },
    adapter: {
      adapterId: descriptor.adapterId,
      adapterType: descriptor.adapterType,
      version: descriptor.version,
      descriptorDigest: descriptor.descriptorDigest,
    },
    requestedCapabilities: [
      { capabilityId: 'api-performance', version: '1.0.0' },
      { capabilityId: 'api-functional', version: '1.0.0' },
    ],
    inputArtifacts: [{
      artifactId: 'artifact-approval-payload-v1',
      kind: 'test-data',
      mediaType: 'application/json',
      digest: BODY_DIGEST,
      uri: `artifact://sha256/${BODY_DIGEST}`,
    }],
    limits: {
      maxDurationSeconds: 300,
      maxVirtualUsers: 100,
      maxArtifactBytes: 10_000_000,
    },
    createdAt: T5,
    createdBy: 'm3-r1-compiler-client',
  }, descriptor);
}

export async function compilerInput(overrides = {}) {
  const frozenTestPlan = overrides.frozenTestPlan ?? await frozenPlanRecord();
  const descriptor = overrides.descriptor ?? adapterDescriptor();
  const request = overrides.executionRequest ?? executionRequest(frozenTestPlan, descriptor);
  return {
    descriptor,
    executionRequest: request,
    frozenTestPlan,
    compilerVersion: K6_API_COMPILER_VERSION,
    compiledAt: T6,
    compiledBy: 'm3-r1-compiler',
    ...overrides,
  };
}

export async function compilation(overrides = {}) {
  return compileK6ApiExecutionSpec(await compilerInput(overrides));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await compilation(), null, 2)}\n`);
}
