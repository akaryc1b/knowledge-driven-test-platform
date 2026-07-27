import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProjectAccessError } from '@kdtp/project-membership';
import { withPostgresTransaction } from '@kdtp/knowledge-registry-postgres';
import { mapProjectAccessPostgresError } from './postgres-errors.js';

export const PROJECT_ACCESS_POSTGRES_SCHEMA = 'kdtp_access';
export const DEFAULT_PROJECT_ACCESS_MIGRATIONS_DIRECTORY = fileURLToPath(new URL('../migrations/', import.meta.url));
const MIGRATION_NAME_PATTERN = /^[0-9]{4}_[a-z0-9_]+\.sql$/;
const BOOTSTRAP_SQL = `
CREATE SCHEMA IF NOT EXISTS ${PROJECT_ACCESS_POSTGRES_SCHEMA};
CREATE TABLE IF NOT EXISTS ${PROJECT_ACCESS_POSTGRES_SCHEMA}.schema_migrations (
  version text PRIMARY KEY,
  checksum text NOT NULL,
  applied_at timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

export async function loadProjectAccessPostgresMigrations(directory = DEFAULT_PROJECT_ACCESS_MIGRATIONS_DIRECTORY) {
  const names = (await readdir(directory)).filter((name) => name.endsWith('.sql')).sort();
  if (names.length === 0) throw new ProjectAccessError('NO_PROJECT_ACCESS_MIGRATIONS', 'No project access migrations were found', { directory });
  const migrations = [];
  for (const name of names) {
    if (!MIGRATION_NAME_PATTERN.test(name)) throw new ProjectAccessError('INVALID_PROJECT_ACCESS_MIGRATION_NAME', 'Project access migration name is invalid', { name });
    const sql = await readFile(join(directory, name), 'utf8');
    if (sql.trim().length === 0) throw new ProjectAccessError('EMPTY_PROJECT_ACCESS_MIGRATION', 'Project access migration is empty', { name });
    migrations.push({
      version: name.slice(0, -4),
      name,
      sql,
      checksum: createHash('sha256').update(sql).digest('hex'),
    });
  }
  return migrations;
}

export async function applyProjectAccessPostgresMigrations({ pool, migrationsDirectory } = {}) {
  const migrations = await loadProjectAccessPostgresMigrations(migrationsDirectory);
  try {
    return await withPostgresTransaction(pool, async (client) => {
      await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['kdtp-project-access-migrations-v1']);
      await client.query(BOOTSTRAP_SQL);
      const applied = [];
      for (const migration of migrations) {
        const existing = await client.query(
          `SELECT checksum FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.schema_migrations WHERE version = $1`,
          [migration.version],
        );
        if (existing.rowCount > 0) {
          if (existing.rows[0].checksum !== migration.checksum) {
            throw new ProjectAccessError('PROJECT_ACCESS_MIGRATION_CHECKSUM_MISMATCH', 'Project access migration checksum does not match', {
              version: migration.version,
              expectedChecksum: existing.rows[0].checksum,
              actualChecksum: migration.checksum,
            });
          }
          continue;
        }
        await client.query(migration.sql);
        await client.query(
          `INSERT INTO ${PROJECT_ACCESS_POSTGRES_SCHEMA}.schema_migrations(version, checksum) VALUES ($1, $2)`,
          [migration.version, migration.checksum],
        );
        applied.push(migration.version);
      }
      return { applied, discovered: migrations.map((item) => item.version) };
    });
  } catch (error) {
    throw mapProjectAccessPostgresError(error, 'applyMigrations');
  }
}
