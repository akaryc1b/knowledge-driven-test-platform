import {
  assertKnowledgeRegistryPort,
} from '@kdtp/knowledge-registry';
import {
  assertKnowledgeSnapshotStorePort,
  assertReviewDecisionStorePort,
  GovernanceUnitOfWorkPort,
} from './ports.js';

export class PassthroughGovernanceUnitOfWork extends GovernanceUnitOfWorkPort {
  constructor({ registry, reviewStore, snapshotStore }) {
    super();
    this.resources = {
      registry: assertKnowledgeRegistryPort(registry),
      reviewStore: assertReviewDecisionStorePort(reviewStore),
      snapshotStore: assertKnowledgeSnapshotStorePort(snapshotStore),
    };
  }

  async execute(work) {
    return work(this.resources);
  }
}
