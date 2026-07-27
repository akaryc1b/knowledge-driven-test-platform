import { HttpBoundaryError } from '@kdtp/governance-http';

export class OidcValidationError extends Error {
  constructor(reasonCode, message) {
    super(message);
    this.name = 'OidcValidationError';
    this.reasonCode = reasonCode;
  }
}

export function oidcInvariant(condition, reasonCode, message) {
  if (!condition) throw new OidcValidationError(reasonCode, message);
}

export function unauthenticated(reasonCode = 'INVALID_TOKEN') {
  return new HttpBoundaryError(
    'UNAUTHENTICATED',
    'Bearer credential is invalid',
    401,
    { reasonCode },
    { 'www-authenticate': 'Bearer error="invalid_token"' },
  );
}

export function authenticationUnavailable(reasonCode, cause) {
  const error = new HttpBoundaryError(
    'AUTHENTICATION_UNAVAILABLE',
    'OIDC authentication is temporarily unavailable',
    503,
    { reasonCode },
  );
  if (cause !== undefined) error.cause = cause;
  return error;
}
