import test from 'node:test';
import assert from 'node:assert/strict';
import { fixture, fixedClock, membershipCommand, PROJECT, T0, T1, T2 } from './test-helpers.js';

async function authorize(setup, action = 'KNOWLEDGE_READ', actor = 'reader') {
  return setup.authorization.authorize({ projectId: PROJECT, actor, action });
}

test('active viewer membership grants read and denies write', async () => {
  const setup = await fixture();
  await setup.memberships.createMembership(membershipCommand());
  assert.equal((await authorize(setup)).allowed, true);
  assert.equal((await authorize(setup, 'KNOWLEDGE_EDIT')).allowed, false);
});

test('missing membership is denied by default', async () => {
  const setup = await fixture();
  const result = await authorize(setup);
  assert.equal(result.allowed, false);
  assert.equal(result.reason, 'membership not found');
});

test('suspended project denies otherwise active member', async () => {
  const setup = await fixture();
  await setup.memberships.createMembership(membershipCommand());
  await setup.directory.updateProject({
    projectId: PROJECT,
    expectedRevision: 1,
    status: 'SUSPENDED',
    actor: 'admin',
    at: T1,
    reason: 'pause project',
  });
  assert.equal((await authorize(setup)).reason, 'project suspended');
});

test('suspended and revoked memberships deny access', async () => {
  const setup = await fixture();
  await setup.memberships.createMembership(membershipCommand());
  await setup.memberships.replaceMembership({
    projectId: PROJECT,
    subject: 'reader',
    expectedRevision: 1,
    status: 'SUSPENDED',
    actor: 'admin',
    at: T1,
    reason: 'pause member',
  });
  assert.equal((await authorize(setup)).reason, 'membership suspended');
});

test('membership validity window is enforced with exclusive end', async () => {
  const future = await fixture({ clock: fixedClock(T0) });
  await future.memberships.createMembership(membershipCommand({ validFrom: T1 }));
  assert.equal((await authorize(future)).reason, 'membership not active yet');

  const expired = await fixture({ clock: fixedClock(T2) });
  await expired.memberships.createMembership(membershipCommand({ validUntil: T2 }));
  assert.equal((await authorize(expired)).reason, 'membership expired');
});

test('role actions support governance and audit separation', async () => {
  const setup = await fixture();
  await setup.memberships.createMembership(membershipCommand({ roles: ['REVIEWER'] }));
  assert.equal((await authorize(setup, 'KNOWLEDGE_REVIEW')).allowed, true);
  assert.equal((await authorize(setup, 'AUDIT_READ')).allowed, true);
  assert.equal((await authorize(setup, 'KNOWLEDGE_PUBLISH')).allowed, false);
});

test('project administrator receives every governance action', async () => {
  const setup = await fixture();
  await setup.memberships.createMembership(membershipCommand({ roles: ['PROJECT_ADMIN'] }));
  assert.equal((await authorize(setup, 'KNOWLEDGE_PUBLISH')).allowed, true);
  assert.equal((await authorize(setup, 'SNAPSHOT_PERSIST')).allowed, true);
});
