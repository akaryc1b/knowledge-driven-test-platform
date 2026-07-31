export class ExecutionContractError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ExecutionContractError';
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
export function executionInvariant(condition, code, message, details = {}) {
  if (!condition) throw new ExecutionContractError(code, message, details);
}
