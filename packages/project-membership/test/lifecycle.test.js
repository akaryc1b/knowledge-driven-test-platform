import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ProjectAccessError,
  createMembershipRecord,
  createProjectRecord,
  replaceMembershipRecord,
  updateProjectRecord,
} from '../src/index.js';
import { membershipCommand, PROJECT, T0, T1, T2 } from './test-helpers.js';

test('project directory record uses revision CAS and terminal archive', () => {
  let record = createProjectRecord({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
  record = updateProjectRecord(record, { expectedRevision: 1, status: 'SUSPENDED', actor: 'admin', at: T1, reason: 'pause' });
  record = updateProjectRecord(record, { expectedRevision: 2, status: 'ARCHIVED', actor: 'admin', at: T2, reason: 'archive' });
  assert.equal(record.status, 'ARCHIVED');
  assert.throws(
    () => updateProjectRecord(record, { expectedRevision: 3, status: 'ACTIVE', actor: 'admin', at: '2026-07-27T12:03:00.000Z', reason: 'restore' }),
    (error) => error instanceof ProjectAccessError && error.code === 'INVALID_PROJECT_STATUS_TRANSITION',
  );
});

test('membership roles are normalized and revoked membership is terminal', () => {
  let record = createMembershipRecord(membershipCommand({ roles: ['REVIEWER', 'VIEWER'] }));
  assert.deepEqual(record.roles, ['REVIEWER', 'VIEWER']);
  record = replaceMembershipRecord(record, {
    expectedRevision: 1,
    status: 'REVOKED',
    actor: 'admin',
    at: T1,
    reason: 'revoke',
  });
  assert.throws(
    () => replaceMembershipRecord(record, {
      expectedRevision: 2,
      roles: ['VIEWER'],
      actor: 'admin',
      at: T2,
      reason: 'edit revoked',
    }),
    (error) => error instanceof ProjectAccessError && error.code === 'MEMBERSHIP_NOT_EDITABLE',
  );
});

test('membership validity end must be later than start', () => {
  assert.throws(
    () => createMembershipRecord(membershipCommand({ validUntil: T0 })),
    (error) => error instanceof ProjectAccessError && error.code === 'INVALID_MEMBERSHIP_VALIDITY',
  );
});
