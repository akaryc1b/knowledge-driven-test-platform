import { GovernanceError, governanceInvariant } from './errors.js';

export const PROJECT_AUTHORIZATION_PORT_METHODS = Object.freeze(['authorize']);
export const REVIEW_DECISION_STORE_PORT_METHODS = Object.freeze(['append', 'list']);
export const SNAPSHOT_STORE_PORT_METHODS = Object.freeze(['save', 'get', 'list']);

export class ProjectAuthorizationPort {
  async authorize() { throw unsupported('ProjectAuthorizationPort', 'authorize'); }
}

export class ReviewDecisionStorePort {
  async append() { throw unsupported('ReviewDecisionStorePort', 'append'); }
  async list() { throw unsupported('ReviewDecisionStorePort', 'list'); }
}

export class KnowledgeSnapshotStorePort {
  async save() { throw unsupported('KnowledgeSnapshotStorePort', 'save'); }
  async get() { throw unsupported('KnowledgeSnapshotStorePort', 'get'); }
  async list() { throw unsupported('KnowledgeSnapshotStorePort', 'list'); }
}

export function assertProjectAuthorizationPort(port) {
  return assertPort(port, PROJECT_AUTHORIZATION_PORT_METHODS, 'authorization');
}
export function assertReviewDecisionStorePort(port) {
  return assertPort(port, REVIEW_DECISION_STORE_PORT_METHODS, 'review decision store');
}
export function assertKnowledgeSnapshotStorePort(port) {
  return assertPort(port, SNAPSHOT_STORE_PORT_METHODS, 'snapshot store');
}

function assertPort(port, methods, name) {
  governanceInvariant(port && typeof port === 'object',
    'INVALID_GOVERNANCE_PORT', `${name} port must be an object`, { name });
  for (const method of methods) {
    governanceInvariant(typeof port[method] === 'function',
      'INVALID_GOVERNANCE_PORT', `${name} port is missing method ${method}`, { name, method });
  }
  return port;
}

function unsupported(port, method) {
  return new GovernanceError('GOVERNANCE_OPERATION_NOT_IMPLEMENTED',
    `${port} operation ${method} is not implemented`, { port, method });
}
