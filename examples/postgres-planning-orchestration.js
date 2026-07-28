import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import {
  applyTestPlanMigrations,
  PostgresTestPlanRegistry,
  TEST_PLAN_POSTGRES_SCHEMA,
} from '@kdtp/test-plan-postgres';
import { request, planner } from '../packages/test-planner/test/test-helpers.js';
import {
  DurablePlanningOrchestrationService,
  PostgresPlanningUnitOfWork,
} from '@kdtp/test-planning-orchestration';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;
if (!connectionString) throw new Error('KDTP_POSTGRES_TEST_URL is required');
const { Pool } = await import('pg');
const pool = new Pool({ connectionString, max: 8 });
try {
  await applyTestPlanMigrations({ pool });
  await pool.query(`TRUNCATE TABLE
    ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_review_decisions,
    ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history,
    ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records CASCADE`);
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
  const orchestration = new DurablePlanningOrchestrationService({
    planner: planner(catalog),
    planningUnitOfWork: new PostgresPlanningUnitOfWork({ pool, authorization }),
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
  await orchestration.review({ planId: record.planId, actor: 'reviewer-one', decision: 'APPROVE', at: '2026-07-27T18:02:00.000Z', reason: 'first review' });
  await orchestration.review({ planId: record.planId, actor: 'reviewer-two', decision: 'APPROVE', at: '2026-07-27T18:03:00.000Z', reason: 'second review' });
  record = (await orchestration.approve({ planId: record.planId, actor: 'approval-governor', at: '2026-07-27T18:04:00.000Z', reason: 'approve plan' })).record;
  record = (await orchestration.freeze({ planId: record.planId, actor: 'freeze-owner', at: '2026-07-27T18:05:00.000Z', reason: 'freeze plan' })).record;
  const reloaded = await new PostgresTestPlanRegistry({ pool }).get({ planId: record.planId });
  const timeline = await orchestration.auditTimeline({ planId: record.planId, actor: 'freeze-owner' });
  process.stdout.write(`${JSON.stringify({
    planId: reloaded.planId,
    status: reloaded.status,
    revision: reloaded.revision,
    snapshotId: reloaded.knowledgeSnapshot.snapshotId,
    capabilityCatalogVersion: reloaded.capabilityCatalog.version,
    timelineEntries: timeline.length,
    reloaded: true,
  }, null, 2)}\n`);
} finally {
  await pool.end();
}
