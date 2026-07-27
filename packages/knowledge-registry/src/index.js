export {
  ENFORCEMENT_LEVELS,
  KNOWLEDGE_RULE_SCHEMA_VERSION,
  KNOWLEDGE_STATUSES,
  LIFECYCLE_TRANSITIONS,
  MERGE_STRATEGIES,
  OVERRIDE_POLICIES,
  REGISTRY_RECORD_SCHEMA_VERSION,
  RISK_LEVELS,
  SCOPE_LEVELS,
} from './constants.js';
export { RegistryError } from './errors.js';
export {
  compareKnowledgeVersions,
  knowledgeKey,
  parseKnowledgeVersion,
  validateKnowledgeId,
} from './identity.js';
export { InMemoryKnowledgeRegistry } from './in-memory-registry.js';
export {
  createKnowledgeRecord,
  replaceDraftRecord,
  transitionKnowledgeRecord,
  validateRegistryRecord,
} from './lifecycle.js';
export {
  assertKnowledgeRegistryPort,
  KNOWLEDGE_REGISTRY_PORT_METHODS,
  KnowledgeRegistryPort,
} from './registry-port.js';
export {
  validateAuditString,
  validateExpectedRevision,
  validateKnowledgeObject,
  validateUtcTimestamp,
} from './validation.js';
