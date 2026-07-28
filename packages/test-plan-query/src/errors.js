export class PlanQueryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PlanQueryError';
    this.code = code;
    this.details = structuredClone(details);
  }
}

export function planQueryInvariant(condition, code, message, details = {}) {
  if (!condition) throw new PlanQueryError(code, message, details);
}
