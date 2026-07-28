import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import { InMemoryTestPlanRegistry } from '@kdtp/test-plan-registry';
import { request, planner } from '../packages/test-planner/test/test-helpers.js';
import {
  DurablePlanningOrchestrationService,
  PassthroughPlanningUnitOfWork,
} from '@kdtp/test-planning-orchestration';

const projectId = 'approval-platform';
const grant = (actor, actions) => ({ projectId, actor, actions });
const authorization = new InMemoryProjectAuthorization([
  grant('planner-service', ['PLAN_GENERATE', 'PLAN_SUBMIT']),
  grant('reviewer-one', ['PLAN_REVIEW']),
  grant('reviewer-two', ['PLAN_REVIEW']),
  grant('approval-governor', ['PLAN_APPROVE']),
  grant('freeze-owner', ['PLAN_FREEZE', 'PLAN_AUDIT_READ']),
]);
const catalog = createBaseCapabilityCatalog('1.0.0');
const planningRequest = request({ catalog });
const registry = new InMemoryTestPlanRegistry();
const orchestration = new DurablePlanningOrchestrationService({
  planner: planner(catalog),
  planningUnitOfWork: new PassthroughPlanningUnitOfWork({ registry, authorization }),
});

const generated = await orchestration.generate({
  planningRequest,
  actor: 'planner-service',
  at: '2026-07-27T18:00:00.000Z',
  reason: 'generate deterministic plan',
});
let record = await orchestration.submit({
  planId: generated.record.planId,
  actor: 'planner-service',
  at: '2026-07-27T18:01:00.000Z',
  reason: 'submit plan',
});
await orchestration.review({
  planId: record.planId,
  actor: 'reviewer-one',
  decision: 'APPROVE',
  at: '2026-07-27T18:02:00.000Z',
  reason: 'first review',
});
await orchestration.review({
  planId: record.planId,
  actor: 'reviewer-two',
  decision: 'APPROVE',
  at: '2026-07-27T18:03:00.000Z',
  reason: 'second review',
});
record = (await orchestration.approve({
  planId: record.planId,
  actor: 'approval-governor',
  at: '2026-07-27T18:04:00.000Z',
  reason: 'approve plan',
})).record;
record = (await orchestration.freeze({
  planId: record.planId,
  actor: 'freeze-owner',
  at: '2026-07-27T18:05:00.000Z',
  reason: 'freeze plan',
})).record;
const timeline = await orchestration.auditTimeline({
  planId: record.planId,
  actor: 'freeze-owner',
});
process.stdout.write(`${JSON.stringify({
  planId: record.planId,
  created: generated.created,
  status: record.status,
  revision: record.revision,
  timelineEntries: timeline.length,
}, null, 2)}\n`);
