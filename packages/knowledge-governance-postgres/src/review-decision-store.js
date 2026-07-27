import {
  ReviewDecisionStorePort,
  governanceInvariant,
  validateActor,
  validateProjectId,
  validateReviewDecision,
} from '@kdtp/knowledge-governance';
import { PostgresGovernanceExecutor } from './executor.js';
import { mapGovernancePostgresError } from './postgres-errors.js';
import { GOVERNANCE_POSTGRES_SCHEMA } from './migrations.js';

export class PostgresReviewDecisionStore extends ReviewDecisionStorePort {
  constructor(input = {}) {
    super();
    this.executor = new PostgresGovernanceExecutor(input);
  }

  async append(input) {
    const decision = validateReviewDecision(input);
    try {
      return await this.executor.write(async (client) => {
        await client.query(
          `INSERT INTO ${GOVERNANCE_POSTGRES_SCHEMA}.review_decisions (
            decision_id, schema_version, project_id, record_key, knowledge_id,
            knowledge_version, review_revision, decision, reviewer, occurred_at,
            reason, decision_payload
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb)`,
          [decision.decisionId, decision.schemaVersion, decision.projectId,
            decision.knowledgeKey, decision.knowledgeId, decision.version,
            decision.reviewRevision, decision.decision, decision.reviewer,
            decision.at, decision.reason, JSON.stringify(decision)],
        );
        return structuredClone(decision);
      });
    } catch (error) {
      throw mapGovernancePostgresError(error, 'appendReviewDecision');
    }
  }

  async list(filter = {}) {
    validateFilter(filter);
    try {
      return await this.executor.read(async (client) => {
        const conditions = [];
        const values = [];
        const add = (column, value) => {
          values.push(value);
          conditions.push(`${column} = $${values.length}`);
        };
        if (filter.projectId !== undefined) add('project_id', filter.projectId);
        if (filter.knowledgeKey !== undefined) add('record_key', filter.knowledgeKey);
        if (filter.reviewRevision !== undefined) add('review_revision', filter.reviewRevision);
        if (filter.reviewer !== undefined) add('reviewer', filter.reviewer);
        if (filter.decision !== undefined) add('decision', filter.decision);
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await client.query(
          `SELECT decision_payload FROM ${GOVERNANCE_POSTGRES_SCHEMA}.review_decisions
             ${where} ORDER BY occurred_at ASC, decision_id ASC`,
          values,
        );
        return result.rows.map((row) => validateReviewDecision(row.decision_payload));
      });
    } catch (error) {
      throw mapGovernancePostgresError(error, 'listReviewDecisions');
    }
  }
}

function validateFilter(filter) {
  governanceInvariant(filter && typeof filter === 'object' && !Array.isArray(filter),
    'INVALID_REVIEW_FILTER', 'Review decision filter must be an object');
  if (filter.projectId !== undefined) validateProjectId(filter.projectId);
  if (filter.knowledgeKey !== undefined) {
    governanceInvariant(typeof filter.knowledgeKey === 'string' && filter.knowledgeKey.length > 0,
      'INVALID_REVIEW_FILTER', 'knowledgeKey must be a non-empty string');
  }
  if (filter.reviewRevision !== undefined) {
    governanceInvariant(Number.isSafeInteger(filter.reviewRevision) && filter.reviewRevision > 0,
      'INVALID_REVIEW_FILTER', 'reviewRevision must be a positive integer');
  }
  if (filter.reviewer !== undefined) validateActor(filter.reviewer);
  if (filter.decision !== undefined) {
    governanceInvariant(['APPROVE', 'REQUEST_CHANGES'].includes(filter.decision),
      'INVALID_REVIEW_FILTER', 'decision filter is invalid');
  }
}
