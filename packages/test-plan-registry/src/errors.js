import { TestPlanError } from '@kdtp/test-plan';

export class TestPlanRegistryError extends TestPlanError {
  constructor(code, message, details = {}) {
    super(code, message, details);
    this.name = 'TestPlanRegistryError';
  }
}

export function registryInvariant(condition, code, message, details = {}) {
  if (!condition) throw new TestPlanRegistryError(code, message, details);
}
