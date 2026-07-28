import test from 'node:test';
import assert from 'node:assert/strict';
import { PlanQueryError } from '../src/index.js';
import { createPlanQueryFixture, OTHER_PROJECT, PROJECT } from './test-helpers.js';

test('plan list is project isolated, stable and cursor paginated', async () => {
  const fixture = await createPlanQueryFixture();
  const first = await fixture.service.listPlans({
    projectId: PROJECT,
    actor: 'reader',
    query: { sortBy: 'createdAt', direction: 'asc', limit: 1 },
  });
  assert.equal(first.items.length, 1);
  assert.equal(first.items[0].planId, fixture.frozen.planId);
  assert.equal(first.page.hasMore, true);
  assert.equal(Object.hasOwn(first.items[0], 'inputFingerprint'), false);

  const second = await fixture.service.listPlans({
    projectId: PROJECT,
    actor: 'reader',
    query: {
      sortBy: 'createdAt',
      direction: 'asc',
      limit: 1,
      cursor: first.page.nextCursor,
    },
  });
  assert.deepEqual(second.items.map((item) => item.planId), [fixture.draft.planId]);
  assert.equal(second.page.hasMore, false);
});

test('plan list applies status, snapshot and capability catalog filters', async () => {
  const fixture = await createPlanQueryFixture();
  const frozen = await fixture.service.listPlans({
    projectId: PROJECT,
    actor: 'reader',
    query: { status: 'FROZEN', catalogVersion: '1.0.0' },
  });
  assert.deepEqual(frozen.items.map((item) => item.planId), [fixture.frozen.planId]);

  const snapshot = await fixture.service.listPlans({
    projectId: PROJECT,
    actor: 'reader',
    query: { snapshotId: fixture.draft.knowledgeSnapshot.snapshotId },
  });
  assert.deepEqual(snapshot.items.map((item) => item.planId), [fixture.draft.planId]);
});

test('plan detail returns executor-independent content without registry fingerprint', async () => {
  const fixture = await createPlanQueryFixture();
  const detail = await fixture.service.getPlan({
    projectId: PROJECT,
    actor: 'reader',
    planId: fixture.frozen.planId,
  });
  assert.equal(detail.status, 'FROZEN');
  assert.equal(detail.revision, 4);
  assert.equal(detail.intents.length, 1);
  assert.equal(detail.dependencyDag.topologicalOrder.length, 1);
  assert.equal(Object.hasOwn(detail, 'inputFingerprint'), false);
  assert.equal(JSON.stringify(detail).includes('postgresql://'), false);
});

test('coverage and provenance views bind to the same current plan revision', async () => {
  const fixture = await createPlanQueryFixture();
  const coverage = await fixture.service.getCoverage({
    projectId: PROJECT,
    actor: 'reader',
    planId: fixture.frozen.planId,
  });
  const provenance = await fixture.service.getProvenance({
    projectId: PROJECT,
    actor: 'reader',
    planId: fixture.frozen.planId,
  });
  assert.equal(coverage.revision, 4);
  assert.equal(provenance.revision, coverage.revision);
  assert.equal(provenance.contentDigest, coverage.contentDigest);
  assert.equal(coverage.matrix.summary.covered, 1);
  assert.ok(provenance.graph.edges.length > 0);
});

test('timeline requires audit authorization and merges history with review evidence', async () => {
  const fixture = await createPlanQueryFixture();
  const timeline = await fixture.service.getTimeline({
    projectId: PROJECT,
    actor: 'auditor',
    planId: fixture.frozen.planId,
  });
  assert.equal(timeline.status, 'FROZEN');
  assert.equal(timeline.events.length, 5);
  assert.equal(timeline.events.filter((item) => item.kind === 'PLAN_REVIEW_DECISION').length, 1);
  assert.deepEqual(timeline.events.map((item) => item.at), [...timeline.events.map((item) => item.at)].sort());

  await assert.rejects(
    fixture.service.getTimeline({
      projectId: PROJECT,
      actor: 'reader',
      planId: fixture.frozen.planId,
    }),
    (error) => error instanceof PlanQueryError && error.code === 'PLAN_QUERY_FORBIDDEN',
  );
});

test('authorization and project binding prevent cross-project plan disclosure', async () => {
  const fixture = await createPlanQueryFixture();
  await assert.rejects(
    fixture.service.listPlans({ projectId: OTHER_PROJECT, actor: 'reader', query: {} }),
    (error) => error.code === 'PLAN_QUERY_FORBIDDEN',
  );
  await assert.rejects(
    fixture.service.getPlan({
      projectId: PROJECT,
      actor: 'reader',
      planId: fixture.other.planId,
    }),
    (error) => error.code === 'PLAN_NOT_FOUND',
  );
});

test('cursor is bound to normalized plan filters', async () => {
  const fixture = await createPlanQueryFixture();
  const first = await fixture.service.listPlans({
    projectId: PROJECT,
    actor: 'reader',
    query: { sortBy: 'createdAt', direction: 'asc', limit: 1 },
  });
  await assert.rejects(
    fixture.service.listPlans({
      projectId: PROJECT,
      actor: 'reader',
      query: {
        sortBy: 'createdAt',
        direction: 'asc',
        limit: 1,
        status: 'FROZEN',
        cursor: first.page.nextCursor,
      },
    }),
    (error) => error.code === 'CURSOR_QUERY_MISMATCH',
  );
});
