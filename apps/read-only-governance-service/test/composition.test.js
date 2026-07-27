import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
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

test('composition runs migrations, warms JWKS and creates all service components', async () => {
  const calls = [];
  const pool = {
    async connect() { return { query: async () => ({ rows: [], rowCount: 0 }), release() {} }; },
    async query() { return { rows: [{ '?column?': 1 }], rowCount: 1 }; },
    async end() {},
  };
  const jwksProvider = {
    async refresh(request) { calls.push(['jwks', request.force]); },
    async getSigningKey() { return {}; },
  };
  const runtimeEvents = new InMemoryRuntimeEventSink();
  const migrations = [1, 2, 3].map((value) => async ({ pool: received }) => {
    assert.equal(received, pool);
    calls.push(['migration', value]);
  });
  const result = await createReadOnlyServiceComposition({
    config,
    pool,
    jwksProvider,
    runtimeEvents,
    migrations,
    serverFactory: () => new FakeServer(),
    requestIdFactory: () => 'request-id',
  });
  assert.deepEqual(calls, [
    ['migration', 1], ['migration', 2], ['migration', 3], ['jwks', false],
  ]);
  assert.ok(result.service);
  assert.ok(result.components.registry);
  assert.ok(result.components.authorization);
  assert.ok(result.components.transport);
  assert.ok(result.components.readiness);
  assert.deepEqual(runtimeEvents.list().map((event) => event.type), [
    'SERVICE_STARTING', 'MIGRATIONS_APPLIED', 'JWKS_WARMED',
  ]);
});
