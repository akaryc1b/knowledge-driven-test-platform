import {
  compareKnowledgeVersions,
  createKnowledgeRecord,
  knowledgeKey,
  KnowledgeRegistryPort,
  parseKnowledgeVersion,
  RegistryError,
  replaceDraftRecord,
  transitionKnowledgeRecord,
  validateKnowledgeId,
  validateRegistryFilter,
} from '@kdtp/knowledge-registry';
import { mapPostgresError } from './postgres-errors.js';
import { assertPostgresClient, assertPostgresPool } from './pool-contract.js';
import { mapPostgresRecord } from './row-mapper.js';
import { POSTGRES_SCHEMA } from './migrations.js';
import { withPostgresTransaction } from './transaction.js';

const RECORD_COLUMNS = `
  record_key,
  record_schema_version,
  knowledge_id,
  knowledge_version,
  version_major,
  version_minor,
  version_patch,
  status,
  scope_level,
  scope_key,
  revision,
  created_at,
  updated_at,
  knowledge
`;

export class PostgresKnowledgeRegistry extends KnowledgeRegistryPort {
  constructor(input = {}) {
    super();
    this.client = input.client ? assertPostgresClient(input.client) : null;
    this.pool = this.client ? null : assertPostgresPool(input.pool);
  }

  async createDraft(command) {
    const record = createKnowledgeRecord(command);
    const parsedVersion = parseKnowledgeVersion(record.knowledge.version);
    try {
      return await this.run(async (client) => {
        await client.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`knowledge-id:${record.knowledge.id}`]);
        const duplicate = await client.query(
          `SELECT 1 FROM ${POSTGRES_SCHEMA}.knowledge_records WHERE knowledge_id = $1 AND knowledge_version = $2`,
          [record.knowledge.id, record.knowledge.version],
        );
        if (duplicate.rowCount > 0) {
          throw new RegistryError('KNOWLEDGE_VERSION_EXISTS', `Knowledge version ${record.key} already exists`, { key: record.key });
        }
        const highest = await client.query(
          `SELECT knowledge_version FROM ${POSTGRES_SCHEMA}.knowledge_records
            WHERE knowledge_id = $1
            ORDER BY version_major DESC, version_minor DESC, version_patch DESC LIMIT 1`,
          [record.knowledge.id],
        );
        if (highest.rowCount > 0) {
          const highestVersion = highest.rows[0].knowledge_version;
          if (compareKnowledgeVersions(record.knowledge.version, highestVersion) <= 0) {
            throw new RegistryError('NON_MONOTONIC_VERSION',
              'New knowledge version must be greater than every existing version', {
                id: record.knowledge.id,
                incomingVersion: record.knowledge.version,
                highestVersion,
              });
          }
        }
        await client.query(
          `INSERT INTO ${POSTGRES_SCHEMA}.knowledge_records (
            record_key, record_schema_version, knowledge_id, knowledge_version,
            version_major, version_minor, version_patch, status, scope_level,
            scope_key, revision, created_at, updated_at, knowledge
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14::jsonb)`,
          [
            record.key, record.recordSchemaVersion, record.knowledge.id,
            record.knowledge.version, parsedVersion.major, parsedVersion.minor,
            parsedVersion.patch, record.knowledge.status, record.knowledge.scope.level,
            record.knowledge.scope.key, record.revision, record.createdAt,
            record.updatedAt, JSON.stringify(record.knowledge),
          ],
        );
        await insertHistoryEvent(client, record.key, record.history[0]);
        return structuredClone(record);
      });
    } catch (error) {
      throw mapPostgresError(error, 'createDraft');
    }
  }

  async get(query) {
    const key = knowledgeKey(query?.id, query?.version);
    try {
      const records = await this.readRecords({ recordKey: key, limit: 1 });
      return records[0] ?? null;
    } catch (error) {
      throw mapPostgresError(error, 'get');
    }
  }

  async list(filter = {}) {
    const normalized = validateRegistryFilter(filter);
    try {
      return await this.readRecords({ filter: normalized });
    } catch (error) {
      throw mapPostgresError(error, 'list');
    }
  }

  async listVersions(query) {
    const id = validateKnowledgeId(query?.id);
    try {
      return await this.readRecords({ filter: { id } });
    } catch (error) {
      throw mapPostgresError(error, 'listVersions');
    }
  }

  async getLatestPublished(query) {
    const id = validateKnowledgeId(query?.id);
    try {
      const records = await this.readRecords({ filter: { id, status: 'PUBLISHED' }, descendingVersion: true, limit: 1 });
      return records[0] ?? null;
    } catch (error) {
      throw mapPostgresError(error, 'getLatestPublished');
    }
  }

  async replaceDraft(command) {
    const key = knowledgeKey(command?.id, command?.version);
    try {
      return await this.run(async (client) => {
        const current = await requireRecordForUpdate(client, key);
        const next = replaceDraftRecord(current, command);
        await persistRecordUpdate(client, current, next);
        return structuredClone(next);
      });
    } catch (error) {
      throw mapPostgresError(error, 'replaceDraft');
    }
  }

  async transition(command) {
    const key = knowledgeKey(command?.id, command?.version);
    try {
      return await this.run(async (client) => {
        const current = await requireRecordForUpdate(client, key);
        const next = transitionKnowledgeRecord(current, command);
        await persistRecordUpdate(client, current, next);
        return structuredClone(next);
      });
    } catch (error) {
      throw mapPostgresError(error, 'transition');
    }
  }

  async readRecords(options) {
    return this.run(async (client) => {
      const { text, values } = buildRecordSelect(options);
      const result = await client.query(text, values);
      return hydrateRows(client, result.rows);
    }, { readOnly: true, isolationLevel: 'REPEATABLE READ' });
  }

  async run(work, options = {}) {
    if (this.client) return work(this.client);
    return withPostgresTransaction(this.pool, work, options);
  }
}

