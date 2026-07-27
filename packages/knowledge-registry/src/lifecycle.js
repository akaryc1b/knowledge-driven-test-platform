import {
  KNOWLEDGE_STATUSES,
  LIFECYCLE_TRANSITIONS,
  REGISTRY_RECORD_SCHEMA_VERSION,
} from './constants.js';
import { registryInvariant } from './errors.js';
import { knowledgeKey } from './identity.js';
import { cloneJsonValue } from './json-value.js';
import {
  validateAuditString,
  validateExpectedRevision,
  validateKnowledgeObject,
  validateUtcTimestamp,
} from './validation.js';

/**
 * @param {{knowledge: unknown, actor: unknown, at: unknown, reason: unknown}} command
 */
export function createKnowledgeRecord(command) {
  const knowledge = validateKnowledgeObject(command?.knowledge);
  registryInvariant(knowledge.status === 'DRAFT',
    'INITIAL_STATUS_MUST_BE_DRAFT', 'New registry knowledge must start in DRAFT', {
      status: knowledge.status,
    });
  const audit = validateAuditCommand(command);
  const key = knowledgeKey(knowledge.id, knowledge.version);

  return {
    recordSchemaVersion: REGISTRY_RECORD_SCHEMA_VERSION,
    key,
    revision: 1,
    createdAt: audit.at,
    updatedAt: audit.at,
    knowledge,
    history: [{
      sequence: 1,
      type: 'CREATED',
      fromStatus: null,
      toStatus: 'DRAFT',
      ...audit,
    }],
  };
}

/**
 * @param {unknown} inputRecord
 * @param {{expectedRevision: unknown, knowledge: unknown, actor: unknown, at: unknown, reason: unknown}} command
 */
export function replaceDraftRecord(inputRecord, command) {
  const record = validateRegistryRecord(inputRecord);
  assertRevision(record, command?.expectedRevision);
  registryInvariant(record.knowledge.status === 'DRAFT',
    'KNOWLEDGE_NOT_EDITABLE', 'Only DRAFT knowledge can be replaced', {
      key: record.key,
      status: record.knowledge.status,
    });

  const incoming = validateKnowledgeObject(command?.knowledge);
  registryInvariant(incoming.status === 'DRAFT',
    'DRAFT_REPLACEMENT_STATUS_INVALID', 'Draft replacement must remain DRAFT');
  registryInvariant(incoming.id === record.knowledge.id && incoming.version === record.knowledge.version,
    'KNOWLEDGE_IDENTITY_CHANGED', 'Draft replacement cannot change id or version', {
      key: record.key,
      incomingId: incoming.id,
      incomingVersion: incoming.version,
    });

  const audit = validateAuditCommand(command);
  assertAuditTime(record, audit.at);
  const revision = record.revision + 1;
  return {
    ...cloneJsonValue(record),
    revision,
    updatedAt: audit.at,
    knowledge: incoming,
    history: [...record.history, {
      sequence: revision,
      type: 'DRAFT_REPLACED',
      fromStatus: 'DRAFT',
      toStatus: 'DRAFT',
      ...audit,
    }],
  };
}

/**
 * @param {unknown} inputRecord
 * @param {{expectedRevision: unknown, toStatus: unknown, actor: unknown, at: unknown, reason: unknown}} command
 */
export function transitionKnowledgeRecord(inputRecord, command) {
  const record = validateRegistryRecord(inputRecord);
  assertRevision(record, command?.expectedRevision);
  registryInvariant(KNOWLEDGE_STATUSES.includes(command?.toStatus),
    'INVALID_TARGET_STATUS', 'Target knowledge status is invalid', {
      toStatus: command?.toStatus,
    });

  const fromStatus = record.knowledge.status;
  const toStatus = command.toStatus;
  registryInvariant(LIFECYCLE_TRANSITIONS[fromStatus].includes(toStatus),
    'INVALID_STATUS_TRANSITION', `Knowledge cannot transition from ${fromStatus} to ${toStatus}`, {
      key: record.key,
      fromStatus,
      toStatus,
    });

  const audit = validateAuditCommand(command);
  assertAuditTime(record, audit.at);
  const revision = record.revision + 1;
  return {
    ...cloneJsonValue(record),
    revision,
    updatedAt: audit.at,
    knowledge: {
      ...cloneJsonValue(record.knowledge),
      status: toStatus,
    },
    history: [...record.history, {
      sequence: revision,
      type: 'STATUS_TRANSITIONED',
      fromStatus,
      toStatus,
      ...audit,
    }],
  };
}

