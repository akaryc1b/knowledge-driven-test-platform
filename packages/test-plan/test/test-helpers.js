import { buildKnowledgeSnapshot, sha256 } from '@kdtp/knowledge-core';
import { createSnapshotEnvelope } from '@kdtp/knowledge-governance';
import {
  createCoverageObligation,
  createPlanningExemption,
  createPlanningRequest,
  createProvenanceEntry,
  createTargetInventory,
  createTestIntent,
  createTestPlan,
} from '../src/index.js';

export const CREATED_AT = '2026-07-27T16:00:00.000Z';
export const PROJECT_ID = 'approval-platform';
export const ENVIRONMENT_ID = 'staging';
export const RELEASE_ID = 'R2';

export function publishedKnowledge(overrides = {}) {
  return {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-APPROVAL-001',
    boundaryKey: 'workflow.approval-submit',
    name: 'Approval submission must be validated',
    version: '1.0.0',
    status: 'PUBLISHED',
    scope: { level: 'PROJECT', key: PROJECT_ID },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { allowedFrom: ['DRAFT'], requireActiveTask: true },
    owner: 'approval-quality-team',
    source: 'M2-A contract fixture',
    riskLevel: 'high',
    tags: ['workflow', 'api'],
    ...overrides,
  };
}

export function snapshotEnvelope(ruleOverrides = {}) {
  const rule = publishedKnowledge(ruleOverrides);
  const snapshot = buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
      releaseId: RELEASE_ID,
      domainPacks: ['approval-workflow'],
    },
    rules: [rule],
    resolution: [{ boundaryKey: rule.boundaryKey, sourceRuleId: rule.id }],
  });
  return createSnapshotEnvelope({
    projectId: PROJECT_ID,
    snapshot,
    actor: 'snapshot-publisher',
    at: CREATED_AT,
    reason: 'M2-A deterministic planning fixture',
  });
}

export function targetInventory(overrides = {}) {
  return createTargetInventory({
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    releaseId: RELEASE_ID,
    targets: [
      {
        targetId: 'api:approval-submit',
        kind: 'api',
        name: 'Submit approval API',
        locator: 'POST /v1/approvals',
        tags: ['approval', 'critical'],
        attributes: { protocol: 'https', operationId: 'submitApproval' },
      },
    ],
    ...overrides,
  });
}

export function planningPolicy(overrides = {}) {
  return {
    policyId: 'policy:release-quality',
    version: '1.0.0',
    entries: [
      {
        policyEntryId: 'policy-entry:approval-api',
        priority: 10,
        selectors: {
          knowledgeIds: ['PROJECT-APPROVAL-001'],
          boundaryKeys: ['workflow.approval-submit'],
          targetKinds: ['api'],
        },
        capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
        mandatory: true,
      },
    ],
    exemptions: [],
    ...overrides,
  };
}

export function planningRequest(overrides = {}) {
  const knowledgeSnapshot = overrides.knowledgeSnapshot ?? snapshotEnvelope();
  const inventory = overrides.targetInventory ?? targetInventory();
  const policy = overrides.planningPolicy ?? planningPolicy();
  return createPlanningRequest({
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    releaseId: RELEASE_ID,
    knowledgeSnapshotId: knowledgeSnapshot.snapshotId,
    knowledgeSnapshotDigest: knowledgeSnapshot.digest,
    knowledgeSnapshot,
    plannerVersion: '1.0.0',
    capabilityCatalogVersion: '1.0.0',
    capabilityCatalogDigest: sha256({ catalog: 'base-capabilities', version: '1.0.0' }),
    targetInventory: inventory,
    planningPolicy: policy,
    createdAt: CREATED_AT,
    createdBy: 'planner-service',
    ...overrides,
  });
}

export function sourceKnowledge(request = planningRequest()) {
  const rule = request.knowledgeSnapshot.snapshot.rules[0];
  return [{
    knowledgeId: rule.id,
    version: rule.version,
    boundaryKey: rule.boundaryKey,
    snapshotId: request.knowledgeSnapshotId,
    snapshotDigest: request.knowledgeSnapshotDigest,
  }];
}

export function completePlan(overrides = {}) {
  const request = overrides.planningRequest ?? planningRequest();
  const intent = createTestIntent({
    planInputFingerprint: request.inputFingerprint,
    intentKind: 'api-functional',
    targetId: 'api:approval-submit',
    capability: { capabilityId: 'api-functional', version: '1.0.0' },
    sourceKnowledge: sourceKnowledge(request),
    policyEntryId: 'policy-entry:approval-api',
    input: { operation: 'submit', payloadProfile: 'valid-approval' },
    assertions: { statusCode: 201, responseSchema: 'approval/v1' },
    thresholds: {},
    dependencies: [],
    tags: ['mandatory'],
    ...(overrides.intent ?? {}),
  });
  const obligation = createCoverageObligation({
    planInputFingerprint: request.inputFingerprint,
    targetId: intent.targetId,
    capability: intent.capability,
    sourceKnowledge: intent.sourceKnowledge,
    policyEntryId: intent.policyEntryId,
    mandatory: true,
    status: 'COVERED',
    intentIds: [intent.intentId],
    ...(overrides.obligation ?? {}),
  });
  const provenance = sourceKnowledge(request).map((source) => createProvenanceEntry({
    intentId: intent.intentId,
    knowledgeId: source.knowledgeId,
    knowledgeVersion: source.version,
    boundaryKey: source.boundaryKey,
    snapshotId: source.snapshotId,
    snapshotDigest: source.snapshotDigest,
    capabilityId: intent.capability.capabilityId,
    capabilityVersion: intent.capability.version,
    targetId: intent.targetId,
    policyEntryId: intent.policyEntryId,
  }));
  return createTestPlan({
    planningRequest: request,
    intents: [intent],
    coverageObligations: [obligation],
    provenance,
  });
}

export function exemption(overrides = {}) {
  return createPlanningExemption({
    knowledgeId: 'PROJECT-APPROVAL-001',
    knowledgeVersion: '1.0.0',
    targetId: 'api:approval-submit',
    capabilityId: 'api-performance',
    capabilityVersion: '1.0.0',
    reason: 'Performance testing is handled by a separately approved release gate',
    owner: 'release-quality-owner',
    ...overrides,
  });
}
