import { validateProjectId } from '@kdtp/knowledge-governance';
import {
  ProjectAccessError,
  ProjectDirectoryPort,
  createProjectRecord,
  updateProjectRecord,
  validateProjectStatus,
} from '@kdtp/project-membership';
import { withPostgresTransaction } from '@kdtp/knowledge-registry-postgres';
import { mapProjectRecord } from './mappers.js';
import { PROJECT_ACCESS_POSTGRES_SCHEMA } from './migrations.js';
import { mapProjectAccessPostgresError } from './postgres-errors.js';

const PROJECT_COLUMNS = 'project_id, name, status, revision, created_at, updated_at';

export class PostgresProjectDirectory extends ProjectDirectoryPort {
  constructor({ pool }) {
    super();
    if (!pool || typeof pool.connect !== 'function') throw new ProjectAccessError('INVALID_PROJECT_ACCESS_POOL', 'PostgreSQL project directory requires a pool');
    this.pool = pool;
  }

  async createProject(command) {
    const record = createProjectRecord(command);
    try {
      return await withPostgresTransaction(this.pool, async (client) => {
        await client.query(
          `INSERT INTO ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects(project_id, name, status, revision, created_at, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [record.projectId, record.name, record.status, record.revision, record.createdAt, record.updatedAt],
        );
        await insertProjectHistory(client, record.projectId, record.history[0]);
        return structuredClone(record);
      });
    } catch (error) { throw mapProjectAccessPostgresError(error, 'createProject'); }
  }

  async getProject(query) {
    const projectId = validateProjectId(query?.projectId);
    try {
      const records = await this.readProjects({ projectId });
      return records[0] ?? null;
    } catch (error) { throw mapProjectAccessPostgresError(error, 'getProject'); }
  }

  async listProjects(filter = {}) {
    if (filter.status !== undefined) validateProjectStatus(filter.status);
    try { return await this.readProjects({ status: filter.status }); }
    catch (error) { throw mapProjectAccessPostgresError(error, 'listProjects'); }
  }

  async updateProject(command) {
    const projectId = validateProjectId(command?.projectId);
    try {
      return await withPostgresTransaction(this.pool, async (client) => {
        const current = await requireProjectForUpdate(client, projectId);
        const next = updateProjectRecord(current, command);
        const result = await client.query(
          `UPDATE ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects
              SET name = $1, status = $2, revision = $3, updated_at = $4
            WHERE project_id = $5 AND revision = $6`,
          [next.name, next.status, next.revision, next.updatedAt, projectId, current.revision],
        );
        if (result.rowCount !== 1) throw new ProjectAccessError('REVISION_CONFLICT', 'Project revision conflict', { projectId });
        await insertProjectHistory(client, projectId, next.history.at(-1));
        return structuredClone(next);
      });
    } catch (error) { throw mapProjectAccessPostgresError(error, 'updateProject'); }
  }

  async readProjects(filter) {
    return withPostgresTransaction(this.pool, async (client) => {
      const conditions = []; const values = [];
      if (filter.projectId !== undefined) { values.push(filter.projectId); conditions.push(`project_id = $${values.length}`); }
      if (filter.status !== undefined) { values.push(filter.status); conditions.push(`status = $${values.length}`); }
      const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
      const result = await client.query(
        `SELECT ${PROJECT_COLUMNS} FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects ${where} ORDER BY project_id`,
        values,
      );
      return hydrateProjects(client, result.rows);
    }, { readOnly: true, isolationLevel: 'REPEATABLE READ' });
  }
}

async function requireProjectForUpdate(client, projectId) {
  const result = await client.query(
    `SELECT ${PROJECT_COLUMNS} FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.projects WHERE project_id = $1 FOR UPDATE`,
    [projectId],
  );
  if (result.rowCount === 0) throw new ProjectAccessError('PROJECT_NOT_FOUND', `Project ${projectId} was not found`, { projectId });
  return (await hydrateProjects(client, result.rows))[0];
}

async function hydrateProjects(client, rows) {
  if (rows.length === 0) return [];
  const ids = rows.map((row) => row.project_id);
  const history = await client.query(
    `SELECT project_id, sequence, event_type, from_status, to_status, actor, occurred_at, reason
       FROM ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_history
      WHERE project_id = ANY($1::text[])
      ORDER BY project_id, sequence`,
    [ids],
  );
  const byId = new Map(ids.map((id) => [id, []]));
  for (const event of history.rows) byId.get(event.project_id)?.push(event);
  return rows.map((row) => mapProjectRecord(row, byId.get(row.project_id) ?? []));
}

async function insertProjectHistory(client, projectId, event) {
  await client.query(
    `INSERT INTO ${PROJECT_ACCESS_POSTGRES_SCHEMA}.project_history
      (project_id, sequence, event_type, from_status, to_status, actor, occurred_at, reason)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
    [projectId, event.sequence, event.type, event.fromStatus, event.toStatus, event.actor, event.at, event.reason],
  );
}
