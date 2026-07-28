import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TestPlannerError,
  validatePlanningResult,
} from '../src/index.js';
import {
  apiTarget,
  capability,
  catalog,
  emptyContract,
  exemption,
  inventory,
  knowledgeRule,
  planner,
  policy,
  policyEntry,
  request,
  snapshotEnvelope,
} from './test-helpers.js';

function assertCode(code) {
  return (error) => error instanceof TestPlannerError && error.code === code;
}

test('planner creates a stable plan, coverage, provenance and dependency DAG', async () => {
  const capabilityCatalog = catalog([capability()]);
  const result = await planner(capabilityCatalog).plan({ planningRequest: request({ catalog: capabilityCatalog }) });
  assert.equal(result.plan.coverage.summary.covered, 1);
  assert.equal(result.plan.intents.length, 1);
  assert.equal(result.plan.provenance.length, 1);
  assert.deepEqual(result.dependencyDag.topologicalOrder, [result.plan.intents[0].intentId]);
  assert.equal(result.coverageMatrix.cells[0].status, 'COVERED');
  assert.equal(result.unsupportedObligations.length, 0);
  assert.deepEqual(validatePlanningResult(result), result);
});

test('equivalent input ordering produces byte-stable planning results', async () => {
  const firstCapability = capability({ capabilityId: 'api-performance' });
  const secondCapability = capability({ capabilityId: 'api-functional' });
  const leftCatalog = catalog([firstCapability, secondCapability]);
  const rightCatalog = catalog([secondCapability, firstCapability]);
  const entries = [
    policyEntry({
      policyEntryId: 'policy-entry:functional', priority: 20,
      capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
    }),
    policyEntry({
      policyEntryId: 'policy-entry:performance', priority: 10,
      capabilityRefs: [{ capabilityId: 'api-performance', version: '1.0.0' }],
    }),
  ];
  const leftRequest = request({ catalog: leftCatalog, planningPolicy: policy(entries) });
  const rightRequest = request({ catalog: rightCatalog, planningPolicy: policy([...entries].reverse()) });
  const left = await planner(leftCatalog).plan(leftRequest);
  const right = await planner(rightCatalog).plan(rightRequest);
  assert.deepEqual(left, right);
  assert.match(left.plan.planId, /^tp-approval-platform-[a-f0-9]{12}$/);
});

test('disabled and incompatible capabilities remain explicit UNPLANNED obligations', async () => {
  const disabledCatalog = catalog([capability({ enabled: false })]);
  const disabled = await planner(disabledCatalog).plan(request({ catalog: disabledCatalog }));
  assert.equal(disabled.plan.coverage.summary.unplanned, 1);
  assert.equal(disabled.unsupportedObligations[0].code, 'CAPABILITY_DISABLED');

  const incompatibleCatalog = catalog([capability({ capabilityId: 'database', targetKinds: ['database'] })]);
  const incompatiblePolicy = policy([policyEntry({
    capabilityRefs: [{ capabilityId: 'database', version: '1.0.0' }],
  })]);
  const incompatible = await planner(incompatibleCatalog).plan(request({
    catalog: incompatibleCatalog,
    planningPolicy: incompatiblePolicy,
  }));
  assert.equal(incompatible.plan.coverage.summary.unplanned, 1);
  assert.equal(incompatible.unsupportedObligations[0].code, 'CAPABILITY_TARGET_KIND_MISMATCH');
});

test('EXEMPT requires and preserves exact structured policy evidence', async () => {
  const capabilityCatalog = catalog([capability()]);
  const result = await planner(capabilityCatalog).plan(request({
    catalog: capabilityCatalog,
    planningPolicy: policy([policyEntry()], [exemption()]),
  }));
  assert.equal(result.plan.coverage.summary.exempt, 1);
  assert.deepEqual(result.plan.coverage.obligations[0].exemption, {
    owner: 'release-quality-owner',
    reason: 'Explicitly accepted by the release quality owner',
  });
  assert.equal(result.plan.intents.length, 0);
});

