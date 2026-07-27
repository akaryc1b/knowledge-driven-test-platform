import {
  GovernanceUnitOfWorkPort,
  governanceInvariant,
} from '@kdtp/knowledge-governance';
import {
  PostgresKnowledgeRegistry,
  assertPostgresPool,
  withPostgresTransaction,
} from '@kdtp/knowledge-registry-postgres';
import { PostgresReviewDecisionStore } from './review-decision-store.js';
import { PostgresKnowledgeSnapshotStore } from './snapshot-store.js';

export class PostgresGovernanceUnitOfWork extends GovernanceUnitOfWorkPort {
  constructor({ pool } = {}) {
    super();
    this.pool = assertPostgresPool(pool);
  }

  async execute(work, options = {}) {
    governanceInvariant(typeof work === 'function',
      'INVALID_GOVERNANCE_UNIT_OF_WORK', 'Unit of Work requires a callback');
    return withPostgresTransaction(this.pool, async (client) => {
      return work({
        registry: new PostgresKnowledgeRegistry({ client }),
        reviewStore: new PostgresReviewDecisionStore({ client }),
        snapshotStore: new PostgresKnowledgeSnapshotStore({ client }),
      });
    }, {
      isolationLevel: options.isolationLevel ?? 'READ COMMITTED',
    });
  }
}
