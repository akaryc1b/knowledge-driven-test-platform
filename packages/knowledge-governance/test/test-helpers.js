import {
  GovernanceAuditQueryService,
  InMemoryKnowledgeSnapshotStore,
  InMemoryProjectAuthorization,
  InMemoryReviewDecisionStore,
  KnowledgeGovernanceService,
} from '../src/index.js';
import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import { InMemoryKnowledgeRegistry } from '@kdtp/knowledge-registry';

export const T0 = '2026-07-27T12:00:00.000Z';
export const T1 = '2026-07-27T12:01:00.000Z';
export const T2 = '2026-07-27T12:02:00.000Z';
export const T3 = '2026-07-27T12:03:00.000Z';
export const T4 = '2026-07-27T12:04:00.000Z';
export const T5 = '2026-07-27T12:05:00.000Z';
export const PROJECT = 'approval-platform';

export function knowledge(overrides = {}) {
  return {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-APPROVAL-001',
    boundaryKey: 'workflow.approval-submit',
    name: '审批提交规则',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: PROJECT },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { allowedFrom: ['DRAFT'] },
    owner: 'approval-team',
    source: 'M1-C governance tests',
    riskLevel: 'high',
    ...overrides,
  };
}

export function createFixture(options = {}) {
  const registry = new InMemoryKnowledgeRegistry();
  const reviewStore = new InMemoryReviewDecisionStore();
  const snapshotStore = new InMemoryKnowledgeSnapshotStore();
  const authorization = new InMemoryProjectAuthorization([
    grant('author', ['KNOWLEDGE_CREATE', 'KNOWLEDGE_EDIT', 'KNOWLEDGE_SUBMIT']),
    grant('reviewer-1', ['KNOWLEDGE_REVIEW']),
    grant('reviewer-2', ['KNOWLEDGE_REVIEW']),
    grant('publisher', ['KNOWLEDGE_PUBLISH', 'KNOWLEDGE_DEPRECATE', 'KNOWLEDGE_ARCHIVE']),
    grant('auditor', ['AUDIT_READ', 'SNAPSHOT_READ']),
    grant('snapshot-bot', ['SNAPSHOT_PERSIST']),
    ...(options.grants ?? []),
  ]);
  const service = new KnowledgeGovernanceService({
    registry,
    authorization,
    reviewStore,
    snapshotStore,
    policy: options.policy,
  });
  const audit = new GovernanceAuditQueryService({ registry, authorization, reviewStore, snapshotStore });
  return { registry, reviewStore, snapshotStore, authorization, service, audit };
}

export function grant(actor, actions, projectId = PROJECT) {
  return { projectId, actor, actions, roles: [] };
}

export async function createAndSubmit(fixture, rule = knowledge()) {
  let record = await fixture.service.createDraft({
    projectId: PROJECT,
    knowledge: rule,
    actor: 'author',
    at: T0,
    reason: 'create draft',
  });
  record = await fixture.service.submitForReview({
    projectId: PROJECT,
    id: rule.id,
    version: rule.version,
    expectedRevision: record.revision,
    actor: 'author',
    at: T1,
    reason: 'submit for review',
  });
  return record;
}

export function reviewCommand(record, overrides = {}) {
  return {
    projectId: PROJECT,
    id: record.knowledge.id,
    version: record.knowledge.version,
    expectedRevision: record.revision,
    decisionId: `decision:${record.revision}:${overrides.actor ?? 'reviewer-1'}:${overrides.decision ?? 'approve'}`,
    decision: 'APPROVE',
    actor: 'reviewer-1',
    at: T2,
    reason: 'approve current review revision',
    ...overrides,
  };
}

export function snapshot() {
  return buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId: PROJECT,
      environmentId: 'staging',
      releaseId: 'M1-C-demo',
      domainPacks: [],
    },
    rules: [],
    resolution: [],
  });
}
