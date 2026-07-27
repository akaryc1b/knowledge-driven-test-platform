export class TestPlannerError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TestPlannerError';
    this.code = code;
    this.details = details;
  }
}

export function plannerInvariant(condition, code, message, details = {}) {
  if (!condition) throw new TestPlannerError(code, message, details);
}
