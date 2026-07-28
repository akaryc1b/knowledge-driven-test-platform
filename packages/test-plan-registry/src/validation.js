import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  assertNoExecutorCode,
  assertNoSensitivePlanningData,
  clonePlanningJson,
  validateContextId,
  validateDigest,
  validateIdentifier,
  validateNonEmptyString,
  validatePlanId,
  validateProjectId,
  validateSemver,
  validateUtcTimestamp,
} from '@kdtp/test-plan';
import { validatePlanningResult } from '@kdtp/test-planner';
import {
  PLAN_HISTORY_EVENT_TYPES,
  PLAN_LIFECYCLE_TRANSITIONS,
  PLAN_RECORD_STATUSES,
  PLAN_REVIEW_DECISIONS,
  TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION,
  TEST_PLAN_RECORD_SCHEMA_VERSION,
  TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION,
} from './constants.js';
import { TestPlanRegistryError, registryInvariant } from './errors.js';

const RECORD_FIELDS = new Set([
  'schemaVersion', 'planId', 'projectId', 'environmentId', 'releaseId', 'status', 'revision',
  'inputFingerprint', 'knowledgeSnapshot', 'capabilityCatalog', 'contentDigest', 'planningResult',
  'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'history',
]);
const HISTORY_FIELDS = new Set([
  'schemaVersion', 'planId', 'revision', 'type', 'fromStatus', 'toStatus',
  'previousContentDigest', 'contentDigest', 'actor', 'at', 'reason',
]);
const DECISION_FIELDS = new Set([
  'schemaVersion', 'decisionId', 'planId', 'projectId', 'planRevision', 'decision',
  'reviewer', 'at', 'reason', 'evidence',
]);
const FILTER_FIELDS = new Set([
  'projectId', 'status', 'environmentId', 'releaseId', 'inputFingerprint', 'snapshotId',
]);
const DECISION_FILTER_FIELDS = new Set([
  'planId', 'projectId', 'planRevision', 'decision', 'reviewer',
]);
const DECISION_ID_PATTERN = /^plan-decision-[a-f0-9]{16}$/;

export function createPlanRecord(command) {
  const planningResult = validatePlanningResult(command?.planningResult);
  const actor = validateActor(command?.actor, 'actor');
  const at = validateUtcTimestamp(command?.at, 'at');
  const reason = validateNonEmptyString(command?.reason, 'reason', 1024);
  const plan = planningResult.plan;
  registryInvariant(Date.parse(at) >= Date.parse(plan.createdAt),
    'INVALID_PLAN_RECORD_TIME', 'Registry creation time cannot precede plan creation time');
  const historyEvent = createHistoryEvent({
    planId: plan.planId,
    revision: 1,
    type: 'PLAN_CREATED',
    fromStatus: null,
    toStatus: 'DRAFT',
    previousContentDigest: null,
    contentDigest: planningResult.digest,
    actor,
    at,
    reason,
  });
  return validatePlanRecord({
    schemaVersion: TEST_PLAN_RECORD_SCHEMA_VERSION,
    planId: plan.planId,
    projectId: plan.projectId,
    environmentId: plan.environmentId,
    releaseId: plan.releaseId,
    status: 'DRAFT',
    revision: 1,
    inputFingerprint: plan.inputFingerprint,
    knowledgeSnapshot: {
      snapshotId: plan.knowledgeSnapshot.snapshotId,
      digest: plan.knowledgeSnapshot.digest,
    },
    capabilityCatalog: {
      version: plan.capabilityCatalog.version,
      digest: plan.capabilityCatalog.digest,
    },
    contentDigest: planningResult.digest,
    planningResult,
    createdAt: plan.createdAt,
    createdBy: plan.createdBy,
    updatedAt: at,
    updatedBy: actor,
    history: [historyEvent],
  });
}

