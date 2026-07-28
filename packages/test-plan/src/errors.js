export class TestPlanError extends Error {
  /**
   * @param {string} code
   * @param {string} message
   * @param {Record<string, unknown>} [details]
   */
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'TestPlanError';
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
export function planInvariant(condition, code, message, details = {}) {
  if (!condition) throw new TestPlanError(code, message, details);
}
