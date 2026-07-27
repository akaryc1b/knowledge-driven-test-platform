export class RegistryError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'RegistryError';
    this.code = code;
    this.details = details;
  }
}

/**
 * @param {unknown} condition
 * @param {string} code
 * @param {string} message
 * @param {Record<string, unknown>} [details]
 */
export function registryInvariant(condition, code, message, details = {}) {
  if (!condition) {
    throw new RegistryError(code, message, details);
  }
}
