import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import { request, planner } from '../../test-planner/test/test-helpers.js';
import { createPlanReviewDecision } from '../src/index.js';

export const T0 = '2026-07-27T18:00:00.000Z';
export const T1 = '2026-07-27T18:01:00.000Z';
export const T2 = '2026-07-27T18:02:00.000Z';
export const T3 = '2026-07-27T18:03:00.000Z';
export const T4 = '2026-07-27T18:04:00.000Z';
export const T5 = '2026-07-27T18:05:00.000Z';
export const T6 = '2026-07-27T18:06:00.000Z';

export async function planningResult({ edited = false } = {}) {
  const catalog = createBaseCapabilityCatalog('1.0.0');
  const strategy = edited ? {
    async createIntentSpecs() {
      return [{
        intentKey: 'primary',
        input: {},
        assertions: {},
        thresholds: {},
        tags: ['api', 'edited', 'mandatory'],
      }];
    },
  } : undefined;
  return planner(catalog, strategy).plan(request({ catalog }));
}

export async function createCommand(overrides = {}) {
  return {
    planningResult: overrides.planningResult ?? await planningResult(),
    actor: 'planner-service',
    at: T0,
    reason: 'generate deterministic test plan',
    ...overrides,
  };
}

export function transitionCommand(record, toStatus, at, overrides = {}) {
  return {
    planId: record.planId,
    expectedRevision: record.revision,
    toStatus,
    actor: 'plan-governor',
    at,
    reason: `transition to ${toStatus}`,
    ...overrides,
  };
}

export function reviewDecision(record, overrides = {}) {
  return createPlanReviewDecision({
    planId: record.planId,
    projectId: record.projectId,
    planRevision: record.revision,
    decision: 'APPROVE',
    reviewer: 'reviewer-one',
    at: T2,
    reason: 'reviewed exact plan revision',
    evidence: { checklist: ['coverage-reviewed'] },
    ...overrides,
  });
}
