import { RegistryError, validateRegistryRecord } from '@kdtp/knowledge-registry';

/** @param {Record<string, any>} row @param {Array<Record<string, any>>} historyRows */
export function mapPostgresRecord(row, historyRows) {
  const record = {
    recordSchemaVersion: row.record_schema_version,
    key: row.record_key,
    revision: safeInteger(row.revision, 'revision'),
    createdAt: canonicalTimestamp(row.created_at, 'created_at'),
    updatedAt: canonicalTimestamp(row.updated_at, 'updated_at'),
    knowledge: cloneJson(row.knowledge),
    history: historyRows.map((event) => ({
      sequence: safeInteger(event.sequence, 'sequence'),
      type: event.event_type,
      fromStatus: event.from_status,
      toStatus: event.to_status,
      actor: event.actor,
      at: canonicalTimestamp(event.occurred_at, 'occurred_at'),
      reason: event.reason,
    })),
  };
  return validateRegistryRecord(record);
}

/** @param {unknown} value @param {string} field */
function safeInteger(value, field) {
  const converted = typeof value === 'number' ? value : Number(value);
  if (!Number.isSafeInteger(converted)) {
    throw new RegistryError('INVALID_POSTGRES_ROW', `PostgreSQL ${field} is not a safe integer`, {
      field,
      value,
    });
  }
  return converted;
}

/** @param {unknown} value @param {string} field */
function canonicalTimestamp(value, field) {
  const date = value instanceof Date ? value : new Date(String(value));
  if (!Number.isFinite(date.getTime())) {
    throw new RegistryError('INVALID_POSTGRES_ROW', `PostgreSQL ${field} is not a timestamp`, {
      field,
      value,
    });
  }
  return date.toISOString();
}

function cloneJson(value) {
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (error) {
      throw new RegistryError('INVALID_POSTGRES_ROW', 'PostgreSQL knowledge JSON is invalid', {
        cause: error.message,
      });
    }
  }
  return structuredClone(value);
}
