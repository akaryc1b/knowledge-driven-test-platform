import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TestPlanRegistryError } from '@kdtp/test-plan-registry';
import { defineTestPlanRegistryContractTests } from '../../test-plan-registry/test/registry-contract.js';
import {
  T1,
  createCommand,
  transitionCommand,
} from '../../test-plan-registry/test/test-helpers.js';
import {
  applyTestPlanMigrations,
  DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY,
  PostgresTestPlanRegistry,
  TEST_PLAN_POSTGRES_SCHEMA,
} from '../src/index.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('Test Plan PostgreSQL integration tests require KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 12 });
  await applyTestPlanMigrations({ pool });

  const reset = async () => {
    await pool.query(
      `TRUNCATE TABLE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_review_decisions,
                      ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history,
                      ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records CASCADE`,
    );
  };

  defineTestPlanRegistryContractTests(
    'PostgresTestPlanRegistry',
    () => new PostgresTestPlanRegistry({ pool }),
    { beforeEach: reset },
  );

  test('PostgresTestPlanRegistry: restores records across adapter instances', { concurrency: false }, async () => {
    await reset();
    const first = new PostgresTestPlanRegistry({ pool });
    const created = await first.create(await createCommand());
    const second = new PostgresTestPlanRegistry({ pool });
    const restored = await second.get({ planId: created.planId });
    assert.equal(restored.contentDigest, created.contentDigest);
    assert.equal(restored.history.length, 1);
  });

  test('PostgresTestPlanRegistry: failed CAS rolls back record and history', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresTestPlanRegistry({ pool });
    const created = await registry.create(await createCommand());
    const reviewing = await registry.transition(transitionCommand(created, 'REVIEWING', T1));
    await assert.rejects(
      () => registry.transition({
        ...transitionCommand(reviewing, 'APPROVED', '2026-07-27T18:02:00.000Z'),
        expectedRevision: 1,
      }),
      (error) => error instanceof TestPlanRegistryError && error.code === 'REVISION_CONFLICT',
    );
    const stored = await registry.get({ planId: created.planId });
    assert.equal(stored.revision, 2);
    assert.equal(stored.history.length, 2);
    assert.equal(stored.status, 'REVIEWING');
  });

  test('Test Plan migration runner is idempotent', { concurrency: false }, async () => {
    const result = await applyTestPlanMigrations({ pool });
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.discovered, ['0001_create_test_plan_registry']);
  });

  test('Test Plan migration runner rejects changed checksums', { concurrency: false }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kdtp-plan-checksum-'));
    try {
      await cp(
        join(DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY, '0001_create_test_plan_registry.sql'),
        join(directory, '0001_create_test_plan_registry.sql'),
      );
      const probe = join(directory, '9000_checksum_probe.sql');
      await writeFile(probe, 'SELECT 1;\n');
      await applyTestPlanMigrations({ pool, migrationsDirectory: directory });
      await writeFile(probe, 'SELECT 2;\n');
      await assert.rejects(
        () => applyTestPlanMigrations({ pool, migrationsDirectory: directory }),
        (error) => error instanceof TestPlanRegistryError
          && error.code === 'TEST_PLAN_MIGRATION_CHECKSUM_MISMATCH',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('Test Plan migration failure rolls back all statements', { concurrency: false }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kdtp-plan-rollback-'));
    try {
      await cp(
        join(DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY, '0001_create_test_plan_registry.sql'),
        join(directory, '0001_create_test_plan_registry.sql'),
      );
      await writeFile(
        join(directory, '9001_rollback_probe.sql'),
        `CREATE TABLE ${TEST_PLAN_POSTGRES_SCHEMA}.rollback_probe(id integer);\nSELECT missing_function();\n`,
      );
      await assert.rejects(
        () => applyTestPlanMigrations({ pool, migrationsDirectory: directory }),
        (error) => error instanceof TestPlanRegistryError && error.code === 'PLAN_STORAGE_ERROR',
      );
      const table = await pool.query(
        `SELECT to_regclass('${TEST_PLAN_POSTGRES_SCHEMA}.rollback_probe') AS relation`,
      );
      assert.equal(table.rows[0].relation, null);
      const migration = await pool.query(
        `SELECT 1 FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_schema_migrations
          WHERE version = '9001_rollback_probe'`,
      );
      assert.equal(migration.rowCount, 0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('PostgreSQL protects history, decisions, frozen content and bindings', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresTestPlanRegistry({ pool });
    let record = await registry.create(await createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    record = await registry.transition(transitionCommand(record, 'APPROVED', '2026-07-27T18:02:00.000Z'));
    record = await registry.transition(transitionCommand(record, 'FROZEN', '2026-07-27T18:03:00.000Z'));

    await assert.rejects(
      () => pool.query(
        `UPDATE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history
            SET actor = 'tampered' WHERE plan_id = $1 AND revision = 1`,
        [record.planId],
      ),
      (error) => error.code === '55000',
    );
    await assert.rejects(
      () => pool.query(
        `UPDATE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
            SET snapshot_digest = $1 WHERE plan_id = $2`,
        ['a'.repeat(64), record.planId],
      ),
      (error) => error.code === '55000',
    );
    await assert.rejects(
      () => pool.query(
        `UPDATE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
            SET content_digest = $1 WHERE plan_id = $2`,
        ['b'.repeat(64), record.planId],
      ),
      (error) => ['55000', '23514'].includes(error.code),
    );
  });


  test('PostgreSQL rejects direct lifecycle skips and non-DRAFT content changes', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresTestPlanRegistry({ pool });
    let record = await registry.create(await createCommand());
    await assert.rejects(
      () => pool.query(
        `UPDATE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
            SET status = 'FROZEN', revision = revision + 1,
                updated_at = updated_at + interval '1 second', updated_by = 'tamper'
          WHERE plan_id = $1`,
        [record.planId],
      ),
      (error) => error.code === '55000',
    );
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    await assert.rejects(
      () => pool.query(
        `UPDATE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
            SET content_digest = $1, revision = revision + 1,
                updated_at = updated_at + interval '1 second', updated_by = 'tamper'
          WHERE plan_id = $2`,
        ['c'.repeat(64), record.planId],
      ),
      (error) => ['55000', '23514'].includes(error.code),
    );
  });

  test('PostgreSQL review evidence enforces exact project and revision bindings', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresTestPlanRegistry({ pool });
    let record = await registry.create(await createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    await assert.rejects(
      () => registry.appendReviewDecision(reviewDecision(record, { projectId: 'other-project' })),
      (error) => error.code === 'PLAN_REVIEW_BINDING_MISMATCH',
    );
    await assert.rejects(
      () => registry.appendReviewDecision(reviewDecision(record, { planRevision: 99 })),
      (error) => error.code === 'PLAN_REVISION_NOT_FOUND',
    );
  });

  after(async () => {
    await pool.end();
  });
}