export function validatePlanRecord(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_RECORD', 'Test plan record must be an object');
  assertOnlyFields(input, RECORD_FIELDS, 'INVALID_PLAN_RECORD', 'Test plan record');
  registryInvariant(input.schemaVersion === TEST_PLAN_RECORD_SCHEMA_VERSION,
    'INVALID_PLAN_RECORD_SCHEMA', 'Test plan record schema version is unsupported');
  const planningResult = validatePlanningResult(input.planningResult);
  const plan = planningResult.plan;
  const normalized = {
    schemaVersion: TEST_PLAN_RECORD_SCHEMA_VERSION,
    planId: validatePlanId(input.planId),
    projectId: validateProjectId(input.projectId),
    environmentId: validateContextId(input.environmentId, 'environmentId'),
    releaseId: validateContextId(input.releaseId, 'releaseId'),
    status: validateStatus(input.status),
    revision: validateRevision(input.revision, 'revision'),
    inputFingerprint: validateDigest(input.inputFingerprint, 'inputFingerprint'),
    knowledgeSnapshot: normalizeSnapshotBinding(input.knowledgeSnapshot),
    capabilityCatalog: normalizeCatalogBinding(input.capabilityCatalog),
    contentDigest: validateDigest(input.contentDigest, 'contentDigest'),
    planningResult,
    createdAt: validateUtcTimestamp(input.createdAt, 'createdAt'),
    createdBy: validateActor(input.createdBy, 'createdBy'),
    updatedAt: validateUtcTimestamp(input.updatedAt, 'updatedAt'),
    updatedBy: validateActor(input.updatedBy, 'updatedBy'),
    history: normalizeHistory(input.history),
  };
  registryInvariant(Date.parse(normalized.updatedAt) >= Date.parse(normalized.createdAt),
    'INVALID_PLAN_RECORD_TIME', 'updatedAt cannot precede createdAt');
  registryInvariant(normalized.planId === plan.planId
      && normalized.projectId === plan.projectId
      && normalized.environmentId === plan.environmentId
      && normalized.releaseId === plan.releaseId
      && normalized.createdAt === plan.createdAt
      && normalized.createdBy === plan.createdBy,
    'PLAN_RECORD_BINDING_MISMATCH', 'Record context does not match planning result');
  registryInvariant(normalized.inputFingerprint === plan.inputFingerprint,
    'PLAN_RECORD_BINDING_MISMATCH', 'Record input fingerprint does not match planning result');
  registryInvariant(normalized.knowledgeSnapshot.snapshotId === plan.knowledgeSnapshot.snapshotId
      && normalized.knowledgeSnapshot.digest === plan.knowledgeSnapshot.digest,
    'PLAN_RECORD_BINDING_MISMATCH', 'Record snapshot binding does not match planning result');
  registryInvariant(normalized.capabilityCatalog.version === plan.capabilityCatalog.version
      && normalized.capabilityCatalog.digest === plan.capabilityCatalog.digest,
    'PLAN_RECORD_BINDING_MISMATCH', 'Record capability catalog binding does not match planning result');
  registryInvariant(normalized.contentDigest === planningResult.digest,
    'PLAN_RECORD_CONTENT_DIGEST_MISMATCH', 'Record content digest does not match planning result');
  registryInvariant(Date.parse(normalized.history[0].at) >= Date.parse(normalized.createdAt),
    'INVALID_PLAN_RECORD_TIME', 'First history event cannot precede plan creation time');
  validateHistoryConsistency(normalized);
  return clonePlanningJson(normalized);
}

export function replaceDraftRecord(recordInput, command) {
  const current = validatePlanRecord(recordInput);
  assertExpectedRevision(current, command?.expectedRevision);
  registryInvariant(current.status === 'DRAFT', 'PLAN_NOT_EDITABLE',
    'Only DRAFT plan records can replace content', { planId: current.planId, status: current.status });
  const planningResult = validatePlanningResult(command?.planningResult);
  assertImmutableBindings(current, planningResult);
  registryInvariant(planningResult.digest !== current.contentDigest,
    'NO_PLAN_CONTENT_CHANGE', 'Draft replacement must change canonical plan content');
  const actor = validateActor(command?.actor, 'actor');
  const at = validateOperationTime(current, command?.at);
  const reason = validateNonEmptyString(command?.reason, 'reason', 1024);
  const nextRevision = current.revision + 1;
  const historyEvent = createHistoryEvent({
    planId: current.planId,
    revision: nextRevision,
    type: 'PLAN_CONTENT_REPLACED',
    fromStatus: current.status,
    toStatus: current.status,
    previousContentDigest: current.contentDigest,
    contentDigest: planningResult.digest,
    actor,
    at,
    reason,
  });
  return validatePlanRecord({
    ...current,
    revision: nextRevision,
    contentDigest: planningResult.digest,
    planningResult,
    updatedAt: at,
    updatedBy: actor,
    history: [...current.history, historyEvent],
  });
}

