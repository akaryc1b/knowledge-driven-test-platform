import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import { createSnapshotEnvelope } from '@kdtp/knowledge-governance';
import {
  CAPABILITY_CONTRACT_SCHEMA_VERSION,
  InMemoryCapabilityCatalog,
  createBaseCapabilityCatalog,
  createCapability,
  createCapabilityCatalog,
} from '@kdtp/test-capability';
import {
  createPlanningExemption,
  createPlanningRequest,
  createTargetInventory,
} from '@kdtp/test-plan';
import { DeterministicTestPlanner } from '../src/index.js';

export const CREATED_AT = '2026-07-27T17:00:00.000Z';
export const PROJECT_ID = 'approval-platform';
export const ENVIRONMENT_ID = 'staging';
export const RELEASE_ID = 'R2';

export function knowledgeRule(overrides = {}) {
  return {
    schemaVersion: 'knowledge-rule/v1',
    id: 'PROJECT-APPROVAL-001',
    boundaryKey: 'workflow.approval-submit',
    name: 'Approval submission must be validated',
    version: '1.0.0',
    status: 'PUBLISHED',
    scope: { level: 'PROJECT', key: PROJECT_ID },
    enforcement: 'mandatory',
    overridePolicy: 'deny',
    enabled: true,
    value: { operationId: 'submitApproval' },
    owner: 'approval-quality-team',
    source: 'M2-C planner fixture',
    riskLevel: 'high',
    tags: ['workflow', 'api'],
    ...overrides,
  };
}

export function snapshotEnvelope(rules = [knowledgeRule()]) {
  const snapshot = buildKnowledgeSnapshot({
    context: {
      globalId: 'company',
      projectId: PROJECT_ID,
      environmentId: ENVIRONMENT_ID,
      releaseId: RELEASE_ID,
      domainPacks: ['approval-workflow'],
    },
    rules,
    resolution: rules.map((rule) => ({ boundaryKey: rule.boundaryKey, sourceRuleId: rule.id })),
  });
  return createSnapshotEnvelope({
    projectId: PROJECT_ID,
    snapshot,
    actor: 'snapshot-publisher',
    at: CREATED_AT,
    reason: 'M2-C deterministic planner fixture',
  });
}

export function inventory(targets = [apiTarget()]) {
  return createTargetInventory({
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    releaseId: RELEASE_ID,
    targets,
  });
}

export function apiTarget(overrides = {}) {
  return {
    targetId: 'api:approval-submit',
    kind: 'api',
    name: 'Submit approval API',
    locator: 'POST /v1/approvals',
    tags: ['approval', 'critical'],
    attributes: { operationId: 'submitApproval' },
    ...overrides,
  };
}

export function policyEntry(overrides = {}) {
  return {
    policyEntryId: 'policy-entry:approval-api',
    priority: 10,
    selectors: {
      knowledgeIds: ['PROJECT-APPROVAL-001'],
      targetKinds: ['api'],
    },
    capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
    mandatory: true,
    ...overrides,
  };
}

export function policy(entries = [policyEntry()], exemptions = []) {
  return {
    policyId: 'policy:release-quality',
    version: '1.0.0',
    entries,
    exemptions,
  };
}

export function request({
  catalog = createBaseCapabilityCatalog('1.0.0'),
  envelope = snapshotEnvelope(),
  targetInventory = inventory(),
  planningPolicy = policy(),
} = {}) {
  return createPlanningRequest({
    projectId: PROJECT_ID,
    environmentId: ENVIRONMENT_ID,
    releaseId: RELEASE_ID,
    knowledgeSnapshotId: envelope.snapshotId,
    knowledgeSnapshotDigest: envelope.digest,
    knowledgeSnapshot: envelope,
    plannerVersion: '1.0.0',
    capabilityCatalogVersion: catalog.version,
    capabilityCatalogDigest: catalog.digest,
    targetInventory,
    planningPolicy,
    createdAt: CREATED_AT,
    createdBy: 'planner-service',
  });
}

export function planner(catalog, strategy) {
  return new DeterministicTestPlanner({
    capabilityCatalogPort: new InMemoryCapabilityCatalog(catalog),
    ...(strategy ? { strategy } : {}),
  });
}

export function emptyContract(additionalProperties = false) {
  return {
    schemaVersion: CAPABILITY_CONTRACT_SCHEMA_VERSION,
    fields: [],
    additionalProperties,
  };
}

export function capability(overrides = {}) {
  const capabilityId = overrides.capabilityId ?? 'api-functional';
  return createCapability({
    capabilityId,
    version: overrides.version ?? '1.0.0',
    name: overrides.name ?? `${capabilityId} capability`,
    targetKinds: overrides.targetKinds ?? ['api'],
    intentKind: overrides.intentKind ?? capabilityId,
    inputContract: overrides.inputContract ?? emptyContract(),
    assertionContract: overrides.assertionContract ?? emptyContract(),
    thresholdContract: overrides.thresholdContract ?? emptyContract(),
    dependencyRules: overrides.dependencyRules ?? [],
    enabled: overrides.enabled ?? true,
    source: { kind: 'built-in', reference: 'M2-C test' },
    tags: overrides.tags ?? ['test'],
  });
}

export function catalog(capabilities) {
  return createCapabilityCatalog({ version: '1.0.0', capabilities });
}

export function exemption(overrides = {}) {
  return createPlanningExemption({
    knowledgeId: 'PROJECT-APPROVAL-001',
    knowledgeVersion: '1.0.0',
    targetId: 'api:approval-submit',
    capabilityId: 'api-functional',
    capabilityVersion: '1.0.0',
    reason: 'Explicitly accepted by the release quality owner',
    owner: 'release-quality-owner',
    ...overrides,
  });
}
