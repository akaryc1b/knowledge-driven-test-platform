import { jsonEqual } from '@kdtp/knowledge-core';
import { KnowledgeSnapshotStorePort } from './ports.js';
import { governanceInvariant } from './errors.js';
import { validateProjectId, validateSnapshotEnvelope } from './validation.js';

export class InMemoryKnowledgeSnapshotStore extends KnowledgeSnapshotStorePort {
  constructor() {
    super();
    this.snapshots = new Map();
  }

  async save(input) {
    const envelope = validateSnapshotEnvelope(input);
    const existing = this.snapshots.get(envelope.snapshotId);
    if (existing) {
      governanceInvariant(jsonEqual(existing, envelope),
        'SNAPSHOT_IMMUTABILITY_CONFLICT', 'Snapshot ID already exists with different content', {
          snapshotId: envelope.snapshotId,
        });
      return structuredClone(existing);
    }
    this.snapshots.set(envelope.snapshotId, structuredClone(envelope));
    return structuredClone(envelope);
  }

  async get(query) {
    governanceInvariant(typeof query?.snapshotId === 'string' && query.snapshotId.length > 0,
      'INVALID_SNAPSHOT_QUERY', 'snapshotId is required');
    const envelope = this.snapshots.get(query.snapshotId);
    return envelope ? structuredClone(envelope) : null;
  }

  async list(filter = {}) {
    if (filter.projectId !== undefined) validateProjectId(filter.projectId);
    const output = [...this.snapshots.values()].filter((envelope) => (
      (filter.projectId === undefined || envelope.projectId === filter.projectId) &&
      (filter.environmentId === undefined || envelope.environmentId === filter.environmentId) &&
      (filter.releaseId === undefined || envelope.releaseId === filter.releaseId)
    ));
    output.sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.snapshotId.localeCompare(right.snapshotId));
    return structuredClone(output);
  }
}
