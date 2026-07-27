import test from 'node:test';
import assert from 'node:assert/strict';
import { ProjectAccessError } from '../src/index.js';
import { fixture, membershipCommand, PROJECT, T1, T2 } from './test-helpers.js';

test('in-memory stores return defensive copies and sorted lists', async () => {
  const { directory, memberships } = await fixture();
  await memberships.createMembership(membershipCommand({ subject: 'z-user' }));
  await memberships.createMembership(membershipCommand({ subject: 'a-user' }));
  const listed = await memberships.listMemberships({ projectId: PROJECT });
  assert.deepEqual(listed.map((item) => item.subject), ['a-user', 'z-user']);
  listed[0].roles.push('AUDITOR');
  assert.deepEqual((await memberships.getMembership({ projectId: PROJECT, subject: 'a-user' })).roles, ['VIEWER']);
  const project = await directory.getProject({ projectId: PROJECT });
  project.name = 'mutated';
  assert.equal((await directory.getProject({ projectId: PROJECT })).name, 'Approval Platform');
});

test('membership update uses revision CAS', async () => {
  const { memberships } = await fixture();
  await memberships.createMembership(membershipCommand());
  await memberships.replaceMembership({
    projectId: PROJECT,
    subject: 'reader',
    expectedRevision: 1,
    roles: ['AUDITOR'],
    actor: 'admin',
    at: T1,
    reason: 'promote',
  });
  await assert.rejects(
    memberships.replaceMembership({
      projectId: PROJECT,
      subject: 'reader',
      expectedRevision: 1,
      roles: ['VIEWER'],
      actor: 'admin',
      at: T2,
      reason: 'stale update',
    }),
    (error) => error instanceof ProjectAccessError && error.code === 'REVISION_CONFLICT',
  );
});

test('membership requires an existing project', async () => {
  const { memberships } = await fixture();
  await assert.rejects(
    memberships.createMembership(membershipCommand({ projectId: 'inventory-platform' })),
    (error) => error instanceof ProjectAccessError && error.code === 'PROJECT_NOT_FOUND',
  );
});
