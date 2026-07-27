import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TestPlanError,
  createCoverageObligation,
  createPlanningRequest,
  createProvenanceEntry,
  createTargetInventory,
  createTestIntent,
  createTestPlan,
  validateTestPlan,
} from '../src/index.js';
import {
  completePlan,
  planningPolicy,
  planningRequest,
  snapshotEnvelope,
  sourceKnowledge,
  targetInventory,
} from './test-helpers.js';

function assertCode(code) {
  return (error) => {
    assert.ok(error instanceof TestPlanError);
    assert.equal(error.code, code);
    return true;
  };
}

test('planning rejects unpublished knowledge even inside a valid immutable envelope', () => {
  const envelope = snapshotEnvelope();
  envelope.snapshot.rules[0].status = 'DRAFT';
  assert.throws(() => planningRequest({ knowledgeSnapshot: envelope }), assertCode('INVALID_KNOWLEDGE_SNAPSHOT'));
});

test('planning requires snapshot ID and digest to match the immutable envelope', () => {
  const envelope = snapshotEnvelope();
  assert.throws(() => createPlanningRequest({
    ...planningRequest(),
    knowledgeSnapshot: envelope,
    knowledgeSnapshotId: 'kb-approval-platform-000000000000',
  }), assertCode('SNAPSHOT_BINDING_MISMATCH'));
  assert.throws(() => createPlanningRequest({
    ...planningRequest(),
    knowledgeSnapshot: envelope,
    knowledgeSnapshotDigest: '0'.repeat(64),
  }), assertCode('SNAPSHOT_BINDING_MISMATCH'));
});

test('planning rejects secret-bearing fields and credential URI values', () => {
  assert.throws(() => createTargetInventory({
    projectId: 'approval-platform', environmentId: 'staging', releaseId: 'R2',
    targets: [{ targetId: 'api:secret', kind: 'api', name: 'Secret API', attributes: { token: 'not-allowed' } }],
  }), assertCode('SENSITIVE_PLANNING_DATA'));
  assert.throws(() => createTargetInventory({
    projectId: 'approval-platform', environmentId: 'staging', releaseId: 'R2',
    targets: [{ targetId: 'db:registry', kind: 'database', name: 'Registry', locator: 'postgresql://user:pass@db/kdtp' }],
  }), assertCode('SENSITIVE_PLANNING_DATA'));
});

test('test intents reject executor scripts while allowing declarative assertions', () => {
  const request = planningRequest();
  const command = {
    planInputFingerprint: request.inputFingerprint,
    intentKind: 'api-functional',
    targetId: 'api:approval-submit',
    capability: { capabilityId: 'api-functional', version: '1.0.0' },
    sourceKnowledge: sourceKnowledge(request),
    policyEntryId: 'policy-entry:approval-api',
    input: { operationId: 'submitApproval' },
    assertions: { statusCode: 201 },
  };
  assert.doesNotThrow(() => createTestIntent(command));
  assert.throws(() => createTestIntent({ ...command, input: { k6Script: 'export default function(){}' } }),
    assertCode('EXECUTOR_SCRIPT_FORBIDDEN'));
});

test('EXEMPT coverage requires structured reason and owner', () => {
  const request = planningRequest();
  const base = {
    planInputFingerprint: request.inputFingerprint,
    targetId: 'api:approval-submit',
    capability: { capabilityId: 'api-functional', version: '1.0.0' },
    sourceKnowledge: sourceKnowledge(request),
    policyEntryId: 'policy-entry:approval-api',
    mandatory: false,
    status: 'EXEMPT',
    intentIds: [],
  };
  assert.throws(() => createCoverageObligation(base), assertCode('INVALID_EXEMPTION'));
  const obligation = createCoverageObligation({ ...base, exemption: { reason: 'Not applicable', owner: 'quality-owner' } });
  assert.equal(obligation.status, 'EXEMPT');
  assert.deepEqual(obligation.exemption, { reason: 'Not applicable', owner: 'quality-owner' });
});

test('test plan aggregates coverage, provenance and immutable bindings', () => {
  const plan = completePlan();
  assert.match(plan.planId, /^tp-approval-platform-[a-f0-9]{12}$/);
  assert.equal(plan.status, 'DRAFT');
  assert.equal(plan.revision, 1);
  assert.deepEqual(plan.coverage.summary, {
    total: 1, mandatory: 1, covered: 1, partial: 0, unplanned: 0, exempt: 0,
  });
  assert.equal(plan.provenance.length, 1);
  assert.equal(plan.knowledgeSnapshot.snapshotId, plan.provenance[0].snapshotId);
  assert.deepEqual(validateTestPlan(plan), plan);
});

