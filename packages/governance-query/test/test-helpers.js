import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import {
  InMemoryKnowledgeSnapshotStore,
  InMemoryProjectAuthorization,
  InMemoryReviewDecisionStore,
  REVIEW_DECISION_SCHEMA_VERSION,
  createSnapshotEnvelope,
} from '@kdtp/knowledge-governance';
import { InMemoryKnowledgeRegistry } from '@kdtp/knowledge-registry';
import {
  InMemoryRequestIdentityContext,
  ReadOnlyGovernanceQueryHandlers,
  ReadOnlyGovernanceQueryService,
} from '../src/index.js';

export const PROJECT = 'approval-platform';
export const OTHER_PROJECT = 'inventory-platform';

const TIMES = [
  '2026-07-27T12:00:00.000Z',
  '2026-07-27T12:01:00.000Z',
  '2026-07-27T12:02:00.000Z',
  '2026-07-27T12:03:00.000Z',
  '2026-07-27T12:04:00.000Z',
  '2026-07-27T12:05:00.000Z',
  '2026-07-27T12:06:00.000Z',
];

export async function createQueryFixture() {
  const registry = new InMemoryKnowledgeRegistry();
  const reviewStore = new InMemoryReviewDecisionStore();
  const snapshotStore = new InMemoryKnowledgeSnapshotStore();
  const authorization = new InMemoryProjectAuthorization([
    grant('knowledge-reader', ['KNOWLEDGE_READ']),
    grant('auditor', ['AUDIT_READ']),
    grant('snapshot-reader', ['SNAPSHOT_READ']),
    grant('full-reader', ['KNOWLEDGE_READ', 'AUDIT_READ', 'SNAPSHOT_READ']),
  ]);
  const identityContext = new InMemoryRequestIdentityContext([
    { credential: 'knowledge-token', actor: 'knowledge-reader' },
    { credential: 'audit-token', actor: 'auditor' },
    { credential: 'snapshot-token', actor: 'snapshot-reader' },
    { credential: 'full-token', actor: 'full-reader' },
    { credential: 'forbidden-token', actor: 'forbidden' },
  ]);
  const service = new ReadOnlyGovernanceQueryService({
    registry,
    authorization,
    reviewStore,
    snapshotStore,
  });
  const handlers = new ReadOnlyGovernanceQueryHandlers({ service, identityContext });

  const approval = await createRecord(registry, knowledge({
    id: 'PROJECT-APPROVAL-001',
    name: '审批提交边界',
    boundaryKey: 'workflow.approval-submit',
    riskLevel: 'high',
  }), { publish: true, offset: 0 });
  const permission = await createRecord(registry, knowledge({
    id: 'PROJECT-PERMISSION-001',
    name: '当前审批人权限',
    boundaryKey: 'permission.current-approver',
    riskLevel: 'critical',
    owner: 'security-team',
  }), { publish: false, offset: 3 });
  await createRecord(registry, knowledge({
    id: 'PROJECT-INVENTORY-001',
    name: '库存边界',
    boundaryKey: 'inventory.quantity',
    scope: { level: 'PROJECT', key: OTHER_PROJECT },
  }), { publish: false, offset: 4 });
  await createRecord(registry, knowledge({
    id: 'GLOBAL-SECURITY-001',
    name: '全局脱敏规则',
    boundaryKey: 'security.secret-redaction',
    scope: { level: 'GLOBAL', key: 'company' },
  }), { publish: false, offset: 5 });

  await reviewStore.append({
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: 'decision:query:approval:0001',
    projectId: PROJECT,
    knowledgeKey: approval.key,
    knowledgeId: approval.knowledge.id,
    version: approval.knowledge.version,
    reviewRevision: 2,
    decision: 'APPROVE',
    reviewer: 'reviewer-1',
    at: TIMES[1],
    reason: 'approve query fixture',
  });

  const snapshotA = buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId: PROJECT,
      environmentId: 'staging',
      releaseId: 'M1-E-a',
      domainPacks: [],
    },
    rules: [approval.knowledge],
    resolution: [],
  });
  const snapshotB = buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId: PROJECT,
      environmentId: 'staging',
      releaseId: 'M1-E-b',
      domainPacks: [],
    },
    rules: [approval.knowledge, permission.knowledge],
    resolution: [],
  });
  await snapshotStore.save(createSnapshotEnvelope({
    projectId: PROJECT,
    snapshot: snapshotA,
    actor: 'snapshot-bot',
    at: TIMES[5],
    reason: 'first query snapshot',
  }));
  await snapshotStore.save(createSnapshotEnvelope({
    projectId: PROJECT,
    snapshot: snapshotB,
    actor: 'snapshot-bot',
    at: TIMES[6],
    reason: 'second query snapshot',
  }));

  return {
    registry,
    authorization,
    reviewStore,
    snapshotStore,
    identityContext,
    service,
    handlers,
    approval,
    permission,
    snapshots: [snapshotA, snapshotB],
  };
}

export function knowledge(overrides = {}) {
  return {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-SAMPLE-001',
    boundaryKey: 'sample.boundary',
    name: '示例边界',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: PROJECT },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { enabled: true },
    owner: 'quality-team',
    source: 'M1-E query fixture',
    riskLevel: 'medium',
    ...overrides,
  };
}

function grant(actor, actions) {
  return { projectId: PROJECT, actor, actions, roles: ['reader'] };
}

async function createRecord(registry, rule, options) {
  let record = await registry.createDraft({
    knowledge: rule,
    actor: 'author',
    at: TIMES[options.offset],
    reason: 'create query fixture',
  });
  if (options.publish) {
    record = await registry.transition({
      id: rule.id,
      version: rule.version,
      expectedRevision: record.revision,
      toStatus: 'REVIEWING',
      actor: 'author',
      at: TIMES[options.offset + 1],
      reason: 'submit query fixture',
    });
    record = await registry.transition({
      id: rule.id,
      version: rule.version,
      expectedRevision: record.revision,
      toStatus: 'PUBLISHED',
      actor: 'publisher',
      at: TIMES[options.offset + 2],
      reason: 'publish query fixture',
    });
  }
  return record;
}
