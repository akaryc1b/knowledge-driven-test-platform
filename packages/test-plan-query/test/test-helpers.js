import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import {
  InMemoryProjectAuthorization,
  createSnapshotEnvelope,
} from '@kdtp/knowledge-governance';
import { InMemoryRequestIdentityContext } from '@kdtp/governance-query';
import {
  InMemoryCapabilityCatalog,
  createBaseCapabilityCatalog,
} from '@kdtp/test-capability';
import {
  createPlanningRequest,
  createTargetInventory,
} from '@kdtp/test-plan';
import {
  InMemoryTestPlanRegistry,
  createPlanReviewDecision,
} from '@kdtp/test-plan-registry';
import { DeterministicTestPlanner } from '@kdtp/test-planner';
import {
  ReadOnlyTestPlanQueryHandlers,
  ReadOnlyTestPlanQueryService,
} from '../src/index.js';

export const PROJECT = 'approval-platform';
export const OTHER_PROJECT = 'inventory-platform';
const T0 = '2026-07-28T04:00:00.000Z';
const T1 = '2026-07-28T04:01:00.000Z';
const T2 = '2026-07-28T04:02:00.000Z';
const T3 = '2026-07-28T04:03:00.000Z';
const T4 = '2026-07-28T04:04:00.000Z';
const T5 = '2026-07-28T04:05:00.000Z';
const T6 = '2026-07-28T04:06:00.000Z';

export async function createPlanQueryFixture() {
  const catalog = createBaseCapabilityCatalog('1.0.0');
  const planner = new DeterministicTestPlanner({
    capabilityCatalogPort: new InMemoryCapabilityCatalog(catalog),
  });
  const registry = new InMemoryTestPlanRegistry();
  const frozenResult = await planner.plan({
    planningRequest: planningRequest({
      projectId: PROJECT,
      releaseId: 'R2-frozen',
      createdAt: T0,
      policyEntryId: 'policy-entry:frozen',
    }),
  });
  const draftResult = await planner.plan({
    planningRequest: planningRequest({
      projectId: PROJECT,
      releaseId: 'R2-draft',
      createdAt: T1,
      policyEntryId: 'policy-entry:draft',
    }),
  });
  const otherResult = await planner.plan({
    planningRequest: planningRequest({
      projectId: OTHER_PROJECT,
      releaseId: 'R2-other',
      createdAt: T2,
      policyEntryId: 'policy-entry:other',
    }),
  });

  let frozen = await registry.create({
    planningResult: frozenResult,
    actor: 'planner-service',
    at: T0,
    reason: 'create frozen query fixture',
  });
  const draft = await registry.create({
    planningResult: draftResult,
    actor: 'planner-service',
    at: T1,
    reason: 'create draft query fixture',
  });
  const other = await registry.create({
    planningResult: otherResult,
    actor: 'other-planner',
    at: T2,
    reason: 'create other project fixture',
  });
  frozen = await registry.transition({
    planId: frozen.planId,
    expectedRevision: frozen.revision,
    toStatus: 'REVIEWING',
    actor: 'planner-service',
    at: T3,
    reason: 'submit fixture plan',
  });
  await registry.appendReviewDecision(createPlanReviewDecision({
    planId: frozen.planId,
    projectId: PROJECT,
    planRevision: frozen.revision,
    decision: 'APPROVE',
    reviewer: 'reviewer-one',
    at: T4,
    reason: 'approve fixture plan',
    evidence: { approvedExemptions: [] },
  }));
  frozen = await registry.transition({
    planId: frozen.planId,
    expectedRevision: frozen.revision,
    toStatus: 'APPROVED',
    actor: 'approval-governor',
    at: T5,
    reason: 'approve fixture plan',
  });
  frozen = await registry.transition({
    planId: frozen.planId,
    expectedRevision: frozen.revision,
    toStatus: 'FROZEN',
    actor: 'freeze-owner',
    at: T6,
    reason: 'freeze fixture plan',
  });

  const authorization = new InMemoryProjectAuthorization([
    { projectId: PROJECT, actor: 'reader', actions: ['PLAN_READ'] },
    { projectId: PROJECT, actor: 'auditor', actions: ['PLAN_READ', 'PLAN_AUDIT_READ'] },
    { projectId: OTHER_PROJECT, actor: 'other-reader', actions: ['PLAN_READ', 'PLAN_AUDIT_READ'] },
  ]);
  const service = new ReadOnlyTestPlanQueryService({ registry, authorization });
  const identityContext = new InMemoryRequestIdentityContext([
    { credential: 'reader-token', actor: 'reader' },
    { credential: 'auditor-token', actor: 'auditor' },
    { credential: 'forbidden-token', actor: 'forbidden' },
  ]);
  const handlers = new ReadOnlyTestPlanQueryHandlers({ service, identityContext });
  return {
    registry,
    authorization,
    service,
    handlers,
    frozen,
    draft,
    other,
  };
}

function planningRequest({ projectId, releaseId, createdAt, policyEntryId }) {
  const catalog = createBaseCapabilityCatalog('1.0.0');
  const knowledgeId = projectId === PROJECT ? 'PROJECT-APPROVAL-001' : 'PROJECT-INVENTORY-001';
  const targetId = projectId === PROJECT ? 'api:approval-submit' : 'api:inventory-update';
  const operationId = projectId === PROJECT ? 'submitApproval' : 'updateInventory';
  const boundaryKey = projectId === PROJECT ? 'workflow.approval-submit' : 'inventory.update';
  const rule = {
    schemaVersion: 'knowledge-rule/v1',
    id: knowledgeId,
    boundaryKey,
    name: `${projectId} query rule`,
    version: '1.0.0',
    status: 'PUBLISHED',
    scope: { level: 'PROJECT', key: projectId },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { operationId },
    owner: 'quality-team',
    source: 'M2-G query fixture',
    riskLevel: 'high',
    tags: ['api'],
  };
  const snapshot = buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId,
      environmentId: 'staging',
      releaseId,
      domainPacks: ['query-fixture'],
    },
    rules: [rule],
    resolution: [{ boundaryKey, sourceRuleId: knowledgeId }],
  });
  const envelope = createSnapshotEnvelope({
    projectId,
    snapshot,
    actor: 'snapshot-publisher',
    at: createdAt,
    reason: 'create M2-G query fixture snapshot',
  });
  const targetInventory = createTargetInventory({
    projectId,
    environmentId: 'staging',
    releaseId,
    targets: [{
      targetId,
      kind: 'api',
      name: `${projectId} API`,
      locator: 'POST /v1/resource',
      tags: ['api'],
      attributes: { operationId },
    }],
  });
  return createPlanningRequest({
    projectId,
    environmentId: 'staging',
    releaseId,
    knowledgeSnapshotId: envelope.snapshotId,
    knowledgeSnapshotDigest: envelope.digest,
    knowledgeSnapshot: envelope,
    plannerVersion: '1.0.0',
    capabilityCatalogVersion: catalog.version,
    capabilityCatalogDigest: catalog.digest,
    targetInventory,
    planningPolicy: {
      policyId: `policy:${projectId}`,
      version: '1.0.0',
      entries: [{
        policyEntryId,
        priority: 10,
        selectors: { knowledgeIds: [knowledgeId], targetIds: [targetId] },
        capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
        mandatory: true,
      }],
      exemptions: [],
    },
    createdAt,
    createdBy: 'planner-service',
  });
}
