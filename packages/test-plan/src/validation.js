import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import { validateSnapshotEnvelope } from '@kdtp/knowledge-governance';
import {
  COVERAGE_STATUSES,
  TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION,
  TEST_INTENT_SCHEMA_VERSION,
  TEST_PLAN_SCHEMA_VERSION,
  TEST_PLAN_STATUSES,
  TEST_PLANNING_REQUEST_SCHEMA_VERSION,
  TEST_TARGET_INVENTORY_SCHEMA_VERSION,
} from './constants.js';
import { TestPlanError, planInvariant } from './errors.js';
import {
  deriveCoverageObligationId,
  deriveExemptionId,
  deriveIntentId,
  derivePlanId,
  deriveProvenanceId,
  deriveTargetInventoryId,
  validateContextId,
  validateCoverageObligationId,
  validateDigest,
  validateExemptionId,
  validateIdentifier,
  validateIntentId,
  validateKind,
  validateNonEmptyString,
  validatePlanId,
  validateProjectId,
  validateProvenanceId,
  validateSemver,
  validateTargetInventoryId,
  validateUtcTimestamp,
} from './identity.js';
import {
  assertNoExecutorCode,
  assertNoSensitivePlanningData,
  clonePlanningJson,
} from './json.js';

const KNOWLEDGE_ID_PATTERN = /^[A-Z][A-Z0-9]{1,31}(?:-[A-Z0-9][A-Z0-9]{0,31}){2,7}$/;
const BOUNDARY_KEY_PATTERN = /^[a-z][a-z0-9]*(?:[.-][a-z0-9][a-z0-9-]*)+$/;
const SNAPSHOT_ID_PATTERN = /^kb-[a-z0-9-]+-[a-f0-9]{12}$/;

const TARGET_FIELDS = new Set(['targetId', 'kind', 'name', 'locator', 'tags', 'attributes']);
const POLICY_FIELDS = new Set(['policyId', 'version', 'entries', 'exemptions']);
const POLICY_ENTRY_FIELDS = new Set(['policyEntryId', 'priority', 'selectors', 'capabilityRefs', 'mandatory']);
const SELECTOR_FIELDS = new Set([
  'knowledgeIds', 'boundaryKeys', 'knowledgeTags', 'targetIds', 'targetKinds', 'targetTags',
]);
const CAPABILITY_REF_FIELDS = new Set(['capabilityId', 'version']);
const INTENT_FIELDS = new Set([
  'schemaVersion', 'intentId', 'planInputFingerprint', 'intentKind', 'targetId', 'capability',
  'sourceKnowledge', 'policyEntryId', 'input', 'assertions', 'thresholds', 'dependencies', 'tags',
]);
const OBLIGATION_FIELDS = new Set([
  'schemaVersion', 'obligationId', 'planInputFingerprint', 'targetId', 'capability',
  'sourceKnowledge', 'policyEntryId', 'mandatory', 'status', 'intentIds', 'exemption',
]);
const PROVENANCE_FIELDS = new Set([
  'provenanceId', 'intentId', 'knowledgeId', 'knowledgeVersion', 'boundaryKey', 'snapshotId',
  'snapshotDigest', 'capabilityId', 'capabilityVersion', 'targetId', 'policyEntryId',
]);

export function createTargetInventory(command) {
  planInvariant(command && typeof command === 'object' && !Array.isArray(command),
    'INVALID_TARGET_INVENTORY', 'Target inventory command must be an object');
  const normalized = normalizeTargetInventory({
    schemaVersion: TEST_TARGET_INVENTORY_SCHEMA_VERSION,
    inventoryId: null,
    projectId: command.projectId,
    environmentId: command.environmentId,
    releaseId: command.releaseId,
    targets: command.targets,
  }, false);
  const inventoryId = deriveTargetInventoryId(targetInventoryIdentityPayload(normalized));
  return { ...normalized, inventoryId };
}

export function validateTargetInventory(input) {
  return normalizeTargetInventory(input, true);
}

function normalizeTargetInventory(input, requireIdentity) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_TARGET_INVENTORY', 'Target inventory must be an object');
  const inventory = input;
  assertOnlyFields(inventory, new Set([
    'schemaVersion', 'inventoryId', 'projectId', 'environmentId', 'releaseId', 'targets',
  ]), 'INVALID_TARGET_INVENTORY', 'Target inventory');
  planInvariant(inventory.schemaVersion === TEST_TARGET_INVENTORY_SCHEMA_VERSION,
    'INVALID_TARGET_INVENTORY_SCHEMA', 'Target inventory schema version is unsupported');
  const projectId = validateProjectId(inventory.projectId);
  const environmentId = validateContextId(inventory.environmentId, 'environmentId');
  const releaseId = validateContextId(inventory.releaseId, 'releaseId');
  planInvariant(Array.isArray(inventory.targets) && inventory.targets.length > 0 && inventory.targets.length <= 10_000,
    'INVALID_TARGET_INVENTORY', 'Target inventory must contain between 1 and 10000 targets');
  const targets = inventory.targets.map(normalizeTarget).sort((a, b) => a.targetId.localeCompare(b.targetId));
  assertUnique(targets.map((target) => target.targetId), 'DUPLICATE_TARGET', 'Target IDs must be unique');
  const normalized = {
    schemaVersion: TEST_TARGET_INVENTORY_SCHEMA_VERSION,
    projectId,
    environmentId,
    releaseId,
    targets,
  };
  const expectedId = deriveTargetInventoryId(targetInventoryIdentityPayload(normalized));
  if (requireIdentity) {
    validateTargetInventoryId(inventory.inventoryId);
    planInvariant(inventory.inventoryId === expectedId,
      'TARGET_INVENTORY_ID_MISMATCH', 'Target inventory ID does not match canonical payload', {
        expectedId,
        actualId: inventory.inventoryId,
      });
  }
  return { ...normalized, inventoryId: requireIdentity ? inventory.inventoryId : null };
}

