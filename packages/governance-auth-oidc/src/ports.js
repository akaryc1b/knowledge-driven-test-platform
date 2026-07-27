import { HttpBoundaryError, httpInvariant } from '@kdtp/governance-http';

export class JwksProviderPort {
  async getSigningKey() {
    throw new HttpBoundaryError('JWKS_PROVIDER_NOT_IMPLEMENTED', 'JWKS provider is not implemented', 500);
  }
}

export class SubjectMapperPort {
  async map() {
    throw new HttpBoundaryError('SUBJECT_MAPPER_NOT_IMPLEMENTED', 'Subject mapper is not implemented', 500);
  }
}

export class AuthenticationEventSinkPort {
  async record() {}
}

export function assertJwksProviderPort(port) {
  httpInvariant(port && typeof port === 'object' && typeof port.getSigningKey === 'function',
    'INVALID_JWKS_PROVIDER', 'JWKS provider must implement getSigningKey', 500);
  return port;
}

export function assertSubjectMapperPort(port) {
  httpInvariant(port && typeof port === 'object' && typeof port.map === 'function',
    'INVALID_SUBJECT_MAPPER', 'Subject mapper must implement map', 500);
  return port;
}

export function assertAuthenticationEventSinkPort(port) {
  httpInvariant(port && typeof port === 'object' && typeof port.record === 'function',
    'INVALID_AUTHENTICATION_EVENT_SINK', 'Authentication event sink must implement record', 500);
  return port;
}
