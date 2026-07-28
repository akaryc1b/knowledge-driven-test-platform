import {
  assertPostgresClient,
  assertPostgresPool,
  withPostgresTransaction,
} from '@kdtp/knowledge-registry-postgres';

export class PostgresTestPlanExecutor {
  constructor({ pool, client } = {}) {
    this.client = client ? assertPostgresClient(client) : null;
    this.pool = this.client ? null : assertPostgresPool(pool);
  }

  async write(work, options = {}) {
    if (this.client) return work(this.client);
    return withPostgresTransaction(this.pool, work, options);
  }

  async read(work) {
    if (this.client) return work(this.client);
    return withPostgresTransaction(this.pool, work, {
      readOnly: true,
      isolationLevel: 'REPEATABLE READ',
    });
  }
}
