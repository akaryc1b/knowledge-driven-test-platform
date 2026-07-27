import { validateMembershipRecord, validateProjectRecord } from '@kdtp/project-membership';

export function mapProjectRecord(row, historyRows) {
  return validateProjectRecord({
    schemaVersion: 'project-directory-record/v1',
    projectId: row.project_id,
    name: row.name,
    status: row.status,
    revision: row.revision,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    history: historyRows.map(mapHistory),
  });
}

export function mapMembershipRecord(row, historyRows) {
  return validateMembershipRecord({
    schemaVersion: 'project-membership-record/v1',
    projectId: row.project_id,
    subject: row.subject,
    roles: [...row.roles].sort(),
    status: row.status,
    validFrom: toIso(row.valid_from),
    validUntil: row.valid_until === null ? null : toIso(row.valid_until),
    revision: row.revision,
    createdAt: toIso(row.created_at),
    updatedAt: toIso(row.updated_at),
    history: historyRows.map(mapHistory),
  });
}

function mapHistory(row) {
  return {
    sequence: row.sequence,
    type: row.event_type,
    fromStatus: row.from_status,
    toStatus: row.to_status,
    actor: row.actor,
    at: toIso(row.occurred_at),
    reason: row.reason,
  };
}

function toIso(value) {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
