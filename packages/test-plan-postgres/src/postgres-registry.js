import { validateDigest, validatePlanId } from '@kdtp/test-plan';
import {
  TestPlanRegistryError,
  TestPlanRegistryPort,
  createPlanRecord,
  replaceDraftRecord,
  transitionPlanRecord,
  validatePlanRecord,
  validatePlanRegistryFilter,
  validatePlanReviewDecision,
  validatePlanReviewDecisionFilter,
} from '@kdtp/test-plan-registry';
import { PostgresTestPlanExecutor } from './executor.js';
import { TEST_PLAN_POSTGRES_SCHEMA } from './migrations.js';
import { mapTestPlanPostgresError } from './postgres-errors.js';

const RECORD_COLUMNS = `plan_id, schema_version, project_id, environment_id, release_id,
  status, revision, input_fingerprint, snapshot_id, snapshot_digest,
  capability_catalog_version, capability_catalog_digest, content_digest, planning_result,
  created_at, created_by, updated_at, updated_by`;

export class PostgresTestPlanRegistry extends TestPlanRegistryPort {
  constructor(input = {}) {
    super();
    this.executor = new PostgresTestPlanExecutor(input);
  }

  async create(command) {
    const record = createPlanRecord(command);
    try {
      return await this.executor.write(async (client) => {
        await client.query(
          `INSERT INTO ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records (
            plan_id, schema_version, project_id, environment_id, release_id,
            status, revision, input_fingerprint, snapshot_id, snapshot_digest,
            capability_catalog_version, capability_catalog_digest, content_digest, planning_result,
            created_at, created_by, updated_at, updated_by
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb,$15,$16,$17,$18)`,
          recordValues(record),
        );
        await insertHistoryEvent(client, record.history[0]);
        return structuredClone(record);
      });
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'create');
    }
  }

  async get(query) {
    const planId = validatePlanId(query?.planId);
    try {
      const records = await this.#readRecords({ planId, limit: 1 });
      return records[0] ?? null;
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'get');
    }
  }

  async getByFingerprint(query) {
    const inputFingerprint = validateDigest(query?.inputFingerprint, 'inputFingerprint');
    try {
      const records = await this.#readRecords({ inputFingerprint, limit: 1 });
      return records[0] ?? null;
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'getByFingerprint');
    }
  }

  async list(filter = {}) {
    const normalized = validatePlanRegistryFilter(filter);
    try {
      return await this.#readRecords({ filter: normalized });
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'list');
    }
  }

  async replaceDraft(command) {
    const planId = validatePlanId(command?.planId);
    try {
      return await this.executor.write(async (client) => {
        const current = await requireRecordForUpdate(client, planId);
        const next = replaceDraftRecord(current, command);
        await persistRecordUpdate(client, current, next);
        return structuredClone(next);
      });
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'replaceDraft');
    }
  }

  async transition(command) {
    const planId = validatePlanId(command?.planId);
    try {
      return await this.executor.write(async (client) => {
        const current = await requireRecordForUpdate(client, planId);
        const next = transitionPlanRecord(current, command);
        await persistRecordUpdate(client, current, next);
        return structuredClone(next);
      });
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'transition');
    }
  }

  async appendReviewDecision(input) {
    const decision = validatePlanReviewDecision(input);
    try {
      return await this.executor.write(async (client) => {
        const record = await client.query(
          `SELECT project_id FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records WHERE plan_id = $1`,
          [decision.planId],
        );
        if (record.rowCount === 0) {
          throw new TestPlanRegistryError('PLAN_NOT_FOUND', 'Test plan was not found', {
            planId: decision.planId,
          });
        }
        if (record.rows[0].project_id !== decision.projectId) {
          throw new TestPlanRegistryError('PLAN_REVIEW_BINDING_MISMATCH',
            'Review decision project does not match plan project');
        }
        await client.query(
          `INSERT INTO ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_review_decisions (
            decision_id, schema_version, plan_id, project_id, plan_revision,
            decision, reviewer, occurred_at, decision_payload
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
          [decision.decisionId, decision.schemaVersion, decision.planId, decision.projectId,
            decision.planRevision, decision.decision, decision.reviewer, decision.at,
            JSON.stringify(decision)],
        );
        return structuredClone(decision);
      });
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'appendReviewDecision');
    }
  }

  async listReviewDecisions(filter = {}) {
    const normalized = validatePlanReviewDecisionFilter(filter);
    try {
      return await this.executor.read(async (client) => {
        const conditions = [];
        const values = [];
        const add = (column, value) => {
          values.push(value);
          conditions.push(`${column} = $${values.length}`);
        };
        if (normalized.planId !== undefined) add('plan_id', normalized.planId);
        if (normalized.projectId !== undefined) add('project_id', normalized.projectId);
        if (normalized.planRevision !== undefined) add('plan_revision', normalized.planRevision);
        if (normalized.decision !== undefined) add('decision', normalized.decision);
        if (normalized.reviewer !== undefined) add('reviewer', normalized.reviewer);
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await client.query(
          `SELECT decision_payload FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_review_decisions
             ${where} ORDER BY occurred_at ASC, decision_id ASC`,
          values,
        );
        return result.rows.map((row) => validatePlanReviewDecision(row.decision_payload));
      });
    } catch (error) {
      throw mapTestPlanPostgresError(error, 'listReviewDecisions');
    }
  }

  async #readRecords(options) {
    return this.executor.read(async (client) => {
      const { text, values } = buildRecordSelect(options);
      const result = await client.query(text, values);
      return hydrateRows(client, result.rows);
    });
  }
}

async function requireRecordForUpdate(client, planId) {
  const result = await client.query(
    `SELECT ${RECORD_COLUMNS} FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
      WHERE plan_id = $1 FOR UPDATE`,
    [planId],
  );
  if (result.rowCount === 0) {
    throw new TestPlanRegistryError('PLAN_NOT_FOUND', 'Test plan was not found', { planId });
  }
  return (await hydrateRows(client, result.rows))[0];
}

async function persistRecordUpdate(client, current, next) {
  const result = await client.query(
    `UPDATE ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
        SET status = $1, revision = $2, content_digest = $3,
            planning_result = $4::jsonb, updated_at = $5, updated_by = $6
      WHERE plan_id = $7 AND revision = $8`,
    [next.status, next.revision, next.contentDigest, JSON.stringify(next.planningResult),
      next.updatedAt, next.updatedBy, current.planId, current.revision],
  );
  if (result.rowCount !== 1) {
    throw new TestPlanRegistryError('REVISION_CONFLICT',
      'Plan record revision does not match expectedRevision', {
        planId: current.planId,
        expectedRevision: current.revision,
      });
  }
  await insertHistoryEvent(client, next.history.at(-1));
}

async function insertHistoryEvent(client, event) {
  await client.query(
    `INSERT INTO ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history (
      plan_id, revision, event_type, from_status, to_status, actor, occurred_at, history_payload
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8::jsonb)`,
    [event.planId, event.revision, event.type, event.fromStatus, event.toStatus,
      event.actor, event.at, JSON.stringify(event)],
  );
}

async function hydrateRows(client, rows) {
  if (rows.length === 0) return [];
  const planIds = rows.map((row) => row.plan_id);
  const history = await client.query(
    `SELECT plan_id, history_payload
       FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history
      WHERE plan_id = ANY($1::text[]) ORDER BY plan_id ASC, revision ASC`,
    [planIds],
  );
  const byPlan = new Map(planIds.map((planId) => [planId, []]));
  for (const row of history.rows) byPlan.get(row.plan_id)?.push(row.history_payload);
  return rows.map((row) => validatePlanRecord({
    schemaVersion: row.schema_version,
    planId: row.plan_id,
    projectId: row.project_id,
    environmentId: row.environment_id,
    releaseId: row.release_id,
    status: row.status,
    revision: row.revision,
    inputFingerprint: row.input_fingerprint,
    knowledgeSnapshot: { snapshotId: row.snapshot_id, digest: row.snapshot_digest },
    capabilityCatalog: {
      version: row.capability_catalog_version,
      digest: row.capability_catalog_digest,
    },
    contentDigest: row.content_digest,
    planningResult: row.planning_result,
    createdAt: timestamp(row.created_at),
    createdBy: row.created_by,
    updatedAt: timestamp(row.updated_at),
    updatedBy: row.updated_by,
    history: byPlan.get(row.plan_id) ?? [],
  }));
}

function buildRecordSelect(options) {
  const conditions = [];
  const values = [];
  const add = (column, value) => {
    values.push(value);
    conditions.push(`${column} = $${values.length}`);
  };
  if (options.planId !== undefined) add('plan_id', options.planId);
  if (options.inputFingerprint !== undefined) add('input_fingerprint', options.inputFingerprint);
  const filter = options.filter ?? {};
  if (filter.projectId !== undefined) add('project_id', filter.projectId);
  if (filter.status !== undefined) add('status', filter.status);
  if (filter.environmentId !== undefined) add('environment_id', filter.environmentId);
  if (filter.releaseId !== undefined) add('release_id', filter.releaseId);
  if (filter.inputFingerprint !== undefined) add('input_fingerprint', filter.inputFingerprint);
  if (filter.snapshotId !== undefined) add('snapshot_id', filter.snapshotId);
  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
  let text = `SELECT ${RECORD_COLUMNS} FROM ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records
    ${where} ORDER BY plan_id ASC`;
  if (options.limit !== undefined) {
    values.push(options.limit);
    text += ` LIMIT $${values.length}`;
  }
  return { text, values };
}

function recordValues(record) {
  return [
    record.planId,
    record.schemaVersion,
    record.projectId,
    record.environmentId,
    record.releaseId,
    record.status,
    record.revision,
    record.inputFingerprint,
    record.knowledgeSnapshot.snapshotId,
    record.knowledgeSnapshot.digest,
    record.capabilityCatalog.version,
    record.capabilityCatalog.digest,
    record.contentDigest,
    JSON.stringify(record.planningResult),
    record.createdAt,
    record.createdBy,
    record.updatedAt,
    record.updatedBy,
  ];
}

function timestamp(input) {
  return input instanceof Date ? input.toISOString() : new Date(input).toISOString();
}
