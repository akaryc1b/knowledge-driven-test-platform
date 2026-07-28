import { PlanningOrchestrationError, orchestrationInvariant } from './errors.js';

export const PLANNING_UNIT_OF_WORK_METHODS = Object.freeze(['execute']);

export class PlanningUnitOfWorkPort {
  async execute() {
    throw new PlanningOrchestrationError('PLANNING_UOW_NOT_IMPLEMENTED',
      'PlanningUnitOfWorkPort.execute is not implemented');
  }
}

export function assertPlanningUnitOfWorkPort(port) {
  orchestrationInvariant(port && typeof port === 'object',
    'INVALID_PLANNING_UNIT_OF_WORK', 'planningUnitOfWork is required');
  for (const method of PLANNING_UNIT_OF_WORK_METHODS) {
    orchestrationInvariant(typeof port[method] === 'function',
      'INVALID_PLANNING_UNIT_OF_WORK', `planningUnitOfWork is missing ${method}`);
  }
  return port;
}