export function transitionPlanRecord(recordInput, command) {
  const current = validatePlanRecord(recordInput);
  assertExpectedRevision(current, command?.expectedRevision);
  const toStatus = validateStatus(command?.toStatus);
  registryInvariant(PLAN_LIFECYCLE_TRANSITIONS[current.status].includes(toStatus),
    'INVALID_PLAN_TRANSITION', `Cannot transition plan from ${current.status} to ${toStatus}`, {
      planId: current.planId,
      fromStatus: current.status,
      toStatus,
    });
  const actor = validateActor(command?.actor, 'actor');
  const at = validateOperationTime(current, command?.at);
  const reason = validateNonEmptyString(command?.reason, 'reason', 1024);
  const nextRevision = current.revision + 1;
  const historyEvent = createHistoryEvent({
    planId: current.planId,
    revision: nextRevision,
    type: 'PLAN_STATUS_TRANSITIONED',
    fromStatus: current.status,
    toStatus,
    previousContentDigest: current.contentDigest,
    contentDigest: current.contentDigest,
    actor,
    at,
    reason,
  });
  return validatePlanRecord({
    ...current,
    status: toStatus,
    revision: nextRevision,
    updatedAt: at,
    updatedBy: actor,
    history: [...current.history, historyEvent],
  });
}

export function createPlanReviewDecision(command) {
  const evidence = normalizeReviewEvidence(command?.evidence);
  const payload = {
    planId: validatePlanId(command?.planId),
    projectId: validateProjectId(command?.projectId),
    planRevision: validateRevision(command?.planRevision, 'planRevision'),
    decision: validateDecision(command?.decision),
    reviewer: validateActor(command?.reviewer, 'reviewer'),
    at: validateUtcTimestamp(command?.at, 'at'),
    reason: validateNonEmptyString(command?.reason, 'reason', 1024),
    evidence,
  };
  assertNoSensitivePlanningData(payload.evidence, { path: '$.planReviewDecision.evidence' });
  assertNoExecutorCode(payload.evidence, '$.planReviewDecision.evidence');
  const decisionId = `plan-decision-${sha256(canonicalize(payload)).slice(0, 16)}`;
  return validatePlanReviewDecision({
    schemaVersion: TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION,
    decisionId,
    ...payload,
  });
}

export function validatePlanReviewDecision(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_REVIEW_DECISION', 'Plan review decision must be an object');
  assertOnlyFields(input, DECISION_FIELDS,
    'INVALID_PLAN_REVIEW_DECISION', 'Plan review decision');
  registryInvariant(input.schemaVersion === TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION,
    'INVALID_PLAN_REVIEW_DECISION_SCHEMA', 'Plan review decision schema version is unsupported');
  registryInvariant(typeof input.decisionId === 'string' && DECISION_ID_PATTERN.test(input.decisionId),
    'INVALID_PLAN_REVIEW_DECISION_ID', 'Plan review decision ID is invalid');
  const normalized = {
    schemaVersion: TEST_PLAN_REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: input.decisionId,
    planId: validatePlanId(input.planId),
    projectId: validateProjectId(input.projectId),
    planRevision: validateRevision(input.planRevision, 'planRevision'),
    decision: validateDecision(input.decision),
    reviewer: validateActor(input.reviewer, 'reviewer'),
    at: validateUtcTimestamp(input.at, 'at'),
    reason: validateNonEmptyString(input.reason, 'reason', 1024),
    evidence: normalizeReviewEvidence(input.evidence),
  };
  assertNoSensitivePlanningData(normalized.evidence, { path: '$.planReviewDecision.evidence' });
  assertNoExecutorCode(normalized.evidence, '$.planReviewDecision.evidence');
  const expectedId = `plan-decision-${sha256(canonicalize({
    planId: normalized.planId,
    projectId: normalized.projectId,
    planRevision: normalized.planRevision,
    decision: normalized.decision,
    reviewer: normalized.reviewer,
    at: normalized.at,
    reason: normalized.reason,
    evidence: normalized.evidence,
  })).slice(0, 16)}`;
  registryInvariant(normalized.decisionId === expectedId,
    'PLAN_REVIEW_DECISION_ID_MISMATCH', 'Plan review decision ID does not match canonical content');
  return clonePlanningJson(normalized);
}

export function validatePlanRegistryFilter(input = {}) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_REGISTRY_FILTER', 'Plan registry filter must be an object');
  assertOnlyFields(input, FILTER_FIELDS, 'INVALID_PLAN_REGISTRY_FILTER', 'Plan registry filter');
  return compact({
    projectId: input.projectId === undefined ? undefined : validateProjectId(input.projectId),
    status: input.status === undefined ? undefined : validateStatus(input.status),
    environmentId: input.environmentId === undefined
      ? undefined : validateContextId(input.environmentId, 'environmentId'),
    releaseId: input.releaseId === undefined ? undefined : validateContextId(input.releaseId, 'releaseId'),
    inputFingerprint: input.inputFingerprint === undefined
      ? undefined : validateDigest(input.inputFingerprint, 'inputFingerprint'),
    snapshotId: input.snapshotId === undefined ? undefined : validateNonEmptyString(input.snapshotId, 'snapshotId'),
  });
}

