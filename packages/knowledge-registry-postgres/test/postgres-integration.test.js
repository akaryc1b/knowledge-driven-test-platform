import test, { after } from 'node:test';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { RegistryError } from '@kdtp/knowledge-registry';
import {
  applyPostgresMigrations,
  DEFAULT_MIGRATIONS_DIRECTORY,
  PostgresKnowledgeRegistry,
  POSTGRES_SCHEMA,
} from '../src/index.js';
import { defineKnowledgeRegistryContractTests } from '../../knowledge-registry/test/registry-contract.js';
import {
  createCommand,
  knowledge,
  T1,
} from '../../knowledge-registry/test/test-helpers.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('PostgreSQL integration tests require KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 8 });
  await applyPostgresMigrations({ pool });

  const reset = async () => {
    await pool.query(
      `TRUNCATE TABLE ${POSTGRES_SCHEMA}.knowledge_history,
                      ${POSTGRES_SCHEMA}.knowledge_records CASCADE`,
    );
  };

  defineKnowledgeRegistryContractTests(
    'PostgresKnowledgeRegistry',
    () => new PostgresKnowledgeRegistry({ pool }),
    { beforeEach: reset },
  );

  test('PostgresKnowledgeRegistry: persists records across adapter instances', { concurrency: false }, async () => {
    await reset();
    const first = new PostgresKnowledgeRegistry({ pool });
    await first.createDraft(createCommand());

    const second = new PostgresKnowledgeRegistry({ pool });
    const restored = await second.get({ id: 'PROJECT-SAMPLE-001', version: '1.0.0' });
    assert.equal(restored.key, 'PROJECT-SAMPLE-001@1.0.0');
    assert.equal(restored.revision, 1);
  });

  test('PostgresKnowledgeRegistry: failed CAS leaves history unchanged', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresKnowledgeRegistry({ pool });
    await registry.createDraft(createCommand());
    await registry.replaceDraft({
      id: 'PROJECT-SAMPLE-001',
      version: '1.0.0',
      expectedRevision: 1,
      knowledge: knowledge({ name: 'updated' }),
      actor: 'quality-engineer',
      at: T1,
      reason: 'valid update',
    });

    await assert.rejects(
      () => registry.replaceDraft({
        id: 'PROJECT-SAMPLE-001',
        version: '1.0.0',
        expectedRevision: 1,
        knowledge: knowledge({ name: 'stale' }),
        actor: 'quality-engineer',
        at: '2026-07-27T12:02:00.000Z',
        reason: 'stale update',
      }),
      (error) => error instanceof RegistryError && error.code === 'REVISION_CONFLICT',
    );

    const stored = await registry.get({ id: 'PROJECT-SAMPLE-001', version: '1.0.0' });
    assert.equal(stored.revision, 2);
    assert.equal(stored.history.length, 2);
  });

  test('PostgresKnowledgeRegistry: concurrent version creation remains monotonic', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresKnowledgeRegistry({ pool });
    await registry.createDraft(createCommand({ knowledge: knowledge({ version: '2.0.0' }) }));

    const results = await Promise.allSettled([
      registry.createDraft(createCommand({
        at: T1,
        knowledge: knowledge({ version: '3.0.0' }),
      })),
      registry.createDraft(createCommand({
        at: '2026-07-27T12:02:00.000Z',
        knowledge: knowledge({ version: '1.5.0' }),
      })),
    ]);

    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    const rejected = results.find((item) => item.status === 'rejected');
    assert.equal(rejected.reason.code, 'NON_MONOTONIC_VERSION');
    const versions = await registry.listVersions({ id: 'PROJECT-SAMPLE-001' });
    assert.deepEqual(versions.map((item) => item.knowledge.version), ['2.0.0', '3.0.0']);
  });

  test('PostgreSQL migration runner is idempotent', { concurrency: false }, async () => {
    const result = await applyPostgresMigrations({ pool });
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.discovered, ['0001_create_registry']);
  });

  test('PostgreSQL migration runner rejects changed checksums', { concurrency: false }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kdtp-postgres-checksum-'));
    try {
      await cp(
        join(DEFAULT_MIGRATIONS_DIRECTORY, '0001_create_registry.sql'),
        join(directory, '0001_create_registry.sql'),
      );
      const probe = join(directory, '9000_checksum_probe.sql');
      await writeFile(probe, 'SELECT 1;\n');
      await applyPostgresMigrations({ pool, migrationsDirectory: directory });
      await writeFile(probe, 'SELECT 2;\n');

      await assert.rejects(
        () => applyPostgresMigrations({ pool, migrationsDirectory: directory }),
        (error) => error instanceof RegistryError && error.code === 'MIGRATION_CHECKSUM_MISMATCH',
      );
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('PostgreSQL migration failure rolls back all statements', { concurrency: false }, async () => {
    const directory = await mkdtemp(join(tmpdir(), 'kdtp-postgres-rollback-'));
    try {
      await cp(
        join(DEFAULT_MIGRATIONS_DIRECTORY, '0001_create_registry.sql'),
        join(directory, '0001_create_registry.sql'),
      );
      await writeFile(
        join(directory, '9001_rollback_probe.sql'),
        'CREATE TABLE kdtp_registry.rollback_probe(id integer);\nSELECT missing_function();\n',
      );

      await assert.rejects(
        () => applyPostgresMigrations({ pool, migrationsDirectory: directory }),
        (error) => error instanceof RegistryError && error.code === 'REGISTRY_STORAGE_ERROR',
      );
      const table = await pool.query(
        "SELECT to_regclass('kdtp_registry.rollback_probe') AS relation",
      );
      assert.equal(table.rows[0].relation, null);
      const migration = await pool.query(
        `SELECT 1 FROM ${POSTGRES_SCHEMA}.schema_migrations WHERE version = '9001_rollback_probe'`,
      );
      assert.equal(migration.rowCount, 0);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  test('PostgreSQL rejects mutation of persisted audit history', { concurrency: false }, async () => {
    await reset();
    const registry = new PostgresKnowledgeRegistry({ pool });
    await registry.createDraft(createCommand());

    await assert.rejects(
      () => pool.query(
        `UPDATE ${POSTGRES_SCHEMA}.knowledge_history
            SET reason = 'tampered'
          WHERE record_key = $1 AND sequence = 1`,
        ['PROJECT-SAMPLE-001@1.0.0'],
      ),
      (error) => error.code === '55000',
    );
  });

  after(async () => {
    await pool.end();
  });
}
