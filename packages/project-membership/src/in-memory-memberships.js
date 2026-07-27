import { validateActor, validateProjectId } from '@kdtp/knowledge-governance';
import { ProjectMembershipPort, assertProjectDirectoryPort } from './ports.js';
import { accessInvariant } from './errors.js';
import { createMembershipRecord, replaceMembershipRecord } from './lifecycle.js';
import { validateMembershipStatus } from './validation.js';

export class InMemoryProjectMembershipStore extends ProjectMembershipPort {
  constructor({ directory }) {
    super();
    this.directory = assertProjectDirectoryPort(directory);
    this.memberships = new Map();
  }

  async createMembership(command) {
    const record = createMembershipRecord(command);
    const project = await this.directory.getProject({ projectId: record.projectId });
    accessInvariant(project, 'PROJECT_NOT_FOUND', `Project ${record.projectId} was not found`, { projectId: record.projectId });
    const key = membershipKey(record.projectId, record.subject);
    accessInvariant(!this.memberships.has(key), 'MEMBERSHIP_EXISTS', 'Project membership already exists', {
      projectId: record.projectId,
      subject: record.subject,
    });
    this.memberships.set(key, structuredClone(record));
    return structuredClone(record);
  }

  async getMembership(query) {
    const projectId = validateProjectId(query?.projectId);
    const subject = validateActor(query?.subject);
    const record = this.memberships.get(membershipKey(projectId, subject));
    return record ? structuredClone(record) : null;
  }

  async listMemberships(filter = {}) {
    if (filter.projectId !== undefined) validateProjectId(filter.projectId);
    if (filter.subject !== undefined) validateActor(filter.subject);
    if (filter.status !== undefined) validateMembershipStatus(filter.status);
    const output = [...this.memberships.values()].filter((record) => (
      (filter.projectId === undefined || record.projectId === filter.projectId) &&
      (filter.subject === undefined || record.subject === filter.subject) &&
      (filter.status === undefined || record.status === filter.status)
    ));
    output.sort((left, right) => left.projectId.localeCompare(right.projectId) || left.subject.localeCompare(right.subject));
    return structuredClone(output);
  }

  async replaceMembership(command) {
    const projectId = validateProjectId(command?.projectId);
    const subject = validateActor(command?.subject);
    const key = membershipKey(projectId, subject);
    const current = this.memberships.get(key);
    accessInvariant(current, 'MEMBERSHIP_NOT_FOUND', 'Project membership was not found', { projectId, subject });
    const next = replaceMembershipRecord(current, command);
    this.memberships.set(key, structuredClone(next));
    return structuredClone(next);
  }
}

export function membershipKey(projectId, subject) {
  return `${projectId}\u0000${subject}`;
}
