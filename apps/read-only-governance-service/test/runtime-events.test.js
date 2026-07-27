import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough } from 'node:stream';
import {
  InMemoryRuntimeEventSink,
  JsonLineRuntimeEventSink,
  RuntimeAuthenticationEventSink,
  createRuntimeEvent,
} from '../src/runtime-events.js';

test('records bounded structured runtime events', async () => {
  const sink = new InMemoryRuntimeEventSink();
  await sink.record(createRuntimeEvent({
    type: 'SERVICE_STARTING',
    service: 'service-a',
    details: { migrationGroups: 3 },
  }));
  assert.equal(sink.list()[0].type, 'SERVICE_STARTING');
  assert.equal(sink.list()[0].details.migrationGroups, 3);
});

test('rejects sensitive runtime detail keys', () => {
  assert.throws(() => createRuntimeEvent({
    type: 'SERVICE_FAILED',
    service: 'service-a',
    details: { databaseUrl: 'postgres://secret' },
  }), (error) => error.code === 'INVALID_RUNTIME_EVENT');
});

test('writes one JSON object per line', async () => {
  const stream = new PassThrough();
  let output = '';
  stream.on('data', (chunk) => { output += chunk; });
  const sink = new JsonLineRuntimeEventSink({ stream });
  await sink.record(createRuntimeEvent({ type: 'SERVICE_READY', service: 'service-a' }));
  assert.equal(output.endsWith('\n'), true);
  assert.equal(JSON.parse(output).type, 'SERVICE_READY');
});

test('authentication adapter preserves only bounded event fields', async () => {
  const runtime = new InMemoryRuntimeEventSink();
  const sink = new RuntimeAuthenticationEventSink({ runtimeEvents: runtime, serviceName: 'service-a' });
  await sink.record({
    type: 'AUTHENTICATION_FAILED',
    at: '2026-07-27T12:00:00.000Z',
    requestId: 'request-1',
    issuer: 'https://id.example.com',
    reasonCode: 'JWT_EXPIRED',
    subjectFingerprint: 'a'.repeat(64),
  });
  const event = runtime.list()[0];
  assert.equal(event.type, 'AUTHENTICATION_EVENT');
  assert.equal(JSON.stringify(event).includes('Bearer'), false);
});
