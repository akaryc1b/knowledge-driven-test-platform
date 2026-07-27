import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ReadinessCoordinator,
  createJwksReadinessCheck,
  createPostgresReadinessCheck,
} from '../src/readiness.js';
import { InMemoryRuntimeEventSink } from '../src/runtime-events.js';

test('liveness is independent from dependency readiness', () => {
  const readiness = new ReadinessCoordinator({
    serviceName: 'service-a',
    checks: [{ name: 'test', async check() {} }],
  });
  assert.equal(readiness.live().status, 'live');
});

test('readiness checks PostgreSQL and JWKS after startup', async () => {
  let queries = 0;
  let refreshes = 0;
  const runtimeEvents = new InMemoryRuntimeEventSink();
  const readiness = new ReadinessCoordinator({
    serviceName: 'service-a',
    checks: [
      createPostgresReadinessCheck({ async query(sql) { assert.equal(sql, 'SELECT 1'); queries += 1; } }),
      createJwksReadinessCheck({ async refresh() { refreshes += 1; } }),
    ],
    runtimeEvents,
  });
  readiness.markStarted();
  const result = await readiness.ready();
  assert.equal(result.statusCode, 200);
  assert.equal(queries, 1);
  assert.equal(refreshes, 1);
  assert.equal(runtimeEvents.list().at(-1).type, 'SERVICE_READY');
});

test('dependency failure and timeout return sanitized not-ready status', async () => {
  const readiness = new ReadinessCoordinator({
    serviceName: 'service-a',
    timeoutMs: 10,
    checks: [
      { name: 'failed', async check() { throw new Error('password=secret'); } },
      { name: 'slow', async check() { await new Promise(() => {}); } },
    ],
  });
  readiness.markStarted();
  const result = await readiness.ready();
  assert.equal(result.statusCode, 503);
  assert.deepEqual(result.body.checks, [
    { name: 'failed', status: 'failed' },
    { name: 'slow', status: 'failed' },
  ]);
  assert.equal(JSON.stringify(result).includes('secret'), false);
});

test('stopping service becomes not ready without dependency access', async () => {
  let checks = 0;
  const readiness = new ReadinessCoordinator({
    serviceName: 'service-a',
    checks: [{ name: 'test', async check() { checks += 1; } }],
  });
  readiness.markStarted();
  readiness.markStopping();
  const result = await readiness.ready();
  assert.equal(result.statusCode, 503);
  assert.equal(checks, 0);
});
