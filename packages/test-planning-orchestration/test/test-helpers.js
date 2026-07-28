import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import { InMemoryTestPlanRegistry } from '@kdtp/test-plan-registry';
import { request, planner } from '../../test-planner/test/test-helpers.js';
import {
  DurablePlanningOrchestrationService,
  PassthroughPlanningUnitOfWork,
} from '../src/index.js';

export const PROJECT_ID = 'approval-platform';
export const T0 = '2026-07-27T18:00:00.000Z';
export const T1 = '2026-07-27T18:01:00.000Z';
export const T2 = '2026-07-27T18:02:00.000Z';
export const T3 = '2026-07-27T18:03:00.000Z';
export const T4 = '2026-07-27T18:04:00.000Z';
export const T5 = '2026-07-27T18:05:00.000Z';

export function authorization() {
  const grant = (actor, actions) => ({ projectId: PROJECT_ID, actor, actions });
  return new InMemoryProjectAuthorization([
    grant('planner-service', ['PLAN_GENERATE', 'PLAN_SUBMIT', 'PLAN_READ']),
    grant('reviewer-one', ['PLAN_REVIEW']),
    grant('reviewer-two', ['PLAN_REVIEW']),
    grant('approval-governor', ['PLAN_APPROVE']),
    grant('freeze-owner', ['PLAN_FREEZE', 'PLAN_READ', 'PLAN_AUDIT_READ']),
    grant('freeze-owner-two', ['PLAN_FREEZE']),
  ]);
}

export function planningRequest() {
  const catalog = createBaseCapabilityCatalog('1.0.0');
  return { catalog, request: request({ catalog }) };
}

export function service({ registry = new InMemoryTestPlanRegistry(), auth = authorization() } = {}) {
  const { catalog, request: planningRequestValue } = planningRequest();
  const planningUnitOfWork = new PassthroughPlanningUnitOfWork({
    registry,
    authorization: auth,
  });
  return {
    registry,
    planningRequest: planningRequestValue,
    orchestration: new DurablePlanningOrchestrationService({
      planner: planner(catalog),
      planningUnitOfWork,
    }),
  };
}

export function generateCommand(planningRequestValue) {
  return {
    planningRequest: planningRequestValue,
    actor: 'planner-service',
    at: T0,
    reason: 'generate governed deterministic plan',
  };
}

export async function frozenLifecycle(orchestration, planningRequestValue) {
  const generated = await orchestration.generate(generateCommand(planningRequestValue));
  let record = await orchestration.submit({
    planId: generated.record.planId,
    actor: 'planner-service',
    at: T1,
    reason: 'submit plan',
  });
  await orchestration.review({
    planId: record.planId,
    actor: 'reviewer-one',
    decision: 'APPROVE',
    at: T2,
    reason: 'first review',
  });
  await orchestration.review({
    planId: record.planId,
    actor: 'reviewer-two',
    decision: 'APPROVE',
    at: T3,
    reason: 'second review',
  });
  record = (await orchestration.approve({
    planId: record.planId,
    actor: 'approval-governor',
    at: T4,
    reason: 'approve current revision',
  })).record;
  record = (await orchestration.freeze({
    planId: record.planId,
    actor: 'freeze-owner',
    at: T5,
    reason: 'freeze approved plan',
  })).record;
  return record;
}
