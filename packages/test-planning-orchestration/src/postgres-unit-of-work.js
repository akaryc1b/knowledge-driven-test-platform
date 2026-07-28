import { assertPostgresPool, withPostgresTransaction } from '@kdtp/knowledge-registry-postgres';
import { TestPlanGovernanceService } from '@kdtp/test-plan-governance';
import { PostgresTestPlanRegistry } from '@kdtp/test-plan-postgres';
import { PlanningUnitOfWorkPort } from './ports.js';
import { orchestrationInvariant } from './errors.js';

export class PostgresPlanningUnitOfWork extends PlanningUnitOfWorkPort {
  constructor({ pool, authorization, policy, registryFactory } = {}) {
    super();
    this.pool = assertPostgresPool(pool);
    this.authorization = authorization;
    this.policy = policy;
    this.registryFactory = registryFactory ?? ((client) => new PostgresTestPlanRegistry({ client }));
    orchestrationInvariant(typeof this.registryFactory === 'function',
      'INVALID_PLAN_REGISTRY_FACTORY', 'registryFactory must be a function');
  }

  async execute(work) {
    orchestrationInvariant(typeof work === 'function',
      'INVALID_PLANNING_WORK', 'Unit of Work callback is required');
    return withPostgresTransaction(this.pool, async (client) => {
      const registry = this.registryFactory(client);
      const governance = new TestPlanGovernanceService({
        registry,
        authorization: this.authorization,
        policy: this.policy,
      });
      return work({ registry, governance, client });
    });
  }
}
