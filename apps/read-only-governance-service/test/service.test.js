import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { ManagedReadOnlyService } from '../src/service.js';
import { InMemoryRuntimeEventSink } from '../src/runtime-events.js';

class FakeServer extends EventEmitter {
  constructor() { super(); this.listening = false; this.closed = 0; }
  listen(port, host) { this.port = port; this.host = host; this.listening = true; queueMicrotask(() => this.emit('listening')); }
  address() { return { address: this.host, port: this.port }; }
  close(callback) { this.closed += 1; this.listening = false; queueMicrotask(callback); }
  closeIdleConnections() { this.idleClosed = true; }
}

const config = {
  serviceName: 'service-a',
  http: { host: '127.0.0.1', port: 8080, requestTimeoutMs: 1000, headersTimeoutMs: 1000, keepAliveTimeoutMs: 1000 },
  operations: { shutdownTimeoutMs: 1000 },
};

test('managed service listens, marks readiness and closes pool once', async () => {
  const server = new FakeServer();
  let started = 0;
  let stopping = 0;
  let poolEnds = 0;
  const runtimeEvents = new InMemoryRuntimeEventSink();
  const service = new ManagedReadOnlyService({
    server,
    pool: { async end() { poolEnds += 1; } },
    readiness: { markStarted() { started += 1; }, markStopping() { stopping += 1; }, async ready() { return { statusCode: 200 }; } },
    runtimeEvents,
    config,
  });
  const address = await service.start();
  assert.equal(address.port, 8080);
  assert.equal(started, 1);
  await Promise.all([service.stop('test'), service.stop('test')]);
  assert.equal(stopping, 1);
  assert.equal(server.closed, 1);
  assert.equal(poolEnds, 1);
  assert.deepEqual(runtimeEvents.list().map((item) => item.type), [
    'SERVICE_LISTENING', 'SERVICE_STOPPING', 'SERVICE_STOPPED',
  ]);
});

test('startup readiness failure closes listener and pool before rejecting', async () => {
  const server = new FakeServer();
  let poolEnds = 0;
  const service = new ManagedReadOnlyService({
    server,
    pool: { async end() { poolEnds += 1; } },
    readiness: {
      markStarted() {},
      markStopping() {},
      async ready() { return { statusCode: 503 }; },
    },
    runtimeEvents: new InMemoryRuntimeEventSink(),
    config,
  });
  await assert.rejects(service.start(), (error) => error.code === 'SERVICE_STARTUP_NOT_READY');
  assert.equal(server.closed, 1);
  assert.equal(poolEnds, 1);
});