export function validatePlanReviewDecisionFilter(input = {}) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_REVIEW_FILTER', 'Plan review decision filter must be an object');
  assertOnlyFields(input, DECISION_FILTER_FIELDS,
    'INVALID_PLAN_REVIEW_FILTER', 'Plan review decision filter');
  return compact({
    planId: input.planId === undefined ? undefined : validatePlanId(input.planId),
    projectId: input.projectId === undefined ? undefined : validateProjectId(input.projectId),
    planRevision: input.planRevision === undefined
      ? undefined : validateRevision(input.planRevision, 'planRevision'),
    decision: input.decision === undefined ? undefined : validateDecision(input.decision),
    reviewer: input.reviewer === undefined ? undefined : validateActor(input.reviewer, 'reviewer'),
  });
}

function createHistoryEvent(input) {
  return validateHistoryEvent({
    schemaVersion: TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION,
    ...input,
  });
}

export function validateHistoryEvent(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_HISTORY', 'Plan history event must be an object');
  assertOnlyFields(input, HISTORY_FIELDS, 'INVALID_PLAN_HISTORY', 'Plan history event');
  registryInvariant(input.schemaVersion === TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION,
    'INVALID_PLAN_HISTORY_SCHEMA', 'Plan history schema version is unsupported');
  registryInvariant(PLAN_HISTORY_EVENT_TYPES.includes(input.type),
    'INVALID_PLAN_HISTORY_TYPE', 'Plan history event type is invalid');
  const normalized = {
    schemaVersion: TEST_PLAN_HISTORY_EVENT_SCHEMA_VERSION,
    planId: validatePlanId(input.planId),
    revision: validateRevision(input.revision, 'history.revision'),
    type: input.type,
    fromStatus: input.fromStatus === null ? null : validateStatus(input.fromStatus),
    toStatus: validateStatus(input.toStatus),
    previousContentDigest: input.previousContentDigest === null
      ? null : validateDigest(input.previousContentDigest, 'previousContentDigest'),
    contentDigest: validateDigest(input.contentDigest, 'contentDigest'),
    actor: validateActor(input.actor, 'actor'),
    at: validateUtcTimestamp(input.at, 'at'),
    reason: validateNonEmptyString(input.reason, 'reason', 1024),
  };
  if (normalized.type === 'PLAN_CREATED') {
    registryInvariant(normalized.revision === 1 && normalized.fromStatus === null
        && normalized.toStatus === 'DRAFT' && normalized.previousContentDigest === null,
      'INVALID_PLAN_HISTORY', 'PLAN_CREATED history is invalid');
  } else if (normalized.type === 'PLAN_CONTENT_REPLACED') {
    registryInvariant(normalized.revision > 1
        && normalized.fromStatus === 'DRAFT'
        && normalized.toStatus === 'DRAFT'
        && normalized.previousContentDigest !== null
        && normalized.previousContentDigest !== normalized.contentDigest,
      'INVALID_PLAN_HISTORY', 'PLAN_CONTENT_REPLACED history is invalid');
  } else {
    registryInvariant(normalized.revision > 1
        && normalized.fromStatus !== null
        && PLAN_LIFECYCLE_TRANSITIONS[normalized.fromStatus].includes(normalized.toStatus)
        && normalized.previousContentDigest === normalized.contentDigest,
      'INVALID_PLAN_HISTORY', 'PLAN_STATUS_TRANSITIONED history is invalid');
  }
  return clonePlanningJson(normalized);
}

function normalizeHistory(input) {
  registryInvariant(Array.isArray(input) && input.length > 0 && input.length <= 100_000,
    'INVALID_PLAN_HISTORY', 'Plan history must be a non-empty bounded array');
  return input.map(validateHistoryEvent);
}

function validateHistoryConsistency(record) {
  registryInvariant(record.history.length === record.revision,
    'PLAN_HISTORY_REVISION_MISMATCH', 'Plan history length must equal record revision');
  let prior = null;
  for (let index = 0; index < record.history.length; index += 1) {
    const event = record.history[index];
    registryInvariant(event.planId === record.planId && event.revision === index + 1,
      'PLAN_HISTORY_REVISION_MISMATCH', 'Plan history revisions must be contiguous');
    if (prior) {
      registryInvariant(event.fromStatus === prior.toStatus
          && event.previousContentDigest === prior.contentDigest
          && Date.parse(event.at) >= Date.parse(prior.at),
      'PLAN_HISTORY_CHAIN_MISMATCH', 'Plan history chain is inconsistent');
    }
    prior = event;
  }
  const latest = record.history.at(-1);
  registryInvariant(latest.toStatus === record.status
      && latest.contentDigest === record.contentDigest
      && latest.at === record.updatedAt
      && latest.actor === record.updatedBy,
  'PLAN_HISTORY_RECORD_MISMATCH', 'Latest plan history event does not match record state');
}