test('test plan construction is deterministic across collection ordering', () => {
  const request = planningRequest();
  const sources = sourceKnowledge(request);
  const makeIntent = (targetId, policyEntryId) => createTestIntent({
    planInputFingerprint: request.inputFingerprint,
    intentKind: 'api-functional', targetId,
    capability: { capabilityId: 'api-functional', version: '1.0.0' },
    sourceKnowledge: sources, policyEntryId,
    input: { operation: targetId }, assertions: { statusCode: 200 }, thresholds: {}, dependencies: [], tags: [],
  });
  const inventory = createTargetInventory({
    projectId: request.projectId, environmentId: request.environmentId, releaseId: request.releaseId,
    targets: [
      { targetId: 'api:first', kind: 'api', name: 'First API' },
      { targetId: 'api:second', kind: 'api', name: 'Second API' },
    ],
  });
  const policy = planningPolicy({ entries: [
    { policyEntryId: 'policy-entry:first', priority: 1, selectors: { targetIds: ['api:first'] }, capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }], mandatory: true },
    { policyEntryId: 'policy-entry:second', priority: 2, selectors: { targetIds: ['api:second'] }, capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }], mandatory: true },
  ] });
  const updatedRequest = createPlanningRequest({ ...request, targetInventory: inventory, planningPolicy: policy });
  const first = makeIntent('api:first', 'policy-entry:first');
  const second = makeIntent('api:second', 'policy-entry:second');
  // Rebind to the updated request fingerprint.
  const intents = [first, second].map((intent) => createTestIntent({ ...intent, planInputFingerprint: updatedRequest.inputFingerprint }));
  const obligations = intents.map((intent) => createCoverageObligation({
    planInputFingerprint: updatedRequest.inputFingerprint, targetId: intent.targetId,
    capability: intent.capability, sourceKnowledge: intent.sourceKnowledge, policyEntryId: intent.policyEntryId,
    mandatory: true, status: 'COVERED', intentIds: [intent.intentId],
  }));
  const provenance = intents.flatMap((intent) => sources.map((source) => createProvenanceEntry({
    intentId: intent.intentId, knowledgeId: source.knowledgeId, knowledgeVersion: source.version,
    boundaryKey: source.boundaryKey, snapshotId: source.snapshotId, snapshotDigest: source.snapshotDigest,
    capabilityId: intent.capability.capabilityId, capabilityVersion: intent.capability.version,
    targetId: intent.targetId, policyEntryId: intent.policyEntryId,
  })));
  const a = createTestPlan({ planningRequest: updatedRequest, intents, coverageObligations: obligations, provenance });
  const b = createTestPlan({ planningRequest: updatedRequest, intents: [...intents].reverse(), coverageObligations: [...obligations].reverse(), provenance: [...provenance].reverse() });
  assert.deepEqual(a, b);
});

test('plan rejects missing provenance and unknown targets with stable errors', () => {
  const request = planningRequest();
  const intent = createTestIntent({
    planInputFingerprint: request.inputFingerprint, intentKind: 'api-functional',
    targetId: 'api:approval-submit', capability: { capabilityId: 'api-functional', version: '1.0.0' },
    sourceKnowledge: sourceKnowledge(request), policyEntryId: 'policy-entry:approval-api',
    input: {}, assertions: {}, thresholds: {}, dependencies: [], tags: [],
  });
  const obligation = createCoverageObligation({
    planInputFingerprint: request.inputFingerprint, targetId: intent.targetId, capability: intent.capability,
    sourceKnowledge: intent.sourceKnowledge, policyEntryId: intent.policyEntryId,
    mandatory: true, status: 'COVERED', intentIds: [intent.intentId],
  });
  assert.throws(() => createTestPlan({ planningRequest: request, intents: [intent], coverageObligations: [obligation], provenance: [] }), assertCode('MISSING_PROVENANCE'));
  const unknown = createTestIntent({ ...intent, targetId: 'api:missing' });
  assert.throws(() => createTestPlan({ planningRequest: request, intents: [unknown], coverageObligations: [], provenance: [] }), assertCode('UNKNOWN_TEST_TARGET'));
});

test('plan digest and coverage summary tampering are detected', () => {
  const plan = completePlan();
  const digestTampered = structuredClone(plan);
  digestTampered.createdBy = 'other-actor';
  assert.throws(() => validateTestPlan(digestTampered), assertCode('TEST_PLAN_DIGEST_MISMATCH'));
  const coverageTampered = structuredClone(plan);
  coverageTampered.coverage.summary.covered = 0;
  assert.throws(() => validateTestPlan(coverageTampered), assertCode('COVERAGE_SUMMARY_MISMATCH'));
});
