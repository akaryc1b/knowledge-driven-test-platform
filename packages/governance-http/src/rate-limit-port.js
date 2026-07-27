import { HttpBoundaryError, httpInvariant } from './errors.js';

export const READ_ONLY_RATE_LIMIT_PORT_METHODS = Object.freeze(['consume']);

export class ReadOnlyRateLimitPort {
  async consume() {
    throw new HttpBoundaryError('RATE_LIMIT_NOT_IMPLEMENTED', 'Rate limiting is not implemented', 500);
  }
}

export class AllowAllReadOnlyRateLimiter extends ReadOnlyRateLimitPort {
  async consume() {
    return { allowed: true, limit: null, remaining: null, resetAt: null };
  }
}

export function assertReadOnlyRateLimitPort(port) {
  httpInvariant(port && typeof port === 'object',
    'INVALID_RATE_LIMIT_PORT', 'Rate limit port must be an object', 500);
  for (const method of READ_ONLY_RATE_LIMIT_PORT_METHODS) {
    httpInvariant(typeof port[method] === 'function',
      'INVALID_RATE_LIMIT_PORT', `Rate limit port is missing method ${method}`, 500, { method });
  }
  return port;
}
