import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { InMemoryTestPlanRegistry } from '@kdtp/test-plan-registry';
import { planningResult } from '../packages/test-plan-registry/test/test-helpers.js';
import { TestPlanGovernanceService } from '@kdtp/test-plan-governance';

const projectId = 'approval-platform';
const grant = (actor, actions) => ({ projectId, actor, actions });
const authorization = new InMemoryProjectAuthorization([
  grant('planner-service', ['PLAN_GENERATE', 'PLAN_SUBMIT']),
  grant('reviewer-one', ['PLAN_REVIEW']),
  grant('reviewer-two', ['PLAN_REVIEW']),
  grant('approval-governor', ['PLAN_APPROVE']),
  grant('freeze-owner', ['PLAN_FREEZE', 'PLAN_AUDIT_READ']),
]);
const registry = new InMemoryTestPlanRegistry();
const service = new TestPlanGovernanceService({ registry, authorization });
let record = await service.generate({ planningResult: await planningResult(), actor: 'planner-service', at: '2026-07-27T18:00:00.000Z', reason: 'generate' });
record = await service.submit({ planId: record.planId, actor: 'planner-service', at: '2026-07-27T18:01:00.000Z', reason: 'submit' });
await service.review({ planId: record.planId, actor: 'reviewer-one', decision: 'APPROVE', at: '2026-07-27T18:02:00.000Z', reason: 'review one' });
await service.review({ planId: record.planId, actor: 'reviewer-two', decision: 'APPROVE', at: '2026-07-27T18:03:00.000Z', reason: 'review two' });
record = (await service.approve({ planId: record.planId, actor: 'approval-governor', at: '2026-07-27T18:04:00.000Z', reason: 'approve' })).record;
record = (await service.freeze({ planId: record.planId, actor: 'freeze-owner', at: '2026-07-27T18:05:00.000Z', reason: 'freeze' })).record;
const timeline = await service.auditTimeline({ planId: record.planId, actor: 'freeze-owner' });
process.stdout.write(`${JSON.stringify({ planId: record.planId, status: record.status, revision: record.revision, timelineEntries: timeline.length }, null, 2)}\n`);
