import { QueryError, queryInvariant } from './errors.js';

export const REQUEST_IDENTITY_CONTEXT_PORT_METHODS = Object.freeze(['resolve']);

export class RequestIdentityContextPort {
  async resolve() {
    throw new QueryError(
      'IDENTITY_RESOLUTION_NOT_IMPLEMENTED',
      'Request identity resolution is not implemented',
    );
  }
}

export function assertRequestIdentityContextPort(port) {
  queryInvariant(port && typeof port === 'object',
    'INVALID_IDENTITY_CONTEXT_PORT', 'Identity context port must be an object');
  for (const method of REQUEST_IDENTITY_CONTEXT_PORT_METHODS) {
    queryInvariant(typeof port[method] === 'function',
      'INVALID_IDENTITY_CONTEXT_PORT', `Identity context port is missing method ${method}`, {
        method,
      });
  }
  return port;
}