/** @param {unknown} input */
export function validateRegistryRecord(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_REGISTRY_RECORD', 'Registry record must be an object');
  const record = /** @type {Record<string, unknown>} */ (input);
  registryInvariant(record.recordSchemaVersion === REGISTRY_RECORD_SCHEMA_VERSION,
    'INVALID_REGISTRY_RECORD_SCHEMA', 'Registry record schema version is unsupported');
  registryInvariant(Number.isSafeInteger(record.revision) && record.revision > 0,
    'INVALID_REGISTRY_REVISION', 'Registry revision must be a positive integer');
  const knowledge = validateKnowledgeObject(record.knowledge);
  registryInvariant(record.key === knowledgeKey(knowledge.id, knowledge.version),
    'REGISTRY_KEY_MISMATCH', 'Registry key does not match knowledge identity');
  validateUtcTimestamp(record.createdAt);
  validateUtcTimestamp(record.updatedAt);
  registryInvariant(Array.isArray(record.history) && record.history.length === record.revision,
    'INVALID_REGISTRY_HISTORY', 'Registry history length must match revision');

  let lifecycleStatus = null;
  for (const [index, event] of record.history.entries()) {
    registryInvariant(event && typeof event === 'object' && !Array.isArray(event),
      'INVALID_REGISTRY_HISTORY', 'Registry history event must be an object', { index });
    registryInvariant(event.sequence === index + 1,
      'INVALID_REGISTRY_HISTORY', 'Registry history sequence must be contiguous', { index });
    validateAuditString(event.actor, 'actor');
    validateAuditString(event.reason, 'reason');
    validateUtcTimestamp(event.at);

    if (index === 0) {
      registryInvariant(event.type === 'CREATED' && event.fromStatus === null && event.toStatus === 'DRAFT',
        'INVALID_REGISTRY_HISTORY', 'Registry history must start with CREATED to DRAFT');
      lifecycleStatus = 'DRAFT';
      continue;
    }

    registryInvariant(event.fromStatus === lifecycleStatus,
      'INVALID_REGISTRY_HISTORY', 'Registry history status chain is discontinuous', {
        index,
        expectedFromStatus: lifecycleStatus,
        actualFromStatus: event.fromStatus,
      });
    if (event.type === 'DRAFT_REPLACED') {
      registryInvariant(lifecycleStatus === 'DRAFT' && event.toStatus === 'DRAFT',
        'INVALID_REGISTRY_HISTORY', 'DRAFT_REPLACED must remain in DRAFT', { index });
    } else {
      registryInvariant(event.type === 'STATUS_TRANSITIONED',
        'INVALID_REGISTRY_HISTORY', 'Registry history event type is invalid', { index });
      registryInvariant(LIFECYCLE_TRANSITIONS[lifecycleStatus].includes(event.toStatus),
        'INVALID_REGISTRY_HISTORY', 'Registry history contains an invalid status transition', {
          index,
          fromStatus: lifecycleStatus,
          toStatus: event.toStatus,
        });
    }
    lifecycleStatus = event.toStatus;
  }

  registryInvariant(record.createdAt === record.history[0].at,
    'INVALID_REGISTRY_HISTORY', 'createdAt must match the first history event');
  registryInvariant(record.updatedAt === record.history.at(-1).at,
    'INVALID_REGISTRY_HISTORY', 'updatedAt must match the last history event');
  registryInvariant(lifecycleStatus === knowledge.status,
    'INVALID_REGISTRY_HISTORY', 'Knowledge status must match the final history status', {
      lifecycleStatus,
      knowledgeStatus: knowledge.status,
    });
  return cloneJsonValue({ ...record, knowledge });
}

/** @param {Record<string, unknown>} record @param {unknown} expected */
function assertRevision(record, expected) {
  validateExpectedRevision(expected);
  registryInvariant(record.revision === expected,
    'REVISION_CONFLICT', 'Registry record revision does not match expectedRevision', {
      key: record.key,
      actualRevision: record.revision,
      expectedRevision: expected,
    });
}

/** @param {Record<string, unknown>} command */
function validateAuditCommand(command) {
  registryInvariant(command && typeof command === 'object',
    'INVALID_AUDIT_COMMAND', 'Write command must be an object');
  return {
    actor: validateAuditString(command.actor, 'actor'),
    at: validateUtcTimestamp(command.at),
    reason: validateAuditString(command.reason, 'reason'),
  };
}

/** @param {Record<string, unknown>} record @param {string} at */
function assertAuditTime(record, at) {
  registryInvariant(Date.parse(at) >= Date.parse(record.updatedAt),
    'AUDIT_TIMESTAMP_REGRESSION', 'Audit timestamp cannot be earlier than the record updatedAt', {
      key: record.key,
      updatedAt: record.updatedAt,
      at,
    });
}
