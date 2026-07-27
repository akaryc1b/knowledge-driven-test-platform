import { assertPostgresClient, assertPostgresPool } from './pool-contract.js';

/**
 * Execute all statements on the same PostgreSQL client.
 *
 * @template T
 * @param {unknown} inputPool
 * @param {(client: any) => Promise<T>} work
 * @param {{readOnly?: boolean, isolationLevel?: 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE'}} [options]
 * @returns {Promise<T>}
 */
export async function withPostgresTransaction(inputPool, work, options = {}) {
  const pool = assertPostgresPool(inputPool);
  const client = assertPostgresClient(await pool.connect());
  const isolationLevel = options.isolationLevel ?? 'READ COMMITTED';
  const begin = options.readOnly
    ? `BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel} READ ONLY`
    : `BEGIN TRANSACTION ISOLATION LEVEL ${isolationLevel}`;

  try {
    await client.query(begin);
    try {
      const result = await work(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        if (error && typeof error === 'object') error.rollbackError = rollbackError;
      }
      throw error;
    }
  } finally {
    client.release();
  }
}
