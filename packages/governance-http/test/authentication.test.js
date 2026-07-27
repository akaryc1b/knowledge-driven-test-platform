import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AuthenticatedRequestIdentityContext,
  HttpBoundaryError,
  InMemoryBearerAuthentication,
} from '../src/index.js';

const NOW = Date.parse('2026-07-27T12:00:00.000Z');

test('in-memory bearer authentication returns a defensive identity', async () => {
  const auth = new InMemoryBearerAuthentication([
    { token: 'known-token', actor: 'reader', attributes: { teams: ['quality'] } },
  ], { clock: () => NOW });
  const first = await auth.authenticate({ scheme: 'Bearer', credential: 'known-token' });
  first.attributes.teams.push('mutated');
  const second = await auth.authenticate({ scheme: 'Bearer', credential: 'known-token' });
  assert.deepEqual(second, { actor: 'reader', attributes: { teams: ['quality'] } });
});

test('disabled, expired and unknown bearer credentials are rejected generically', async () => {
  const auth = new InMemoryBearerAuthentication([
    { token: 'disabled-token', actor: 'disabled', disabled: true },
    { token: 'expired-token', actor: 'expired', expiresAt: '2026-07-27T11:59:59.000Z' },
  ], { clock: () => NOW });
  for (const credential of ['disabled-token', 'expired-token', 'unknown-token']) {
    await assert.rejects(
      auth.authenticate({ scheme: 'Bearer', credential }),
      (error) => error instanceof HttpBoundaryError && error.code === 'UNAUTHENTICATED' && error.status === 401,
    );
  }
});

test('authenticated identity context only accepts transport-provided identity', async () => {
  const context = new AuthenticatedRequestIdentityContext();
  assert.deepEqual(await context.resolve({ authenticatedIdentity: { actor: 'reader', attributes: {} } }), {
    actor: 'reader',
    attributes: {},
  });
  await assert.rejects(context.resolve({ credential: 'raw-token' }), (error) => error.code === 'UNAUTHENTICATED');
});
