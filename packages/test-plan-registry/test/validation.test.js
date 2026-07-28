import test from 'node:test';
import assert from 'node:assert/strict';
import {
  TestPlanRegistryError,
  createPlanRecord,
  createPlanReviewDecision,
  replaceDraftRecord,
  transitionPlanRecord,
  validatePlanRecord,
} from '../src/index.js';
import { T0, T1, T2, createCommand, planningResult } from './test-helpers.js';

test('plan record rejects tampered content digest and history', async () => {
  const record = createPlanRecord(await createCommand());
  assert.throws(
    () => validatePlanRecord({ ...record, contentDigest: 'a'.repeat(64) }),
    (error) => error instanceof TestPlanRegistryError
      && error.code === 'PLAN_RECORD_CONTENT_DIGEST_MISMATCH',
  );
  assert.throws(
    () => validatePlanRecord({ ...record, history: [{ ...record.history[0], actor: 'tampered-actor' }] }),
    (error) => error instanceof TestPlanRegistryError
      && error.code === 'PLAN_HISTORY_RECORD_MISMATCH',
  );
});

test('plan binding cannot change during draft replacement', async () => {
  const record = createPlanRecord(await createCommand());
  const edited = await planningResult({ edited: true });
  edited.plan.projectId = 'inventory-platform';
  assert.throws(
    () => replaceDraftRecord(record, {
      expectedRevision: 1,
      planningResult: edited,
      actor: 'plan-editor',
      at: T1,
      reason: 'attempt to change binding',
    }),
    (error) => typeof error.code === 'string',
  );
});

test('invalid lifecycle transitions are rejected', async () => {
  const record = createPlanRecord(await createCommand());
  assert.throws(
    () => transitionPlanRecord(record, {
      expectedRevision: 1,
      toStatus: 'FROZEN',
      actor: 'plan-governor',
      at: T1,
      reason: 'skip review',
    }),
    (error) => error instanceof TestPlanRegistryError && error.code === 'INVALID_PLAN_TRANSITION',
  );
});

test('review decision identity is canonical and defensive', async () => {
  const record = createPlanRecord(await createCommand());
  const decision = createPlanReviewDecision({
    planId: record.planId,
    projectId: record.projectId,
    planRevision: 1,
    decision: 'APPROVE',
    reviewer: 'reviewer-one',
    at: T0,
    reason: 'approve exact revision',
    evidence: { checks: ['coverage'] },
  });
  assert.match(decision.decisionId, /^plan-decision-[a-f0-9]{16}$/);
  decision.evidence.checks.push('mutated');
  const next = createPlanReviewDecision({
    planId: record.planId,
    projectId: record.projectId,
    planRevision: 1,
    decision: 'APPROVE',
    reviewer: 'reviewer-one',
    at: T0,
    reason: 'approve exact revision',
    evidence: { checks: ['coverage'] },
  });
  assert.deepEqual(next.evidence.checks, ['coverage']);
});

test('review decision evidence rejects secrets and executor scripts', async () => {
  const record = createPlanRecord(await createCommand());
  assert.throws(
    () => createPlanReviewDecision({
      planId: record.planId,
      projectId: record.projectId,
      planRevision: 1,
      decision: 'APPROVE',
      reviewer: 'reviewer-one',
      at: T0,
      reason: 'unsafe evidence',
      evidence: { token: 'secret-token-value' },
    }),
    (error) => typeof error.code === 'string',
  );
  assert.throws(
    () => createPlanReviewDecision({
      planId: record.planId,
      projectId: record.projectId,
      planRevision: 1,
      decision: 'APPROVE',
      reviewer: 'reviewer-one',
      at: T0,
      reason: 'unsafe evidence',
      evidence: { script: 'export default function () {}' },
    }),
    (error) => typeof error.code === 'string',
  );
});

test('history event types enforce content and lifecycle semantics', async () => {
  const record = createPlanRecord(await createCommand());
  const invalidReplacement = structuredClone(record);
  invalidReplacement.revision = 2;
  invalidReplacement.updatedAt = T1;
  invalidReplacement.updatedBy = 'plan-editor';
  invalidReplacement.history.push({
    ...invalidReplacement.history[0],
    revision: 2,
    type: 'PLAN_CONTENT_REPLACED',
    fromStatus: 'REVIEWING',
    toStatus: 'REVIEWING',
    previousContentDigest: record.contentDigest,
    contentDigest: 'a'.repeat(64),
    actor: 'plan-editor',
    at: T1,
    reason: 'invalid content replacement state',
  });
  invalidReplacement.status = 'REVIEWING';
  invalidReplacement.contentDigest = 'a'.repeat(64);
  await assert.rejects(
    async () => validatePlanRecord(invalidReplacement),
    (error) => error.code === 'INVALID_PLAN_HISTORY',
  );
});

test('review decision evidence must be a structured object', async () => {
  const record = createPlanRecord(await createCommand());
  assert.throws(
    () => createPlanReviewDecision({
      planId: record.planId,
      projectId: record.projectId,
      planRevision: record.revision,
      decision: 'APPROVE',
      reviewer: 'reviewer-one',
      at: T2,
      reason: 'invalid evidence shape',
      evidence: ['not-an-object'],
    }),
    (error) => error.code === 'INVALID_PLAN_REVIEW_EVIDENCE',
  );
});
