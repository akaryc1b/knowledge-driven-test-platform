import { ProjectAuthorizationPort } from './ports.js';
import {
  validateActor,
  validateGovernanceAction,
  validateProjectId,
} from './validation.js';
import { governanceInvariant } from './errors.js';

export class InMemoryProjectAuthorization extends ProjectAuthorizationPort {
  constructor(grants = []) {
    super();
    this.grants = new Map();
    for (const grant of grants) this.grant(grant);
  }

  grant(input) {
    const projectId = validateProjectId(input?.projectId);
    const actor = validateActor(input?.actor);
    governanceInvariant(Array.isArray(input?.actions) && input.actions.length > 0,
      'INVALID_AUTHORIZATION_GRANT', 'Authorization grant actions must be a non-empty array');
    const actions = [...new Set(input.actions.map(validateGovernanceAction))].sort();
    const roles = input.roles === undefined ? [] : input.roles;
    governanceInvariant(Array.isArray(roles) && roles.every((role) => typeof role === 'string' && role.length > 0),
      'INVALID_AUTHORIZATION_GRANT', 'Authorization roles must be non-empty strings');
    const key = `${projectId}\u0000${actor}`;
    const current = this.grants.get(key);
    this.grants.set(key, {
      projectId,
      actor,
      actions: [...new Set([...(current?.actions ?? []), ...actions])].sort(),
      roles: [...new Set([...(current?.roles ?? []), ...roles])].sort(),
    });
    return this;
  }

  async authorize(request) {
    const projectId = validateProjectId(request?.projectId);
    const actor = validateActor(request?.actor);
    const action = validateGovernanceAction(request?.action);
    const grant = this.grants.get(`${projectId}\u0000${actor}`);
    const allowed = Boolean(grant?.actions.includes(action));
    return {
      allowed,
      projectId,
      actor,
      action,
      roles: grant ? [...grant.roles] : [],
      reason: allowed ? 'grant matched' : 'no matching project grant',
    };
  }
}
