import test from 'node:test';
import assert from 'node:assert/strict';
import { withPostgresTransaction } from '../src/index.js';

function fakePool(handler) {
  const queries = [];
  let released = false;
  const client = {
    async query(text, values) {
      queries.push({ text, values });
      return handler?.(text, values) ?? { rowCount: 0, rows: [] };
    },
    release() {
      released = true;
    },
  };
  return {
    pool: { async connect() { return client; } },
    queries,
    wasReleased: () => released,
  };
}

test('transaction commits work on the same client and releases it', async () => {
  const fixture = fakePool();
  const result = await withPostgresTransaction(fixture.pool, async (client) => {
    await client.query('SELECT 1');
    return 'done';
  });

  assert.equal(result, 'done');
  assert.deepEqual(fixture.queries.map((item) => item.text), [
    'BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED',
    'SELECT 1',
    'COMMIT',
  ]);
  assert.equal(fixture.wasReleased(), true);
});

test('transaction rolls back and releases the client after failure', async () => {
  const fixture = fakePool();
  const failure = new Error('write failed');

  await assert.rejects(
    () => withPostgresTransaction(fixture.pool, async () => { throw failure; }),
    (error) => error === failure,
  );
  assert.deepEqual(fixture.queries.map((item) => item.text), [
    'BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED',
    'ROLLBACK',
  ]);
  assert.equal(fixture.wasReleased(), true);
});

test('read-only transaction uses repeatable read when requested', async () => {
  const fixture = fakePool();
  await withPostgresTransaction(fixture.pool, async () => undefined, {
    readOnly: true,
    isolationLevel: 'REPEATABLE READ',
  });
  assert.equal(
    fixture.queries[0].text,
    'BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY',
  );
});
