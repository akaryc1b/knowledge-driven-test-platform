import { validateActor, validateProjectId } from '@kdtp/knowledge-governance';
import {
  ProjectAccessError,
  ProjectMembershipPort,
  createMembershipRecord,
  replaceMembershipRecord,
  validateMembershipStatus,
} from '@kdtp/project-membership';
import { withPostgresTransaction } from '@kdtp/knowledge-registry-postgres';
import { mapMembershipRecord } from './mappers.js';
import { PROJECT_ACCESS_POSTGRES_SCHEMA } from './migrations.js';
import { mapProjectAccessPostgresError } from './postgres-errors.js';

const MEMBERSHIP_COLUMNS = 'project_id, subject, roles, status, valid_from, valid_until, revision, created_at, updated_at';

export class PostgresProjectMembershipStore extends ProjectMembershipPort {
  constructor({ pool }) {
    super();
    if (!pool || typeof pool.connect !== 'function') throw new ProjectAccessError('INVALID_PROJECT_ACCESS_POOL', 'PostgreSQL membership store requires a pool');
    this.pool = pool;
  }

  async createMembership(command) {
    const record = createMembershipRecord(command);
    try {
      return await withPostgresTransaction(this.pool, async (client) => {
        await client.query(
          `INSERT INTO ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships
            (project_id, subject, roles, status, valid_from, valid_until, revision, created_at, updated_at)
           VALUES ($1,$2,$3::text[],$4,$5,$6,$7,$8,$9)`,
          [record.projectId, record.subject, record.roles, record.status, record.validFrom, record.validUntil, record.revision, record.createdAt, record.updatedAt],
        );
        await insertMembershipHistory(client, record.projectId, record.subject, record.history[0]);
        return structuredClone(record);
      });
    } catch (error) { throw mapProjectAccessPostgresError(error, 'createMembership'); }
  }

  async getMembership(query) {
    const projectId = validateProjectId(query?.projectId);
    const subject = validateActor(query?.subject);
    try {
      const records = await this.readMemberships({ projectId, subject });
      return records[0] ?? null;
    } catch (error) { throw mapProjectAccessPostgresError(error, 'getMembership'); }
  }

  async listMemberships(filter = {}) {
    if (filter.projectId !== undefined) validateProjectId(filter.projectId);
    if (filter.subject !== undefined) validateActor(filter.subject);
    if (filter.status !== undefined) validateMembershipStatus(filter.status);
    try { return await this.readMemberships(filter); }
    catch (error) { throw mapProjectAccessPostgresError(error, 'listMemberships'); }
  }

  async replaceMembership(command) {
    const projectId = validateProjectId(command?.projectId);
    const subject = validateActor(command?.subject);
    try {
      return await withPostgresTransaction(this.pool, async (client) => {
        const current = await requireMembershipForUpdate(client, projectId, subject);
        const next = replaceMembershipRecord(current, command);
        const result = await client.query(
          `UPDATE ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships
              SET roles = $1::text[], status = $2, valid_from = $3, valid_until = $4,
                  revision = $5, updated_at = $6
            WHERE project_id = $7 AND subject = $8 AND revision = $9`,
          [next.roles, next.status, next.validFrom, next.validUntil, next.revision, next.updatedAt, projectId, subject, current.revision],
        );
        if (result.rowCount !== 1) throw new ProjectAccessError('REVISION_CONFLICT', 'Membership revision conflict', { projectId, subject });
        await insertMembershipHistory(client, projectId, subject, next.history.at(-1));
        return structuredClone(next);
      });
    } catch (error) { throw mapProjectAccessPostgresError(error, 'replaceMembership'); }
  }

  async readMemberships(filter) {
    return withPostgresTransaction(this.pool, async (client) => {
      const conditions = []; const values = [];
      for (const [field, column] of [['projectId','project_id'], ['subject','subject'], ['status','status']]) {
        if (filter[field] !== undefined) { values.push(filter[field]); conditions.push(`${column} = $${values.length}`); }
      }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await client.query(
        `SELECT ${MEMBERSHIP_COLUMNS} FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships
         ${where} ORDER BY project_id, subject`,
        values,
      );
      return hydrateMemberships(client, result.rows);
    }, { readOnly: true, isolationLevel: 'REPEATABLE READ' });
  }
}

async function requireMembershipForUpdate(client, projectId, subject) {
  const result = await client.query(
    `SELECT ${MEMBERSHIP_COLUMNS} FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_memberships
      WHERE project_id = $1 AND subject = $2 FOR UPDATE`,
    [projectId, subject],
  );
  if (result.rowCount === 0) throw new ProjectAccessError('MEMBERSHIP_NOT_FOUND', 'Project membership was not found', { projectId, subject });
  return (await hydrateMemberships(client, result.rows))[0];
}

async function hydrateMemberships(client, rows) {
  if (rows.length === 0) return [];
  const projectIds = rows.map((row) => row.project_id);
  const subjects = rows.map((row) => row.subject);
  const history = await client.query(
    `SELECT project_id, subject, sequence, event_type, from_status, to_status, actor, occurred_at, reason
       FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.membership_history
      WHERE (project_id, subject) IN (SELECT * FROM unnest($1::text[], $2::text[]))
      ORDER BY project_id, subject, sequence`,
    [projectIds, subjects],
  );
  const byKey = new Map(rows.map((row) => [`${row.project_id}\u0000${row.subject}`, []]));
  for (const event of history.rows) byKey.get(`${event.project_id}\u0000${event.subject}`)?.push(event);
  return rows.map((row) => mapMembershipRecord(row, byKey.get(`${row.project_id}\u0000${row.subject}`) ?? []));
}

async function insertMembershipHistory(client, projectId, subject, event) {
  await client.query(
    `INSERT INTO ${PROJECT_ACCESS_POSTGRES_SCHEMA}.membership_history
      (project_id, subject, sequence, event_type, from_status, to_status, actor, occurred_at, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [projectId, subject, event.sequence, event.type, event.fromStatus, event.toStatus, event.actor, event.at, event.reason],
  );
}