async function requireRecordForUpdate(client, key) {
  const result = await client.query(
    `SELECT ${RECORD_COLUMNS} FROM ${POSTGRES_SCHEMA}.knowledge_records WHERE record_key = $1 FOR UPDATE`,
    [key],
  );
  if (result.rowCount === 0) {
    throw new RegistryError('KNOWLEDGE_NOT_FOUND', `Knowledge version ${key} was not found`, { key });
  }
  return (await hydrateRows(client, result.rows))[0];
}

async function persistRecordUpdate(client, current, next) {
  const updated = await client.query(
    `UPDATE ${POSTGRES_SCHEMA}.knowledge_records
        SET status = $1, scope_level = $2, scope_key = $3, revision = $4,
            updated_at = $5, knowledge = $6::jsonb
      WHERE record_key = $7 AND revision = $8`,
    [next.knowledge.status, next.knowledge.scope.level, next.knowledge.scope.key,
      next.revision, next.updatedAt, JSON.stringify(next.knowledge), current.key, current.revision],
  );
  if (updated.rowCount !== 1) {
    throw new RegistryError('REVISION_CONFLICT',
      'Registry record revision does not match expectedRevision', {
        key: current.key,
        expectedRevision: current.revision,
      });
  }
  await insertHistoryEvent(client, next.key, next.history.at(-1));
}

async function insertHistoryEvent(client, key, event) {
  await client.query(
    `INSERT INTO ${POSTGRES_SCHEMA}.knowledge_history (
      record_key, sequence, event_type, from_status, to_status, actor, occurred_at, reason
    ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [key, event.sequence, event.type, event.fromStatus, event.toStatus,
      event.actor, event.at, event.reason],
  );
}

async function hydrateRows(client, rows) {
  if (rows.length === 0) return [];
  const keys = rows.map((row) => row.record_key);
  const historyResult = await client.query(
    `SELECT record_key, sequence, event_type, from_status, to_status, actor, occurred_at, reason
       FROM ${POSTGRES_SCHEMA}.knowledge_history
      WHERE record_key = ANY($1::text[]) ORDER BY record_key, sequence`,
    [keys],
  );
  const historyByKey = new Map(keys.map((key) => [key, []]));
  for (const event of historyResult.rows) historyByKey.get(event.record_key)?.push(event);
  return rows.map((row) => mapPostgresRecord(row, historyByKey.get(row.record_key) ?? []));
}

function buildRecordSelect(options) {
  const conditions = [];
  const values = [];
  const addCondition = (sql, value) => {
    values.push(value);
    conditions.push(sql.replace('?', `$${values.length}`));
  };
  if (options.recordKey !== undefined) addCondition('record_key = ?', options.recordKey);
  const filter = options.filter ?? {};
  if (filter.id !== undefined) addCondition('knowledge_id = ?', filter.id);
  if (filter.status !== undefined) addCondition('status = ?', filter.status);
  if (filter.scopeLevel !== undefined) addCondition('scope_level = ?', filter.scopeLevel);
  if (filter.scopeKey !== undefined) addCondition('scope_key = ?', filter.scopeKey);
  const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
  const direction = options.descendingVersion ? 'DESC' : 'ASC';
  let text = `SELECT ${RECORD_COLUMNS} FROM ${POSTGRES_SCHEMA}.knowledge_records ${where}
    ORDER BY knowledge_id ASC, version_major ${direction}, version_minor ${direction}, version_patch ${direction}`;
  if (options.limit !== undefined) {
    values.push(options.limit);
    text += ` LIMIT $${values.length}`;
  }
  return { text, values };
}
