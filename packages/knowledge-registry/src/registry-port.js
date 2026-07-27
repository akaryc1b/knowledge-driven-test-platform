import { RegistryError, registryInvariant } from './errors.js';

export const KNOWLEDGE_REGISTRY_PORT_METHODS = Object.freeze([
  'createDraft',
  'get',
  'list',
  'listVersions',
  'getLatestPublished',
  'replaceDraft',
  'transition',
]);

export class KnowledgeRegistryPort {
  async createDraft() { throw unsupported('createDraft'); }
  async get() { throw unsupported('get'); }
  async list() { throw unsupported('list'); }
  async listVersions() { throw unsupported('listVersions'); }
  async getLatestPublished() { throw unsupported('getLatestPublished'); }
  async replaceDraft() { throw unsupported('replaceDraft'); }
  async transition() { throw unsupported('transition'); }
}

/** @param {unknown} port */
export function assertKnowledgeRegistryPort(port) {
  registryInvariant(port && typeof port === 'object',
    'INVALID_REGISTRY_PORT', 'Registry port must be an object');
  for (const method of KNOWLEDGE_REGISTRY_PORT_METHODS) {
    registryInvariant(typeof port[method] === 'function',
      'INVALID_REGISTRY_PORT', `Registry port is missing method ${method}`, { method });
  }
  return port;
}

function unsupported(method) {
  return new RegistryError('REGISTRY_OPERATION_NOT_IMPLEMENTED',
    `Registry operation ${method} is not implemented`, { method });
}
