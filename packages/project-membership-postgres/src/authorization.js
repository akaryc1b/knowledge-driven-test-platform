import {
  ProjectAuthorizationPort,
  validateActor,
  validateGovernanceAction,
  validateProjectId,
} from '@kdtp/knowledge-governance';
import {
  DEFAULT_ROLE_ACTIONS,
  ProjectAccessError,
  evaluateProjectAuthorization,
  validateRoleActions,
  validateUtcTimestamp,
} from '@kdtp/project-membership';
import { withPostgresTransaction } from '@kdtp/knowledge-registry-postgres';
import { PROJECT_ACCESS_POSTGRES_SCHEMA } from './migrations.js';
import { mapProjectAccessPostgresError } from './postgres-errors.js';

export class PostgresProjectMembershipAuthorization extends ProjectAuthorizationPort {
  constructor({ pool, clock, roleActions = DEFAULT_ROLE_ACTIONS }) {
    super();
    if (!pool || typeof pool.connect !== 'function') throw new ProjectAccessError('INVALID_PROJECT_ACCESS_POOL', 'PostgreSQL authorization requires a pool');
    if (!clock || typeof clock.now !== 'function') throw new ProjectAccessError('INVALID_ACCESS_CLOCK', 'Authorization clock must expose now()');
    this.pool = pool;
    this.clock = clock;
    this.roleActions = validateRoleActions(roleActions);
  }

  async authorize(request) {
    const projectId = validateProjectId(request?.projectId);
    const actor = validateActor(request?.actor);
    const action = validateGovernanceAction(request?.action);
    const now = validateUtcTimestamp(await this.clock.now(), 'clock.now');
    try {
      return await withPostgresTransaction(this.pool, async (client) => {
        const result = await client.query(
          `SELECT p.project_id, p.status AS project_status,
                  m.subject, m.roles, m.status AS membership_status, m.valid_from, m.valid_until
             FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects p
             LEFT JOIN ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships m
               ON m.project_id = p.project_id AND m.subject = $2
            WHERE p.project_id = $1`,
          [projectId, actor],
        );
        const row = result.rows[0];
        const project = row ? { projectId: row.project_id, status: row.project_status } : null;
        const membership = row?.subject ? {
          projectId,
          subject: row.subject,
          roles: [...row.roles].sort(),
          status: row.membership_status,
          validFrom: toIso(row.valid_from),
          validUntil: row.valid_until === null ? null : toIso(row.valid_until),
        } : null;
        return evaluateProjectAuthorization({ projectId, actor, action, now, project, membership, roleActions: this.roleActions });
      }, { readOnly: true, isolationLevel: 'REPEATABLE READ' });
    } catch (error) { throw mapProjectAccessPostgresError(error, 'authorize'); }
  }
}

function toIso(value) { return value instanceof Date ? value.toISOString() : new Date(value).toISOString(); }
