import test from 'node:test';
import assert from 'node:assert/strict';
import { QueryError } from '../src/index.js';
import { createQueryFixture, OTHER_PROJECT, PROJECT } from './test-helpers.js';

test('knowledge list is project isolated, filterable and cursor paginated', async () => {
  const fixture = await createQueryFixture();
  const first = await fixture.service.listKnowledge({
    projectId: PROJECT,
    actor: 'knowledge-reader',
    query: { sortBy: 'id', direction: 'asc', limit: 1 },
  });
  assert.equal(first.items.length, 1);
  assert.equal(first.page.hasMore, true);
  assert.equal(first.items[0].id, 'PROJECT-APPROVAL-001');

  const second = await fixture.service.listKnowledge({
    projectId: PROJECT,
    actor: 'knowledge-reader',
    query: {
      sortBy: 'id',
      direction: 'asc',
      limit: 1,
      cursor: first.page.nextCursor,
    },
  });
  assert.deepEqual(second.items.map((item) => item.id), ['PROJECT-PERMISSION-001']);

  const filtered = await fixture.service.listKnowledge({
    projectId: PROJECT,
    actor: 'knowledge-reader',
    query: { riskLevel: 'critical' },
  });
  assert.deepEqual(filtered.items.map((item) => item.owner), ['security-team']);
});

test('knowledge detail hides other projects and shared scopes', async () => {
  const fixture = await createQueryFixture();
  const detail = await fixture.service.getKnowledge({
    projectId: PROJECT,
    actor: 'knowledge-reader',
    id: fixture.approval.knowledge.id,
    version: '1.0.0',
  });
  assert.equal(detail.status, 'PUBLISHED');
  assert.equal(detail.historyCount, 3);

  await assert.rejects(
    fixture.service.getKnowledge({
      projectId: PROJECT,
      actor: 'knowledge-reader',
      id: 'PROJECT-INVENTORY-001',
      version: '1.0.0',
    }),
    (error) => error instanceof QueryError && error.code === 'KNOWLEDGE_NOT_FOUND',
  );
  await assert.rejects(
    fixture.service.getKnowledge({
      projectId: PROJECT,
      actor: 'knowledge-reader',
      id: 'GLOBAL-SECURITY-001',
      version: '1.0.0',
    }),
    (error) => error instanceof QueryError && error.code === 'KNOWLEDGE_NOT_FOUND',
  );
});

test('knowledge query requires explicit project read authorization', async () => {
  const fixture = await createQueryFixture();
  await assert.rejects(
    fixture.service.listKnowledge({
      projectId: PROJECT,
      actor: 'forbidden',
      query: {},
    }),
    (error) => error instanceof QueryError && error.code === 'GOVERNANCE_FORBIDDEN',
  );
  await assert.rejects(
    fixture.service.listKnowledge({
      projectId: OTHER_PROJECT,
      actor: 'knowledge-reader',
      query: {},
    }),
    (error) => error instanceof QueryError && error.code === 'GOVERNANCE_FORBIDDEN',
  );
});

test('review timeline exposes normalized registry and approval events', async () => {
  const fixture = await createQueryFixture();
  const timeline = await fixture.service.getReviewTimeline({
    projectId: PROJECT,
    actor: 'auditor',
    id: fixture.approval.knowledge.id,
    version: '1.0.0',
  });
  assert.equal(timeline.currentStatus, 'PUBLISHED');
  assert.deepEqual(timeline.events.map((event) => event.kind), [
    'REGISTRY_EVENT',
    'REGISTRY_EVENT',
    'REVIEW_DECISION',
    'REGISTRY_EVENT',
  ]);
  assert.equal(timeline.events[2].reviewRevision, 2);
});

test('snapshot list and detail remain project isolated', async () => {
  const fixture = await createQueryFixture();
  const first = await fixture.service.listSnapshots({
    projectId: PROJECT,
    actor: 'snapshot-reader',
    query: { sortBy: 'createdAt', direction: 'asc', limit: 1 },
  });
  assert.equal(first.items.length, 1);
  assert.equal(first.page.hasMore, true);

  const detail = await fixture.service.getSnapshot({
    projectId: PROJECT,
    actor: 'snapshot-reader',
    snapshotId: fixture.snapshots[0].snapshotId,
  });
  assert.equal(detail.releaseId, 'M1-E-a');
  assert.equal(detail.snapshot.context.projectId, PROJECT);

  await assert.rejects(
    fixture.service.getSnapshot({
      projectId: OTHER_PROJECT,
      actor: 'snapshot-reader',
      snapshotId: fixture.snapshots[0].snapshotId,
    }),
    (error) => error.code === 'GOVERNANCE_FORBIDDEN',
  );
});

test('cursor is bound to the normalized query filters', async () => {
  const fixture = await createQueryFixture();
  const first = await fixture.service.listKnowledge({
    projectId: PROJECT,
    actor: 'knowledge-reader',
    query: { limit: 1, sortBy: 'id', direction: 'asc' },
  });
  await assert.rejects(
    fixture.service.listKnowledge({
      projectId: PROJECT,
      actor: 'knowledge-reader',
      query: {
        limit: 1,
        sortBy: 'id',
        direction: 'asc',
        status: 'PUBLISHED',
        cursor: first.page.nextCursor,
      },
    }),
    (error) => error instanceof QueryError && error.code === 'CURSOR_QUERY_MISMATCH',
  );
});
