import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ProjectAccessError } from '@kdtp/project-membership';
import {
  defineMembershipStoreContract,
  defineProjectDirectoryContract,
  defineReadAuthorizationContract,
} from '../../project-membership/test/contracts.js';
import { PROJECT, T0, T1, membershipCommand } from '../../project-membership/test/test-helpers.js';
import {
  applyProjectAccessPostgresMigrations,
  DEFAULT_PROJECT_ACCESS_MIGRATIONS_DIRECTORY,
  PostgresProjectDirectory,
  PostgresProjectMembershipAuthorization,
  PostgresProjectMembershipStore,
  PROJECT_ACCESS_POSTGRES_SCHEMA,
} from '../src/index.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('PostgreSQL project access tests require KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 8 });
  await applyProjectAccessPostgresMigrations({ pool });

  const reset = async () => {
    await pool.query(`TRUNCATE TABLE
      ${PROJECT_ACCESS_POSTGRES_SCHEMA}.membership_history,
      ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships,
      ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_history,
      ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects CASCADE`);
  };

  const createFixture = async () => {
    const directory = new PostgresProjectDirectory({ pool });
    const memberships = new PostgresProjectMembershipStore({ pool });
    const authorization = new PostgresProjectMembershipAuthorization({
      pool,
      clock: { async now() { return T1; } },
    });
    return { directory, memberships, authorization };
  };

  defineProjectDirectoryContract(test, createFixture, { beforeEach: reset });
  defineMembershipStoreContract(test, createFixture, { beforeEach: reset });
  defineReadAuthorizationContract(test, createFixture, { beforeEach: reset });

  test('PostgreSQL project access adapters restore records across instances', { concurrency: false }, async () => {
    await reset();
    const firstDirectory = new PostgresProjectDirectory({ pool });
    const firstMemberships = new PostgresProjectMembershipStore({ pool });
    await firstDirectory.createProject({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
    await firstMemberships.createMembership(membershipCommand());

    const secondDirectory = new PostgresProjectDirectory({ pool });
    const secondMemberships = new PostgresProjectMembershipStore({ pool });
    assert.equal((await secondDirectory.getProject({ projectId: PROJECT })).revision, 1);
    assert.deepEqual((await secondMemberships.getMembership({ projectId: PROJECT, subject: 'reader' })).roles, ['VIEWER']);
  });

  test('concurrent membership updates with one revision allow exactly one winner', { concurrency: false }, async () => {
    await reset();
    const directory = new PostgresProjectDirectory({ pool });
    const memberships = new PostgresProjectMembershipStore({ pool });
    await directory.createProject({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
    await memberships.createMembership(membershipCommand());

    const results = await Promise.allSettled([
      memberships.replaceMembership({
        projectId: PROJECT,
        subject: 'reader',
        expectedRevision: 1,
        roles: ['AUDITOR'],
        actor: 'admin-1',
        at: T1,
        reason: 'promote to auditor',
      }),
      memberships.replaceMembership({
        projectId: PROJECT,
        subject: 'reader',
        expectedRevision: 1,
        roles: ['REVIEWER'],
        actor: 'admin-2',
        at: T1,
        reason: 'promote to reviewer',
      }),
    ]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
    assert.equal(results.find((item) => item.status === 'rejected').reason.code, 'REVISION_CONFLICT');
    assert.equal((await memberships.getMembership({ projectId: PROJECT, subject: 'reader' })).revision, 2);
  });

  test('database rejects mutation of project and membership history', { concurrency: false }, async () => {
    await reset();
    const directory = new PostgresProjectDirectory({ pool });
    const memberships = new PostgresProjectMembershipStore({ pool });
    await directory.createProject({ projectId: PROJECT, name: 'Approval', actor: 'admin', at: T0, reason: 'create' });
    await memberships.createMembership(membershipCommand());
    await assert.rejects(
      pool.query(`UPDATE ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_history SET reason = 'tampered' WHERE project_id = $1`, [PROJECT]),
      (error) => error.code === '55000',
    );
    await assert.rejects(
      pool.query(`DELETE FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.membership_history WHERE project_id = $1`, [PROJECT]),
      (error) => error.code === '55000',
    );
  });

  test('project access migration runner is idempotent and checksum protected', { concurrency: false }, async () => {
    const result = await applyProjectAccessPostgresMigrations({ pool });
    assert.deepEqual(result.applied, []);
    const directory = await mkdtemp(join(tmpdir(), 'kdtp-access-checksum-'));
    try {
      await cp(
        join(DEFAULT_PROJECT_ACCESS_MIGRATIONS_DIRECTORY, '0001_create_project_access.sql'),
        join(directory, '0001_create_project_access.sql'),
      );
      const probe = join(directory, '9000_access_probe.sql');
      await writeFile(probe, 'SELECT 1;\n');
      await applyProjectAccessPostgresMigrations({ pool, migrationsDirectory: directory });
      await writeFile(probe, 'SELECT 2;\n');
      await assert.rejects(
        applyProjectAccessPostgresMigrations({ pool, migrationsDirectory: directory }),
        (error) => error instanceof ProjectAccessError && error.code === 'PROJECT_ACCESS_MIGRATION_CHECKSUM_MISMATCH',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  after(async () => { await pool.end(); });
}
