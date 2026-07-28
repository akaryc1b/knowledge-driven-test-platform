import { TestPlanGovernanceService } from '@kdtp/test-plan-governance';
import { assertPlanningUnitOfWorkPort, PlanningUnitOfWorkPort } from './ports.js';
import { orchestrationInvariant } from './errors.js';

export class PassthroughPlanningUnitOfWork extends PlanningUnitOfWorkPort {
  constructor({ registry, authorization, policy } = {}) {
    super();
    orchestrationInvariant(registry && typeof registry === 'object',
      'INVALID_PLAN_REGISTRY', 'registry is required');
    this.registry = registry;
    this.authorization = authorization;
    this.policy = policy;
  }

  async execute(work) {
    orchestrationInvariant(typeof work === 'function',
      'INVALID_PLANNING_WORK', 'Unit of Work callback is required');
    const governance = new TestPlanGovernanceService({
      registry: this.registry,
      authorization: this.authorization,
      policy: this.policy,
    });
    return work({ registry: this.registry, governance });
  }
}

export function validatePassthroughPlanningUnitOfWork(input) {
  return assertPlanningUnitOfWorkPort(input);
}