function assertImmutableBindings(record, planningResult) {
  const plan = planningResult.plan;
  registryInvariant(record.planId === plan.planId
      && record.projectId === plan.projectId
      && record.environmentId === plan.environmentId
      && record.releaseId === plan.releaseId
      && record.inputFingerprint === plan.inputFingerprint
      && record.knowledgeSnapshot.snapshotId === plan.knowledgeSnapshot.snapshotId
      && record.knowledgeSnapshot.digest === plan.knowledgeSnapshot.digest
      && record.capabilityCatalog.version === plan.capabilityCatalog.version
      && record.capabilityCatalog.digest === plan.capabilityCatalog.digest,
  'PLAN_BINDING_IMMUTABLE', 'Plan identity, context, Snapshot and Catalog bindings are immutable');
}

function assertExpectedRevision(record, input) {
  const expectedRevision = validateRevision(input, 'expectedRevision');
  registryInvariant(record.revision === expectedRevision,
    'REVISION_CONFLICT', 'Plan record revision does not match expectedRevision', {
      planId: record.planId,
      expectedRevision,
      actualRevision: record.revision,
    });
}

function validateOperationTime(record, input) {
  const at = validateUtcTimestamp(input, 'at');
  registryInvariant(Date.parse(at) >= Date.parse(record.updatedAt),
    'INVALID_PLAN_RECORD_TIME', 'Operation time cannot precede the current record time');
  return at;
}

function normalizeSnapshotBinding(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_RECORD', 'knowledgeSnapshot binding must be an object');
  assertOnlyFields(input, new Set(['snapshotId', 'digest']),
    'INVALID_PLAN_RECORD', 'knowledgeSnapshot binding');
  return {
    snapshotId: validateNonEmptyString(input.snapshotId, 'snapshotId'),
    digest: validateDigest(input.digest, 'snapshotDigest'),
  };
}


function normalizeReviewEvidence(input) {
  const evidence = input ?? {};
  registryInvariant(evidence && typeof evidence === 'object' && !Array.isArray(evidence),
    'INVALID_PLAN_REVIEW_EVIDENCE', 'Plan review evidence must be an object');
  return clonePlanningJson(evidence);
}

function normalizeCatalogBinding(input) {
  registryInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLAN_RECORD', 'capabilityCatalog binding must be an object');
  assertOnlyFields(input, new Set(['version', 'digest']),
    'INVALID_PLAN_RECORD', 'capabilityCatalog binding');
  return {
    version: validateSemver(input.version, 'capabilityCatalog.version'),
    digest: validateDigest(input.digest, 'capabilityCatalog.digest'),
  };
}

function validateStatus(input) {
  registryInvariant(PLAN_RECORD_STATUSES.includes(input),
    'INVALID_PLAN_STATUS', 'Plan record status is invalid', { status: input });
  return input;
}

function validateDecision(input) {
  registryInvariant(PLAN_REVIEW_DECISIONS.includes(input),
    'INVALID_PLAN_REVIEW_DECISION', 'Plan review decision is invalid', { decision: input });
  return input;
}

function validateRevision(input, field) {
  registryInvariant(Number.isSafeInteger(input) && input > 0,
    'INVALID_PLAN_REVISION', `${field} must be a positive integer`, { field, value: input });
  return input;
}

function validateActor(input, field) {
  return validateIdentifier(input, field);
}

function assertOnlyFields(input, allowed, code, label) {
  const unknown = Object.keys(input).filter((key) => !allowed.has(key));
  registryInvariant(unknown.length === 0, code, `${label} contains unsupported fields`, { unknown });
}

function compact(input) {
  return Object.fromEntries(Object.entries(input).filter(([, value]) => value !== undefined));
}

export function mapRegistryDomainError(error, operation) {
  if (error instanceof TestPlanRegistryError) return error;
  if (error && typeof error.code === 'string') return error;
  const mapped = new TestPlanRegistryError('PLAN_REGISTRY_ERROR',
    'Test plan registry operation failed', { operation });
  mapped.cause = error;
  return mapped;
}
