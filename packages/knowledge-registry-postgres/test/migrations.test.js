import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  DEFAULT_MIGRATIONS_DIRECTORY,
  loadPostgresMigrations,
} from '../src/index.js';

test('migration loader returns deterministic names and SHA-256 checksums', async () => {
  const migrations = await loadPostgresMigrations();
  assert.deepEqual(migrations.map((item) => item.name), ['0001_create_registry.sql']);
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
  assert.equal(migrations[0].sql, await readFile(
    join(DEFAULT_MIGRATIONS_DIRECTORY, '0001_create_registry.sql'),
    'utf8',
  ));
});

test('migration encodes identity, revision and append-only audit protections', async () => {
  const [migration] = await loadPostgresMigrations();
  for (const required of [
    'knowledge_records_identity_unique',
    'knowledge_records_json_identity_consistent',
    'knowledge revision must advance by exactly one',
    'knowledge history is append-only',
    'version_major numeric(16, 0)',
  ]) {
    assert.match(migration.sql, new RegExp(required.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
});

test('migration loader rejects invalid names before database access', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'kdtp-migrations-'));
  try {
    await writeFile(join(directory, 'bad-name.sql'), 'SELECT 1;\n');
    await assert.rejects(
      () => loadPostgresMigrations(directory),
      (error) => error.code === 'INVALID_MIGRATION_NAME',
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
