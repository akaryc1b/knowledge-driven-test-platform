export class TestPlannerPort {
  async plan() {
    throw new Error('TestPlannerPort.plan must be implemented');
  }
}

export class PlanningStrategyPort {
  async createIntentSpecs() {
    throw new Error('PlanningStrategyPort.createIntentSpecs must be implemented');
  }
}
