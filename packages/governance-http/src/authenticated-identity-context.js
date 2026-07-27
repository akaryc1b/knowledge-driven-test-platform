import { QueryError, RequestIdentityContextPort } from '@kdtp/governance-query';

export class AuthenticatedRequestIdentityContext extends RequestIdentityContextPort {
  async resolve(context) {
    const identity = context?.authenticatedIdentity;
    if (!identity || typeof identity !== 'object' || Array.isArray(identity)) {
      throw new QueryError('UNAUTHENTICATED', 'Authenticated request identity is required');
    }
    if (typeof identity.actor !== 'string' || identity.actor.trim().length === 0) {
      throw new QueryError('UNAUTHENTICATED', 'Authenticated request identity is invalid');
    }
    return {
      actor: identity.actor,
      attributes: structuredClone(identity.attributes ?? {}),
    };
  }
}
