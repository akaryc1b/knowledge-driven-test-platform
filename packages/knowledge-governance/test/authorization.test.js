import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryProjectAuthorization } from '../src/index.js';
import { PROJECT } from './test-helpers.js';

test('authorization grants merge actions and roles for the same project actor', async () => {
  const authorization = new InMemoryProjectAuthorization([
    { projectId: PROJECT, actor: 'author', actions: ['KNOWLEDGE_CREATE'], roles: ['author'] },
    { projectId: PROJECT, actor: 'author', actions: ['KNOWLEDGE_REVIEW'], roles: ['reviewer'] },
  ]);
  const create = await authorization.authorize({
    projectId: PROJECT,
    actor: 'author',
    action: 'KNOWLEDGE_CREATE',
  });
  const review = await authorization.authorize({
    projectId: PROJECT,
    actor: 'author',
    action: 'KNOWLEDGE_REVIEW',
  });
  assert.equal(create.allowed, true);
  assert.equal(review.allowed, true);
  assert.deepEqual(review.roles, ['author', 'reviewer']);
});
