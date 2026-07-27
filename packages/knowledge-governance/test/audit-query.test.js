import test from 'node:test';
import assert from 'node:assert/strict';
import { GovernanceError } from '../src/index.js';
import { createAndSubmit, createFixture, PROJECT, reviewCommand, snapshot, T3 } from './test-helpers.js';

test('audit query merges registry events and review decisions in chronological order', async () => {
  const fixture = createFixture();
  const record = await createAndSubmit(fixture);
  await fixture.service.review(reviewCommand(record));
  const timeline = await fixture.audit.getKnowledgeTimeline({
    projectId: PROJECT,
    id: record.knowledge.id,
    version: record.knowledge.version,
    actor: 'auditor',
  });
  assert.deepEqual(timeline.events.map((event) => event.kind), [
    'REGISTRY_EVENT',
    'REGISTRY_EVENT',
    'REVIEW_DECISION',
  ]);
  assert.equal(timeline.currentStatus, 'REVIEWING');
});

test('audit query enforces project authorization', async () => {
  const fixture = createFixture();
  const record = await createAndSubmit(fixture);
  await assert.rejects(
    fixture.audit.getKnowledgeTimeline({
      projectId: PROJECT,
      id: record.knowledge.id,
      version: record.knowledge.version,
      actor: 'author',
    }),
    (error) => error instanceof GovernanceError && error.code === 'GOVERNANCE_FORBIDDEN',
  );
});

test('snapshot persistence and audit listing remain project scoped', async () => {
  const fixture = createFixture();
  await fixture.service.persistSnapshot({
    projectId: PROJECT,
    snapshot: snapshot(),
    actor: 'snapshot-bot',
    at: T3,
    reason: 'save governed snapshot',
  });
  const listed = await fixture.audit.listSnapshots({ projectId: PROJECT, actor: 'auditor' });
  assert.equal(listed.length, 1);
  assert.equal(listed[0].projectId, PROJECT);
});
