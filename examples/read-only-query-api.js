import { InMemoryKnowledgeRegistry } from '../packages/knowledge-registry/src/index.js';
import {
  InMemoryKnowledgeSnapshotStore,
  InMemoryProjectAuthorization,
  InMemoryReviewDecisionStore,
} from '../packages/knowledge-governance/src/index.js';
import {
  InMemoryRequestIdentityContext,
  ReadOnlyGovernanceQueryHandlers,
  ReadOnlyGovernanceQueryService,
} from '../packages/governance-query/src/index.js';

const projectId = 'approval-platform';
const registry = new InMemoryKnowledgeRegistry();
const authorization = new InMemoryProjectAuthorization([
  {
    projectId,
    actor: 'query-reader',
    actions: ['KNOWLEDGE_READ'],
    roles: ['reader'],
  },
]);
const reviewStore = new InMemoryReviewDecisionStore();
const snapshotStore = new InMemoryKnowledgeSnapshotStore();
const service = new ReadOnlyGovernanceQueryService({
  registry,
  authorization,
  reviewStore,
  snapshotStore,
});
const handlers = new ReadOnlyGovernanceQueryHandlers({
  service,
  identityContext: new InMemoryRequestIdentityContext([
    { credential: 'demo-token', actor: 'query-reader' },
  ]),
});

await registry.createDraft({
  knowledge: {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-APPROVAL-QUERY-001',
    boundaryKey: 'workflow.approval-query',
    name: '审批只读查询边界',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: projectId },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { visibleToProjectReaders: true },
    owner: 'approval-team',
    source: 'M1-E read-only query example',
    riskLevel: 'medium',
  },
  actor: 'knowledge-author',
  at: '2026-07-27T12:00:00.000Z',
  reason: 'create query example',
});

const response = await handlers.listKnowledge({
  context: {
    credential: 'demo-token',
    requestId: 'm1-e-example',
  },
  projectId,
  query: {
    sortBy: 'id',
    direction: 'asc',
    limit: 10,
  },
});

process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
