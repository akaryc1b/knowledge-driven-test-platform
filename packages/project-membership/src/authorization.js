import {
  ProjectAuthorizationPort,
  validateActor,
  validateGovernanceAction,
  validateProjectId,
} from '@kdtp/knowledge-governance';
import { DEFAULT_ROLE_ACTIONS } from './constants.js';
import { accessInvariant } from './errors.js';
import { assertProjectDirectoryPort, assertProjectMembershipPort } from './ports.js';
import { validateRoleActions, validateUtcTimestamp } from './validation.js';

export class ProjectMembershipAuthorization extends ProjectAuthorizationPort {
  constructor({ directory, memberships, clock, roleActions = DEFAULT_ROLE_ACTIONS }) {
    super();
    this.directory = assertProjectDirectoryPort(directory);
    this.memberships = assertProjectMembershipPort(memberships);
    accessInvariant(clock && typeof clock.now === 'function', 'INVALID_ACCESS_CLOCK', 'Authorization clock must expose now()');
    this.clock = clock;
    this.roleActions = validateRoleActions(roleActions);
  }

  async authorize(request) {
    const projectId = validateProjectId(request?.projectId);
    const actor = validateActor(request?.actor);
    const action = validateGovernanceAction(request?.action);
    const now = validateUtcTimestamp(await this.clock.now(), 'clock.now');
    const project = await this.directory.getProject({ projectId });
    const membership = await this.memberships.getMembership({ projectId, subject: actor });
    return evaluateProjectAuthorization({ projectId, actor, action, now, project, membership, roleActions: this.roleActions });
  }
}

export function evaluateProjectAuthorization({ projectId, actor, action, now, project, membership, roleActions = DEFAULT_ROLE_ACTIONS }) {
  const base = { allowed: false, projectId, actor, action, roles: membership ? [...membership.roles] : [] };
  if (!project) return { ...base, reason: 'project not found' };
  if (project.status !== 'ACTIVE') return { ...base, reason: `project ${project.status.toLowerCase()}` };
  if (!membership) return { ...base, reason: 'membership not found' };
  if (membership.status !== 'ACTIVE') return { ...base, reason: `membership ${membership.status.toLowerCase()}` };
  if (Date.parse(now) < Date.parse(membership.validFrom)) return { ...base, reason: 'membership not active yet' };
  if (membership.validUntil !== null && Date.parse(now) >= Date.parse(membership.validUntil)) {
    return { ...base, reason: 'membership expired' };
  }
  const allowed = membership.roles.some((role) => roleActions[role]?.includes(action));
  return { ...base, allowed, reason: allowed ? 'active membership role matched' : 'membership roles do not grant action' };
}
