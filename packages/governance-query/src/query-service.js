import {
  assertKnowledgeRegistryPort,
  compareKnowledgeVersions,
} from '@kdtp/knowledge-registry';
import {
  GovernanceAuditQueryService,
  assertKnowledgeSnapshotStorePort,
  assertProjectAuthorizationPort,
  assertReviewDecisionStorePort,
  validateActor,
  validateProjectId,
} from '@kdtp/knowledge-governance';
import { QUERY_PAGE_SCHEMA_VERSION } from './constants.js';
import { paginate, queryFingerprint } from './cursor.js';
import {
  toKnowledgeDetail,
  toKnowledgeSummary,
  toSnapshotDetail,
  toSnapshotSummary,
  toTimelineDto,
} from './dto.js';
import { QueryError, queryInvariant } from './errors.js';
import {
  normalizeKnowledgeListQuery,
  normalizeSnapshotListQuery,
} from './validation.js';

const RISK_ORDER = Object.freeze({ low: 0, medium: 1, high: 2, critical: 3 });

export class ReadOnlyGovernanceQueryService {
  constructor({ registry, authorization, reviewStore, snapshotStore }) {
    this.registry = assertKnowledgeRegistryPort(registry);
    this.authorization = assertProjectAuthorizationPort(authorization);
    this.reviewStore = assertReviewDecisionStorePort(reviewStore);
    this.snapshotStore = assertKnowledgeSnapshotStorePort(snapshotStore);
    this.audit = new GovernanceAuditQueryService({
      registry: this.registry,
      authorization: this.authorization,
      reviewStore: this.reviewStore,
      snapshotStore: this.snapshotStore,
    });
  }

  async listKnowledge(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    await this.assertAllowed(projectId, actor, 'KNOWLEDGE_READ');
    const normalized = normalizeKnowledgeListQuery(query?.query);
    let records = await this.registry.list({
      scopeLevel: 'PROJECT',
      scopeKey: projectId,
      status: normalized.filter.status,
    });
    records = records.filter((record) => matchesKnowledge(record, normalized.filter));
    records.sort(knowledgeComparator(normalized.sortBy, normalized.direction));
    const summaries = records.map(toKnowledgeSummary);
    const fingerprint = queryFingerprint({
      kind: 'knowledge',
      projectId,
      filter: normalized.filter,
      sortBy: normalized.sortBy,
      direction: normalized.direction,
    });
    const page = paginate(summaries, {
      limit: normalized.limit,
      cursor: normalized.cursor,
      fingerprint,
      itemKey: (item) => item.key,
      itemTuple: (item) => [item[normalized.sortBy], item.key],
    });
    return {
      schemaVersion: QUERY_PAGE_SCHEMA_VERSION,
      projectId,
      sort: { field: normalized.sortBy, direction: normalized.direction },
      ...page,
    };
  }

  async getKnowledge(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    await this.assertAllowed(projectId, actor, 'KNOWLEDGE_READ');
    const record = await this.registry.get({ id: query?.id, version: query?.version });
    return toKnowledgeDetail(requireProjectRecord(record, projectId));
  }

  async getReviewTimeline(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    const timeline = await this.audit.getKnowledgeTimeline({
      projectId,
      id: query?.id,
      version: query?.version,
      actor,
    });
    if (timeline.knowledge.scope.level !== 'PROJECT' || timeline.knowledge.scope.key !== projectId) {
      throw new QueryError('KNOWLEDGE_NOT_FOUND', 'Knowledge was not found');
    }
    return toTimelineDto(timeline);
  }

