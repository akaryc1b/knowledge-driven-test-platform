import { buildKnowledgeSnapshot } from '../packages/knowledge-core/src/index.js';
import { InMemoryKnowledgeRegistry } from '../packages/knowledge-registry/src/index.js';
import {
  GovernanceAuditQueryService,
  InMemoryKnowledgeSnapshotStore,
  InMemoryProjectAuthorization,
  InMemoryReviewDecisionStore,
  KnowledgeGovernanceService,
} from '../packages/knowledge-governance/src/index.js';

const projectId = 'approval-platform';
const registry = new InMemoryKnowledgeRegistry();
const reviewStore = new InMemoryReviewDecisionStore();
const snapshotStore = new InMemoryKnowledgeSnapshotStore();
const authorization = new InMemoryProjectAuthorization([
  { projectId, actor: 'author', actions: ['KNOWLEDGE_CREATE', 'KNOWLEDGE_SUBMIT'], roles: ['author'] },
  { projectId, actor: 'reviewer', actions: ['KNOWLEDGE_REVIEW'], roles: ['reviewer'] },
  { projectId, actor: 'publisher', actions: ['KNOWLEDGE_PUBLISH'], roles: ['publisher'] },
  { projectId, actor: 'snapshot-bot', actions: ['SNAPSHOT_PERSIST'], roles: ['automation'] },
  { projectId, actor: 'auditor', actions: ['AUDIT_READ', 'SNAPSHOT_READ'], roles: ['auditor'] },
]);
const governance = new KnowledgeGovernanceService({ registry, authorization, reviewStore, snapshotStore });
const audit = new GovernanceAuditQueryService({ registry, authorization, reviewStore, snapshotStore });

let record = await governance.createDraft({
  projectId,
  knowledge: {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-APPROVAL-001',
    boundaryKey: 'workflow.approval-submit',
    name: '审批提交规则',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: projectId },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { allowedFrom: ['DRAFT'] },
    owner: 'approval-team',
    source: 'M1-C governance example',
    riskLevel: 'high',
  },
  actor: 'author',
  at: '2026-07-27T12:00:00.000Z',
  reason: 'create governed knowledge',
});
record = await governance.submitForReview({
  projectId,
  id: record.knowledge.id,
  version: record.knowledge.version,
  expectedRevision: record.revision,
  actor: 'author',
  at: '2026-07-27T12:01:00.000Z',
  reason: 'submit for review',
});
await governance.review({
  projectId,
  id: record.knowledge.id,
  version: record.knowledge.version,
  expectedRevision: record.revision,
  decisionId: 'decision:approval:reviewer:0001',
  decision: 'APPROVE',
  actor: 'reviewer',
  at: '2026-07-27T12:02:00.000Z',
  reason: 'approve business boundary',
});
({ record } = await governance.publish({
  projectId,
  id: record.knowledge.id,
  version: record.knowledge.version,
  expectedRevision: record.revision,
  actor: 'publisher',
  at: '2026-07-27T12:03:00.000Z',
  reason: 'publish approved boundary',
}));
const snapshot = buildKnowledgeSnapshot({
  context: {
    globalId: 'company',
    projectId,
    environmentId: 'staging',
    releaseId: 'M1-C-demo',
    domainPacks: [],
  },
  rules: [record.knowledge],
  resolution: [],
});
await governance.persistSnapshot({
  projectId,
  snapshot,
  actor: 'snapshot-bot',
  at: '2026-07-27T12:04:00.000Z',
  reason: 'persist governed release snapshot',
});
const timeline = await audit.getKnowledgeTimeline({
  projectId,
  id: record.knowledge.id,
  version: record.knowledge.version,
  actor: 'auditor',
});
process.stdout.write(`${JSON.stringify({ record, snapshotId: snapshot.snapshotId, timeline }, null, 2)}\n`);
