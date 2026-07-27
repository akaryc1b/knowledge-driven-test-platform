import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { HttpBoundaryError } from '@kdtp/governance-http';
import {
  InMemoryAuthenticationEventSink,
  RemoteJwksProvider,
} from '../src/index.js';
import { createRsaKey, ISSUER, jsonResponse, NOW_MS } from './test-helpers.js';

const first = createRsaKey('key-old');
const second = createRsaKey('key-new');

test('JWKS cache avoids repeated fetches and respects bounded max-age', async () => {
  let calls = 0;
  let now = NOW_MS;
  const provider = new RemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example.test/jwks.json',
    fetcher: async () => {
      calls += 1;
      return jsonResponse({ keys: [first.publicJwk] }, { cacheControl: 'public, max-age=3600' });
    },
    clock: () => now,
    cacheTtlMs: 100,
    maxCacheTtlMs: 200,
  });
  await provider.getSigningKey({ issuer: ISSUER, kid: first.kid, alg: 'RS256' });
  now += 150;
  await provider.getSigningKey({ issuer: ISSUER, kid: first.kid, alg: 'RS256' });
  assert.equal(calls, 1);
  now += 51;
  await provider.getSigningKey({ issuer: ISSUER, kid: first.kid, alg: 'RS256' });
  assert.equal(calls, 2);
});

test('unknown kid triggers one controlled refresh for key rotation', async () => {
  let calls = 0;
  let now = NOW_MS;
  const documents = [
    { keys: [first.publicJwk] },
    { keys: [first.publicJwk, second.publicJwk] },
  ];
  const provider = new RemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example.test/jwks.json',
    fetcher: async () => jsonResponse(documents[Math.min(calls++, 1)]),
    clock: () => now,
    minimumRefreshIntervalMs: 1000,
  });
  await provider.getSigningKey({ issuer: ISSUER, kid: first.kid, alg: 'RS256' });
  now += 1001;
  const rotated = await provider.getSigningKey({ issuer: ISSUER, kid: second.kid, alg: 'RS256' });
  assert.equal(rotated.kid, second.kid);
  assert.equal(calls, 2);
});

test('concurrent JWKS requests share one in-flight refresh', async () => {
  let calls = 0;
  let release;
  const wait = new Promise((resolve) => { release = resolve; });
  const provider = new RemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example.test/jwks.json',
    fetcher: async () => {
      calls += 1;
      await wait;
      return jsonResponse({ keys: [first.publicJwk] });
    },
    clock: () => NOW_MS,
  });
  const pending = Array.from({ length: 8 }, () => provider.getSigningKey({
    issuer: ISSUER,
    kid: first.kid,
    alg: 'RS256',
  }));
  release();
  await Promise.all(pending);
  assert.equal(calls, 1);
});

test('malformed, oversized and wrong-content-type JWKS responses fail closed', async () => {
  const responses = [
    new Response('{', { status: 200, headers: { 'content-type': 'application/json' } }),
    jsonResponse({ keys: Array.from({ length: 33 }, (_, index) => ({
      ...first.publicJwk,
      kid: `key-${index}`,
    })) }),
    new Response(JSON.stringify({ keys: [first.publicJwk] }), {
      status: 200,
      headers: { 'content-type': 'text/plain' },
    }),
  ];
  for (const response of responses) {
    const provider = new RemoteJwksProvider({
      issuer: ISSUER,
      jwksUri: 'https://issuer.example.test/jwks.json',
      fetcher: async () => response,
      clock: () => NOW_MS,
    });
    await assert.rejects(
      provider.getSigningKey({ issuer: ISSUER, kid: first.kid, alg: 'RS256' }),
      (error) => error instanceof HttpBoundaryError && error.status === 503,
    );
  }
});

test('JWKS provider rejects RSA keys smaller than 2048 bits', async () => {
  const weak = createRsaKey('weak-key', 1024);
  const provider = new RemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example.test/jwks.json',
    fetcher: async () => jsonResponse({ keys: [weak.publicJwk] }),
    clock: () => NOW_MS,
  });
  await assert.rejects(
    provider.getSigningKey({ issuer: ISSUER, kid: weak.kid, alg: 'RS256' }),
    (error) => error instanceof HttpBoundaryError && error.status === 503,
  );
});

test('JWKS endpoint requires HTTPS unless explicitly enabled for local tests', () => {
  assert.throws(
    () => new RemoteJwksProvider({
      issuer: ISSUER,
      jwksUri: 'http://issuer.example.test/jwks.json',
      fetcher: async () => jsonResponse({ keys: [first.publicJwk] }),
    }),
    (error) => error instanceof HttpBoundaryError && error.code === 'INVALID_OIDC_CONFIG',
  );
});

test('real local HTTP JWKS server works only through the explicit test override', async () => {
  let calls = 0;
  const server = createServer((request, response) => {
    calls += 1;
    response.writeHead(200, {
      'content-type': 'application/jwk-set+json',
      'cache-control': 'max-age=60',
    });
    response.end(JSON.stringify({ keys: [first.publicJwk] }));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  try {
    const address = server.address();
    const provider = new RemoteJwksProvider({
      issuer: 'http://127.0.0.1',
      jwksUri: `http://127.0.0.1:${address.port}/jwks.json`,
      allowHttpForTesting: true,
      clock: () => NOW_MS,
    });
    const key = await provider.getSigningKey({
      issuer: 'http://127.0.0.1',
      kid: first.kid,
      alg: 'RS256',
    });
    assert.equal(key.kid, first.kid);
    assert.equal(calls, 1);
  } finally {
    server.close();
    await once(server, 'close');
  }
});

test('JWKS refresh emits a bounded event without key material', async () => {
  const sink = new InMemoryAuthenticationEventSink();
  const provider = new RemoteJwksProvider({
    issuer: ISSUER,
    jwksUri: 'https://issuer.example.test/jwks.json',
    fetcher: async () => jsonResponse({ keys: [first.publicJwk] }),
    clock: () => NOW_MS,
    eventSink: sink,
  });
  await provider.getSigningKey({ issuer: ISSUER, kid: first.kid, alg: 'RS256', requestId: 'jwks-event' });
  const [event] = sink.list();
  assert.equal(event.type, 'JWKS_REFRESHED');
  assert.equal(event.keyCount, 1);
  const serialized = JSON.stringify(event);
  assert.equal(serialized.includes(first.publicJwk.n), false);
});
