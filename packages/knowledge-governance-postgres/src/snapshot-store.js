import { jsonEqual } from '@kdtp/knowledge-core';
import {
  KnowledgeSnapshotStorePort,
  governanceInvariant,
  validateProjectId,
  validateSnapshotEnvelope,
} from '@kdtp/knowledge-governance';
import { PostgresGovernanceExecutor } from './executor.js';
import { mapGovernancePostgresError } from './postgres-errors.js';
import { GOVERNANCE_POSTGRES_SCHEMA } from './migrations.js';

export class PostgresKnowledgeSnapshotStore extends KnowledgeSnapshotStorePort {
  constructor(input = {}) {
    super();
    this.executor = new PostgresGovernanceExecutor(input);
  }

  async save(input) {
    const envelope = validateSnapshotEnvelope(input);
    try {
      return await this.executor.write(async (client) => {
        const inserted = await client.query(
          `INSERT INTO ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes (
            snapshot_id, schema_version, digest, project_id, environment_id,
            release_id, created_by, created_at, reason, envelope
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb)
          ON CONFLICT (snapshot_id) DO NOTHING RETURNING envelope`,
          [envelope.snapshotId, envelope.schemaVersion, envelope.digest,
            envelope.projectId, envelope.environmentId, envelope.releaseId,
            envelope.createdBy, envelope.createdAt, envelope.reason,
            JSON.stringify(envelope)],
        );
        if (inserted.rowCount === 1) {
          return validateSnapshotEnvelope(inserted.rows[0].envelope);
        }
        const existingResult = await client.query(
          `SELECT envelope FROM ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes
            WHERE snapshot_id = $1 FOR SHARE`,
          [envelope.snapshotId],
        );
        governanceInvariant(existingResult.rowCount === 1,
          'SNAPSHOT_STORAGE_RACE', 'Snapshot conflict row could not be read', {
            snapshotId: envelope.snapshotId,
          });
        const existing = validateSnapshotEnvelope(existingResult.rows[0].envelope);
        governanceInvariant(jsonEqual(existing, envelope),
          'SNAPSHOT_IMMUTABILITY_CONFLICT', 'Snapshot ID already exists with different content', {
            snapshotId: envelope.snapshotId,
          });
        return existing;
      });
    } catch (error) {
      throw mapGovernancePostgresError(error, 'saveSnapshot');
    }
  }

  async get(query) {
    governanceInvariant(typeof query?.snapshotId === 'string' && query.snapshotId.length > 0,
      'INVALID_SNAPSHOT_QUERY', 'snapshotId is required');
    try {
      return await this.executor.read(async (client) => {
        const result = await client.query(
          `SELECT envelope FROM ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes WHERE snapshot_id = $1`,
          [query.snapshotId],
        );
        return result.rowCount === 0 ? null : validateSnapshotEnvelope(result.rows[0].envelope);
      });
    } catch (error) {
      throw mapGovernancePostgresError(error, 'getSnapshot');
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
        if (filter.environmentId !== undefined) add('environment_id', filter.environmentId);
        if (filter.releaseId !== undefined) add('release_id', filter.releaseId);
        const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
        const result = await client.query(
          `SELECT envelope FROM ${GOVERNANCE_POSTGRES_SCHEMA}.snapshot_envelopes
             ${where} ORDER BY created_at ASC, snapshot_id ASC`,
          values,
        );
        return result.rows.map((row) => validateSnapshotEnvelope(row.envelope));
      });
    } catch (error) {
      throw mapGovernancePostgresError(error, 'listSnapshots');
    }
  }
}

function validateFilter(filter) {
  governanceInvariant(filter && typeof filter === 'object' && !Array.isArray(filter),
    'INVALID_SNAPSHOT_FILTER', 'Snapshot filter must be an object');
  if (filter.projectId !== undefined) validateProjectId(filter.projectId);
  for (const field of ['environmentId', 'releaseId']) {
    if (filter[field] !== undefined) {
      governanceInvariant(typeof filter[field] === 'string' && filter[field].length > 0,
        'INVALID_SNAPSHOT_FILTER', `${field} must be a non-empty string`, { field });
    }
  }
}
