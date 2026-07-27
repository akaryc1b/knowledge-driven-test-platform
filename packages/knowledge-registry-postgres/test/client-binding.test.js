import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresKnowledgeRegistry } from '../src/index.js';

test('PostgresKnowledgeRegistry accepts a transaction-bound client without opening a pool transaction', async () => {
  const statements = [];
  const client = {
    async query(text) {
      statements.push(text);
      if (String(text).includes('FROM kdtp_registry.knowledge_records')) {
        return { rowCount: 0, rows: [] };
      }
      return { rowCount: 0, rows: [] };
    },
    release() {},
  };
  const registry = new PostgresKnowledgeRegistry({ client });
  const result = await registry.get({ id: 'PROJECT-SAMPLE-001', version: '1.0.0' });
  assert.equal(result, null);
  assert.equal(statements.some((text) => String(text).startsWith('BEGIN')), false);
});
