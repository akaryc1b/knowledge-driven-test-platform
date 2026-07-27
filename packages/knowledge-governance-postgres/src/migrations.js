import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { GovernanceError } from '@kdtp/knowledge-governance';
import {
  assertPostgresPool,
  withPostgresTransaction,
} from '@kdtp/knowledge-registry-postgres';
import { mapGovernancePostgresError } from './postgres-errors.js';

export const GOVERNANCE_POSTGRES_SCHEMA = 'kdtp_governance';
export const DEFAULT_GOVERNANCE_MIGRATIONS_DIRECTORY =
  fileURLToPath(new URL('../migrations/', import.meta.url));

const MIGRATION_NAME_PATTERN = /^[0-9]{4}_[a-z0-9_]+\.sql$/;
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS ${GOVERNANCE_POSTGRES_SCHEMA};
CREATE TABLE IF NOT EXISTS ${GOVERNANCE_POSTGRES_SCHEMA}.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export async function loadGovernancePostgresMigrations(
  directory = DEFAULT_GOVERNANCE_MIGRATIONS_DIRECTORY,
) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0) {
    throw new GovernanceError('NO_GOVERNANCE_MIGRATIONS',
      'No PostgreSQL governance migrations were found', { directory });
  }
  const migrations = [];
  for (const name of names) {
    if (!MIGRATION_NAME_PATTERN.test(name)) {
      throw new GovernanceError('INVALID_GOVERNANCE_MIGRATION_NAME',
        'PostgreSQL governance migration name is invalid', { name });
    }
    const sql = await readFile(join(directory, name), 'utf8');
    if (sql.trim().length === 0) {
      throw new GovernanceError('EMPTY_GOVERNANCE_MIGRATION',
        'PostgreSQL governance migration is empty', { name });
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

export async function applyGovernancePostgresMigrations(input) {
  const pool = assertPostgresPool(input?.pool);
  const migrations = await loadGovernancePostgresMigrations(input?.migrationsDirectory);
  try {
    return await withPostgresTransaction(pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        'kdtp-governance-migrations-v1',
      ]);
      await client.query(BOOTSTRAP_SQL);
      const registry = await client.query(
        "SELECT to_regclass('kdtp_registry.knowledge_records') AS relation",
      );
      if (!registry.rows[0]?.relation) {
        throw new GovernanceError('REGISTRY_SCHEMA_REQUIRED',
          'Registry migrations must be applied before governance migrations');
      }
      const applied = [];
      for (const migration of migrations) {
        const existing = await client.query(
          `SELECT checksum FROM ${GOVERNANCE_POSTGRES_SCHEMA}.schema_migrations WHERE version = $1`,
          [migration.version],
        );
        if (existing.rowCount > 0) {
          if (existing.rows[0].checksum !== migration.checksum) {
            throw new GovernanceError('GOVERNANCE_MIGRATION_CHECKSUM_MISMATCH',
              `Governance migration ${migration.version} checksum does not match`, {
                version: migration.version,
                expectedChecksum: existing.rows[0].checksum,
                actualChecksum: migration.checksum,
              });
          }
          continue;
        }
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${GOVERNANCE_POSTGRES_SCHEMA}.schema_migrations(version, checksum) VALUES ($1, $2)`,
          [migration.version, migration.checksum],
        );
        applied.push(migration.version);
      }
      return { applied, discovered: migrations.map((item) => item.version) };
    });
  } catch (error) {
    throw mapGovernancePostgresError(error, 'applyGovernanceMigrations');
  }
}
