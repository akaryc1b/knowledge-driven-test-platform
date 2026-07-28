import { EventEmitter } from 'node:events';
import {
  InMemoryKnowledgeSnapshotStore,
  InMemoryProjectAuthorization,
  InMemoryReviewDecisionStore,
} from '@kdtp/knowledge-governance';
import { InMemoryKnowledgeRegistry } from '@kdtp/knowledge-registry';
import { InMemoryTestPlanRegistry } from '@kdtp/test-plan-registry';
import {
  InMemoryRuntimeEventSink,
  createReadOnlyServiceComposition,
  isReadOnlyTestPlanPath,
  loadServiceConfig,
} from '../apps/read-only-governance-service/src/index.js';

class ExampleServer extends EventEmitter {
  listen() {}
  close(callback) { callback?.(); }
  address() { return { address: '127.0.0.1', port: 0 }; }
}

const calls = [];
const config = loadServiceConfig({
  KDTP_SERVICE_NAME: 'm2-h-example',
  KDTP_DATABASE_URL: 'postgresql://example:password@postgres.example/kdtp',
  KDTP_OIDC_ISSUER: 'https://id.example.test',
  KDTP_OIDC_JWKS_URI: 'https://id.example.test/jwks',
  KDTP_OIDC_AUDIENCE: 'kdtp-read-api',
  KDTP_OIDC_SUBJECT_MAPPINGS_JSON: '[{"subject":"example-subject","actor":"example-auditor"}]',
});
const authorization = new InMemoryProjectAuthorization([{
  projectId: 'approval-platform',
  actor: 'example-auditor',
  actions: ['KNOWLEDGE_READ', 'AUDIT_READ', 'SNAPSHOT_READ', 'PLAN_READ', 'PLAN_AUDIT_READ'],
}]);
const runtimeEvents = new InMemoryRuntimeEventSink();
const authentication = {
  async authenticate() { return { actor: 'example-auditor' }; },
};
const jwksProvider = {
  async refresh() { calls.push('jwks'); },
  async getSigningKey() { return {}; },
};
const pool = {
  async connect() { return { async query() { return { rows: [], rowCount: 0 }; }, release() {} }; },
  async query() { return { rows: [{ '?column?': 1 }], rowCount: 1 }; },
  async end() {},
};
const migrations = [1, 2, 3, 4].map((group) => async () => calls.push(`migration-${group}`));

const composition = await createReadOnlyServiceComposition({
  config,
  pool,
  migrations,
  jwksProvider,
  authentication,
  authorization,
  registry: new InMemoryKnowledgeRegistry(),
  reviewStore: new InMemoryReviewDecisionStore(),
  snapshotStore: new InMemoryKnowledgeSnapshotStore(),
  testPlanRegistry: new InMemoryTestPlanRegistry(),
  runtimeEvents,
  serverFactory: () => new ExampleServer(),
  requestIdFactory: () => 'm2-h-example-request',
});

console.log(JSON.stringify({
  schemaVersion: 'read-only-planning-service-example/v1',
  migrationGroups: calls.filter((item) => item.startsWith('migration-')).length,
  jwksWarmed: calls.includes('jwks'),
  knowledgeRoutes: 5,
  testPlanRoutes: 5,
  sharedAuthentication: composition.components.transport.authentication
    === composition.components.testPlanTransport.authentication,
  sharedRateLimiter: composition.components.transport.rateLimiter
    === composition.components.testPlanTransport.rateLimiter,
  sharedAuthorization: composition.components.queryService.authorization
    === composition.components.testPlanQueryService.authorization,
  dispatch: {
    knowledge: isReadOnlyTestPlanPath('/v1/projects/approval-platform/knowledge') ? 'plan' : 'knowledge',
    testPlan: isReadOnlyTestPlanPath('/v1/projects/approval-platform/test-plans') ? 'plan' : 'knowledge',
  },
  writesAllowed: false,
}, null, 2));
