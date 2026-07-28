export class PlanningOrchestrationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PlanningOrchestrationError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

export function orchestrationInvariant(condition, code, message, details = {}) {
  if (!condition) throw new PlanningOrchestrationError(code, message, details);
}