test('required capability dependencies produce stable topological ordering', async () => {
  const performance = capability({ capabilityId: 'api-performance' });
  const functional = capability({
    capabilityId: 'api-functional',
    dependencyRules: [{
      capabilityId: 'api-performance', version: '1.0.0', required: true, targetScope: 'same-target',
    }],
  });
  const capabilityCatalog = catalog([functional, performance]);
  const planningPolicy = policy([policyEntry({
    capabilityRefs: [
      { capabilityId: 'api-functional', version: '1.0.0' },
      { capabilityId: 'api-performance', version: '1.0.0' },
    ],
  })]);
  const result = await planner(capabilityCatalog).plan(request({ catalog: capabilityCatalog, planningPolicy }));
  const functionalIntent = result.plan.intents.find((item) => item.capability.capabilityId === 'api-functional');
  const performanceIntent = result.plan.intents.find((item) => item.capability.capabilityId === 'api-performance');
  assert.deepEqual(functionalIntent.dependencies, [performanceIntent.intentId]);
  assert.ok(result.dependencyDag.topologicalOrder.indexOf(performanceIntent.intentId)
    < result.dependencyDag.topologicalOrder.indexOf(functionalIntent.intentId));
});

test('missing required dependencies become unsupported and cascade deterministically', async () => {
  const functional = capability({
    capabilityId: 'api-functional',
    dependencyRules: [{
      capabilityId: 'api-performance', version: '1.0.0', required: true, targetScope: 'same-target',
    }],
  });
  const capabilityCatalog = catalog([functional, capability({ capabilityId: 'api-performance' })]);
  const result = await planner(capabilityCatalog).plan(request({ catalog: capabilityCatalog }));
  assert.equal(result.plan.intents.length, 0);
  assert.equal(result.plan.coverage.summary.unplanned, 1);
  assert.equal(result.unsupportedObligations[0].code, 'REQUIRED_DEPENDENCY_MISSING');
});

test('cyclic capability dependencies are rejected before a formal plan is returned', async () => {
  const first = capability({
    capabilityId: 'capability-a',
    dependencyRules: [{ capabilityId: 'capability-b', version: '1.0.0', required: true, targetScope: 'same-target' }],
  });
  const second = capability({
    capabilityId: 'capability-b',
    dependencyRules: [{ capabilityId: 'capability-a', version: '1.0.0', required: true, targetScope: 'same-target' }],
  });
  const capabilityCatalog = catalog([first, second]);
  const planningPolicy = policy([policyEntry({
    capabilityRefs: [
      { capabilityId: 'capability-a', version: '1.0.0' },
      { capabilityId: 'capability-b', version: '1.0.0' },
    ],
  })]);
  await assert.rejects(
    () => planner(capabilityCatalog).plan(request({ catalog: capabilityCatalog, planningPolicy })),
    assertCode('DEPENDENCY_CYCLE'),
  );
});

test('coverage matrix reports PARTIAL when covered and exempt obligations share a cell', async () => {
  const rules = [
    knowledgeRule(),
    knowledgeRule({ id: 'PROJECT-APPROVAL-002', boundaryKey: 'workflow.approval-audit', name: 'Approval audit required' }),
  ];
  const envelope = snapshotEnvelope(rules);
  const capabilityCatalog = catalog([capability()]);
  const planningPolicy = policy([policyEntry({ selectors: { targetKinds: ['api'] } })], [exemption({
    knowledgeId: 'PROJECT-APPROVAL-002',
  })]);
  const result = await planner(capabilityCatalog).plan(request({
    catalog: capabilityCatalog, envelope, planningPolicy,
  }));
  assert.equal(result.plan.coverage.summary.covered, 1);
  assert.equal(result.plan.coverage.summary.exempt, 1);
  assert.equal(result.coverageMatrix.cells.length, 1);
  assert.equal(result.coverageMatrix.cells[0].status, 'PARTIAL');
});

