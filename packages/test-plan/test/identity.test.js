import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TestPlanError,
  createPlanningRequest,
  createTargetInventory,
  createTestIntent,
  validatePlanningRequest,
  validateTargetInventory,
  validateTestIntent,
} from '../src/index.js';
import {
  planningPolicy,
  planningRequest,
  snapshotEnvelope,
  sourceKnowledge,
  targetInventory,
} from './test-helpers.js';

test('target inventory identity is stable across target and tag ordering', () => {
  const first = createTargetInventory({
    projectId: 'approval-platform', environmentId: 'staging', releaseId: 'R2',
    targets: [
      { targetId: 'web:approval', kind: 'web-ui', name: 'Approval page', tags: ['ui', 'critical'] },
      { targetId: 'api:approval', kind: 'api', name: 'Approval API', tags: ['critical', 'api'] },
    ],
  });
  const second = createTargetInventory({
    projectId: 'approval-platform', environmentId: 'staging', releaseId: 'R2',
    targets: [
      { name: 'Approval API', tags: ['api', 'critical'], kind: 'api', targetId: 'api:approval' },
      { tags: ['critical', 'ui'], targetId: 'web:approval', name: 'Approval page', kind: 'web-ui' },
    ],
  });
  assert.deepEqual(first, second);
  assert.match(first.inventoryId, /^target-inventory-approval-platform-[a-f0-9]{12}$/);
});

test('planning request fingerprint and plan ID inputs are stable for semantically equal input', () => {
  const request = planningRequest();
  const reordered = createPlanningRequest({
    ...request,
    targetInventory: createTargetInventory({
      projectId: request.projectId,
      environmentId: request.environmentId,
      releaseId: request.releaseId,
      targets: request.targetInventory.targets.map((target) => ({
        ...target,
        tags: [...target.tags].reverse(),
      })),
    }),
    planningPolicy: {
      ...request.planningPolicy,
      entries: request.planningPolicy.entries.map((entry) => ({
        ...entry,
        capabilityRefs: [...entry.capabilityRefs].reverse(),
        selectors: { ...entry.selectors, targetKinds: [...entry.selectors.targetKinds].reverse() },
      })),
    },
  });
  assert.equal(reordered.inputFingerprint, request.inputFingerprint);
});

test('every immutable binding affects the planning fingerprint', () => {
  const base = planningRequest();
  const mutations = [
    { plannerVersion: '1.0.1' },
    { capabilityCatalogVersion: '1.0.1' },
    { capabilityCatalogDigest: '1'.repeat(64) },
    { targetInventory: targetInventory({ targets: [{ targetId: 'api:other', kind: 'api', name: 'Other API' }] }) },
    { planningPolicy: planningPolicy({ version: '1.0.1' }) },
  ];
  for (const mutation of mutations) {
    const changed = createPlanningRequest({ ...base, ...mutation });
    assert.notEqual(changed.inputFingerprint, base.inputFingerprint);
  }
});

test('planning constructors defensive-copy inputs and validators detect tampering', () => {
  const envelope = snapshotEnvelope();
  const inventory = targetInventory();
  const policy = planningPolicy();
  const request = planningRequest({ knowledgeSnapshot: envelope, targetInventory: inventory, planningPolicy: policy });
  envelope.snapshot.rules[0].value.allowedFrom.push('APPROVED');
  inventory.targets[0].attributes.operationId = 'mutated';
  policy.entries[0].mandatory = false;
  assert.deepEqual(request.knowledgeSnapshot.snapshot.rules[0].value.allowedFrom, ['DRAFT']);
  assert.equal(request.targetInventory.targets[0].attributes.operationId, 'submitApproval');
  assert.equal(request.planningPolicy.entries[0].mandatory, true);

  const tampered = structuredClone(request);
  tampered.plannerVersion = '1.0.1';
  assert.throws(() => validatePlanningRequest(tampered), (error) => {
    assert.ok(error instanceof TestPlanError);
    assert.equal(error.code, 'PLANNING_FINGERPRINT_MISMATCH');
    return true;
  });
});

test('intent identity is deterministic and excludes presentation-only tag order', () => {
  const request = planningRequest();
  const base = {
    planInputFingerprint: request.inputFingerprint,
    intentKind: 'api-functional',
    targetId: 'api:approval-submit',
    capability: { capabilityId: 'api-functional', version: '1.0.0' },
    sourceKnowledge: sourceKnowledge(request),
    policyEntryId: 'policy-entry:approval-api',
    input: { payloadProfile: 'valid', operation: 'submit' },
    assertions: { statusCode: 201 },
    thresholds: {},
    dependencies: [],
  };
  const first = createTestIntent({ ...base, tags: ['mandatory', 'smoke'] });
  const second = createTestIntent({ ...base, tags: ['smoke', 'mandatory'] });
  assert.equal(first.intentId, second.intentId);
  assert.deepEqual(first, second);
  assert.deepEqual(validateTestIntent(first), first);
});

test('target inventory identity tampering is rejected with a stable code', () => {
  const inventory = targetInventory();
  inventory.targets[0].name = 'Changed';
  assert.throws(() => validateTargetInventory(inventory), (error) => {
    assert.equal(error.code, 'TARGET_INVENTORY_ID_MISMATCH');
    return true;
  });
});
