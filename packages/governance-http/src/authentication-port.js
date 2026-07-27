import { HttpBoundaryError, httpInvariant } from './errors.js';

export const AUTHENTICATION_PORT_METHODS = Object.freeze(['authenticate']);

export class AuthenticationPort {
  async authenticate() {
    throw new HttpBoundaryError(
      'AUTHENTICATION_NOT_IMPLEMENTED',
      'Authentication is not implemented',
      500,
    );
  }
}

export function assertAuthenticationPort(port) {
  httpInvariant(port && typeof port === 'object',
    'INVALID_AUTHENTICATION_PORT', 'Authentication port must be an object', 500);
  for (const method of AUTHENTICATION_PORT_METHODS) {
    httpInvariant(typeof port[method] === 'function',
      'INVALID_AUTHENTICATION_PORT', `Authentication port is missing method ${method}`, 500, { method });
  }
  return port;
}