test('strategy duplicates are deduplicated while conflicting logical intent keys are rejected', async () => {
  const open = emptyContract(true);
  const capabilityCatalog = catalog([capability({
    inputContract: open,
    assertionContract: open,
    thresholdContract: open,
  })]);
  const duplicateStrategy = {
    async createIntentSpecs() {
      const spec = { intentKey: 'primary', input: { profile: 'valid' }, assertions: {}, thresholds: {}, tags: [] };
      return [spec, structuredClone(spec)];
    },
  };
  const deduplicated = await planner(capabilityCatalog, duplicateStrategy)
    .plan(request({ catalog: capabilityCatalog }));
  assert.equal(deduplicated.plan.intents.length, 1);

  const conflictingStrategy = {
    async createIntentSpecs() {
      return [
        { intentKey: 'primary', input: { profile: 'valid' }, assertions: {}, thresholds: {}, tags: [] },
        { intentKey: 'primary', input: { profile: 'invalid' }, assertions: {}, thresholds: {}, tags: [] },
      ];
    },
  };
  await assert.rejects(
    () => planner(capabilityCatalog, conflictingStrategy).plan(request({ catalog: capabilityCatalog })),
    assertCode('INTENT_CONFLICT'),
  );
});

test('declarative strategy materializes required capability fields or leaves an explicit gap', async () => {
  const requiredInput = {
    schemaVersion: 'capability-contract/v1',
    fields: [{ name: 'operationId', type: 'string', required: true }],
    additionalProperties: false,
  };
  const capabilityCatalog = catalog([capability({ inputContract: requiredInput })]);
  const covered = await planner(capabilityCatalog).plan(request({ catalog: capabilityCatalog }));
  assert.deepEqual(covered.plan.intents[0].input, { operationId: 'submitApproval' });

  const missingTarget = inventory([apiTarget({ attributes: {} })]);
  const missingEnvelope = snapshotEnvelope([
    knowledgeRule({ value: { requireActiveTask: true } }),
  ]);
  const unplanned = await planner(capabilityCatalog).plan(request({
    catalog: capabilityCatalog,
    targetInventory: missingTarget,
    envelope: missingEnvelope,
  }));
  assert.equal(unplanned.plan.coverage.summary.unplanned, 1);
  assert.equal(unplanned.unsupportedObligations[0].code, 'UNSUPPORTED_OBLIGATION');
});

test('planner enforces exact catalog version and digest binding', async () => {
  const first = catalog([capability()]);
  const second = catalog([capability({ tags: ['changed'] })]);
  await assert.rejects(
    () => planner(second).plan(request({ catalog: first })),
    assertCode('PLANNER_CATALOG_BINDING_MISMATCH'),
  );
});

test('selectors require all declared tags and keep unmatched combinations out of the plan', async () => {
  const capabilityCatalog = catalog([capability()]);
  const targets = inventory([
    apiTarget(),
    apiTarget({ targetId: 'api:secondary', name: 'Secondary API', tags: ['secondary'] }),
  ]);
  const planningPolicy = policy([policyEntry({
    selectors: { knowledgeTags: ['workflow', 'api'], targetTags: ['critical'] },
  })]);
  const result = await planner(capabilityCatalog).plan(request({
    catalog: capabilityCatalog, targetInventory: targets, planningPolicy,
  }));
  assert.equal(result.plan.intents.length, 1);
  assert.equal(result.plan.intents[0].targetId, 'api:approval-submit');
});

test('tampered coverage, graph, DAG and result digest are rejected', async () => {
  const capabilityCatalog = catalog([capability()]);
  const result = await planner(capabilityCatalog).plan(request({ catalog: capabilityCatalog }));
  for (const mutate of [
    (copy) => { copy.coverageMatrix.summary.covered = 0; },
    (copy) => { copy.provenanceGraph.nodes = []; },
    (copy) => { copy.dependencyDag.topologicalOrder = []; },
    (copy) => { copy.digest = 'f'.repeat(64); },
  ]) {
    const copy = structuredClone(result);
    mutate(copy);
    assert.throws(() => validatePlanningResult(copy));
  }
});
