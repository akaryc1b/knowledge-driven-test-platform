import test from 'node:test';
import assert from 'node:assert/strict';
import { GovernanceError } from '../src/index.js';
import {
  createAndSubmit,
  createFixture,
  knowledge,
  PROJECT,
  reviewCommand,
  T0,
  T1,
  T3,
  T4,
  T5,
} from './test-helpers.js';

test('unauthorized actor cannot create project knowledge', async () => {
  const fixture = createFixture();
  await assert.rejects(
    fixture.service.createDraft({
      projectId: PROJECT,
      knowledge: knowledge(),
      actor: 'intruder',
      at: T0,
      reason: 'unauthorized create',
    }),
    (error) => error instanceof GovernanceError && error.code === 'GOVERNANCE_FORBIDDEN',
  );
});

test('original author is required to submit by default', async () => {
  const fixture = createFixture({
    grants: [{ projectId: PROJECT, actor: 'delegate', actions: ['KNOWLEDGE_SUBMIT'], roles: [] }],
  });
  const record = await fixture.service.createDraft({
    projectId: PROJECT,
    knowledge: knowledge(),
    actor: 'author',
    at: T0,
    reason: 'create draft',
  });
  await assert.rejects(
    fixture.service.submitForReview({
      projectId: PROJECT,
      id: record.knowledge.id,
      version: record.knowledge.version,
      expectedRevision: record.revision,
      actor: 'delegate',
      at: T1,
      reason: 'delegate submit',
    }),
    (error) => error instanceof GovernanceError && error.code === 'ONLY_ORIGINAL_AUTHOR_CAN_SUBMIT',
  );
});

test('author cannot review their own knowledge even with a review grant', async () => {
  const fixture = createFixture({
    grants: [{ projectId: PROJECT, actor: 'author', actions: ['KNOWLEDGE_REVIEW'], roles: [] }],
  });
  const record = await createAndSubmit(fixture);
  await assert.rejects(
    fixture.service.review(reviewCommand(record, { actor: 'author', decisionId: 'decision:self:review' })),
    (error) => error instanceof GovernanceError && error.code === 'AUTHOR_REVIEW_FORBIDDEN',
  );
});

test('high risk knowledge publishes after one distinct approval', async () => {
  const fixture = createFixture();
  const reviewing = await createAndSubmit(fixture, knowledge({ riskLevel: 'high' }));
  await fixture.service.review(reviewCommand(reviewing));
  const result = await fixture.service.publish({
    projectId: PROJECT,
    id: reviewing.knowledge.id,
    version: reviewing.knowledge.version,
    expectedRevision: reviewing.revision,
    actor: 'publisher',
    at: T3,
    reason: 'publish approved knowledge',
  });
  assert.equal(result.record.knowledge.status, 'PUBLISHED');
  assert.deepEqual(result.evidence.reviewers, ['reviewer-1']);
});

test('critical knowledge requires two distinct reviewers', async () => {
  const fixture = createFixture();
  const reviewing = await createAndSubmit(fixture, knowledge({ riskLevel: 'critical' }));
  await fixture.service.review(reviewCommand(reviewing));
  await assert.rejects(
    fixture.service.publish({
      projectId: PROJECT,
      id: reviewing.knowledge.id,
      version: reviewing.knowledge.version,
      expectedRevision: reviewing.revision,
      actor: 'publisher',
      at: T3,
      reason: 'publish with one approval',
    }),
    (error) => error instanceof GovernanceError && error.code === 'INSUFFICIENT_APPROVALS',
  );
  await fixture.service.review(reviewCommand(reviewing, {
    actor: 'reviewer-2',
    decisionId: 'decision:critical:reviewer-2',
    at: T3,
  }));
  const published = await fixture.service.publish({
    projectId: PROJECT,
    id: reviewing.knowledge.id,
    version: reviewing.knowledge.version,
    expectedRevision: reviewing.revision,
    actor: 'publisher',
    at: T4,
    reason: 'publish with two approvals',
  });
  assert.equal(published.record.knowledge.status, 'PUBLISHED');
  assert.deepEqual(published.evidence.reviewers, ['reviewer-1', 'reviewer-2']);
});

test('request changes returns to draft and invalidates approvals from the previous revision', async () => {
  const fixture = createFixture();
  let record = await createAndSubmit(fixture, knowledge({ riskLevel: 'critical' }));
  await fixture.service.review(reviewCommand(record));
  const changes = await fixture.service.review(reviewCommand(record, {
    actor: 'reviewer-2',
    decisionId: 'decision:request-changes',
    decision: 'REQUEST_CHANGES',
    at: T3,
    reason: 'clarify critical acceptance criteria',
  }));
  assert.equal(changes.record.knowledge.status, 'DRAFT');
  record = await fixture.service.replaceDraft({
    projectId: PROJECT,
    id: record.knowledge.id,
    version: record.knowledge.version,
    expectedRevision: changes.record.revision,
    knowledge: knowledge({ riskLevel: 'critical', description: 'clarified' }),
    actor: 'author',
    at: T4,
    reason: 'clarify draft',
  });
  record = await fixture.service.submitForReview({
    projectId: PROJECT,
    id: record.knowledge.id,
    version: record.knowledge.version,
    expectedRevision: record.revision,
    actor: 'author',
    at: T5,
    reason: 'resubmit clarified draft',
  });
  await fixture.service.review(reviewCommand(record, {
    decisionId: 'decision:new-cycle:reviewer-1',
    at: '2026-07-27T12:06:00.000Z',
  }));
  await assert.rejects(
    fixture.service.publish({
      projectId: PROJECT,
      id: record.knowledge.id,
      version: record.knowledge.version,
      expectedRevision: record.revision,
      actor: 'publisher',
      at: '2026-07-27T12:07:00.000Z',
      reason: 'attempt with stale approval',
    }),
    (error) => error instanceof GovernanceError && error.code === 'INSUFFICIENT_APPROVALS',
  );
});

test('author cannot publish their own knowledge', async () => {
  const fixture = createFixture({
    grants: [{ projectId: PROJECT, actor: 'author', actions: ['KNOWLEDGE_PUBLISH'], roles: [] }],
  });
  const reviewing = await createAndSubmit(fixture);
  await fixture.service.review(reviewCommand(reviewing));
  await assert.rejects(
    fixture.service.publish({
      projectId: PROJECT,
      id: reviewing.knowledge.id,
      version: reviewing.knowledge.version,
      expectedRevision: reviewing.revision,
      actor: 'author',
      at: T3,
      reason: 'self publish',
    }),
    (error) => error instanceof GovernanceError && error.code === 'AUTHOR_PUBLISH_FORBIDDEN',
  );
});

test('project grants do not leak to another project', async () => {
  const fixture = createFixture();
  await assert.rejects(
    fixture.service.createDraft({
      projectId: 'inventory-platform',
      knowledge: knowledge({ scope: { level: 'PROJECT', key: 'inventory-platform' } }),
      actor: 'author',
      at: T0,
      reason: 'cross-project create',
    }),
    (error) => error instanceof GovernanceError && error.code === 'GOVERNANCE_FORBIDDEN',
  );
});

test('project-scoped knowledge must match the governance project', async () => {
  const fixture = createFixture();
  await assert.rejects(
    fixture.service.createDraft({
      projectId: PROJECT,
      knowledge: knowledge({ scope: { level: 'PROJECT', key: 'inventory-platform' } }),
      actor: 'author',
      at: T0,
      reason: 'mismatched project scope',
    }),
    (error) => error instanceof GovernanceError && error.code === 'KNOWLEDGE_PROJECT_MISMATCH',
  );
});