  async listSnapshots(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    const normalized = normalizeSnapshotListQuery(query?.query);
    const envelopes = await this.audit.listSnapshots({
      projectId,
      actor,
      environmentId: normalized.filter.environmentId,
      releaseId: normalized.filter.releaseId,
    });
    const filtered = envelopes
      .filter((item) => normalized.filter.createdBy === undefined
        || item.createdBy === normalized.filter.createdBy)
      .sort(snapshotComparator(normalized.sortBy, normalized.direction))
      .map(toSnapshotSummary);
    const fingerprint = queryFingerprint({
      kind: 'snapshot',
      projectId,
      filter: normalized.filter,
      sortBy: normalized.sortBy,
      direction: normalized.direction,
    });
    const page = paginate(filtered, {
      limit: normalized.limit,
      cursor: normalized.cursor,
      fingerprint,
      itemKey: (item) => item.snapshotId,
      itemTuple: (item) => [item[normalized.sortBy], item.snapshotId],
    });
    return {
      schemaVersion: QUERY_PAGE_SCHEMA_VERSION,
      projectId,
      sort: { field: normalized.sortBy, direction: normalized.direction },
      ...page,
    };
  }

  async getSnapshot(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    await this.assertAllowed(projectId, actor, 'SNAPSHOT_READ');
    queryInvariant(typeof query?.snapshotId === 'string' && query.snapshotId.length > 0,
      'INVALID_SNAPSHOT_QUERY', 'snapshotId is required');
    const envelope = await this.snapshotStore.get({ snapshotId: query.snapshotId });
    if (!envelope || envelope.projectId !== projectId) {
      throw new QueryError('SNAPSHOT_NOT_FOUND', 'Snapshot was not found');
    }
    return toSnapshotDetail(envelope);
  }

  async assertAllowed(projectId, actor, action) {
    const result = await this.authorization.authorize({ projectId, actor, action });
    queryInvariant(result && typeof result === 'object' && typeof result.allowed === 'boolean',
      'INVALID_AUTHORIZATION_RESULT', 'Authorization port returned an invalid result');
    queryInvariant(result.allowed,
      'GOVERNANCE_FORBIDDEN', 'Actor is not authorized for query action', {
        projectId,
        actor,
        action,
      });
  }
}

function requireProjectRecord(record, projectId) {
  if (!record || record.knowledge.scope.level !== 'PROJECT' || record.knowledge.scope.key !== projectId) {
    throw new QueryError('KNOWLEDGE_NOT_FOUND', 'Knowledge was not found');
  }
  return record;
}

function matchesKnowledge(record, filter) {
  const knowledge = record.knowledge;
  if (filter.riskLevel !== undefined && knowledge.riskLevel !== filter.riskLevel) return false;
  if (filter.id !== undefined && knowledge.id !== filter.id) return false;
  if (filter.boundaryKey !== undefined && knowledge.boundaryKey !== filter.boundaryKey) return false;
  if (filter.owner !== undefined && knowledge.owner !== filter.owner) return false;
  if (filter.enabled !== undefined && knowledge.enabled !== filter.enabled) return false;
  if (filter.search !== undefined) {
    const haystack = [
      knowledge.id,
      knowledge.name,
      knowledge.boundaryKey,
      knowledge.owner,
    ].join('\n').toLocaleLowerCase();
    if (!haystack.includes(filter.search)) return false;
  }
  return true;
}

function knowledgeComparator(sortBy, direction) {
  return (left, right) => {
    let result;
    if (sortBy === 'version') {
      result = compareKnowledgeVersions(left.knowledge.version, right.knowledge.version);
    } else if (sortBy === 'riskLevel') {
      result = RISK_ORDER[left.knowledge.riskLevel] - RISK_ORDER[right.knowledge.riskLevel];
    } else if (sortBy === 'id' || sortBy === 'name' || sortBy === 'status') {
      result = String(left.knowledge[sortBy]).localeCompare(String(right.knowledge[sortBy]));
    } else {
      result = String(left[sortBy]).localeCompare(String(right[sortBy]));
    }
    if (result === 0) result = left.key.localeCompare(right.key);
    return direction === 'asc' ? result : -result;
  };
}

function snapshotComparator(sortBy, direction) {
  return (left, right) => {
    let result = String(left[sortBy]).localeCompare(String(right[sortBy]));
    if (result === 0) result = left.snapshotId.localeCompare(right.snapshotId);
    return direction === 'asc' ? result : -result;
  };
}