function targetInventoryIdentityPayload(inventory) {
  return {
    schemaVersion: inventory.schemaVersion,
    projectId: inventory.projectId,
    environmentId: inventory.environmentId,
    releaseId: inventory.releaseId,
    targets: inventory.targets,
  };
}

function normalizeTarget(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_TARGET', 'Test target must be an object');
  assertOnlyFields(input, TARGET_FIELDS, 'INVALID_TARGET', 'Test target');
  const targetId = validateIdentifier(input.targetId, 'targetId');
  const kind = validateKind(input.kind, 'target.kind');
  const name = validateNonEmptyString(input.name, 'target.name', 256);
  const locator = input.locator === undefined
    ? undefined
    : validateNonEmptyString(input.locator, 'target.locator', 2048);
  const tags = normalizeStringArray(input.tags ?? [], 'target.tags', validateKind);
  const attributes = clonePlanningJson(input.attributes ?? {});
  assertNoSensitivePlanningData({ locator, attributes }, { path: `$.targets.${targetId}` });
  assertNoExecutorCode(attributes, `$.targets.${targetId}.attributes`);
  return compact({ targetId, kind, name, locator, tags, attributes });
}

export function validatePlanningPolicy(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLANNING_POLICY', 'Planning policy must be an object');
  assertOnlyFields(input, POLICY_FIELDS, 'INVALID_PLANNING_POLICY', 'Planning policy');
  const policyId = validateIdentifier(input.policyId, 'planningPolicy.policyId');
  const version = validateSemver(input.version, 'planningPolicy.version');
  planInvariant(Array.isArray(input.entries) && input.entries.length > 0 && input.entries.length <= 10_000,
    'INVALID_PLANNING_POLICY', 'Planning policy must contain between 1 and 10000 entries');
  const entries = input.entries.map(normalizePolicyEntry)
    .sort((a, b) => a.priority - b.priority || a.policyEntryId.localeCompare(b.policyEntryId));
  assertUnique(entries.map((entry) => entry.policyEntryId),
    'DUPLICATE_POLICY_ENTRY', 'Planning policy entry IDs must be unique');
  const exemptions = (input.exemptions ?? []).map(normalizeExemption)
    .sort((a, b) => a.exemptionId.localeCompare(b.exemptionId));
  assertUnique(exemptions.map((item) => item.exemptionId),
    'DUPLICATE_EXEMPTION', 'Planning exemptions must be unique');
  const normalized = { policyId, version, entries, exemptions };
  assertNoSensitivePlanningData(normalized, { path: '$.planningPolicy' });
  assertNoExecutorCode(normalized, '$.planningPolicy');
  return normalized;
}

function normalizePolicyEntry(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLANNING_POLICY_ENTRY', 'Planning policy entry must be an object');
  assertOnlyFields(input, POLICY_ENTRY_FIELDS,
    'INVALID_PLANNING_POLICY_ENTRY', 'Planning policy entry');
  const policyEntryId = validateIdentifier(input.policyEntryId, 'policyEntryId');
  planInvariant(Number.isSafeInteger(input.priority) && input.priority >= 0 && input.priority <= 1_000_000,
    'INVALID_PLANNING_POLICY_PRIORITY', 'Planning policy priority must be a non-negative integer');
  planInvariant(typeof input.mandatory === 'boolean',
    'INVALID_PLANNING_POLICY_ENTRY', 'Planning policy mandatory must be boolean');
  const selectorsInput = input.selectors ?? {};
  planInvariant(selectorsInput && typeof selectorsInput === 'object' && !Array.isArray(selectorsInput),
    'INVALID_PLANNING_SELECTOR', 'Planning policy selectors must be an object');
  assertOnlyFields(selectorsInput, SELECTOR_FIELDS, 'INVALID_PLANNING_SELECTOR', 'Planning selector');
  const selectors = {
    knowledgeIds: normalizeStringArray(selectorsInput.knowledgeIds ?? [], 'knowledgeIds', validateKnowledgeId),
    boundaryKeys: normalizeStringArray(selectorsInput.boundaryKeys ?? [], 'boundaryKeys', validateBoundaryKey),
    knowledgeTags: normalizeStringArray(selectorsInput.knowledgeTags ?? [], 'knowledgeTags', validateKind),
    targetIds: normalizeStringArray(selectorsInput.targetIds ?? [], 'targetIds', (item) => validateIdentifier(item, 'targetId')),
    targetKinds: normalizeStringArray(selectorsInput.targetKinds ?? [], 'targetKinds', (item) => validateKind(item, 'targetKind')),
    targetTags: normalizeStringArray(selectorsInput.targetTags ?? [], 'targetTags', validateKind),
  };
  planInvariant(Array.isArray(input.capabilityRefs) && input.capabilityRefs.length > 0,
    'INVALID_PLANNING_POLICY_ENTRY', 'Planning policy entry requires capability references');
  const capabilityRefs = input.capabilityRefs.map(normalizeCapabilityRef)
    .sort(compareCapabilityRef);
  assertUnique(capabilityRefs.map(capabilityKey),
    'DUPLICATE_CAPABILITY_REFERENCE', 'Capability references must be unique');
  return {
    policyEntryId,
    priority: input.priority,
    selectors,
    capabilityRefs,
    mandatory: input.mandatory,
  };
}

