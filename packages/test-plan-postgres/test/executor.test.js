import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresTestPlanExecutor } from '../src/index.js';

test('PostgresTestPlanExecutor rejects invalid pool and client contracts', () => {
  assert.throws(() => new PostgresTestPlanExecutor({ pool: {} }), (error) => error.code === 'INVALID_POSTGRES_POOL');
  assert.throws(() => new PostgresTestPlanExecutor({ client: {} }), (error) => error.code === 'INVALID_POSTGRES_CLIENT');
});
