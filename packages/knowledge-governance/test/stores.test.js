import test from 'node:test';
import assert from 'node:assert/strict';
import {
  GovernanceError,
  InMemoryKnowledgeSnapshotStore,
  InMemoryReviewDecisionStore,
  REVIEW_DECISION_SCHEMA_VERSION,
  createSnapshotEnvelope,
} from '../src/index.js';
import { PROJECT, snapshot, T0 } from './test-helpers.js';

test('review decision store is append-only per reviewer and review revision', async () => {
  const store = new InMemoryReviewDecisionStore();
  const decision = {
    schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
    decisionId: 'decision:append-only:0001',
    projectId: PROJECT,
    knowledgeKey: 'PROJECT-APPROVAL-001@1.0.0',
    knowledgeId: 'PROJECT-APPROVAL-001',
    version: '1.0.0',
    reviewRevision: 2,
    decision: 'APPROVE',
    reviewer: 'reviewer-1',
    at: T0,
    reason: 'approve',
  };
  await store.append(decision);
  await assert.rejects(
    store.append({ ...decision, decisionId: 'decision:append-only:0002' }),
    (error) => error instanceof GovernanceError && error.code === 'REVIEWER_ALREADY_DECIDED',
  );
  const listed = await store.list({ projectId: PROJECT });
  listed[0].reason = 'mutated';
  assert.equal((await store.list({ projectId: PROJECT }))[0].reason, 'approve');
});

test('snapshot store is immutable and idempotent for identical content', async () => {
  const store = new InMemoryKnowledgeSnapshotStore();
  const envelope = createSnapshotEnvelope({
    projectId: PROJECT,
    snapshot: snapshot(),
    actor: 'snapshot-bot',
    at: T0,
    reason: 'persist release evidence',
  });
  const first = await store.save(envelope);
  const second = await store.save(envelope);
  assert.deepEqual(first, second);
  const corrupted = structuredClone(envelope);
  corrupted.reason = 'different reason';
  await assert.rejects(
    store.save(corrupted),
    (error) => error instanceof GovernanceError && error.code === 'SNAPSHOT_IMMUTABILITY_CONFLICT',
  );
});

test('snapshot envelope rejects project mismatch and digest tampering', () => {
  const valid = snapshot();
  assert.throws(
    () => createSnapshotEnvelope({
      projectId: 'inventory-platform',
      snapshot: valid,
      actor: 'snapshot-bot',
      at: T0,
      reason: 'wrong project',
    }),
    (error) => error instanceof GovernanceError && error.code === 'SNAPSHOT_PROJECT_MISMATCH',
  );
  assert.throws(
    () => createSnapshotEnvelope({
      projectId: PROJECT,
      snapshot: { ...valid, digest: '0'.repeat(64) },
      actor: 'snapshot-bot',
      at: T0,
      reason: 'tampered digest',
    }),
    (error) => error instanceof GovernanceError && error.code === 'SNAPSHOT_DIGEST_MISMATCH',
  );
});