function normalizeExemption(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_EXEMPTION', 'Planning exemption must be an object');
  const allowed = new Set([
    'exemptionId', 'knowledgeId', 'knowledgeVersion', 'targetId', 'capabilityId',
    'capabilityVersion', 'reason', 'owner',
  ]);
  assertOnlyFields(input, allowed, 'INVALID_EXEMPTION', 'Planning exemption');
  const payload = {
    knowledgeId: validateKnowledgeId(input.knowledgeId),
    knowledgeVersion: validateSemver(input.knowledgeVersion, 'knowledgeVersion'),
    targetId: validateIdentifier(input.targetId, 'targetId'),
    capabilityId: validateIdentifier(input.capabilityId, 'capabilityId'),
    capabilityVersion: validateSemver(input.capabilityVersion, 'capabilityVersion'),
    reason: validateNonEmptyString(input.reason, 'exemption.reason'),
    owner: validateNonEmptyString(input.owner, 'exemption.owner'),
  };
  const expectedId = deriveExemptionId(payload);
  validateExemptionId(input.exemptionId);
  planInvariant(input.exemptionId === expectedId,
    'EXEMPTION_ID_MISMATCH', 'Exemption ID does not match canonical payload', {
      expectedId,
      actualId: input.exemptionId,
    });
  return { exemptionId: input.exemptionId, ...payload };
}

export function createPlanningExemption(command) {
  const payload = {
    knowledgeId: validateKnowledgeId(command?.knowledgeId),
    knowledgeVersion: validateSemver(command?.knowledgeVersion, 'knowledgeVersion'),
    targetId: validateIdentifier(command?.targetId, 'targetId'),
    capabilityId: validateIdentifier(command?.capabilityId, 'capabilityId'),
    capabilityVersion: validateSemver(command?.capabilityVersion, 'capabilityVersion'),
    reason: validateNonEmptyString(command?.reason, 'exemption.reason'),
    owner: validateNonEmptyString(command?.owner, 'exemption.owner'),
  };
  return { exemptionId: deriveExemptionId(payload), ...payload };
}

export function createPlanningRequest(command) {
  return normalizePlanningRequest({
    ...command,
    schemaVersion: TEST_PLANNING_REQUEST_SCHEMA_VERSION,
    inputFingerprint: null,
  }, false);
}

export function validatePlanningRequest(input) {
  return normalizePlanningRequest(input, true);
}

function normalizePlanningRequest(input, requireFingerprint) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PLANNING_REQUEST', 'Planning request must be an object');
  const allowed = new Set([
    'schemaVersion', 'inputFingerprint', 'projectId', 'environmentId', 'releaseId',
    'knowledgeSnapshotId', 'knowledgeSnapshotDigest', 'knowledgeSnapshot', 'plannerVersion',
    'capabilityCatalogVersion', 'capabilityCatalogDigest', 'targetInventory', 'planningPolicy',
    'createdAt', 'createdBy',
  ]);
  assertOnlyFields(input, allowed, 'INVALID_PLANNING_REQUEST', 'Planning request');
  planInvariant(input.schemaVersion === TEST_PLANNING_REQUEST_SCHEMA_VERSION,
    'INVALID_PLANNING_REQUEST_SCHEMA', 'Planning request schema version is unsupported');
  const projectId = validateProjectId(input.projectId);
  const environmentId = validateContextId(input.environmentId, 'environmentId');
  const releaseId = validateContextId(input.releaseId, 'releaseId');
  const knowledgeSnapshot = normalizeSnapshotEnvelope(input.knowledgeSnapshot);
  planInvariant(input.knowledgeSnapshotId === knowledgeSnapshot.snapshotId,
    'SNAPSHOT_BINDING_MISMATCH', 'Planning request snapshot ID does not match immutable envelope');
  planInvariant(input.knowledgeSnapshotDigest === knowledgeSnapshot.digest,
    'SNAPSHOT_BINDING_MISMATCH', 'Planning request snapshot digest does not match immutable envelope');
  planInvariant(projectId === knowledgeSnapshot.projectId
      && environmentId === knowledgeSnapshot.environmentId
      && releaseId === knowledgeSnapshot.releaseId,
    'SNAPSHOT_BINDING_MISMATCH', 'Planning context does not match immutable snapshot context');
  const targetInventory = validateTargetInventory(input.targetInventory);
  planInvariant(projectId === targetInventory.projectId
      && environmentId === targetInventory.environmentId
      && releaseId === targetInventory.releaseId,
    'TARGET_INVENTORY_CONTEXT_MISMATCH', 'Target inventory context does not match planning context');
  const planningPolicy = validatePlanningPolicy(input.planningPolicy);
  const normalized = {
    schemaVersion: TEST_PLANNING_REQUEST_SCHEMA_VERSION,
    projectId,
    environmentId,
    releaseId,
    knowledgeSnapshotId: knowledgeSnapshot.snapshotId,
    knowledgeSnapshotDigest: knowledgeSnapshot.digest,
    knowledgeSnapshot,
    plannerVersion: validateSemver(input.plannerVersion, 'plannerVersion'),
    capabilityCatalogVersion: validateSemver(input.capabilityCatalogVersion, 'capabilityCatalogVersion'),
    capabilityCatalogDigest: validateDigest(input.capabilityCatalogDigest, 'capabilityCatalogDigest'),
    targetInventory,
    planningPolicy,
    createdAt: validateUtcTimestamp(input.createdAt, 'createdAt'),
    createdBy: validateNonEmptyString(input.createdBy, 'createdBy'),
  };
  assertNoSensitivePlanningData({
    targetInventory,
    planningPolicy,
    createdBy: normalized.createdBy,
  }, { path: '$.planningRequest' });
  assertNoSensitivePlanningData(knowledgeSnapshot.snapshot, {
    path: '$.planningRequest.knowledgeSnapshot.snapshot',
    inspectKeys: false,
  });
  const expectedFingerprint = sha256(planningRequestIdentityPayload(normalized));
  if (requireFingerprint) {
    validateDigest(input.inputFingerprint, 'inputFingerprint');
    planInvariant(input.inputFingerprint === expectedFingerprint,
      'PLANNING_FINGERPRINT_MISMATCH', 'Planning request fingerprint does not match canonical input', {
        expectedFingerprint,
        actualFingerprint: input.inputFingerprint,
      });
  }
  return {
    ...normalized,
    inputFingerprint: requireFingerprint ? input.inputFingerprint : expectedFingerprint,
  };
}

