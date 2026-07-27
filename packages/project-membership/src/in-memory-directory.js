import { validateProjectId } from '@kdtp/knowledge-governance';
import { ProjectDirectoryPort } from './ports.js';
import { accessInvariant } from './errors.js';
import { createProjectRecord, updateProjectRecord } from './lifecycle.js';
import { validateProjectStatus } from './validation.js';

export class InMemoryProjectDirectory extends ProjectDirectoryPort {
  constructor() {
    super();
    this.projects = new Map();
  }

  async createProject(command) {
    const record = createProjectRecord(command);
    accessInvariant(!this.projects.has(record.projectId), 'PROJECT_EXISTS', `Project ${record.projectId} already exists`, { projectId: record.projectId });
    this.projects.set(record.projectId, structuredClone(record));
    return structuredClone(record);
  }

  async getProject(query) {
    const projectId = validateProjectId(query?.projectId);
    const record = this.projects.get(projectId);
    return record ? structuredClone(record) : null;
  }

  async listProjects(filter = {}) {
    if (filter.status !== undefined) validateProjectStatus(filter.status);
    const output = [...this.projects.values()].filter((record) => (
      filter.status === undefined || record.status === filter.status
    ));
    output.sort((left, right) => left.projectId.localeCompare(right.projectId));
    return structuredClone(output);
  }

  async updateProject(command) {
    const projectId = validateProjectId(command?.projectId);
    const current = this.projects.get(projectId);
    accessInvariant(current, 'PROJECT_NOT_FOUND', `Project ${projectId} was not found`, { projectId });
    const next = updateProjectRecord(current, command);
    this.projects.set(projectId, structuredClone(next));
    return structuredClone(next);
  }
}
