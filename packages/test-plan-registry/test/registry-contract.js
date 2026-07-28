import test from 'node:test';
import assert from 'node:assert/strict';
import { TestPlanRegistryError } from '../src/index.js';
import {
  T0, T1, T2, T3, T4, T5, T6,
  createCommand,
  planningResult,
  reviewDecision,
  transitionCommand,
} from './test-helpers.js';

export function defineTestPlanRegistryContractTests(adapterName, createRegistry, hooks = {}) {
  const adapterTest = (name, body) => test(`${adapterName}: ${name}`, { concurrency: false }, async () => {
    await hooks.beforeEach?.();
    const registry = await createRegistry();
    try {
      await body(registry);
    } finally {
      await hooks.afterEach?.(registry);
    }
  });

  adapterTest('creates and retrieves a defensive copy', async (registry) => {
    const created = await registry.create(await createCommand());
    created.planningResult.plan.intents[0].tags.push('mutated');
    const stored = await registry.get({ planId: created.planId });
    assert.equal(stored.revision, 1);
    assert.equal(stored.status, 'DRAFT');
    assert.equal(stored.history.length, 1);
    assert.equal(stored.planningResult.plan.intents[0].tags.includes('mutated'), false);
  });

  adapterTest('rejects duplicate plan ID and input fingerprint', async (registry) => {
    const command = await createCommand();
    await registry.create(command);
    await assert.rejects(
      () => registry.create({ ...command, at: T1 }),
      (error) => error instanceof TestPlanRegistryError
        && ['PLAN_EXISTS', 'PLAN_INPUT_EXISTS'].includes(error.code),
    );
  });

  adapterTest('concurrent duplicate creation has one winner', async (registry) => {
    const command = await createCommand();
    const results = await Promise.allSettled([
      registry.create(command),
      registry.create({ ...command, at: T1 }),
    ]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    assert.equal(results.filter((item) => item.status === 'rejected').length, 1);
  });

  adapterTest('retrieves by fingerprint and lists with stable filters', async (registry) => {
    const created = await registry.create(await createCommand());
    assert.equal((await registry.getByFingerprint({
      inputFingerprint: created.inputFingerprint,
    })).planId, created.planId);
    assert.deepEqual((await registry.list({ projectId: created.projectId })).map((item) => item.planId), [
      created.planId,
    ]);
    assert.equal((await registry.list({ status: 'REVIEWING' })).length, 0);
  });

  adapterTest('replaces DRAFT content with revision CAS and immutable bindings', async (registry) => {
    const created = await registry.create(await createCommand());
    const editedResult = await planningResult({ edited: true });
    const updated = await registry.replaceDraft({
      planId: created.planId,
      expectedRevision: 1,
      planningResult: editedResult,
      actor: 'plan-editor',
      at: T1,
      reason: 'add reviewed intent tag',
    });
    assert.equal(updated.revision, 2);
    assert.equal(updated.status, 'DRAFT');
    assert.notEqual(updated.contentDigest, created.contentDigest);
    assert.equal(updated.history.at(-1).type, 'PLAN_CONTENT_REPLACED');
    await assert.rejects(
      () => registry.replaceDraft({
        planId: created.planId,
        expectedRevision: 1,
        planningResult: editedResult,
        actor: 'plan-editor',
        at: T2,
        reason: 'stale edit',
      }),
      (error) => error instanceof TestPlanRegistryError && error.code === 'REVISION_CONFLICT',
    );
  });

  adapterTest('supports lifecycle and request-changes return to DRAFT', async (registry) => {
    let record = await registry.create(await createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    record = await registry.transition(transitionCommand(record, 'DRAFT', T2));
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T3));
    record = await registry.transition(transitionCommand(record, 'APPROVED', T4));
    record = await registry.transition(transitionCommand(record, 'FROZEN', T5));
    record = await registry.transition(transitionCommand(record, 'SUPERSEDED', T6));
    record = await registry.transition({
      ...transitionCommand(record, 'ARCHIVED', '2026-07-27T18:07:00.000Z'),
    });
    assert.equal(record.status, 'ARCHIVED');
    assert.equal(record.revision, 8);
    assert.equal(record.history.length, 8);
  });

  adapterTest('concurrent lifecycle transition has one winner', async (registry) => {
    const record = await registry.create(await createCommand());
    const results = await Promise.allSettled([
      registry.transition(transitionCommand(record, 'REVIEWING', T1)),
      registry.transition(transitionCommand(record, 'REVIEWING', T2)),
    ]);
    assert.equal(results.filter((item) => item.status === 'fulfilled').length, 1);
    const rejected = results.find((item) => item.status === 'rejected');
    assert.equal(rejected.reason.code, 'REVISION_CONFLICT');
  });

  adapterTest('FROZEN content cannot be replaced', async (registry) => {
    let record = await registry.create(await createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    record = await registry.transition(transitionCommand(record, 'APPROVED', T2));
    record = await registry.transition(transitionCommand(record, 'FROZEN', T3));
    await assert.rejects(
      () => registry.replaceDraft({
        planId: record.planId,
        expectedRevision: record.revision,
        planningResult: planningResult({ edited: true }),
        actor: 'plan-editor',
        at: T4,
        reason: 'attempt frozen mutation',
      }),
      (error) => error instanceof TestPlanRegistryError && error.code === 'PLAN_NOT_EDITABLE',
    );
  });

  adapterTest('stores append-only review decisions bound to exact revision', async (registry) => {
    let record = await registry.create(await createCommand());
    record = await registry.transition(transitionCommand(record, 'REVIEWING', T1));
    const decision = reviewDecision(record);
    const stored = await registry.appendReviewDecision(decision);
    stored.evidence.checklist.push('mutated');
    const listed = await registry.listReviewDecisions({
      planId: record.planId,
      planRevision: record.revision,
    });
    assert.equal(listed.length, 1);
    assert.deepEqual(listed[0].evidence.checklist, ['coverage-reviewed']);
    await assert.rejects(
      () => registry.appendReviewDecision(decision),
      (error) => error instanceof TestPlanRegistryError
        && error.code === 'PLAN_REVIEW_DECISION_EXISTS',
    );
    await assert.rejects(
      () => registry.appendReviewDecision(reviewDecision(record, {
        decision: 'REQUEST_CHANGES',
        at: T3,
        reason: 'same reviewer attempted another decision',
      })),
      (error) => error instanceof TestPlanRegistryError
        && error.code === 'REVIEWER_ALREADY_DECIDED',
    );
  });
}