export function planningRequestIdentityPayload(request) {
  return canonicalize({
    schemaVersion: request.schemaVersion,
    projectId: request.projectId,
    environmentId: request.environmentId,
    releaseId: request.releaseId,
    knowledgeSnapshotId: request.knowledgeSnapshotId,
    knowledgeSnapshotDigest: request.knowledgeSnapshotDigest,
    plannerVersion: request.plannerVersion,
    capabilityCatalogVersion: request.capabilityCatalogVersion,
    capabilityCatalogDigest: request.capabilityCatalogDigest,
    targetInventory: request.targetInventory,
    planningPolicy: request.planningPolicy,
  });
}

export function createTestIntent(command) {
  const normalized = normalizeIntent({
    ...command,
    schemaVersion: TEST_INTENT_SCHEMA_VERSION,
    intentId: null,
  }, false);
  return { ...normalized, intentId: deriveIntentId(intentIdentityPayload(normalized)) };
}

export function validateTestIntent(input) {
  return normalizeIntent(input, true);
}

function normalizeIntent(input, requireIdentity) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_TEST_INTENT', 'Test intent must be an object');
  assertOnlyFields(input, INTENT_FIELDS, 'INVALID_TEST_INTENT', 'Test intent');
  planInvariant(input.schemaVersion === TEST_INTENT_SCHEMA_VERSION,
    'INVALID_TEST_INTENT_SCHEMA', 'Test intent schema version is unsupported');
  const normalized = {
    schemaVersion: TEST_INTENT_SCHEMA_VERSION,
    planInputFingerprint: validateDigest(input.planInputFingerprint, 'planInputFingerprint'),
    intentKind: validateKind(input.intentKind, 'intentKind'),
    targetId: validateIdentifier(input.targetId, 'targetId'),
    capability: normalizeCapabilityRef(input.capability),
    sourceKnowledge: normalizeKnowledgeRefs(input.sourceKnowledge),
    policyEntryId: validateIdentifier(input.policyEntryId, 'policyEntryId'),
    input: clonePlanningJson(input.input ?? {}),
    assertions: clonePlanningJson(input.assertions ?? {}),
    thresholds: clonePlanningJson(input.thresholds ?? {}),
    dependencies: normalizeStringArray(input.dependencies ?? [], 'dependencies', validateIntentId),
    tags: normalizeStringArray(input.tags ?? [], 'intent.tags', validateKind),
  };
  assertNoSensitivePlanningData({
    input: normalized.input,
    assertions: normalized.assertions,
    thresholds: normalized.thresholds,
  }, { path: '$.intent' });
  assertNoExecutorCode({
    input: normalized.input,
    assertions: normalized.assertions,
    thresholds: normalized.thresholds,
  }, '$.intent');
  const expectedId = deriveIntentId(intentIdentityPayload(normalized));
  if (requireIdentity) {
    validateIntentId(input.intentId);
    planInvariant(input.intentId === expectedId,
      'TEST_INTENT_ID_MISMATCH', 'Test intent ID does not match canonical payload', {
        expectedId,
        actualId: input.intentId,
      });
  }
  return { ...normalized, intentId: requireIdentity ? input.intentId : null };
}

function intentIdentityPayload(intent) {
  return canonicalize({
    planInputFingerprint: intent.planInputFingerprint,
    intentKind: intent.intentKind,
    targetId: intent.targetId,
    capability: intent.capability,
    sourceKnowledge: intent.sourceKnowledge,
    policyEntryId: intent.policyEntryId,
    input: intent.input,
    assertions: intent.assertions,
    thresholds: intent.thresholds,
  });
}

export function createCoverageObligation(command) {
  const normalized = normalizeCoverageObligation({
    ...command,
    schemaVersion: TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION,
    obligationId: null,
  }, false);
  return {
    ...normalized,
    obligationId: deriveCoverageObligationId(coverageObligationIdentityPayload(normalized)),
  };
}

export function validateCoverageObligation(input) {
  return normalizeCoverageObligation(input, true);
}

