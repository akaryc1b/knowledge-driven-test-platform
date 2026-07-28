import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY,
  loadTestPlanMigrations,
} from '../src/index.js';
import { TestPlanRegistryError } from '@kdtp/test-plan-registry';

test('loads Test Plan migrations in deterministic order with SHA-256 checksums', async () => {
  const migrations = await loadTestPlanMigrations();
  assert.deepEqual(migrations.map((item) => item.version), ['0001_create_test_plan_registry']);
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
  assert.equal(migrations[0].name, '0001_create_test_plan_registry.sql');
  assert.equal(DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY.endsWith('migrations/'), true);
});

test('rejects invalid and empty Test Plan migrations', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kdtp-test-plan-migrations-'));
  try {
    await writeFile(join(directory, 'bad-name.sql'), 'SELECT 1;\n');
    await assert.rejects(
      () => loadTestPlanMigrations(directory),
      (error) => error instanceof TestPlanRegistryError
        && error.code === 'INVALID_TEST_PLAN_MIGRATION_NAME',
    );
    await rm(join(directory, 'bad-name.sql'));
    await writeFile(join(directory, '0001_empty.sql'), '   \n');
    await assert.rejects(
      () => loadTestPlanMigrations(directory),
      (error) => error instanceof TestPlanRegistryError
        && error.code === 'EMPTY_TEST_PLAN_MIGRATION',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
