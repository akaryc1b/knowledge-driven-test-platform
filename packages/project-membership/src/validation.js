import { validateActor, validateGovernanceAction, validateProjectId } from '@kdtp/knowledge-governance';
import {
  DEFAULT_ROLE_ACTIONS,
  MEMBERSHIP_STATUSES,
  PROJECT_DIRECTORY_SCHEMA_VERSION,
  PROJECT_MEMBERSHIP_SCHEMA_VERSION,
  PROJECT_ROLES,
  PROJECT_STATUSES,
} from './constants.js';
import { accessInvariant } from './errors.js';

const NON_EMPTY = (value) => typeof value === 'string' && value.trim().length > 0;

export function validateUtcTimestamp(input, field = 'timestamp') {
  accessInvariant(typeof input === 'string', 'INVALID_ACCESS_TIMESTAMP', `${field} must be a UTC ISO string`, { field });
  const time = Date.parse(input);
  accessInvariant(Number.isFinite(time) && new Date(time).toISOString() === input,
    'INVALID_ACCESS_TIMESTAMP', `${field} must use canonical UTC ISO format`, { field, value: input });
  return input;
}

export function validateOptionalUtcTimestamp(input, field) {
  return input === null || input === undefined ? null : validateUtcTimestamp(input, field);
}

export function validateAuditCommand(command) {
  accessInvariant(command && typeof command === 'object' && !Array.isArray(command),
    'INVALID_ACCESS_COMMAND', 'Access write command must be an object');
  const actor = validateActor(command.actor);
  const at = validateUtcTimestamp(command.at, 'at');
  accessInvariant(NON_EMPTY(command.reason) && command.reason.length <= 512,
    'INVALID_ACCESS_REASON', 'reason must be a non-empty string of at most 512 characters');
  return { actor, at, reason: command.reason };
}

export function validateExpectedRevision(input) {
  accessInvariant(Number.isSafeInteger(input) && input > 0,
    'INVALID_EXPECTED_REVISION', 'expectedRevision must be a positive integer', { expectedRevision: input });
  return input;
}

export function validateProjectName(input) {
  accessInvariant(NON_EMPTY(input) && input.length <= 200,
    'INVALID_PROJECT_NAME', 'Project name must be a non-empty string of at most 200 characters');
  return input;
}

export function validateProjectStatus(input) {
  accessInvariant(PROJECT_STATUSES.includes(input), 'INVALID_PROJECT_STATUS', 'Project status is invalid', { status: input });
  return input;
}

export function validateMembershipStatus(input) {
  accessInvariant(MEMBERSHIP_STATUSES.includes(input), 'INVALID_MEMBERSHIP_STATUS', 'Membership status is invalid', { status: input });
  return input;
}

export function validateRoles(input) {
  accessInvariant(Array.isArray(input) && input.length > 0,
    'INVALID_PROJECT_ROLES', 'Membership roles must be a non-empty array');
  const roles = input.map((role) => {
    accessInvariant(PROJECT_ROLES.includes(role), 'INVALID_PROJECT_ROLE', 'Project role is invalid', { role });
    return role;
  });
  accessInvariant(new Set(roles).size === roles.length,
    'DUPLICATE_PROJECT_ROLE', 'Membership roles must be unique');
  return [...roles].sort();
}

export function validateRoleActions(input = DEFAULT_ROLE_ACTIONS) {
  accessInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_ROLE_ACTION_POLICY', 'Role action policy must be an object');
  const normalized = {};
  for (const role of PROJECT_ROLES) {
    const actions = input[role];
    accessInvariant(Array.isArray(actions), 'INVALID_ROLE_ACTION_POLICY', `Role ${role} must define an action array`, { role });
    normalized[role] = [...new Set(actions.map(validateGovernanceAction))].sort();
  }
  return Object.freeze(normalized);
}

export function validateProjectRecord(input) {
  accessInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PROJECT_RECORD', 'Project record must be an object');
  accessInvariant(input.schemaVersion === PROJECT_DIRECTORY_SCHEMA_VERSION,
    'INVALID_PROJECT_SCHEMA', 'Project record schema version is unsupported');
  validateProjectId(input.projectId);
  validateProjectName(input.name);
  validateProjectStatus(input.status);
  validateExpectedRevision(input.revision);
  validateUtcTimestamp(input.createdAt, 'createdAt');
  validateUtcTimestamp(input.updatedAt, 'updatedAt');
  validateHistory(input.history, input.revision, input.status, 'PROJECT');
  return structuredClone(input);
}

export function validateMembershipRecord(input) {
  accessInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_MEMBERSHIP_RECORD', 'Membership record must be an object');
  accessInvariant(input.schemaVersion === PROJECT_MEMBERSHIP_SCHEMA_VERSION,
    'INVALID_MEMBERSHIP_SCHEMA', 'Membership record schema version is unsupported');
  validateProjectId(input.projectId);
  validateActor(input.subject);
  validateRoles(input.roles);
  validateMembershipStatus(input.status);
  const validFrom = validateUtcTimestamp(input.validFrom, 'validFrom');
  const validUntil = validateOptionalUtcTimestamp(input.validUntil, 'validUntil');
  accessInvariant(validUntil === null || Date.parse(validUntil) > Date.parse(validFrom),
    'INVALID_MEMBERSHIP_VALIDITY', 'validUntil must be later than validFrom');
  validateExpectedRevision(input.revision);
  validateUtcTimestamp(input.createdAt, 'createdAt');
  validateUtcTimestamp(input.updatedAt, 'updatedAt');
  validateHistory(input.history, input.revision, input.status, 'MEMBERSHIP');
  return structuredClone(input);
}

function validateHistory(history, revision, currentStatus, kind) {
  accessInvariant(Array.isArray(history) && history.length === revision,
    'INVALID_ACCESS_HISTORY', `${kind} history length must match revision`);
  let status = null;
  for (const [index, event] of history.entries()) {
    accessInvariant(event && typeof event === 'object' && !Array.isArray(event),
      'INVALID_ACCESS_HISTORY', `${kind} history event must be an object`, { index });
    accessInvariant(event.sequence === index + 1, 'INVALID_ACCESS_HISTORY', `${kind} history sequence must be contiguous`, { index });
    validateActor(event.actor);
    validateUtcTimestamp(event.at, 'history.at');
    accessInvariant(NON_EMPTY(event.reason), 'INVALID_ACCESS_HISTORY', `${kind} history reason is required`, { index });
    if (index === 0) {
      accessInvariant(event.type === 'CREATED' && event.fromStatus === null && event.toStatus === 'ACTIVE',
        'INVALID_ACCESS_HISTORY', `${kind} history must start with CREATED to ACTIVE`);
      status = 'ACTIVE';
    } else {
      accessInvariant(event.type === 'UPDATED' && event.fromStatus === status,
        'INVALID_ACCESS_HISTORY', `${kind} history status chain is invalid`, { index });
      status = event.toStatus;
    }
  }
  accessInvariant(status === currentStatus, 'INVALID_ACCESS_HISTORY', `${kind} current status must match history`);
}