function normalizeCoverageObligation(input, requireIdentity) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_COVERAGE_OBLIGATION', 'Coverage obligation must be an object');
  assertOnlyFields(input, OBLIGATION_FIELDS,
    'INVALID_COVERAGE_OBLIGATION', 'Coverage obligation');
  planInvariant(input.schemaVersion === TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION,
    'INVALID_COVERAGE_OBLIGATION_SCHEMA', 'Coverage obligation schema version is unsupported');
  planInvariant(typeof input.mandatory === 'boolean',
    'INVALID_COVERAGE_OBLIGATION', 'Coverage obligation mandatory must be boolean');
  planInvariant(COVERAGE_STATUSES.includes(input.status),
    'INVALID_COVERAGE_STATUS', 'Coverage status is invalid', { status: input.status });
  const intentIds = normalizeStringArray(input.intentIds ?? [], 'intentIds', validateIntentId);
  const exemption = input.exemption === undefined ? undefined : normalizeCoverageExemption(input.exemption);
  if (input.status === 'COVERED' || input.status === 'PARTIAL') {
    planInvariant(intentIds.length > 0,
      'INVALID_COVERAGE_STATUS', `${input.status} coverage requires at least one intent`);
    planInvariant(exemption === undefined,
      'INVALID_COVERAGE_STATUS', `${input.status} coverage cannot contain exemption evidence`);
  } else if (input.status === 'UNPLANNED') {
    planInvariant(intentIds.length === 0 && exemption === undefined,
      'INVALID_COVERAGE_STATUS', 'UNPLANNED coverage cannot contain intents or exemption evidence');
  } else {
    planInvariant(intentIds.length === 0 && exemption !== undefined,
      'INVALID_EXEMPTION', 'EXEMPT coverage requires structured exemption evidence and no intents');
  }
  const normalized = compact({
    schemaVersion: TEST_COVERAGE_OBLIGATION_SCHEMA_VERSION,
    planInputFingerprint: validateDigest(input.planInputFingerprint, 'planInputFingerprint'),
    targetId: validateIdentifier(input.targetId, 'targetId'),
    capability: normalizeCapabilityRef(input.capability),
    sourceKnowledge: normalizeKnowledgeRefs(input.sourceKnowledge),
    policyEntryId: validateIdentifier(input.policyEntryId, 'policyEntryId'),
    mandatory: input.mandatory,
    status: input.status,
    intentIds,
    exemption,
  });
  const expectedId = deriveCoverageObligationId(coverageObligationIdentityPayload(normalized));
  if (requireIdentity) {
    validateCoverageObligationId(input.obligationId);
    planInvariant(input.obligationId === expectedId,
      'COVERAGE_OBLIGATION_ID_MISMATCH', 'Coverage obligation ID does not match canonical payload', {
        expectedId,
        actualId: input.obligationId,
      });
  }
  return { ...normalized, obligationId: requireIdentity ? input.obligationId : null };
}

function coverageObligationIdentityPayload(obligation) {
  return canonicalize({
    planInputFingerprint: obligation.planInputFingerprint,
    targetId: obligation.targetId,
    capability: obligation.capability,
    sourceKnowledge: obligation.sourceKnowledge,
    policyEntryId: obligation.policyEntryId,
  });
}

function normalizeCoverageExemption(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_EXEMPTION', 'Coverage exemption must be an object');
  assertOnlyFields(input, new Set(['reason', 'owner']), 'INVALID_EXEMPTION', 'Coverage exemption');
  return {
    reason: validateNonEmptyString(input.reason, 'coverage.exemption.reason'),
    owner: validateNonEmptyString(input.owner, 'coverage.exemption.owner'),
  };
}

export function createProvenanceEntry(command) {
  const normalized = normalizeProvenance({ ...command, provenanceId: null }, false);
  return { ...normalized, provenanceId: deriveProvenanceId(provenanceIdentityPayload(normalized)) };
}

export function validateProvenanceEntry(input) {
  return normalizeProvenance(input, true);
}

function normalizeProvenance(input, requireIdentity) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_PROVENANCE', 'Provenance entry must be an object');
  assertOnlyFields(input, PROVENANCE_FIELDS, 'INVALID_PROVENANCE', 'Provenance entry');
  const normalized = {
    intentId: validateIntentId(input.intentId),
    knowledgeId: validateKnowledgeId(input.knowledgeId),
    knowledgeVersion: validateSemver(input.knowledgeVersion, 'knowledgeVersion'),
    boundaryKey: validateBoundaryKey(input.boundaryKey),
    snapshotId: validateSnapshotId(input.snapshotId),
    snapshotDigest: validateDigest(input.snapshotDigest, 'snapshotDigest'),
    capabilityId: validateIdentifier(input.capabilityId, 'capabilityId'),
    capabilityVersion: validateSemver(input.capabilityVersion, 'capabilityVersion'),
    targetId: validateIdentifier(input.targetId, 'targetId'),
    policyEntryId: validateIdentifier(input.policyEntryId, 'policyEntryId'),
  };
  const expectedId = deriveProvenanceId(provenanceIdentityPayload(normalized));
  if (requireIdentity) {
    validateProvenanceId(input.provenanceId);
    planInvariant(input.provenanceId === expectedId,
      'PROVENANCE_ID_MISMATCH', 'Provenance ID does not match canonical payload', {
        expectedId,
        actualId: input.provenanceId,
      });
  }
  return { ...normalized, provenanceId: requireIdentity ? input.provenanceId : null };
}

function provenanceIdentityPayload(provenance) {
  return canonicalize({
    intentId: provenance.intentId,
    knowledgeId: provenance.knowledgeId,
    knowledgeVersion: provenance.knowledgeVersion,
    boundaryKey: provenance.boundaryKey,
    snapshotId: provenance.snapshotId,
    snapshotDigest: provenance.snapshotDigest,
    capabilityId: provenance.capabilityId,
    capabilityVersion: provenance.capabilityVersion,
    targetId: provenance.targetId,
    policyEntryId: provenance.policyEntryId,
  });
}

