import {
  InMemoryProjectDirectory,
  InMemoryProjectMembershipStore,
  ProjectMembershipAuthorization,
} from '../src/index.js';

export const PROJECT = 'approval-platform';
export const T0 = '2026-07-27T12:00:00.000Z';
export const T1 = '2026-07-27T12:01:00.000Z';
export const T2 = '2026-07-27T12:02:00.000Z';

export function fixedClock(at = T1) {
  return { async now() { return at; } };
}

export async function fixture(options = {}) {
  const directory = new InMemoryProjectDirectory();
  await directory.createProject({ projectId: PROJECT, name: 'Approval Platform', actor: 'admin', at: T0, reason: 'register project' });
  const memberships = new InMemoryProjectMembershipStore({ directory });
  const authorization = new ProjectMembershipAuthorization({
    directory,
    memberships,
    clock: options.clock ?? fixedClock(),
  });
  return { directory, memberships, authorization };
}

export function membershipCommand(overrides = {}) {
  return {
    projectId: PROJECT,
    subject: 'reader',
    roles: ['VIEWER'],
    validFrom: T0,
    validUntil: null,
    actor: 'admin',
    at: T0,
    reason: 'grant project access',
    ...overrides,
  };
}
