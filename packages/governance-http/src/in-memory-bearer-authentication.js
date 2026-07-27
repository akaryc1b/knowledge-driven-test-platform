import { AuthenticationPort } from './authentication-port.js';
import { HttpBoundaryError, httpInvariant } from './errors.js';

export class InMemoryBearerAuthentication extends AuthenticationPort {
  constructor(entries = [], options = {}) {
    super();
    this.entries = new Map();
    this.clock = options.clock ?? (() => Date.now());
    for (const entry of entries) this.register(entry);
  }

  register(input) {
    httpInvariant(typeof input?.token === 'string' && input.token.length >= 8 && input.token.length <= 4096,
      'INVALID_AUTHENTICATION_ENTRY', 'Authentication token must contain 8 to 4096 characters', 500);
    httpInvariant(typeof input?.actor === 'string' && input.actor.trim().length > 0,
      'INVALID_AUTHENTICATION_ENTRY', 'Authentication actor must be a non-empty string', 500);
    if (input.expiresAt !== undefined && input.expiresAt !== null) {
      httpInvariant(typeof input.expiresAt === 'string' && Number.isFinite(Date.parse(input.expiresAt)),
        'INVALID_AUTHENTICATION_ENTRY', 'Authentication expiresAt must be an ISO timestamp', 500);
    }
    this.entries.set(input.token, {
      actor: input.actor,
      attributes: structuredClone(input.attributes ?? {}),
      disabled: input.disabled === true,
      expiresAt: input.expiresAt ?? null,
    });
    return this;
  }

  async authenticate(request) {
    if (request?.scheme !== 'Bearer' || typeof request?.credential !== 'string') {
      throw unauthenticated();
    }
    const entry = this.entries.get(request.credential);
    if (!entry || entry.disabled || (entry.expiresAt !== null && Date.parse(entry.expiresAt) <= this.clock())) {
      throw unauthenticated();
    }
    return {
      actor: entry.actor,
      attributes: structuredClone(entry.attributes),
    };
  }
}

function unauthenticated() {
  return new HttpBoundaryError(
    'UNAUTHENTICATED',
    'Bearer credential is invalid',
    401,
    {},
    { 'www-authenticate': 'Bearer' },
  );
}