export function createTestPlan(command) {
  const request = validatePlanningRequest(command?.planningRequest);
  const intents = normalizeUniqueArray(command?.intents ?? [], validateTestIntent, 'intentId',
    'DUPLICATE_TEST_INTENT').sort((a, b) => a.intentId.localeCompare(b.intentId));
  const obligations = normalizeUniqueArray(command?.coverageObligations ?? [], validateCoverageObligation,
    'obligationId', 'DUPLICATE_COVERAGE_OBLIGATION')
    .sort((a, b) => a.obligationId.localeCompare(b.obligationId));
  const provenance = normalizeUniqueArray(command?.provenance ?? [], validateProvenanceEntry,
    'provenanceId', 'DUPLICATE_PROVENANCE')
    .sort((a, b) => a.provenanceId.localeCompare(b.provenanceId));
  validatePlanBindings(request, intents, obligations, provenance);
  const coverage = { obligations, summary: coverageSummary(obligations) };
  const payload = {
    schemaVersion: TEST_PLAN_SCHEMA_VERSION,
    planId: derivePlanId(request.projectId, request.inputFingerprint),
    projectId: request.projectId,
    environmentId: request.environmentId,
    releaseId: request.releaseId,
    status: 'DRAFT',
    revision: 1,
    inputFingerprint: request.inputFingerprint,
    knowledgeSnapshot: request.knowledgeSnapshot,
    planner: { version: request.plannerVersion },
    capabilityCatalog: {
      version: request.capabilityCatalogVersion,
      digest: request.capabilityCatalogDigest,
    },
    targets: request.targetInventory,
    planningPolicy: request.planningPolicy,
    intents,
    coverage,
    provenance,
    createdAt: request.createdAt,
    createdBy: request.createdBy,
  };
  return { ...payload, digest: sha256(payload) };
}

export function validateTestPlan(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_TEST_PLAN', 'Test plan must be an object');
  const allowed = new Set([
    'schemaVersion', 'planId', 'projectId', 'environmentId', 'releaseId', 'status', 'revision',
    'inputFingerprint', 'knowledgeSnapshot', 'planner', 'capabilityCatalog', 'targets',
    'planningPolicy', 'intents', 'coverage', 'provenance', 'createdAt', 'createdBy', 'digest',
  ]);
  assertOnlyFields(input, allowed, 'INVALID_TEST_PLAN', 'Test plan');
  planInvariant(input.schemaVersion === TEST_PLAN_SCHEMA_VERSION,
    'INVALID_TEST_PLAN_SCHEMA', 'Test plan schema version is unsupported');
  validatePlanId(input.planId);
  planInvariant(TEST_PLAN_STATUSES.includes(input.status),
    'INVALID_TEST_PLAN_STATUS', 'Test plan status is invalid', { status: input.status });
  planInvariant(Number.isSafeInteger(input.revision) && input.revision > 0,
    'INVALID_TEST_PLAN_REVISION', 'Test plan revision must be a positive integer');
  planInvariant(input.status === 'DRAFT' && input.revision === 1,
    'INVALID_TEST_PLAN', 'M2-A only validates initial DRAFT revision 1 plans');
  planInvariant(input.planner && typeof input.planner === 'object' && !Array.isArray(input.planner),
    'INVALID_TEST_PLAN', 'Test plan planner binding is required');
  planInvariant(input.capabilityCatalog && typeof input.capabilityCatalog === 'object'
      && !Array.isArray(input.capabilityCatalog),
    'INVALID_TEST_PLAN', 'Test plan capability catalog binding is required');
  planInvariant(input.coverage && typeof input.coverage === 'object' && !Array.isArray(input.coverage),
    'INVALID_TEST_PLAN', 'Test plan coverage is required');
  const request = validatePlanningRequest({
    schemaVersion: TEST_PLANNING_REQUEST_SCHEMA_VERSION,
    inputFingerprint: input.inputFingerprint,
    projectId: input.projectId,
    environmentId: input.environmentId,
    releaseId: input.releaseId,
    knowledgeSnapshotId: input.knowledgeSnapshot?.snapshotId,
    knowledgeSnapshotDigest: input.knowledgeSnapshot?.digest,
    knowledgeSnapshot: input.knowledgeSnapshot,
    plannerVersion: input.planner.version,
    capabilityCatalogVersion: input.capabilityCatalog.version,
    capabilityCatalogDigest: input.capabilityCatalog.digest,
    targetInventory: input.targets,
    planningPolicy: input.planningPolicy,
    createdAt: input.createdAt,
    createdBy: input.createdBy,
  });
  const recreated = createTestPlan({
    planningRequest: request,
    intents: input.intents,
    coverageObligations: input.coverage.obligations,
    provenance: input.provenance,
  });
  planInvariant(input.planId === recreated.planId,
    'PLAN_ID_MISMATCH', 'Test plan ID does not match planning input', {
      expectedId: recreated.planId,
      actualId: input.planId,
    });
  planInvariant(JSON.stringify(input.coverage.summary) === JSON.stringify(recreated.coverage.summary),
    'COVERAGE_SUMMARY_MISMATCH', 'Coverage summary does not match obligations');
  validateDigest(input.digest, 'plan.digest');
  planInvariant(input.digest === recreated.digest,
    'TEST_PLAN_DIGEST_MISMATCH', 'Test plan digest does not match canonical payload', {
      expectedDigest: recreated.digest,
      actualDigest: input.digest,
    });
  return clonePlanningJson(recreated);
}

