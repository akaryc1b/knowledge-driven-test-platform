import test from 'node:test';
import {
  InMemoryProjectDirectory,
  InMemoryProjectMembershipStore,
  ProjectMembershipAuthorization,
} from '../src/index.js';
import {
  defineMembershipStoreContract,
  defineProjectDirectoryContract,
  defineReadAuthorizationContract,
} from './contracts.js';
import { T1 } from './test-helpers.js';

async function createFixture() {
  const directory = new InMemoryProjectDirectory();
  const memberships = new InMemoryProjectMembershipStore({ directory });
  const authorization = new ProjectMembershipAuthorization({
    directory,
    memberships,
    clock: { async now() { return T1; } },
  });
  return { directory, memberships, authorization };
}

defineProjectDirectoryContract(test, createFixture);
defineMembershipStoreContract(test, createFixture);
defineReadAuthorizationContract(test, createFixture);
