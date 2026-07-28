export class PlanGovernanceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PlanGovernanceError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

export function planGovernanceInvariant(condition, code, message, details = {}) {
  if (!condition) throw new PlanGovernanceError(code, message, details);
}
