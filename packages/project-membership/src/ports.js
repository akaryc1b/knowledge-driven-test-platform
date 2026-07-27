import { ProjectAccessError, accessInvariant } from './errors.js';

export const PROJECT_DIRECTORY_PORT_METHODS = Object.freeze([
  'createProject', 'getProject', 'listProjects', 'updateProject',
]);
export const PROJECT_MEMBERSHIP_PORT_METHODS = Object.freeze([
  'createMembership', 'getMembership', 'listMemberships', 'replaceMembership',
]);

export class ProjectDirectoryPort {
  async createProject() { throw unsupported('ProjectDirectoryPort', 'createProject'); }
  async getProject() { throw unsupported('ProjectDirectoryPort', 'getProject'); }
  async listProjects() { throw unsupported('ProjectDirectoryPort', 'listProjects'); }
  async updateProject() { throw unsupported('ProjectDirectoryPort', 'updateProject'); }
}

export class ProjectMembershipPort {
  async createMembership() { throw unsupported('ProjectMembershipPort', 'createMembership'); }
  async getMembership() { throw unsupported('ProjectMembershipPort', 'getMembership'); }
  async listMemberships() { throw unsupported('ProjectMembershipPort', 'listMemberships'); }
  async replaceMembership() { throw unsupported('ProjectMembershipPort', 'replaceMembership'); }
}

export function assertProjectDirectoryPort(port) {
  return assertPort(port, PROJECT_DIRECTORY_PORT_METHODS, 'project directory');
}
export function assertProjectMembershipPort(port) {
  return assertPort(port, PROJECT_MEMBERSHIP_PORT_METHODS, 'project membership');
}

function assertPort(port, methods, name) {
  accessInvariant(port && typeof port === 'object', 'INVALID_PROJECT_ACCESS_PORT', `${name} port must be an object`);
  for (const method of methods) {
    accessInvariant(typeof port[method] === 'function', 'INVALID_PROJECT_ACCESS_PORT', `${name} port is missing method ${method}`, { method });
  }
  return port;
}

function unsupported(port, method) {
  return new ProjectAccessError('PROJECT_ACCESS_OPERATION_NOT_IMPLEMENTED', `${port} operation ${method} is not implemented`, { port, method });
}