function validatePlanBindings(request, intents, obligations, provenance) {
  const targets = new Set(request.targetInventory.targets.map((target) => target.targetId));
  const policyEntries = new Map(request.planningPolicy.entries.map((entry) => [entry.policyEntryId, entry]));
  const knowledge = new Map(request.knowledgeSnapshot.snapshot.rules.map((rule) => [
    `${rule.id}@${rule.version}`,
    rule,
  ]));
  const intentMap = new Map(intents.map((intent) => [intent.intentId, intent]));
  for (const intent of intents) {
    planInvariant(intent.planInputFingerprint === request.inputFingerprint,
      'PLAN_INPUT_BINDING_MISMATCH', 'Intent is bound to a different planning input');
    planInvariant(targets.has(intent.targetId),
      'UNKNOWN_TEST_TARGET', 'Intent references a target outside the inventory', { targetId: intent.targetId });
    planInvariant(policyEntries.has(intent.policyEntryId),
      'UNKNOWN_POLICY_ENTRY', 'Intent references an unknown planning policy entry');
    validateKnowledgeRefsAgainstSnapshot(intent.sourceKnowledge, request, knowledge);
    for (const dependency of intent.dependencies) {
      planInvariant(intentMap.has(dependency),
        'UNKNOWN_INTENT_DEPENDENCY', 'Intent dependency does not exist', { dependency });
      planInvariant(dependency !== intent.intentId,
        'SELF_INTENT_DEPENDENCY', 'Intent cannot depend on itself', { intentId: intent.intentId });
    }
  }
  for (const obligation of obligations) {
    planInvariant(obligation.planInputFingerprint === request.inputFingerprint,
      'PLAN_INPUT_BINDING_MISMATCH', 'Coverage obligation is bound to a different planning input');
    planInvariant(targets.has(obligation.targetId),
      'UNKNOWN_TEST_TARGET', 'Coverage obligation references a target outside the inventory');
    planInvariant(policyEntries.has(obligation.policyEntryId),
      'UNKNOWN_POLICY_ENTRY', 'Coverage obligation references an unknown planning policy entry');
    validateKnowledgeRefsAgainstSnapshot(obligation.sourceKnowledge, request, knowledge);
    for (const intentId of obligation.intentIds) {
      const intent = intentMap.get(intentId);
      planInvariant(intent,
        'UNKNOWN_COVERAGE_INTENT', 'Coverage obligation references an unknown intent', { intentId });
      planInvariant(intent.targetId === obligation.targetId
          && capabilityKey(intent.capability) === capabilityKey(obligation.capability),
        'COVERAGE_INTENT_BINDING_MISMATCH', 'Coverage intent does not match obligation target or capability');
    }
  }
  const provenanceKeys = new Set(provenance.map((item) => provenanceBindingKey(item)));
  for (const item of provenance) {
    const intent = intentMap.get(item.intentId);
    planInvariant(intent, 'UNKNOWN_PROVENANCE_INTENT', 'Provenance references an unknown intent');
    planInvariant(item.snapshotId === request.knowledgeSnapshotId
        && item.snapshotDigest === request.knowledgeSnapshotDigest,
      'PROVENANCE_SNAPSHOT_MISMATCH', 'Provenance snapshot binding does not match planning request');
    planInvariant(item.targetId === intent.targetId
        && item.capabilityId === intent.capability.capabilityId
        && item.capabilityVersion === intent.capability.version
        && item.policyEntryId === intent.policyEntryId,
      'PROVENANCE_INTENT_MISMATCH', 'Provenance does not match the referenced intent');
    validateKnowledgeRefsAgainstSnapshot([{
      knowledgeId: item.knowledgeId,
      version: item.knowledgeVersion,
      boundaryKey: item.boundaryKey,
      snapshotId: item.snapshotId,
      snapshotDigest: item.snapshotDigest,
    }], request, knowledge);
  }
  for (const intent of intents) {
    for (const source of intent.sourceKnowledge) {
      const expected = provenanceBindingKey({
        intentId: intent.intentId,
        knowledgeId: source.knowledgeId,
        knowledgeVersion: source.version,
        boundaryKey: source.boundaryKey,
        snapshotId: source.snapshotId,
        snapshotDigest: source.snapshotDigest,
        capabilityId: intent.capability.capabilityId,
        capabilityVersion: intent.capability.version,
        targetId: intent.targetId,
        policyEntryId: intent.policyEntryId,
      });
      planInvariant(provenanceKeys.has(expected),
        'MISSING_PROVENANCE', 'Every intent source must have exact provenance', {
          intentId: intent.intentId,
          knowledgeId: source.knowledgeId,
        });
    }
  }
}

function validateKnowledgeRefsAgainstSnapshot(refs, request, knowledge) {
  for (const ref of refs) {
    planInvariant(ref.snapshotId === request.knowledgeSnapshotId
        && ref.snapshotDigest === request.knowledgeSnapshotDigest,
      'SNAPSHOT_BINDING_MISMATCH', 'Knowledge reference snapshot binding is invalid');
    const rule = knowledge.get(`${ref.knowledgeId}@${ref.version}`);
    planInvariant(rule && rule.boundaryKey === ref.boundaryKey && rule.status === 'PUBLISHED',
      'UNPUBLISHED_KNOWLEDGE', 'Knowledge reference is not a published rule in the immutable snapshot', {
        knowledgeId: ref.knowledgeId,
        version: ref.version,
      });
  }
}

function normalizeSnapshotEnvelope(input) {
  try {
    const envelope = validateSnapshotEnvelope(input);
    planInvariant(envelope.snapshot.rules.length > 0,
      'INVALID_KNOWLEDGE_SNAPSHOT', 'Planning snapshot must contain at least one published rule');
    for (const rule of envelope.snapshot.rules) {
      planInvariant(rule && typeof rule === 'object' && !Array.isArray(rule),
        'INVALID_KNOWLEDGE_SNAPSHOT', 'Snapshot rule must be an object');
      validateKnowledgeId(rule.id);
      validateSemver(rule.version, 'knowledge.version');
      validateBoundaryKey(rule.boundaryKey);
      planInvariant(rule.status === 'PUBLISHED',
        'UNPUBLISHED_KNOWLEDGE', 'Planning snapshot can contain only PUBLISHED knowledge', {
          knowledgeId: rule.id,
          version: rule.version,
          status: rule.status,
        });
    }
    return clonePlanningJson(envelope);
  } catch (error) {
    if (error instanceof TestPlanError) throw error;
    throw new TestPlanError('INVALID_KNOWLEDGE_SNAPSHOT', 'Immutable knowledge snapshot is invalid', {
      causeCode: error?.code,
    });
  }
}

