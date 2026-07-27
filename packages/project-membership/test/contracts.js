import assert from 'node:assert/strict';
import { ProjectAccessError, ProjectMembershipAuthorization } from '../src/index.js';
import { membershipCommand, PROJECT, T0, T1, T2 } from './test-helpers.js';

export function defineProjectDirectoryContract(test, createFixture, options = {}) {
  test('project directory contract: create, defensive read, CAS and terminal archive', async () => {
    await options.beforeEach?.();
    const { directory } = await createFixture();
    const created = await directory.createProject({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
    created.name = 'mutated';
    assert.equal((await directory.getProject({ projectId: PROJECT })).name, 'Approval');
    const suspended = await directory.updateProject({ projectId: PROJECT, expectedRevision: 1, status: 'SUSPENDED', actor: 'admin', at: T1, reason: 'pause' });
    assert.equal(suspended.revision, 2);
    await assert.rejects(
      directory.updateProject({ projectId: PROJECT, expectedRevision: 1, status: 'ACTIVE', actor: 'admin', at: T2, reason: 'stale' }),
      (error) => error instanceof ProjectAccessError && error.code === 'REVISION_CONFLICT',
    );
  });
}

export function defineMembershipStoreContract(test, createFixture, options = {}) {
  test('membership store contract: append audit, defensive read, filters and CAS', async () => {
    await options.beforeEach?.();
    const { directory, memberships } = await createFixture();
    await directory.createProject({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
    await memberships.createMembership(membershipCommand());
    const updated = await memberships.replaceMembership({
      projectId: PROJECT,
      subject: 'reader',
      expectedRevision: 1,
      roles: ['AUDITOR'],
      actor: 'admin',
      at: T1,
      reason: 'promote',
    });
    assert.equal(updated.history.length, 2);
    const listed = await memberships.listMemberships({ projectId: PROJECT, status: 'ACTIVE' });
    assert.equal(listed.length, 1);
    listed[0].roles.push('VIEWER');
    assert.deepEqual((await memberships.getMembership({ projectId: PROJECT, subject: 'reader' })).roles, ['AUDITOR']);
    await assert.rejects(
      memberships.replaceMembership({
        projectId: PROJECT,
        subject: 'reader',
        expectedRevision: 1,
        roles: ['VIEWER'],
        actor: 'admin',
        at: T2,
        reason: 'stale',
      }),
      (error) => error instanceof ProjectAccessError && error.code === 'REVISION_CONFLICT',
    );
  });
}

export function defineReadAuthorizationContract(test, createFixture, options = {}) {
  test('read authorization contract: active viewer allowed, missing and expired membership denied', async () => {
    await options.beforeEach?.();
    const setup = await createFixture();
    await setup.directory.createProject({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
    await setup.memberships.createMembership(membershipCommand());
    const authorization = setup.authorization ?? new ProjectMembershipAuthorization({
      directory: setup.directory,
      memberships: setup.memberships,
      clock: { async now() { return T1; } },
    });
    assert.equal((await authorization.authorize({ projectId: PROJECT, actor: 'reader', action: 'KNOWLEDGE_READ' })).allowed, true);
    assert.equal((await authorization.authorize({ projectId: PROJECT, actor: 'unknown', action: 'KNOWLEDGE_READ' })).allowed, false);
  });
}
