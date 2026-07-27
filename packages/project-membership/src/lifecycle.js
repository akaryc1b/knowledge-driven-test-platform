import { validateActor, validateProjectId } from '@kdtp/knowledge-governance';
import {
  MEMBERSHIP_STATUS_TRANSITIONS,
  PROJECT_DIRECTORY_SCHEMA_VERSION,
  PROJECT_MEMBERSHIP_SCHEMA_VERSION,
  PROJECT_STATUS_TRANSITIONS,
} from './constants.js';
import { accessInvariant } from './errors.js';
import {
  validateAuditCommand,
  validateExpectedRevision,
  validateMembershipRecord,
  validateMembershipStatus,
  validateOptionalUtcTimestamp,
  validateProjectName,
  validateProjectRecord,
  validateProjectStatus,
  validateRoles,
  validateUtcTimestamp,
} from './validation.js';

export function createProjectRecord(command) {
  const projectId = validateProjectId(command?.projectId);
  const name = validateProjectName(command?.name);
  const audit = validateAuditCommand(command);
  return {
    schemaVersion: PROJECT_DIRECTORY_SCHEMA_VERSION,
    projectId,
    name,
    status: 'ACTIVE',
    revision: 1,
    createdAt: audit.at,
    updatedAt: audit.at,
    history: [{ sequence: 1, type: 'CREATED', fromStatus: null, toStatus: 'ACTIVE', ...audit }],
  };
}

export function updateProjectRecord(inputRecord, command) {
  const record = validateProjectRecord(inputRecord);
  assertRevision(record, command?.expectedRevision);
  const toStatus = validateProjectStatus(command?.status);
  accessInvariant(PROJECT_STATUS_TRANSITIONS[record.status].includes(toStatus),
    'INVALID_PROJECT_STATUS_TRANSITION', `Project cannot transition from ${record.status} to ${toStatus}`, {
      projectId: record.projectId,
      fromStatus: record.status,
      toStatus,
    });
  const audit = validateAuditCommand(command);
  assertAuditTime(record, audit.at);
  const name = command?.name === undefined ? record.name : validateProjectName(command.name);
  const revision = record.revision + 1;
  return {
    ...structuredClone(record),
    name,
    status: toStatus,
    revision,
    updatedAt: audit.at,
    history: [...record.history, {
      sequence: revision,
      type: 'UPDATED',
      fromStatus: record.status,
      toStatus,
      ...audit,
    }],
  };
}

export function createMembershipRecord(command) {
  const projectId = validateProjectId(command?.projectId);
  const subject = validateActor(command?.subject);
  const roles = validateRoles(command?.roles);
  const validFrom = validateUtcTimestamp(command?.validFrom ?? command?.at, 'validFrom');
  const validUntil = validateOptionalUtcTimestamp(command?.validUntil, 'validUntil');
  accessInvariant(validUntil === null || Date.parse(validUntil) > Date.parse(validFrom),
    'INVALID_MEMBERSHIP_VALIDITY', 'validUntil must be later than validFrom');
  const audit = validateAuditCommand(command);
  return {
    schemaVersion: PROJECT_MEMBERSHIP_SCHEMA_VERSION,
    projectId,
    subject,
    roles,
    status: 'ACTIVE',
    validFrom,
    validUntil,
    revision: 1,
    createdAt: audit.at,
    updatedAt: audit.at,
    history: [{ sequence: 1, type: 'CREATED', fromStatus: null, toStatus: 'ACTIVE', ...audit }],
  };
}

export function replaceMembershipRecord(inputRecord, command) {
  const record = validateMembershipRecord(inputRecord);
  assertRevision(record, command?.expectedRevision);
  const status = command?.status === undefined ? record.status : validateMembershipStatus(command.status);
  if (status !== record.status) {
    accessInvariant(MEMBERSHIP_STATUS_TRANSITIONS[record.status].includes(status),
      'INVALID_MEMBERSHIP_STATUS_TRANSITION', `Membership cannot transition from ${record.status} to ${status}`, {
        projectId: record.projectId,
        subject: record.subject,
        fromStatus: record.status,
        toStatus: status,
      });
  } else {
    accessInvariant(record.status !== 'REVOKED',
      'MEMBERSHIP_NOT_EDITABLE', 'Revoked membership cannot be modified', {
        projectId: record.projectId,
        subject: record.subject,
      });
  }
  const roles = command?.roles === undefined ? record.roles : validateRoles(command.roles);
  const validFrom = command?.validFrom === undefined ? record.validFrom : validateUtcTimestamp(command.validFrom, 'validFrom');
  const validUntil = command?.validUntil === undefined ? record.validUntil : validateOptionalUtcTimestamp(command.validUntil, 'validUntil');
  accessInvariant(validUntil === null || Date.parse(validUntil) > Date.parse(validFrom),
    'INVALID_MEMBERSHIP_VALIDITY', 'validUntil must be later than validFrom');
  const audit = validateAuditCommand(command);
  assertAuditTime(record, audit.at);
  const revision = record.revision + 1;
  return {
    ...structuredClone(record),
    roles,
    status,
    validFrom,
    validUntil,
    revision,
    updatedAt: audit.at,
    history: [...record.history, {
      sequence: revision,
      type: 'UPDATED',
      fromStatus: record.status,
      toStatus: status,
      ...audit,
    }],
  };
}

function assertRevision(record, expected) {
  validateExpectedRevision(expected);
  accessInvariant(record.revision === expected, 'REVISION_CONFLICT', 'Access record revision does not match expectedRevision', {
    actualRevision: record.revision,
    expectedRevision: expected,
  });
}

function assertAuditTime(record, at) {
  accessInvariant(Date.parse(at) >= Date.parse(record.updatedAt),
    'AUDIT_TIMESTAMP_REGRESSION', 'Audit timestamp cannot move backwards', {
      updatedAt: record.updatedAt,
      at,
    });
}
