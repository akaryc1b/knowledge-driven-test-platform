import assert from 'node:assert/strict';
import { buildKnowledgeSnapshot } from '@kdtp/knowledge-core';
import {
  REVIEW_DECISION_SCHEMA_VERSION,
  createSnapshotEnvelope,
} from '../src/index.js';

export function defineAuthorizationContract(test, createAuthorization, lifecycle = {}) {
  test('authorization adapter contract: project grants are isolated and defensive',
    { concurrency: false }, async () => {
      await lifecycle.beforeEach?.();
      const authorization = await createAuthorization();
      authorization.grant({
        projectId: 'approval-platform',
        actor: 'reviewer',
        actions: ['KNOWLEDGE_REVIEW'],
        roles: ['reviewer'],
      });
      const allowed = await authorization.authorize({
        projectId: 'approval-platform', actor: 'reviewer', action: 'KNOWLEDGE_REVIEW',
      });
      const denied = await authorization.authorize({
        projectId: 'inventory-platform', actor: 'reviewer', action: 'KNOWLEDGE_REVIEW',
      });
      assert.equal(allowed.allowed, true);
      assert.equal(denied.allowed, false);
      allowed.roles.push('mutated');
      assert.deepEqual((await authorization.authorize({
        projectId: 'approval-platform', actor: 'reviewer', action: 'KNOWLEDGE_REVIEW',
      })).roles, ['reviewer']);
    });
}

export function defineReviewStoreContract(test, createStore, lifecycle = {}) {
  test('review store adapter contract: decisions are append-only and queryable by revision',
    { concurrency: false }, async () => {
      await lifecycle.beforeEach?.();
      const store = await createStore();
      const first = decision({ decisionId: 'decision:contract:0001', reviewRevision: 2 });
      const second = decision({
        decisionId: 'decision:contract:0002', reviewRevision: 5, reviewer: 'reviewer-2',
      });
      await store.append(first);
      await store.append(second);
      assert.deepEqual(
        (await store.list({ projectId: 'approval-platform', reviewRevision: 5 }))
          .map((item) => item.decisionId),
        ['decision:contract:0002'],
      );
      const listed = await store.list({ projectId: 'approval-platform' });
      listed[0].reason = 'mutated';
      assert.equal((await store.list({ projectId: 'approval-platform' }))[0].reason,
        'contract approval');
    });
}

export function defineSnapshotStoreContract(test, createStore, lifecycle = {}) {
  test('snapshot store adapter contract: immutable ID and project filters',
    { concurrency: false }, async () => {
      await lifecycle.beforeEach?.();
      const store = await createStore();
      const envelope = createSnapshotEnvelope({
        projectId: 'approval-platform',
        snapshot: buildKnowledgeSnapshot({
          context: {
            globalId: 'company', projectId: 'approval-platform',
            environmentId: 'staging', releaseId: 'contract', domainPacks: [],
          },
          rules: [], resolution: [],
        }),
        actor: 'snapshot-bot',
        at: '2026-07-27T12:00:00.000Z',
        reason: 'contract snapshot',
      });
      await store.save(envelope);
      assert.equal((await store.get({ snapshotId: envelope.snapshotId })).digest, envelope.digest);
      assert.equal((await store.list({ projectId: 'approval-platform' })).length, 1);
      assert.equal((await store.list({ projectId: 'inventory-platform' })).length, 0);
    });
}

function decision(overrides = {}) {
  return {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: 'decision:contract:default',
    projectId: 'approval-platform',
    knowledgeKey: 'PROJECT-APPROVAL-001@1.0.0',
    knowledgeId: 'PROJECT-APPROVAL-001',
    version: '1.0.0',
    reviewRevision: 2,
    decision: 'APPROVE',
    reviewer: 'reviewer-1',
    at: '2026-07-27T12:00:00.000Z',
    reason: 'contract approval',
    ...overrides,
  };
}
