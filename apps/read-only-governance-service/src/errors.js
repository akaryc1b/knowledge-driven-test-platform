export class ServiceConfigurationError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ServiceConfigurationError';
    this.code = code;
    this.details = details;
  }
}

export function serviceInvariant(condition, code, message, details = {}) {
  if (!condition) throw new ServiceConfigurationError(code, message, details);
}
