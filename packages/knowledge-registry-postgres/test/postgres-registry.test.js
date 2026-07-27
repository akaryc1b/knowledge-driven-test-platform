import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresKnowledgeRegistry } from '../src/index.js';

test('adapter rejects an invalid pool at construction time', () => {
  assert.throws(
    () => new PostgresKnowledgeRegistry({ pool: {} }),
    (error) => error.code === 'INVALID_POSTGRES_POOL',
  );
});
