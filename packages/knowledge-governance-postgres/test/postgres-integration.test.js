import test, { after } from 'node:test';
import { cp, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import {
  GovernanceError,
  InMemoryProjectAuthorization,
  KnowledgeGovernanceService,
  REVIEW_DECISION_SCHEMA_VERSION,
  createSnapshotEnvelope,
} from '@kdtp/knowledge-governance';
import {
  PostgresKnowledgeRegistry,
  POSTGRES_SCHEMA,
  applyPostgresMigrations,
} from '@kdtp/knowledge-registry-postgres';
import {
  DEFAULT_GOVERNANCE_MIGRATIONS_DIRECTORY,
  GOVERNANCE_POSTGRES_SCHEMA,
  PostgresGovernanceUnitOfWork,
  PostgresKnowledgeSnapshotStore,
  PostgresReviewDecisionStore,
  applyGovernancePostgresMigrations,
} from '../src/index.js';
import {
  defineReviewStoreContract,
  defineSnapshotStoreContract,
} from '../../knowledge-governance/test/contracts.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('PostgreSQL governance integration tests require KDTP_POSTGRES_TEST_URL',
    { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 12 });
  await applyPostgresMigrations({ pool });
  await applyGovernancePostgresMigrations({ pool });

  const reset = async () => {
    await pool.query(
      `TRUNCATE TABLE
        ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes,
        ${GOVERNANCE_POSTGRES_SCHEMA}.review_decisions,
        ${POSTGRES_SCHEMA}.knowledge_history,
        ${POSTGRES_SCHEMA}.knowledge_records`,
    );
  };
  const seed = async () => {
    const registry = new PostgresKnowledgeRegistry({ pool });
    let record = await registry.createDraft(createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    return record;
  };

  defineReviewStoreContract(test, async () => new PostgresReviewDecisionStore({ pool }), {
    beforeEach: async () => { await reset(); await seed(); },
  });
  defineSnapshotStoreContract(test, async () => new PostgresKnowledgeSnapshotStore({ pool }), {
    beforeEach: reset,
  });

  test('governance migration runner is idempotent', { concurrency: false }, async () => {
    const result = await applyGovernancePostgresMigrations({ pool });
    assert.deepEqual(result.applied, []);
    assert.deepEqual(result.discovered, ['0001_create_governance_evidence']);
  });

  test('governance migration runner rejects changed checksums',
    { concurrency: false }, async () => {
      const directory = await mkdtemp(join(tmpdir(), 'kdtp-governance-checksum-'));
      try {
        await cp(
          join(DEFAULT_GOVERNANCE_MIGRATIONS_DIRECTORY, '0001_create_governance_evidence.sql'),
          join(directory, '0001_create_governance_evidence.sql'),
        );
        const probe = join(directory, '9000_checksum_probe.sql');
        await writeFile(probe, 'SELECT 1;\n');
        await applyGovernancePostgresMigrations({ pool, migrationsDirectory: directory });
        await writeFile(probe, 'SELECT 2;\n');
        await assert.rejects(
          applyGovernancePostgresMigrations({ pool, migrationsDirectory: directory }),
          (error) => error instanceof GovernanceError &&
            error.code === 'GOVERNANCE_MIGRATION_CHECKSUM_MISMATCH',
        );
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

  test('governance migration failure rolls back all statements',
    { concurrency: false }, async () => {
      const directory = await mkdtemp(join(tmpdir(), 'kdtp-governance-rollback-'));
      try {
        await cp(
          join(DEFAULT_GOVERNANCE_MIGRATIONS_DIRECTORY, '0001_create_governance_evidence.sql'),
          join(directory, '0001_create_governance_evidence.sql'),
        );
        await writeFile(
          join(directory, '9001_rollback_probe.sql'),
          'CREATE TABLE kdtp_governance.rollback_probe(id integer);\nSELECT missing_function();\n',
        );
        await assert.rejects(
          applyGovernancePostgresMigrations({ pool, migrationsDirectory: directory }),
          (error) => error instanceof GovernanceError && error.code === 'GOVERNANCE_STORAGE_ERROR',
        );
        const table = await pool.query(
          "SELECT to_regclass('kdtp_governance.rollback_probe') AS relation",
        );
        assert.equal(table.rows[0].relation, null);
      } finally {
        await rm(directory, { recursive: true, force: true });
      }
    });

  test('evidence persists across adapter instances', { concurrency: false }, async () => {
    await reset();
    const record = await seed();
    await new PostgresReviewDecisionStore({ pool }).append(reviewDecision(record));
    assert.equal((await new PostgresReviewDecisionStore({ pool })
      .list({ projectId: PROJECT })).length, 1);
    const envelope = snapshotEnvelope();
    await new PostgresKnowledgeSnapshotStore({ pool }).save(envelope);
    assert.equal((await new PostgresKnowledgeSnapshotStore({ pool })
      .get({ snapshotId: envelope.snapshotId })).digest, envelope.digest);
  });

  test('database prevents update and delete of governance evidence',
    { concurrency: false }, async () => {
      await reset();
      const record = await seed();
      await new PostgresReviewDecisionStore({ pool }).append(reviewDecision(record));
      const envelope = snapshotEnvelope();
      await new PostgresKnowledgeSnapshotStore({ pool }).save(envelope);
      await assert.rejects(
        pool.query(`UPDATE ${GOVERNANCE_POSTGRES_SCHEMA}.review_decisions
          SET reason = 'tampered' WHERE decision_id = $1`, ['decision:postgres:reviewer-1']),
        (error) => error.code === '55000',
      );
      await assert.rejects(
        pool.query(`DELETE FROM ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes
          WHERE snapshot_id = $1`, [envelope.snapshotId]),
        (error) => error.code === '55000',
      );
    });

  test('database rejects snapshot digest mismatch', { concurrency: false }, async () => {
    await reset();
    const envelope = snapshotEnvelope();
    await assert.rejects(
      pool.query(
        `INSERT INTO ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes (
          snapshot_id, schema_version, digest, project_id, environment_id, release_id,
          created_by, created_at, reason, envelope
        ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)`,
        [envelope.snapshotId, envelope.schemaVersion, '0'.repeat(64), envelope.projectId,
          envelope.environmentId, envelope.releaseId, envelope.createdBy,
          envelope.createdAt, envelope.reason, JSON.stringify(envelope)],
      ),
      (error) => error.code === '23514',
    );
  });

  test('Unit of Work rolls back Registry and review evidence together',
    { concurrency: false }, async () => {
      await reset();
      const unitOfWork = new PostgresGovernanceUnitOfWork({ pool });
      await assert.rejects(
        unitOfWork.execute(async ({ registry, reviewStore }) => {
          let record = await registry.createDraft(createCommand());
          record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
          await reviewStore.append(reviewDecision(record));
          throw new Error('force rollback');
        }),
        /force rollback/,
      );
      assert.equal(await new PostgresKnowledgeRegistry({ pool })
        .get({ id: KNOWLEDGE_ID, version: VERSION }), null);
      assert.equal((await new PostgresReviewDecisionStore({ pool })
        .list({ projectId: PROJECT })).length, 0);
    });

  test('REQUEST_CHANGES and Registry transition commit atomically',
    { concurrency: false }, async () => {
      await reset();
      const fixture = durableFixture(pool);
      let record = await fixture.service.createDraft(governedCreate());
      record = await fixture.service.submitForReview(governedSubmit(record));
      const result = await fixture.service.review({
        projectId: PROJECT, id: record.knowledge.id, version: record.knowledge.version,
        expectedRevision: record.revision, decisionId: 'decision:postgres:request-changes',
        decision: 'REQUEST_CHANGES', actor: 'reviewer-1', at: T2,
        reason: 'clarify evidence',
      });
      assert.equal(result.record.knowledge.status, 'DRAFT');
      assert.equal((await fixture.reviewStore.list({
        projectId: PROJECT, reviewRevision: record.revision,
      })).length, 1);
    });

  test('concurrent publish allows exactly one lifecycle transition',
    { concurrency: false }, async () => {
      await reset();
      const fixture = durableFixture(pool);
      let record = await fixture.service.createDraft(governedCreate());
      record = await fixture.service.submitForReview(governedSubmit(record));
      await fixture.service.review({
        projectId: PROJECT, id: record.knowledge.id, version: record.knowledge.version,
        expectedRevision: record.revision, decisionId: 'decision:postgres:publish-approval',
        decision: 'APPROVE', actor: 'reviewer-1', at: T2, reason: 'approve publish',
      });
      const command = {
        projectId: PROJECT, id: record.knowledge.id, version: record.knowledge.version,
        expectedRevision: record.revision, actor: 'publisher', at: T3,
        reason: 'publish concurrently',
      };
      const results = await Promise.allSettled([
        fixture.service.publish(command), fixture.service.publish(command),
      ]);
      assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
      assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
      const stored = await fixture.registry.get({ id: KNOWLEDGE_ID, version: VERSION });
      assert.equal(stored.knowledge.status, 'PUBLISHED');
      assert.equal(stored.history.filter((event) => event.toStatus === 'PUBLISHED').length, 1);
    });

  test('concurrent reviewer decisions are unique per review revision',
    { concurrency: false }, async () => {
      await reset();
      const record = await seed();
      const store = new PostgresReviewDecisionStore({ pool });
      const results = await Promise.allSettled([
        store.append(reviewDecision(record, { decisionId: 'decision:postgres:concurrent-1' })),
        store.append(reviewDecision(record, { decisionId: 'decision:postgres:concurrent-2' })),
      ]);
      assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
      assert.equal(results.find((item) => item.status === 'rejected').reason.code,
        'REVIEWER_ALREADY_DECIDED');
    });

  after(async () => { await pool.end(); });
}

const PROJECT = 'approval-platform';
const KNOWLEDGE_ID = 'PROJECT-APPROVAL-001';
const VERSION = '1.0.0';
const T0 = '2026-07-27T12:00:00.000Z';
const T1 = '2026-07-27T12:01:00.000Z';
const T2 = '2026-07-27T12:02:00.000Z';
const T3 = '2026-07-27T12:03:00.000Z';

function knowledge() {
  return {
    schemaVersion: 'knowledge-rule/v1', id: KNOWLEDGE_ID,
    boundaryKey: 'workflow.approval-submit', name: '审批提交规则',
    version: VERSION, status: 'DRAFT', scope: { level: 'PROJECT', key: PROJECT },
    enforcement: 'mandatory', overridePolicy: 'deny', enabled: true,
    value: { allowedFrom: ['DRAFT'] }, owner: 'approval-team',
    source: 'M1-D PostgreSQL integration', riskLevel: 'high',
  };
}
function createCommand() {
  return { knowledge: knowledge(), actor: 'author', at: T0, reason: 'create durable knowledge' };
}
function transitionCommand(record, toStatus, at) {
  return { id: record.knowledge.id, version: record.knowledge.version,
    expectedRevision: record.revision, toStatus, actor: 'author', at,
    reason: `transition to ${toStatus}` };
}
function reviewDecision(record, overrides = {}) {
  return {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: 'decision:postgres:reviewer-1', projectId: PROJECT,
    knowledgeKey: record.key, knowledgeId: record.knowledge.id,
    version: record.knowledge.version, reviewRevision: record.revision,
    decision: 'APPROVE', reviewer: 'reviewer-1', at: T2,
    reason: 'approve durable knowledge', ...overrides,
  };
}
function snapshotEnvelope() {
  return createSnapshotEnvelope({
    projectId: PROJECT,
    snapshot: buildKnowledgeSnapshot({
      context: { globalId: 'company', projectId: PROJECT, environmentId: 'staging',
        releaseId: 'M1-D-contract', domainPacks: [] },
      rules: [], resolution: [],
    }),
    actor: 'snapshot-bot', at: T0, reason: 'persist durable snapshot',
  });
}
function durableFixture(pool) {
  const registry = new PostgresKnowledgeRegistry({ pool });
  const reviewStore = new PostgresReviewDecisionStore({ pool });
  const snapshotStore = new PostgresKnowledgeSnapshotStore({ pool });
  const authorization = new InMemoryProjectAuthorization([
    { projectId: PROJECT, actor: 'author', actions: ['KNOWLEDGE_CREATE', 'KNOWLEDGE_SUBMIT'], roles: ['author'] },
    { projectId: PROJECT, actor: 'reviewer-1', actions: ['KNOWLEDGE_REVIEW'], roles: ['reviewer'] },
    { projectId: PROJECT, actor: 'publisher', actions: ['KNOWLEDGE_PUBLISH'], roles: ['publisher'] },
  ]);
  const service = new KnowledgeGovernanceService({ registry, reviewStore, snapshotStore,
    authorization, unitOfWork: new PostgresGovernanceUnitOfWork({ pool }) });
  return { registry, reviewStore, snapshotStore, service };
}
function governedCreate() { return { projectId: PROJECT, ...createCommand() }; }
function governedSubmit(record) {
  return { projectId: PROJECT, id: record.knowledge.id, version: record.knowledge.version,
    expectedRevision: record.revision, actor: 'author', at: T1,
    reason: 'submit durable knowledge' };
}
