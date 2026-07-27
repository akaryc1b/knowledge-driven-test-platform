import { once } from 'node:events';
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
  ReadOnlyGovernanceQueryHandlers,
  ReadOnlyGovernanceQueryService,
} from '../packages/governance-query/src/index.js';
import {
  AuthenticatedRequestIdentityContext,
  InMemoryBearerAuthentication,
  InMemoryFixedWindowRateLimiter,
  ReadOnlyGovernanceHttpTransport,
  createReadOnlyNodeHttpServer,
} from '../packages/governance-http/src/index.js';

const projectId = 'approval-platform';
const at = '2026-07-27T12:00:00.000Z';
const directory = new InMemoryProjectDirectory();
await directory.createProject({
  projectId,
  name: 'Approval Platform',
  actor: 'platform-admin',
  at,
  reason: 'register project for HTTP example',
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
  reason: 'grant read-only HTTP membership',
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
  identityContext: new AuthenticatedRequestIdentityContext(),
});
const transport = new ReadOnlyGovernanceHttpTransport({
  handlers,
  authentication: new InMemoryBearerAuthentication([
    { token: 'membership-http-demo-token', actor: 'query-reader' },
  ]),
  rateLimiter: new InMemoryFixedWindowRateLimiter({ limit: 10, windowMs: 60_000 }),
});

await registry.createDraft({
  knowledge: {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-HTTP-QUERY-001',
    boundaryKey: 'http.read-only-query',
    name: '只读 HTTP 查询边界',
    version: '1.0.0',
    status: 'DRAFT',
    scope: { level: 'PROJECT', key: projectId },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { methods: ['GET'] },
    owner: 'quality-platform-team',
    source: 'M1-G read-only HTTP example',
    riskLevel: 'high',
  },
  actor: 'knowledge-author',
  at,
  reason: 'create HTTP example knowledge',
});

const server = createReadOnlyNodeHttpServer({ transport });
server.listen(0, '127.0.0.1');
await once(server, 'listening');
try {
  const address = server.address();
  const response = await fetch(
    `http://127.0.0.1:${address.port}/v1/projects/${projectId}/knowledge?sortBy=id&direction=asc&limit=10`,
    {
      headers: {
        authorization: 'Bearer membership-http-demo-token',
        accept: 'application/json',
        'x-request-id': 'm1-g-example',
      },
    },
  );
  const body = await response.json();
  process.stdout.write(`${JSON.stringify({
    status: response.status,
    requestId: response.headers.get('x-request-id'),
    securityHeaders: {
      cacheControl: response.headers.get('cache-control'),
      frameOptions: response.headers.get('x-frame-options'),
      contentTypeOptions: response.headers.get('x-content-type-options'),
    },
    body,
  }, null, 2)}\n`);
} finally {
  server.close();
  await once(server, 'close');
}
