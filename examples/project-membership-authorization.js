import { InMemoryKnowledgeRegistry } from '../packages/knowledge-registry/src/index.js';
import {
  InMemoryKnowledgeSnapshotStore,
  InMemoryReviewDecisionStore,
} from '../packages/knowledge-governance/src/index.js';
import {
  InMemoryProjectDirectory,
  InMemoryProjectMembershipStore,
  ProjectMembershipAuthorization,
} from '../packages/project-membership/src/index.js';
import {
  InMemoryRequestIdentityContext,
  ReadOnlyGovernanceQueryHandlers,
  ReadOnlyGovernanceQueryService,
} from '../packages/governance-query/src/index.js';

const projectId = 'approval-platform';
const at = '2026-07-27T12:00:00.000Z';
const directory = new InMemoryProjectDirectory();
await directory.createProject({
  projectId,
  name: 'Approval Platform',
  actor: 'platform-admin',
  at,
  reason: 'register project for membership authorization example',
});
const memberships = new InMemoryProjectMembershipStore({ directory });
await memberships.createMembership({
  projectId,
  subject: 'query-reader',
  roles: ['VIEWER'],
  validFrom: at,
  validUntil: null,
  actor: 'project-admin',
  at,
  reason: 'grant read-only project membership',
});
const authorization = new ProjectMembershipAuthorization({
  directory,
  memberships,
  clock: { async now() { return '2026-07-27T12:01:00.000Z'; } },
});

const registry = new InMemoryKnowledgeRegistry();
const reviewStore = new InMemoryReviewDecisionStore();
const snapshotStore = new InMemoryKnowledgeSnapshotStore();
const service = new ReadOnlyGovernanceQueryService({ registry, authorization, reviewStore, snapshotStore });
const handlers = new ReadOnlyGovernanceQueryHandlers({
  service,
  identityContext: new InMemoryRequestIdentityContext([
    { credential: 'membership-demo-token', actor: 'query-reader' },
  ]),
});

await registry.createDraft({
  knowledge: {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-ACCESS-QUERY-001',
    boundaryKey: 'access.membership-query',
    name: '项目成员只读查询边界',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: projectId },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { membershipRequired: true },
    owner: 'quality-platform-team',
    source: 'M1-F project membership example',
    riskLevel: 'high',
  },
  actor: 'knowledge-author',
  at,
  reason: 'create membership query example knowledge',
});

const response = await handlers.listKnowledge({
  context: { credential: 'membership-demo-token', requestId: 'm1-f-example' },
  projectId,
  query: { sortBy: 'id', direction: 'asc', limit: 10 },
});
process.stdout.write(`${JSON.stringify(response, null, 2)}\n`);
