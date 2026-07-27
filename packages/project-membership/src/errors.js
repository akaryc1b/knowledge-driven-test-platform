export class ProjectAccessError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ProjectAccessError';
    this.code = code;
    this.details = details;
  }
}

export function accessInvariant(condition, code, message, details = {}) {
  if (!condition) throw new ProjectAccessError(code, message, details);
}
