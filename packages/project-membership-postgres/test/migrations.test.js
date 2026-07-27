import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DEFAULT_PROJECT_ACCESS_MIGRATIONS_DIRECTORY,
  loadProjectAccessPostgresMigrations,
} from '../src/index.js';

test('project access migration catalog is deterministic', async () => {
  const migrations = await loadProjectAccessPostgresMigrations();
  assert.deepEqual(migrations.map((item) => item.version), ['0001_create_project_access']);
  assert.match(migrations[0].checksum, /^[a-f0-9]{64}$/);
  assert.equal(migrations[0].name, '0001_create_project_access.sql');
  assert.ok(DEFAULT_PROJECT_ACCESS_MIGRATIONS_DIRECTORY.endsWith('/migrations/'));
});
