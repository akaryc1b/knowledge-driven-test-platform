import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryProjectAuthorization } from '@kdtp/knowledge-governance';
import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import {
  applyTestPlanMigrations,
  PostgresTestPlanRegistry,
  TEST_PLAN_POSTGRES_SCHEMA,
} from '@kdtp/test-plan-postgres';
import { request, planner } from '../../test-planner/test/test-helpers.js';
import {
  DurablePlanningOrchestrationService,
  PostgresPlanningUnitOfWork,
} from '../src/index.js';

const connectionString = process.env.KDTP_POSTGRES_TEST_URL;

if (!connectionString) {
  test('M2-F PostgreSQL integration requires KDTP_POSTGRES_TEST_URL', { skip: true }, () => {});
} else {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString, max: 16 });
  await applyTestPlanMigrations({ pool });

  const projectId = 'approval-platform';
  const grant = (actor, actions) => ({ projectId, actor, actions });
  const authorization = new InMemoryProjectAuthorization([
    grant('planner-service', ['PLAN_GENERATE', 'PLAN_SUBMIT', 'PLAN_READ']),
    grant('reviewer-one', ['PLAN_REVIEW']),
    grant('reviewer-two', ['PLAN_REVIEW']),
    grant('approval-governor', ['PLAN_APPROVE']),
    grant('freeze-owner', ['PLAN_FREEZE', 'PLAN_READ', 'PLAN_AUDIT_READ']),
    grant('freeze-owner-two', ['PLAN_FREEZE']),
  ]);

  const reset = async () => {
    await pool.query(`TRUNCATE TABLE
      ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_review_decisions,
      ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_history,
      ${TEST_PLAN_POSTGRES_SCHEMA}.test_plan_records CASCADE`);
  };

  const context = () => {
    const catalog = createBaseCapabilityCatalog('1.0.0');
    const planningRequest = request({ catalog });
    const unitOfWork = new PostgresPlanningUnitOfWork({ pool, authorization });
    const orchestration = new DurablePlanningOrchestrationService({
      planner: planner(catalog),
      planningUnitOfWork: unitOfWork,
    });
    return { planningRequest, unitOfWork, orchestration };
  };

  const generate = (orchestration, planningRequest) => orchestration.generate({
    planningRequest,
    actor: 'planner-service',
    at: '2026-07-27T18:00:00.000Z',
    reason: 'generate deterministic plan',
  });

  async function approveReady(orchestration, planningRequest) {
    const generated = await generate(orchestration, planningRequest);
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
      reason: 'approve exact reviewed revision',
    })).record;
    return record;
  }

  test('M2-F PostgreSQL: concurrent generate converges on one durable plan',
    { concurrency: false }, async () => {
      await reset();
      const { orchestration, planningRequest } = context();
      const results = await Promise.all(
        Array.from({ length: 8 }, () => generate(orchestration, planningRequest)),
      );
      assert.equal(new Set(results.map((item) => item.record.planId)).size, 1);
      assert.equal(results.filter((item) => item.created).length, 1);
      const records = await new PostgresTestPlanRegistry({ pool }).list({ projectId });
      assert.equal(records.length, 1);
    });

  test('M2-F PostgreSQL: request-changes evidence and lifecycle roll back together',
    { concurrency: false }, async () => {
      await reset();
      const { orchestration, planningRequest } = context();
      const generated = await generate(orchestration, planningRequest);
      const reviewing = await orchestration.submit({
        planId: generated.record.planId,
        actor: 'planner-service',
        at: '2026-07-27T18:01:00.000Z',
        reason: 'submit plan',
      });
      const catalog = createBaseCapabilityCatalog('1.0.0');
      const failingUnitOfWork = new PostgresPlanningUnitOfWork({
        pool,
        authorization,
        registryFactory(client) {
          const registry = new PostgresTestPlanRegistry({ client });
          return new Proxy(registry, {
            get(target, property) {
              if (property === 'transition') {
                return async () => { throw new Error('forced transition rollback'); };
              }
              const value = Reflect.get(target, property, target);
              return typeof value === 'function' ? value.bind(target) : value;
            },
          });
        },
      });
      const failing = new DurablePlanningOrchestrationService({
        planner: planner(catalog),
        planningUnitOfWork: failingUnitOfWork,
      });
      await assert.rejects(
        () => failing.review({
          planId: reviewing.planId,
          actor: 'reviewer-one',
          decision: 'REQUEST_CHANGES',
          at: '2026-07-27T18:02:00.000Z',
          reason: 'request changes rollback probe',
        }),
        /forced transition rollback/,
      );
      const registry = new PostgresTestPlanRegistry({ pool });
      const decisions = await registry.listReviewDecisions({ planId: reviewing.planId });
      const stored = await registry.get({ planId: reviewing.planId });
      assert.equal(decisions.length, 0);
      assert.equal(stored.status, 'REVIEWING');
      assert.equal(stored.revision, 2);
    });

  test('M2-F PostgreSQL: concurrent review by one reviewer records one decision',
    { concurrency: false }, async () => {
      await reset();
      const { orchestration, planningRequest } = context();
      const generated = await generate(orchestration, planningRequest);
      const reviewing = await orchestration.submit({
        planId: generated.record.planId,
        actor: 'planner-service',
        at: '2026-07-27T18:01:00.000Z',
        reason: 'submit plan',
      });
      const command = {
        planId: reviewing.planId,
        actor: 'reviewer-one',
        decision: 'APPROVE',
        at: '2026-07-27T18:02:00.000Z',
        reason: 'concurrent review',
      };
      const settled = await Promise.allSettled([
        orchestration.review(command),
        orchestration.review(command),
      ]);
      assert.equal(settled.filter((item) => item.status === 'fulfilled').length, 1);
      const decisions = await new PostgresTestPlanRegistry({ pool }).listReviewDecisions({
        planId: reviewing.planId,
        reviewer: 'reviewer-one',
      });
      assert.equal(decisions.length, 1);
    });

  test('M2-F PostgreSQL: concurrent freeze has one winner and reloads FROZEN plan',
    { concurrency: false }, async () => {
      await reset();
      const { orchestration, planningRequest } = context();
      const approved = await approveReady(orchestration, planningRequest);
      const settled = await Promise.allSettled([
        orchestration.freeze({
          planId: approved.planId,
          actor: 'freeze-owner',
          at: '2026-07-27T18:05:00.000Z',
          reason: 'freeze one',
        }),
        orchestration.freeze({
          planId: approved.planId,
          actor: 'freeze-owner-two',
          at: '2026-07-27T18:05:01.000Z',
          reason: 'freeze two',
        }),
      ]);
      assert.equal(settled.filter((item) => item.status === 'fulfilled').length, 1);
      const reloaded = await new PostgresTestPlanRegistry({ pool }).get({ planId: approved.planId });
      assert.equal(reloaded.status, 'FROZEN');
      assert.equal(reloaded.revision, 4);
      const timeline = await orchestration.auditTimeline({
        planId: approved.planId,
        actor: 'freeze-owner',
      });
      assert.equal(timeline.length, 6);
    });

  after(async () => pool.end());
}
