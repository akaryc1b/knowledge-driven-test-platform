import test from 'node:test';
import {
  InMemoryKnowledgeSnapshotStore,
  InMemoryProjectAuthorization,
  InMemoryReviewDecisionStore,
} from '../src/index.js';
import {
  defineAuthorizationContract,
  defineReviewStoreContract,
  defineSnapshotStoreContract,
} from './contracts.js';

defineAuthorizationContract(test, async () => new InMemoryProjectAuthorization());
defineReviewStoreContract(test, async () => new InMemoryReviewDecisionStore());
defineSnapshotStoreContract(test, async () => new InMemoryKnowledgeSnapshotStore());
