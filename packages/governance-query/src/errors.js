export class QueryError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'QueryError';
    this.code = code;
    this.details = details;
  }
}

export function queryInvariant(condition, code, message, details = {}) {
  if (!condition) throw new QueryError(code, message, details);
}
