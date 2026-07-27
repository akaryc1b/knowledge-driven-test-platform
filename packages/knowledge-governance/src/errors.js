export class GovernanceError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'GovernanceError';
    this.code = code;
    this.details = details;
  }
}

export function governanceInvariant(condition, code, message, details = {}) {
  if (!condition) throw new GovernanceError(code, message, details);
}
