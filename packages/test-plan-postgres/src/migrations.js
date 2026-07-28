import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { TestPlanRegistryError } from '@kdtp/test-plan-registry';
import { withPostgresTransaction } from '@kdtp/knowledge-registry-postgres';
import { mapTestPlanPostgresError } from './postgres-errors.js';

export const TEST_PLAN_POSTGRES_SCHEMA = 'kdtp_test_plan';
export const DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations/', import.meta.url));
const MIGRATION_NAME_PATTERN = /^[0-9]{4}_[a-z0-9_]+\.sql$/;
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS ${TEST_PLAN_POSTGRES_SCHEMA};
CREATE TABLE IF NOT EXISTS ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export async function loadTestPlanMigrations(directory = DEFAULT_TEST_PLAN_MIGRATIONS_DIRECTORY) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0) {
    throw new TestPlanRegistryError('NO_TEST_PLAN_MIGRATIONS',
      'No Test Plan PostgreSQL migrations were found', { directory });
  }
  const migrations = [];
  for (const name of names) {
    if (!MIGRATION_NAME_PATTERN.test(name)) {
      throw new TestPlanRegistryError('INVALID_TEST_PLAN_MIGRATION_NAME',
        'Test Plan PostgreSQL migration name is invalid', { name });
    }
    const sql = await readFile(join(directory, name), 'utf8');
    if (sql.trim().length === 0) {
      throw new TestPlanRegistryError('EMPTY_TEST_PLAN_MIGRATION',
        'Test Plan PostgreSQL migration is empty', { name });
    }
    migrations.push({
      version: name.slice(0, -4),
      name,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }
  return migrations;
}

export async function applyTestPlanMigrations(input) {
  const migrations = await loadTestPlanMigrations(input?.migrationsDirectory);
  try {
    return await withPostgresTransaction(input?.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        'kdtp-test-plan-migrations-v1',
      ]);
      await client.query(BOOTSTRAP_SQL);
      const applied = [];
      for (const migration of migrations) {
        const existing = await client.query(
          `SELECT checksum FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_schema_migrations WHERE version = $1`,
          [migration.version],
        );
        if (existing.rowCount > 0) {
          if (existing.rows[0].checksum !== migration.checksum) {
            throw new TestPlanRegistryError('TEST_PLAN_MIGRATION_CHECKSUM_MISMATCH',
              `Test Plan PostgreSQL migration ${migration.version} checksum does not match`, {
                version: migration.version,
                expectedChecksum: existing.rows[0].checksum,
                actualChecksum: migration.checksum,
              });
          }
          continue;
        }
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_schema_migrations(version, checksum) VALUES ($1,$2)`,
          [migration.version, migration.checksum],
        );
        applied.push(migration.version);
      }
      return { applied, discovered: migrations.map((item) => item.version) };
    });
  } catch (error) {
    throw mapTestPlanPostgresError(error, 'applyTestPlanMigrations');
  }
}
