import {
  assertPostgresClient,
  assertPostgresPool,
  withPostgresTransaction,
} from '@kdtp/knowledge-registry-postgres';

export class PostgresGovernanceExecutor {
  constructor({ pool, client } = {}) {
    this.client = client ? assertPostgresClient(client) : null;
    this.pool = this.client ? null : assertPostgresPool(pool);
  }

  async write(work) {
    if (this.client) return work(this.client);
    return withPostgresTransaction(this.pool, work);
  }

  async read(work) {
    if (this.client) return work(this.client);
    return withPostgresTransaction(this.pool, work, {
      readOnly: true,
      isolationLevel: 'REPEATABLE READ',
    });
  }
}
