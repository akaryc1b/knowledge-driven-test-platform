import test from 'node:test';
import assert from 'node:assert/strict';
import {
  InMemoryRequestIdentityContext,
  QueryError,
} from '../src/index.js';

test('identity context resolves defensive actor metadata', async () => {
  const identities = new InMemoryRequestIdentityContext([
    { credential: 'reader-token', actor: 'reader', attributes: { team: 'quality' } },
  ]);
  const first = await identities.resolve({ credential: 'reader-token' });
  first.attributes.team = 'mutated';
  const second = await identities.resolve({ credential: 'reader-token' });
  assert.equal(second.actor, 'reader');
  assert.equal(second.attributes.team, 'quality');
});

test('identity context rejects missing or unknown credentials', async () => {
  const identities = new InMemoryRequestIdentityContext();
  await assert.rejects(
    identities.resolve({}),
    (error) => error instanceof QueryError && error.code === 'UNAUTHENTICATED',
  );
  await assert.rejects(
    identities.resolve({ credential: 'unknown' }),
    (error) => error instanceof QueryError && error.code === 'UNAUTHENTICATED',
  );
});
