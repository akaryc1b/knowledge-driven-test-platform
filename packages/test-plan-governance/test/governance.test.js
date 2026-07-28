import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { InMemoryTestPlanRegistry } from '@kdtp/test-plan-registry';
import { planningResult } from '../../test-plan-registry/test/test-helpers.js';
import {
  PlanGovernanceError,
  TestPlanGovernanceService,
  evaluateCoverageGate,
} from '../src/index.js';

const PROJECT = 'approval-platform';
const T0 = '2026-07-27T18:00:00.000Z';
const T1 = '2026-07-27T18:01:00.000Z';
const T2 = '2026-07-27T18:02:00.000Z';
const T3 = '2026-07-27T18:03:00.000Z';
const T4 = '2026-07-27T18:04:00.000Z';
const T5 = '2026-07-27T18:05:00.000Z';

function grant(actor, actions) { return { projectId: PROJECT, actor, actions }; }
function service(extraGrants = [], policy) {
  const registry = new InMemoryTestPlanRegistry();
  const authorization = new InMemoryProjectAuthorization([
    grant('planner-service', ['PLAN_GENERATE', 'PLAN_EDIT', 'PLAN_SUBMIT', 'PLAN_READ']),
    grant('reviewer-one', ['PLAN_REVIEW', 'PLAN_READ', 'PLAN_AUDIT_READ']),
    grant('reviewer-two', ['PLAN_REVIEW', 'PLAN_READ', 'PLAN_AUDIT_READ']),
    grant('approval-governor', ['PLAN_APPROVE', 'PLAN_READ', 'PLAN_AUDIT_READ']),
    grant('freeze-owner', ['PLAN_FREEZE', 'PLAN_READ', 'PLAN_AUDIT_READ']),
    grant('auditor', ['PLAN_READ', 'PLAN_AUDIT_READ']),
    ...extraGrants,
  ]);
  return { registry, governance: new TestPlanGovernanceService({ registry, authorization, policy }) };
}

async function generated(governance) {
  return governance.generate({
    planningResult: await planningResult(), actor: 'planner-service', at: T0, reason: 'generate plan',
  });
}

function code(expected) {
  return (error) => error instanceof PlanGovernanceError && error.code === expected;
}

test('high-risk plan requires two distinct reviewers before approval and a separate freezer', async () => {
  const { governance } = service();
  let record = await generated(governance);
  record = await governance.submit({ planId: record.planId, actor: 'planner-service', at: T1, reason: 'submit' });
  await governance.review({ planId: record.planId, actor: 'reviewer-one', decision: 'APPROVE', at: T2, reason: 'review one' });
  await assert.rejects(
    () => governance.approve({ planId: record.planId, actor: 'approval-governor', at: T3, reason: 'approve' }),
    code('PLAN_APPROVAL_GATE_FAILED'),
  );
  await governance.review({ planId: record.planId, actor: 'reviewer-two', decision: 'APPROVE', at: T3, reason: 'review two' });
  const approved = await governance.approve({ planId: record.planId, actor: 'approval-governor', at: T4, reason: 'approve' });
  assert.equal(approved.record.status, 'APPROVED');
  assert.equal(approved.gate.requiredApprovals, 2);
  const frozen = await governance.freeze({ planId: record.planId, actor: 'freeze-owner', at: T5, reason: 'freeze' });
  assert.equal(frozen.record.status, 'FROZEN');
});

test('plan generator cannot review their own plan', async () => {
  const { governance } = service([grant('planner-service', ['PLAN_REVIEW'])]);
  let record = await generated(governance);
  record = await governance.submit({ planId: record.planId, actor: 'planner-service', at: T1, reason: 'submit' });
  await assert.rejects(
    () => governance.review({ planId: record.planId, actor: 'planner-service', decision: 'APPROVE', at: T2, reason: 'self review' }),
    code('PLAN_SELF_REVIEW_FORBIDDEN'),
  );
});

