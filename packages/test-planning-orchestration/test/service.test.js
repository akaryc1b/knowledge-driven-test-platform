import test from 'node:test';
import assert from 'node:assert/strict';
import {
  DurablePlanningOrchestrationService,
  PlanningOrchestrationError,
  PlanningUnitOfWorkPort,
  assertPlanningUnitOfWorkPort,
} from '../src/index.js';
import {
  frozenLifecycle,
  generateCommand,
  planningRequest,
  service,
} from './test-helpers.js';

test('generate is idempotent for the same canonical planning input', async () => {
  const context = service();
  const first = await context.orchestration.generate(generateCommand(context.planningRequest));
  const second = await context.orchestration.generate(generateCommand(context.planningRequest));
  assert.equal(first.created, true);
  assert.equal(second.created, false);
  assert.equal(second.record.planId, first.record.planId);
  assert.equal(second.idempotencyKey, first.idempotencyKey);
  assert.equal((await context.registry.list()).length, 1);
});

test('generate binds the authenticated actor to planning request createdBy', async () => {
  const context = service();
  await assert.rejects(
    () => context.orchestration.generate({
      ...generateCommand(context.planningRequest),
      actor: 'other-planner',
    }),
    (error) => error instanceof PlanningOrchestrationError
      && error.code === 'PLAN_GENERATOR_IDENTITY_MISMATCH',
  );
});

test('orchestration completes governed lifecycle and returns durable views', async () => {
  const context = service();
  const record = await frozenLifecycle(context.orchestration, context.planningRequest);
  assert.equal(record.status, 'FROZEN');
  assert.equal(record.revision, 4);
  const coverage = await context.orchestration.coverage({
    planId: record.planId,
    actor: 'freeze-owner',
  });
  assert.equal(coverage.summary.covered, 1);
  assert.equal(coverage.obligations.length, 1);
  const timeline = await context.orchestration.auditTimeline({
    planId: record.planId,
    actor: 'freeze-owner',
  });
  assert.equal(timeline.length, 6);
});

test('validate delegates to the deterministic planning result contract', async () => {
  const context = service();
  const generated = await context.orchestration.generate(generateCommand(context.planningRequest));
  assert.equal(context.orchestration.validate(generated.planningResult).digest,
    generated.planningResult.digest);
});

test('PlanningUnitOfWorkPort exposes one explicit execute boundary', async () => {
  const port = new PlanningUnitOfWorkPort();
  await assert.rejects(() => port.execute(), { code: 'PLANNING_UOW_NOT_IMPLEMENTED' });
  assert.throws(() => assertPlanningUnitOfWorkPort({}), {
    code: 'INVALID_PLANNING_UNIT_OF_WORK',
  });
});

test('idempotency conflict is rejected if an existing fingerprint has different content', async () => {
  const { catalog, request: planningRequestValue } = planningRequest();
  const fakeRecord = {
    inputFingerprint: planningRequestValue.inputFingerprint,
    contentDigest: '0'.repeat(64),
    planId: 'tp-approval-platform-000000000000',
  };
  const unitOfWork = {
    async execute(work) {
      return work({
        registry: { async getByFingerprint() { return fakeRecord; } },
        governance: {},
      });
    },
  };
  const { planner } = await import('../../test-planner/test/test-helpers.js');
  const orchestration = new DurablePlanningOrchestrationService({
    planner: planner(catalog),
    planningUnitOfWork: unitOfWork,
  });
  await assert.rejects(
    () => orchestration.generate(generateCommand(planningRequestValue)),
    (error) => typeof error.code === 'string',
  );
});
