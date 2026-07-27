import { RegistryError, registryInvariant } from './errors.js';
import { compareKnowledgeVersions, knowledgeKey, validateKnowledgeId } from './identity.js';
import { compareRegistryRecords, validateRegistryFilter } from './filters.js';
import {
  createKnowledgeRecord,
  replaceDraftRecord,
  transitionKnowledgeRecord,
} from './lifecycle.js';
import { KnowledgeRegistryPort } from './registry-port.js';

export class InMemoryKnowledgeRegistry extends KnowledgeRegistryPort {
  constructor() {
    super();
    /** @type {Map<string, Record<string, unknown>>} */
    this.records = new Map();
  }

  async createDraft(command) {
    const record = createKnowledgeRecord(command);
    registryInvariant(!this.records.has(record.key),
      'KNOWLEDGE_VERSION_EXISTS', `Knowledge version ${record.key} already exists`, {
        key: record.key,
      });

    const versions = this.findVersions(record.knowledge.id);
    if (versions.length > 0) {
      const highest = versions.at(-1).knowledge.version;
      registryInvariant(compareKnowledgeVersions(record.knowledge.version, highest) > 0,
        'NON_MONOTONIC_VERSION', 'New knowledge version must be greater than every existing version', {
          id: record.knowledge.id,
          incomingVersion: record.knowledge.version,
          highestVersion: highest,
        });
    }

    this.records.set(record.key, structuredClone(record));
    return structuredClone(record);
  }

  async get(query) {
    const key = knowledgeKey(query?.id, query?.version);
    const record = this.records.get(key);
    return record ? structuredClone(record) : null;
  }

  async list(filter = {}) {
    validateRegistryFilter(filter);
    const records = [...this.records.values()].filter((record) => {
      const knowledge = record.knowledge;
      return (
        (filter.id === undefined || knowledge.id === filter.id) &&
        (filter.status === undefined || knowledge.status === filter.status) &&
        (filter.scopeLevel === undefined || knowledge.scope.level === filter.scopeLevel) &&
        (filter.scopeKey === undefined || knowledge.scope.key === filter.scopeKey)
      );
    });
    records.sort(compareRegistryRecords);
    return structuredClone(records);
  }

  async listVersions(query) {
    const id = validateKnowledgeId(query?.id);
    return structuredClone(this.findVersions(id));
  }

  async getLatestPublished(query) {
    const versions = await this.listVersions({ id: query?.id });
    const published = versions.filter((record) => record.knowledge.status === 'PUBLISHED');
    return published.length > 0 ? structuredClone(published.at(-1)) : null;
  }

  async replaceDraft(command) {
    const key = knowledgeKey(command?.id, command?.version);
    const current = this.requireRecord(key);
    const next = replaceDraftRecord(current, command);
    this.records.set(key, structuredClone(next));
    return structuredClone(next);
  }

  async transition(command) {
    const key = knowledgeKey(command?.id, command?.version);
    const current = this.requireRecord(key);
    const next = transitionKnowledgeRecord(current, command);
    this.records.set(key, structuredClone(next));
    return structuredClone(next);
  }

  /** @param {string} id */
  findVersions(id) {
    return [...this.records.values()]
      .filter((record) => record.knowledge.id === id)
      .sort((left, right) => compareKnowledgeVersions(
        left.knowledge.version,
        right.knowledge.version,
      ));
  }

  /** @param {string} key */
  requireRecord(key) {
    const record = this.records.get(key);
    if (!record) {
      throw new RegistryError('KNOWLEDGE_NOT_FOUND', `Knowledge version ${key} was not found`, {
        key,
      });
    }
    return structuredClone(record);
  }
}