test('reviewer of approved revision cannot be the final freezer', async () => {
  const { governance } = service([grant('reviewer-one', ['PLAN_FREEZE'])]);
  let record = await generated(governance);
  record = await governance.submit({ planId: record.planId, actor: 'planner-service', at: T1, reason: 'submit' });
  await governance.review({ planId: record.planId, actor: 'reviewer-one', decision: 'APPROVE', at: T2, reason: 'review one' });
  await governance.review({ planId: record.planId, actor: 'reviewer-two', decision: 'APPROVE', at: T3, reason: 'review two' });
  await governance.approve({ planId: record.planId, actor: 'approval-governor', at: T4, reason: 'approve' });
  await assert.rejects(
    () => governance.freeze({ planId: record.planId, actor: 'reviewer-one', at: T5, reason: 'freeze' }),
    code('REVIEWER_CANNOT_FREEZE'),
  );
});

test('REQUEST_CHANGES returns DRAFT and previous review evidence cannot approve the new revision', async () => {
  const { governance } = service();
  let record = await generated(governance);
  record = await governance.submit({ planId: record.planId, actor: 'planner-service', at: T1, reason: 'submit' });
  await governance.review({ planId: record.planId, actor: 'reviewer-one', decision: 'APPROVE', at: T2, reason: 'review one' });
  const changed = await governance.review({
    planId: record.planId, actor: 'reviewer-two', decision: 'REQUEST_CHANGES', at: T3, reason: 'change requested',
  });
  assert.equal(changed.record.status, 'DRAFT');
  const edited = await governance.edit({
    planId: record.planId, expectedRevision: changed.record.revision,
    planningResult: await planningResult({ edited: true }), actor: 'planner-service', at: T4, reason: 'edit',
  });
  record = await governance.submit({ planId: edited.planId, actor: 'planner-service', at: T5, reason: 'resubmit' });
  await assert.rejects(
    () => governance.approve({ planId: record.planId, actor: 'approval-governor', at: '2026-07-27T18:06:00.000Z', reason: 'approve' }),
    code('PLAN_APPROVAL_GATE_FAILED'),
  );
});

test('mandatory UNPLANNED and unapproved EXEMPT obligations fail deterministic coverage gate', async () => {
  const { governance } = service([], { requiredApprovalsByRisk: { high: 1, critical: 1 } });
  let record = await generated(governance);
  record.planningResult.plan.coverage.obligations[0].status = 'UNPLANNED';
  record.planningResult.plan.coverage.obligations[0].intentIds = [];
  const unplanned = evaluateCoverageGate(record, [{ decision: 'APPROVE', reviewer: 'r', evidence: {} }], {
    requiredApprovalsByRisk: { high: 1, critical: 1 },
  });
  assert.equal(unplanned.passed, false);
  assert.equal(unplanned.blockers[0].code, 'MANDATORY_UNPLANNED');
  record.planningResult.plan.coverage.obligations[0].mandatory = false;
  record.planningResult.plan.coverage.obligations[0].status = 'EXEMPT';
  record.planningResult.plan.coverage.obligations[0].exemption = { reason: 'not applicable', owner: 'quality-owner' };
  const exempt = evaluateCoverageGate(record, [{ decision: 'APPROVE', reviewer: 'r', evidence: {} }], {
    requiredApprovalsByRisk: { high: 1, critical: 1 },
  });
  assert.equal(exempt.blockers.some((item) => item.code === 'EXEMPTION_NOT_APPROVED'), true);
});

test('audit timeline is project-authorized and combines history with review evidence', async () => {
  const { governance } = service();
  let record = await generated(governance);
  record = await governance.submit({ planId: record.planId, actor: 'planner-service', at: T1, reason: 'submit' });
  await governance.review({ planId: record.planId, actor: 'reviewer-one', decision: 'APPROVE', at: T2, reason: 'review' });
  const timeline = await governance.auditTimeline({ planId: record.planId, actor: 'auditor' });
  assert.equal(timeline.some((item) => item.kind === 'PLAN_HISTORY'), true);
  assert.equal(timeline.some((item) => item.kind === 'PLAN_REVIEW_DECISION'), true);
  await assert.rejects(
    () => governance.auditTimeline({ planId: record.planId, actor: 'unknown' }),
    code('PLAN_ACTION_FORBIDDEN'),
  );
});
