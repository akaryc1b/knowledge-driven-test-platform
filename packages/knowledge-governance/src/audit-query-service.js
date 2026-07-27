import { assertKnowledgeRegistryPort, knowledgeKey } from '@kdtp/knowledge-registry';
import { GovernanceError } from './errors.js';
import {
  assertKnowledgeSnapshotStorePort,
  assertProjectAuthorizationPort,
  assertReviewDecisionStorePort,
} from './ports.js';
import { validateActor, validateProjectId } from './validation.js';

export class GovernanceAuditQueryService {
  constructor({ registry, authorization, reviewStore, snapshotStore }) {
    this.registry = assertKnowledgeRegistryPort(registry);
    this.authorization = assertProjectAuthorizationPort(authorization);
    this.reviewStore = assertReviewDecisionStorePort(reviewStore);
    this.snapshotStore = assertKnowledgeSnapshotStorePort(snapshotStore);
  }

  async getKnowledgeTimeline(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    await assertAllowed(this.authorization, { projectId, actor, action: 'AUDIT_READ' });
    const key = knowledgeKey(query?.id, query?.version);
    const record = await this.registry.get({ id: query?.id, version: query?.version });
    if (!record) throw new GovernanceError('KNOWLEDGE_NOT_FOUND', `Knowledge ${key} was not found`, { key });
    if (record.knowledge.scope.level === 'PROJECT' && record.knowledge.scope.key !== projectId) {
      throw new GovernanceError('KNOWLEDGE_PROJECT_MISMATCH', 'Project-scoped knowledge does not belong to audit project', {
        projectId,
        scopeKey: record.knowledge.scope.key,
        key,
      });
    }
    const decisions = await this.reviewStore.list({ projectId, knowledgeKey: key });
    const events = [
      ...record.history.map((event) => ({
        kind: 'REGISTRY_EVENT',
        eventType: event.type,
        at: event.at,
        actor: event.actor,
        reason: event.reason,
        sequence: event.sequence,
        fromStatus: event.fromStatus,
        toStatus: event.toStatus,
      })),
      ...decisions.map((decision) => ({
        kind: 'REVIEW_DECISION',
        eventType: decision.decision,
        at: decision.at,
        actor: decision.reviewer,
        reason: decision.reason,
        decisionId: decision.decisionId,
        reviewRevision: decision.reviewRevision,
      })),
    ].sort(compareEvents);
    return {
      projectId,
      key,
      currentStatus: record.knowledge.status,
      revision: record.revision,
      knowledge: structuredClone(record.knowledge),
      events,
    };
  }

  async listSnapshots(query) {
    const projectId = validateProjectId(query?.projectId);
    const actor = validateActor(query?.actor);
    await assertAllowed(this.authorization, { projectId, actor, action: 'SNAPSHOT_READ' });
    return this.snapshotStore.list({
      projectId,
      environmentId: query?.environmentId,
      releaseId: query?.releaseId,
    });
  }
}

async function assertAllowed(authorization, request) {
  const result = await authorization.authorize(request);
  if (!result?.allowed) {
    throw new GovernanceError('GOVERNANCE_FORBIDDEN', 'Actor is not authorized for governance query', {
      ...request,
      reason: result?.reason,
    });
  }
}

function compareEvents(left, right) {
  return left.at.localeCompare(right.at)
    || eventPriority(left) - eventPriority(right)
    || String(left.sequence ?? left.decisionId).localeCompare(String(right.sequence ?? right.decisionId));
}

function eventPriority(event) {
  return event.kind === 'REGISTRY_EVENT' ? 0 : 1;
}
