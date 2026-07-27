import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { RegistryError } from '@kdtp/knowledge-registry';
import { mapPostgresError } from './postgres-errors.js';
import { withPostgresTransaction } from './transaction.js';

export const POSTGRES_SCHEMA = 'kdtp_registry';
export const DEFAULT_MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations/', import.meta.url));

const MIGRATION_NAME_PATTERN = /^[0-9]{4}_[a-z0-9_]+\.sql$/;
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS ${POSTGRES_SCHEMA};
CREATE TABLE IF NOT EXISTS ${POSTGRES_SCHEMA}.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

/** @param {string} [directory] */
export async function loadPostgresMigrations(directory = DEFAULT_MIGRATIONS_DIRECTORY) {
  const names = (await readdir(directory))
    .filter((name) => name.endsWith('.sql'))
    .sort();
  if (names.length === 0) {
    throw new RegistryError('NO_POSTGRES_MIGRATIONS', 'No PostgreSQL migrations were found', {
      directory,
    });
  }

  const migrations = [];
  for (const name of names) {
    if (!MIGRATION_NAME_PATTERN.test(name)) {
      throw new RegistryError('INVALID_MIGRATION_NAME', 'PostgreSQL migration name is invalid', {
        name,
      });
    }
    const sql = await readFile(join(directory, name), 'utf8');
    if (sql.trim().length === 0) {
      throw new RegistryError('EMPTY_POSTGRES_MIGRATION', 'PostgreSQL migration is empty', { name });
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

/**
 * @param {{pool: unknown, migrationsDirectory?: string}} input
 */
export async function applyPostgresMigrations(input) {
  const migrations = await loadPostgresMigrations(input?.migrationsDirectory);
  try {
    return await withPostgresTransaction(input?.pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [
        'kdtp-registry-migrations-v1',
      ]);
      await client.query(BOOTSTRAP_SQL);

      const applied = [];
      for (const migration of migrations) {
        const existing = await client.query(
          `SELECT checksum FROM ${POSTGRES_SCHEMA}.schema_migrations WHERE version = $1`,
          [migration.version],
        );
        if (existing.rowCount > 0) {
          if (existing.rows[0].checksum !== migration.checksum) {
            throw new RegistryError(
              'MIGRATION_CHECKSUM_MISMATCH',
              `PostgreSQL migration ${migration.version} checksum does not match`,
              {
                version: migration.version,
                expectedChecksum: existing.rows[0].checksum,
                actualChecksum: migration.checksum,
              },
            );
          }
          continue;
        }

        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${POSTGRES_SCHEMA}.schema_migrations(version, checksum) VALUES ($1, $2)`,
          [migration.version, migration.checksum],
        );
        applied.push(migration.version);
      }
      return { applied, discovered: migrations.map((item) => item.version) };
    });
  } catch (error) {
    throw mapPostgresError(error, 'applyMigrations');
  }
}
