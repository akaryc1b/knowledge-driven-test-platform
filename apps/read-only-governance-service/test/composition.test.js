import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { createReadOnlyServiceComposition } from '../src/composition.js';
import { loadServiceConfig } from '../src/config.js';
import { InMemoryRuntimeEventSink } from '../src/runtime-events.js';

class FakeServer extends EventEmitter {
  listen() {}
  close(callback) { callback?.(); }
  address() { return { address: '127.0.0.1', port: 0 }; }
}

const config = loadServiceConfig({
  KDTP_DATABASE_URL: 'postgresql://user:password@db.example/kdtp',
  KDTP_OIDC_ISSUER: 'https://id.example.com',
  KDTP_OIDC_JWKS_URI: 'https://id.example.com/jwks',
  KDTP_OIDC_AUDIENCE: 'kdtp-api',
  KDTP_OIDC_SUBJECT_MAPPINGS_JSON: JSON.stringify([{ subject: 'subject-1', actor: 'reader-1' }]),
  KDTP_HTTP_PORT: '8080',
});

function fakePool() {
  return {
    async connect() { return { query: async () => ({ rows: [], rowCount: 0 }), release() {} }; },
    async query() { return { rows: [{ '?column?': 1 }], rowCount: 1 }; },
    async end() {},
  };
}

function fakeJwks(calls = []) {
  return {
    async refresh(request) { calls.push(['jwks', request.force]); },
    async getSigningKey() { return {}; },
  };
}

test('composition runs four migrations, warms JWKS and shares security dependencies across ten routes', async () => {
  const calls = [];
  const pool = fakePool();
  const jwksProvider = fakeJwks(calls);
  const runtimeEvents = new InMemoryRuntimeEventSink();
  const migrations = [1, 2, 3, 4].map((value) => async ({ pool: received }) => {
    assert.equal(received, pool);
    calls.push(['migration', value]);
  });
  const authorization = new InMemoryProjectAuthorization([
    { projectId: 'approval-platform', actor: 'reader-1', actions: ['KNOWLEDGE_READ', 'PLAN_READ'] },
  ]);
  const result = await createReadOnlyServiceComposition({
    config,
    pool,
    jwksProvider,
    authorization,
    runtimeEvents,
    migrations,
    serverFactory: () => new FakeServer(),
    requestIdFactory: () => 'request-id',
  });
  assert.deepEqual(calls, [
    ['migration', 1], ['migration', 2], ['migration', 3], ['migration', 4], ['jwks', false],
  ]);
  assert.ok(result.service);
  assert.ok(result.components.registry);
  assert.ok(result.components.testPlanRegistry);
  assert.ok(result.components.queryService);
  assert.ok(result.components.testPlanQueryService);
  assert.ok(result.components.transport);
  assert.ok(result.components.testPlanTransport);
  assert.ok(result.components.readiness);
  assert.equal(result.components.transport.authentication, result.components.testPlanTransport.authentication);
  assert.equal(result.components.transport.rateLimiter, result.components.testPlanTransport.rateLimiter);
  assert.equal(result.components.handlers.identityContext, result.components.testPlanHandlers.identityContext);
  assert.equal(result.components.queryService.authorization, authorization);
  assert.equal(result.components.testPlanQueryService.authorization, authorization);
  assert.deepEqual(runtimeEvents.list().map((event) => event.type), [
    'SERVICE_STARTING', 'MIGRATIONS_APPLIED', 'JWKS_WARMED',
  ]);
  assert.equal(runtimeEvents.list()[1].details.migrationGroups, 4);
});

test('fourth migration failure prevents JWKS warm-up and server construction', async () => {
  const calls = [];
  const pool = fakePool();
  const runtimeEvents = new InMemoryRuntimeEventSink();
  const migrations = [
    async () => calls.push('migration-1'),
    async () => calls.push('migration-2'),
    async () => calls.push('migration-3'),
    async () => { calls.push('migration-4'); throw new Error('test plan migration failed'); },
  ];
  let serverConstructed = false;
  await assert.rejects(
    createReadOnlyServiceComposition({
      config,
      pool,
      runtimeEvents,
      migrations,
      jwksProvider: fakeJwks(calls),
      serverFactory() { serverConstructed = true; return new FakeServer(); },
    }),
    /test plan migration failed/,
  );
  assert.deepEqual(calls, ['migration-1', 'migration-2', 'migration-3', 'migration-4']);
  assert.equal(serverConstructed, false);
  assert.deepEqual(runtimeEvents.list().map((event) => event.type), ['SERVICE_STARTING']);
});
