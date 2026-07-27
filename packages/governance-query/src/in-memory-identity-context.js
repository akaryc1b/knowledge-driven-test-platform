import { RequestIdentityContextPort } from './identity-port.js';
import { QueryError, queryInvariant } from './errors.js';

export class InMemoryRequestIdentityContext extends RequestIdentityContextPort {
  constructor(entries = []) {
    super();
    this.identities = new Map();
    for (const entry of entries) this.register(entry);
  }

  register(input) {
    queryInvariant(typeof input?.credential === 'string' && input.credential.length > 0,
      'INVALID_IDENTITY_ENTRY', 'Identity credential must be a non-empty string');
    queryInvariant(typeof input?.actor === 'string' && input.actor.trim().length > 0,
      'INVALID_IDENTITY_ENTRY', 'Identity actor must be a non-empty string');
    this.identities.set(input.credential, {
      actor: input.actor,
      attributes: structuredClone(input.attributes ?? {}),
    });
    return this;
  }

  async resolve(context) {
    queryInvariant(context && typeof context === 'object' && !Array.isArray(context),
      'INVALID_IDENTITY_CONTEXT', 'Request identity context must be an object');
    const credential = context.credential;
    queryInvariant(typeof credential === 'string' && credential.length > 0,
      'UNAUTHENTICATED', 'Request credential is required');
    const identity = this.identities.get(credential);
    if (!identity) {
      throw new QueryError('UNAUTHENTICATED', 'Request credential is not recognized');
    }
    return structuredClone(identity);
  }
}
