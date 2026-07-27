import { createServer } from 'node:http';
import {
  InMemoryRuntimeEventSink,
  ManagedReadOnlyService,
  ReadinessCoordinator,
  createOperationalNodeHttpHandler,
} from '../apps/read-only-governance-service/src/index.js';

const runtimeEvents = new InMemoryRuntimeEventSink();
const pool = {
  async query() { return { rows: [{ ok: 1 }], rowCount: 1 }; },
  async end() {},
};
const jwks = { async refresh() {} };
const readiness = new ReadinessCoordinator({
  serviceName: 'kdtp-read-only-example',
  checks: [
    { name: 'postgres', async check() { await pool.query('SELECT 1'); } },
    { name: 'jwks', async check() { await jwks.refresh(); } },
  ],
  runtimeEvents,
});
const handler = createOperationalNodeHttpHandler({
  businessHandler(_request, response) {
    response.statusCode = 404;
    response.end();
  },
  readiness,
  requestIdFactory: () => 'm1-i-example',
});
const server = createServer(handler);
const service = new ManagedReadOnlyService({
  server,
  pool,
  readiness,
  runtimeEvents,
  config: {
    serviceName: 'kdtp-read-only-example',
    http: {
      host: '127.0.0.1',
      port: 0,
      requestTimeoutMs: 5000,
      headersTimeoutMs: 5000,
      keepAliveTimeoutMs: 1000,
    },
    operations: { shutdownTimeoutMs: 1000 },
  },
});
const address = await service.start();
const live = await fetch(`http://127.0.0.1:${address.port}/live`);
const ready = await fetch(`http://127.0.0.1:${address.port}/ready`);
await service.stop('example-complete');
process.stdout.write(`${JSON.stringify({
  live: { status: live.status, body: await live.json() },
  ready: { status: ready.status, body: await ready.json() },
  eventTypes: runtimeEvents.list().map((event) => event.type),
}, null, 2)}\n`);
