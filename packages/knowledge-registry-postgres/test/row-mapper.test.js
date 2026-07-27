import test from 'node:test';
import assert from 'node:assert/strict';
import { createKnowledgeRecord } from '@kdtp/knowledge-registry';
import { mapPostgresRecord } from '../src/index.js';
import { createCommand } from '../../knowledge-registry/test/test-helpers.js';

test('row mapper reconstructs and validates a registry record', () => {
  const record = createKnowledgeRecord(createCommand());
  const mapped = mapPostgresRecord({
    record_key: record.key,
    record_schema_version: record.recordSchemaVersion,
    revision: String(record.revision),
    created_at: new Date(record.createdAt),
    updated_at: record.updatedAt,
    knowledge: JSON.stringify(record.knowledge),
  }, [{
    record_key: record.key,
    sequence: '1',
    event_type: 'CREATED',
    from_status: null,
    to_status: 'DRAFT',
    actor: record.history[0].actor,
    occurred_at: new Date(record.history[0].at),
    reason: record.history[0].reason,
  }]);

  assert.deepEqual(mapped, record);
});
