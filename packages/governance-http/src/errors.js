export class HttpBoundaryError extends Error {
  constructor(code, message, status, details = {}, headers = {}) {
    super(message);
    this.name = 'HttpBoundaryError';
    this.code = code;
    this.status = status;
    this.details = details;
    this.headers = headers;
  }
}

export function httpInvariant(condition, code, message, status, details = {}, headers = {}) {
  if (!condition) throw new HttpBoundaryError(code, message, status, details, headers);
}
