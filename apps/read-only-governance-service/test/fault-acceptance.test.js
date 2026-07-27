import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter, once } from 'node:events';
import { createServer, get as httpGet } from 'node:http';
import {
  ReadinessCoordinator,
  createJwksReadinessCheck,
  createPostgresReadinessCheck,
} from '../src/readiness.js';
import { createOperationalNodeHttpHandler } from '../src/operational-http.js';
import { InMemoryRuntimeEventSink } from '../src/runtime-events.js';
import { ManagedReadOnlyService, installShutdownSignals } from '../src/service.js';

test('PostgreSQL outage removes readiness and recovery restores it without restart', async () => {
  let available = true;
  const events = new InMemoryRuntimeEventSink();
  const readiness = new ReadinessCoordinator({
    serviceName: 'fault-service',
    checks: [createPostgresReadinessCheck({
      async query(sql) {
        assert.equal(sql, 'SELECT 1');
        if (!available) throw new Error('database unavailable');
      },
    })],
    runtimeEvents: events,
  });
  readiness.markStarted();
  assert.equal((await readiness.ready()).statusCode, 200);
  available = false;
  const failed = await readiness.ready();
  assert.equal(failed.statusCode, 503);
  assert.deepEqual(failed.body.checks, [{ name: 'postgres', status: 'failed' }]);
  assert.equal(readiness.live().status, 'live');
  available = true;
  assert.equal((await readiness.ready()).statusCode, 200);
  assert.deepEqual(events.list().map((event) => event.type), [
    'SERVICE_READY', 'SERVICE_NOT_READY', 'SERVICE_READY',
  ]);
});

test('JWKS outage is fail-closed for readiness and recovers after refresh succeeds', async () => {
  let available = true;
  let refreshes = 0;
  const readiness = new ReadinessCoordinator({
    serviceName: 'fault-service',
    checks: [createJwksReadinessCheck({
      async refresh(request) {
        assert.equal(request.force, false);
        refreshes += 1;
        if (!available) throw new Error('jwks unavailable');
      },
    })],
  });
  readiness.markStarted();
  assert.equal((await readiness.ready()).statusCode, 200);
  available = false;
  assert.equal((await readiness.ready()).statusCode, 503);
  available = true;
  assert.equal((await readiness.ready()).statusCode, 200);
  assert.equal(refreshes, 3);
});

test('operational server keeps liveness healthy while readiness dependency is unavailable', async (context) => {
  const readiness = new ReadinessCoordinator({
    serviceName: 'fault-service',
    checks: [{ name: 'postgres', async check() { throw new Error('unavailable'); } }],
  });
  readiness.markStarted();
  const server = createServer(createOperationalNodeHttpHandler({
    readiness,
    businessHandler(_request, response) {
      response.statusCode = 404;
      response.end();
    },
  }));
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(() => new Promise((resolve) => server.close(resolve)));
  const { port } = server.address();
  const live = await fetch(`http://127.0.0.1:${port}/live`);
  const ready = await fetch(`http://127.0.0.1:${port}/ready`);
  assert.equal(live.status, 200);
  assert.equal((await live.json()).status, 'live');
  assert.equal(ready.status, 503);
  assert.equal((await ready.json()).status, 'not_ready');
});

test('SIGTERM drains an active request before closing PostgreSQL pool', async () => {
  let enterRequest;
  const entered = new Promise((resolve) => { enterRequest = resolve; });
  let releaseRequest;
  const release = new Promise((resolve) => { releaseRequest = resolve; });
  const server = createServer(async (_request, response) => {
    enterRequest();
    await release;
    response.setHeader('connection', 'close');
    response.end('completed');
  });
  let poolEnds = 0;
  const events = new InMemoryRuntimeEventSink();
  const readiness = {
    markStarted() {},
    markStopping() { this.stopping = true; },
    async ready() { return { statusCode: 200 }; },
  };
  const service = new ManagedReadOnlyService({
    server,
    pool: { async end() { poolEnds += 1; } },
    readiness,
    runtimeEvents: events,
    config: {
      serviceName: 'fault-service',
      http: {
        host: '127.0.0.1', port: 0, requestTimeoutMs: 5000,
        headersTimeoutMs: 5000, keepAliveTimeoutMs: 1000,
      },
      operations: { shutdownTimeoutMs: 2000 },
    },
  });
  const processRef = new EventEmitter();
  processRef.exitCode = 0;
  const uninstall = installShutdownSignals(service, { processRef });
  const address = await service.start();
  const responsePromise = new Promise((resolve, reject) => {
    const request = httpGet({
      hostname: '127.0.0.1', port: address.port, path: '/slow',
      headers: { connection: 'close' },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ statusCode: response.statusCode, body }));
    });
    request.on('error', reject);
  });
  await entered;
  processRef.emit('SIGTERM', 'SIGTERM');
  assert.equal(readiness.stopping, true);
  assert.equal(poolEnds, 0);
  releaseRequest();
  assert.deepEqual(await responsePromise, { statusCode: 200, body: 'completed' });
  await service.stopping;
  uninstall();
  assert.equal(poolEnds, 1);
  const stopped = events.list().find((event) => event.type === 'SERVICE_STOPPED');
  assert.equal(stopped.details.forcedConnections, 0);
});
