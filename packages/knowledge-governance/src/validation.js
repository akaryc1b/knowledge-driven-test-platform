import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  knowledgeKey,
  validateAuditString,
  validateExpectedRevision,
  validateUtcTimestamp,
} from '@kdtp/knowledge-registry';
import {
  GOVERNANCE_ACTIONS,
  REVIEW_DECISIONS,
  REVIEW_DECISION_SCHEMA_VERSION,
  SNAPSHOT_ENVELOPE_SCHEMA_VERSION,
} from './constants.js';
import { governanceInvariant } from './errors.js';

const PROJECT_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,127}$/;
const DECISION_ID_PATTERN = /^[a-z0-9][a-z0-9._:-]{7,255}$/;
const SNAPSHOT_ID_PATTERN = /^kb-[a-z0-9-]+-[a-f0-9]{12}$/;
const DIGEST_PATTERN = /^[a-f0-9]{64}$/;

export function validateProjectId(input) {
  governanceInvariant(typeof input === 'string' && PROJECT_ID_PATTERN.test(input),
    'INVALID_PROJECT_ID', 'projectId must be a lowercase project identifier', { projectId: input });
  return input;
}

export function validateActor(input) {
  return validateAuditString(input, 'actor');
}

export function validateReason(input) {
  return validateAuditString(input, 'reason');
}

export function validateGovernanceAction(input) {
  governanceInvariant(GOVERNANCE_ACTIONS.includes(input),
    'INVALID_GOVERNANCE_ACTION', 'Governance action is invalid', { action: input });
  return input;
}

export function validateReviewDecision(input) {
  governanceInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_REVIEW_DECISION', 'Review decision must be an object');
  const decision = input;
  governanceInvariant(decision.schemaVersion === REVIEW_DECISION_SCHEMA_VERSION,
    'INVALID_REVIEW_DECISION_SCHEMA', 'Review decision schema version is unsupported');
  governanceInvariant(typeof decision.decisionId === 'string' && DECISION_ID_PATTERN.test(decision.decisionId),
    'INVALID_REVIEW_DECISION_ID', 'Review decision ID is invalid');
  validateProjectId(decision.projectId);
  knowledgeKey(decision.knowledgeId, decision.version);
  governanceInvariant(decision.knowledgeKey === knowledgeKey(decision.knowledgeId, decision.version),
    'REVIEW_KNOWLEDGE_KEY_MISMATCH', 'Review decision knowledge key does not match identity');
  validateExpectedRevision(decision.reviewRevision);
  governanceInvariant(REVIEW_DECISIONS.includes(decision.decision),
    'INVALID_REVIEW_DECISION_VALUE', 'Review decision value is invalid');
  validateActor(decision.reviewer);
  validateUtcTimestamp(decision.at);
  validateReason(decision.reason);
  return structuredClone(decision);
}

export function validateSnapshot(snapshot) {
  governanceInvariant(snapshot && typeof snapshot === 'object' && !Array.isArray(snapshot),
    'INVALID_KNOWLEDGE_SNAPSHOT', 'Knowledge snapshot must be an object');
  governanceInvariant(typeof snapshot.snapshotId === 'string' && SNAPSHOT_ID_PATTERN.test(snapshot.snapshotId),
    'INVALID_SNAPSHOT_ID', 'Knowledge snapshot ID is invalid');
  governanceInvariant(typeof snapshot.digest === 'string' && DIGEST_PATTERN.test(snapshot.digest),
    'INVALID_SNAPSHOT_DIGEST', 'Knowledge snapshot digest is invalid');
  governanceInvariant(snapshot.schemaVersion === 1,
    'INVALID_SNAPSHOT_SCHEMA', 'Knowledge snapshot schema version must be 1');
  governanceInvariant(snapshot.context && typeof snapshot.context === 'object' && !Array.isArray(snapshot.context),
    'INVALID_SNAPSHOT_CONTEXT', 'Knowledge snapshot context is required');
  for (const field of ['projectId', 'environmentId', 'releaseId']) {
    governanceInvariant(typeof snapshot.context[field] === 'string' && snapshot.context[field].length > 0,
      'INVALID_SNAPSHOT_CONTEXT', `Snapshot context ${field} is required`, { field });
  }
  governanceInvariant(Array.isArray(snapshot.rules) && Array.isArray(snapshot.resolution),
    'INVALID_SNAPSHOT_PAYLOAD', 'Snapshot rules and resolution must be arrays');

  const payload = canonicalize({
    schemaVersion: snapshot.schemaVersion,
    context: snapshot.context,
    rules: snapshot.rules,
    resolution: snapshot.resolution,
  });
  const digest = sha256(payload);
  governanceInvariant(digest === snapshot.digest,
    'SNAPSHOT_DIGEST_MISMATCH', 'Snapshot digest does not match canonical payload', {
      expectedDigest: digest,
      actualDigest: snapshot.digest,
    });
  const slug = String(snapshot.context.projectId)
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  governanceInvariant(snapshot.snapshotId === `kb-${slug}-${digest.slice(0, 12)}`,
    'SNAPSHOT_ID_MISMATCH', 'Snapshot ID does not match project and digest');
  return structuredClone(snapshot);
}

export function createSnapshotEnvelope(command) {
  const projectId = validateProjectId(command?.projectId);
  const snapshot = validateSnapshot(command?.snapshot);
  governanceInvariant(snapshot.context.projectId === projectId,
    'SNAPSHOT_PROJECT_MISMATCH', 'Snapshot project does not match governance project', {
      projectId,
      snapshotProjectId: snapshot.context.projectId,
    });
  const actor = validateActor(command?.actor);
  const createdAt = validateUtcTimestamp(command?.at);
  const reason = validateReason(command?.reason);
  return {
    schemaVersion: SNAPSHOT_ENVELOPE_SCHEMA_VERSION,
    snapshotId: snapshot.snapshotId,
    digest: snapshot.digest,
    projectId,
    environmentId: snapshot.context.environmentId,
    releaseId: snapshot.context.releaseId,
    createdBy: actor,
    createdAt,
    reason,
    snapshot,
  };
}

export function validateSnapshotEnvelope(input) {
  governanceInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_SNAPSHOT_ENVELOPE', 'Snapshot envelope must be an object');
  governanceInvariant(input.schemaVersion === SNAPSHOT_ENVELOPE_SCHEMA_VERSION,
    'INVALID_SNAPSHOT_ENVELOPE_SCHEMA', 'Snapshot envelope schema version is unsupported');
  const normalized = createSnapshotEnvelope({
    projectId: input.projectId,
    snapshot: input.snapshot,
    actor: input.createdBy,
    at: input.createdAt,
    reason: input.reason,
  });
  governanceInvariant(normalized.snapshotId === input.snapshotId && normalized.digest === input.digest,
    'SNAPSHOT_ENVELOPE_MISMATCH', 'Snapshot envelope identity does not match snapshot payload');
  governanceInvariant(normalized.environmentId === input.environmentId && normalized.releaseId === input.releaseId,
    'SNAPSHOT_ENVELOPE_CONTEXT_MISMATCH', 'Snapshot envelope context does not match snapshot payload');
  return normalized;
}
