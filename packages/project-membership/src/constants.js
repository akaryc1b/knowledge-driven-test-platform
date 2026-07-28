import { GOVERNANCE_ACTIONS } from '@kdtp/knowledge-governance';

export const PROJECT_DIRECTORY_SCHEMA_VERSION = 'project-directory-record/v1';
export const PROJECT_MEMBERSHIP_SCHEMA_VERSION = 'project-membership-record/v1';

export const PROJECT_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'ARCHIVED']);
export const MEMBERSHIP_STATUSES = Object.freeze(['ACTIVE', 'SUSPENDED', 'REVOKED']);
export const PROJECT_ROLES = Object.freeze([
  'VIEWER',
  'AUTHOR',
  'REVIEWER',
  'PUBLISHER',
  'AUDITOR',
  'AUTOMATION',
  'PROJECT_ADMIN',
]);

export const PROJECT_STATUS_TRANSITIONS = Object.freeze({
  ACTIVE: Object.freeze(['SUSPENDED', 'ARCHIVED']),
  SUSPENDED: Object.freeze(['ACTIVE', 'ARCHIVED']),
  ARCHIVED: Object.freeze([]),
});

export const MEMBERSHIP_STATUS_TRANSITIONS = Object.freeze({
  ACTIVE: Object.freeze(['SUSPENDED', 'REVOKED']),
  SUSPENDED: Object.freeze(['ACTIVE', 'REVOKED']),
  REVOKED: Object.freeze([]),
});

const VIEW_ACTIONS = ['KNOWLEDGE_READ', 'SNAPSHOT_READ', 'PLAN_READ'];
export const DEFAULT_ROLE_ACTIONS = Object.freeze({
  VIEWER: Object.freeze([...VIEW_ACTIONS]),
  AUTHOR: Object.freeze([...VIEW_ACTIONS, 'KNOWLEDGE_CREATE', 'KNOWLEDGE_EDIT', 'KNOWLEDGE_SUBMIT',
    'PLAN_CREATE', 'PLAN_GENERATE', 'PLAN_EDIT', 'PLAN_SUBMIT']),
  REVIEWER: Object.freeze([...VIEW_ACTIONS, 'KNOWLEDGE_REVIEW', 'AUDIT_READ',
    'PLAN_REVIEW', 'PLAN_APPROVE', 'PLAN_AUDIT_READ']),
  PUBLISHER: Object.freeze([
    ...VIEW_ACTIONS,
    'KNOWLEDGE_PUBLISH',
    'KNOWLEDGE_DEPRECATE',
    'KNOWLEDGE_ARCHIVE',
    'AUDIT_READ',
    'PLAN_FREEZE',
    'PLAN_AUDIT_READ',
  ]),
  AUDITOR: Object.freeze(['KNOWLEDGE_READ', 'AUDIT_READ', 'SNAPSHOT_READ', 'PLAN_READ', 'PLAN_AUDIT_READ']),
  AUTOMATION: Object.freeze(['KNOWLEDGE_READ', 'SNAPSHOT_PERSIST', 'SNAPSHOT_READ', 'PLAN_GENERATE', 'PLAN_READ']),
  PROJECT_ADMIN: Object.freeze([...GOVERNANCE_ACTIONS]),
});