function normalizeKnowledgeRefs(input) {
  planInvariant(Array.isArray(input) && input.length > 0,
    'INVALID_KNOWLEDGE_REFERENCE', 'At least one source knowledge reference is required');
  const refs = input.map((ref) => {
    planInvariant(ref && typeof ref === 'object' && !Array.isArray(ref),
      'INVALID_KNOWLEDGE_REFERENCE', 'Knowledge reference must be an object');
    assertOnlyFields(ref, new Set([
      'knowledgeId', 'version', 'boundaryKey', 'snapshotId', 'snapshotDigest',
    ]), 'INVALID_KNOWLEDGE_REFERENCE', 'Knowledge reference');
    return {
      knowledgeId: validateKnowledgeId(ref.knowledgeId),
      version: validateSemver(ref.version, 'knowledge.version'),
      boundaryKey: validateBoundaryKey(ref.boundaryKey),
      snapshotId: validateSnapshotId(ref.snapshotId),
      snapshotDigest: validateDigest(ref.snapshotDigest, 'snapshotDigest'),
    };
  }).sort(compareKnowledgeRef);
  assertUnique(refs.map((ref) => `${ref.knowledgeId}@${ref.version}`),
    'DUPLICATE_KNOWLEDGE_REFERENCE', 'Knowledge references must be unique');
  return refs;
}

function normalizeCapabilityRef(input) {
  planInvariant(input && typeof input === 'object' && !Array.isArray(input),
    'INVALID_CAPABILITY_REFERENCE', 'Capability reference must be an object');
  assertOnlyFields(input, CAPABILITY_REF_FIELDS,
    'INVALID_CAPABILITY_REFERENCE', 'Capability reference');
  return {
    capabilityId: validateIdentifier(input.capabilityId, 'capabilityId'),
    version: validateSemver(input.version, 'capability.version'),
  };
}

function coverageSummary(obligations) {
  const summary = {
    total: obligations.length,
    mandatory: obligations.filter((item) => item.mandatory).length,
    covered: 0,
    partial: 0,
    unplanned: 0,
    exempt: 0,
  };
  for (const obligation of obligations) {
    summary[obligation.status.toLowerCase()] += 1;
  }
  return summary;
}

function provenanceBindingKey(item) {
  return [
    item.intentId,
    item.knowledgeId,
    item.knowledgeVersion,
    item.boundaryKey,
    item.snapshotId,
    item.snapshotDigest,
    item.capabilityId,
    item.capabilityVersion,
    item.targetId,
    item.policyEntryId,
  ].join('|');
}

function compareKnowledgeRef(left, right) {
  return left.knowledgeId.localeCompare(right.knowledgeId)
    || left.version.localeCompare(right.version)
    || left.boundaryKey.localeCompare(right.boundaryKey);
}

function compareCapabilityRef(left, right) {
  return left.capabilityId.localeCompare(right.capabilityId) || left.version.localeCompare(right.version);
}

function capabilityKey(ref) {
  return `${ref.capabilityId}@${ref.version}`;
}

function validateKnowledgeId(input) {
  planInvariant(typeof input === 'string' && KNOWLEDGE_ID_PATTERN.test(input),
    'INVALID_KNOWLEDGE_ID', 'Knowledge ID is invalid', { knowledgeId: input });
  return input;
}

function validateBoundaryKey(input) {
  planInvariant(typeof input === 'string' && BOUNDARY_KEY_PATTERN.test(input),
    'INVALID_BOUNDARY_KEY', 'Knowledge boundary key is invalid', { boundaryKey: input });
  return input;
}

function validateSnapshotId(input) {
  planInvariant(typeof input === 'string' && SNAPSHOT_ID_PATTERN.test(input),
    'INVALID_SNAPSHOT_ID', 'Snapshot ID is invalid', { snapshotId: input });
  return input;
}

function normalizeStringArray(input, field, validator) {
  planInvariant(Array.isArray(input),
    'INVALID_PLANNING_FIELD', `${field} must be an array`, { field });
  const output = input.map((item) => validator(item, field)).sort();
  assertUnique(output, 'DUPLICATE_PLANNING_VALUE', `${field} must contain unique values`);
  return output;
}

function normalizeUniqueArray(input, validator, identityField, code) {
  planInvariant(Array.isArray(input), 'INVALID_TEST_PLAN', `${identityField} collection must be an array`);
  const output = input.map(validator);
  assertUnique(output.map((item) => item[identityField]), code, `${identityField} values must be unique`);
  return output;
}

function assertOnlyFields(input, allowed, code, label) {
  const unknownFields = Object.keys(input).filter((field) => !allowed.has(field));
  if (unknownFields.some((field) => {
    const normalized = field.toLowerCase().replace(/[^a-z0-9]/g, '');
    return ['script', 'k6script', 'playwrightscript', 'sqlscript', 'executorcode', 'runtimecommand'].includes(normalized);
  })) {
    throw new TestPlanError('EXECUTOR_SCRIPT_FORBIDDEN', `${label} cannot contain executor code`, {
      unknownFields,
    });
  }
  planInvariant(unknownFields.length === 0, code, `${label} contains unsupported fields`, { unknownFields });
}

function assertUnique(values, code, message) {
  planInvariant(new Set(values).size === values.length, code, message);
}

function compact(value) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}
