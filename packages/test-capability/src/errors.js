export class CapabilityCatalogError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'CapabilityCatalogError';
    this.code = code;
    this.details = details;
  }
}

export function capabilityInvariant(condition, code, message, details = {}) {
  if (!condition) throw new CapabilityCatalogError(code, message, details);
}
