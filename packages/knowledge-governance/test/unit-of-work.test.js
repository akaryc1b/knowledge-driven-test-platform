import test from 'node:test';
import assert from 'node:assert/strict';
import { InMemoryKnowledgeRegistry } from '@kdtp/knowledge-registry';
import {
  InMemoryKnowledgeSnapshotStore,
  InMemoryReviewDecisionStore,
  PassthroughGovernanceUnitOfWork,
} from '../src/index.js';

test('passthrough governance unit of work supplies configured ports', async () => {
  const registry = new InMemoryKnowledgeRegistry();
  const reviewStore = new InMemoryReviewDecisionStore();
  const snapshotStore = new InMemoryKnowledgeSnapshotStore();
  const unitOfWork = new PassthroughGovernanceUnitOfWork({
    registry,
    reviewStore,
    snapshotStore,
  });
  const result = await unitOfWork.execute((resources) => {
    assert.equal(resources.registry, registry);
    assert.equal(resources.reviewStore, reviewStore);
    assert.equal(resources.snapshotStore, snapshotStore);
    return 'ok';
  });
  assert.equal(result, 'ok');
});
