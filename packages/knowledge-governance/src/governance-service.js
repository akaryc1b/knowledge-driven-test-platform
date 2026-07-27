import {
  assertKnowledgeRegistryPort,
  knowledgeKey,
  validateExpectedRevision,
} from '@kdtp/knowledge-registry';
import {
  REVIEW_DECISION_SCHEMA_VERSION,
} from './constants.js';
import { GovernanceError, governanceInvariant } from './errors.js';
import { PassthroughGovernanceUnitOfWork } from './passthrough-unit-of-work.js';
import {
  assertGovernanceUnitOfWorkPort,
  assertKnowledgeSnapshotStorePort,
  assertProjectAuthorizationPort,
  assertReviewDecisionStorePort,
} from './ports.js';
import { GovernancePolicy } from './policy.js';
import {
  createSnapshotEnvelope,
  validateActor,
  validateProjectId,
} from './validation.js';

export class KnowledgeGovernanceService {
  constructor({ registry, authorization, reviewStore, snapshotStore, unitOfWork, policy = new GovernancePolicy() }) {
    this.registry = assertKnowledgeRegistryPort(registry);
    this.authorization = assertProjectAuthorizationPort(authorization);
    this.reviewStore = assertReviewDecisionStorePort(reviewStore);
    this.snapshotStore = assertKnowledgeSnapshotStorePort(snapshotStore);
    this.unitOfWork = unitOfWork === undefined
      ? new PassthroughGovernanceUnitOfWork({
        registry: this.registry,
        reviewStore: this.reviewStore,
        snapshotStore: this.snapshotStore,
      })
      : assertGovernanceUnitOfWorkPort(unitOfWork);
    governanceInvariant(policy instanceof GovernancePolicy,
      'INVALID_GOVERNANCE_POLICY', 'policy must be a GovernancePolicy');
    this.policy = policy;
  }

  async createDraft(command) {
    const projectId = validateProjectId(command?.projectId);
    assertProjectBinding(projectId, command?.knowledge);
    await this.assertAuthorized(projectId, command?.actor, 'KNOWLEDGE_CREATE', {
      knowledgeId: command?.knowledge?.id,
      version: command?.knowledge?.version,
    });
    return this.unitOfWork.execute(({ registry }) => registry.createDraft(command));
  }

  async replaceDraft(command) {
    const projectId = validateProjectId(command?.projectId);
    const visible = await this.requireRecord(this.registry, command, projectId);
    await this.assertAuthorized(projectId, command?.actor, 'KNOWLEDGE_EDIT', resource(visible));
    assertProjectBinding(projectId, command?.knowledge);
    return this.unitOfWork.execute(async ({ registry }) => {
      const current = await this.requireRecord(registry, command, projectId);
      governanceInvariant(current.revision === command?.expectedRevision,
        'REVISION_CONFLICT', 'Draft replacement revision changed before transaction', {
          key: current.key,
          expectedRevision: command?.expectedRevision,
          actualRevision: current.revision,
        });
      return registry.replaceDraft(command);
    });
  }

  async submitForReview(command) {
    const projectId = validateProjectId(command?.projectId);
    const visible = await this.requireRecord(this.registry, command, projectId);
    await this.assertAuthorized(projectId, command?.actor, 'KNOWLEDGE_SUBMIT', resource(visible));
    return this.unitOfWork.execute(async ({ registry }) => {
      const record = await this.requireRecord(registry, command, projectId);
      this.policy.assertSubmitAllowed(record, command?.actor);
      return registry.transition({
        id: record.knowledge.id,
        version: record.knowledge.version,
        expectedRevision: command?.expectedRevision,
        toStatus: 'REVIEWING',
        actor: command?.actor,
        at: command?.at,
        reason: command?.reason,
      });
    });
  }

  async review(command) {
    const projectId = validateProjectId(command?.projectId);
    const visible = await this.requireRecord(this.registry, command, projectId);
    await this.assertAuthorized(projectId, command?.actor, 'KNOWLEDGE_REVIEW', resource(visible));
    return this.unitOfWork.execute(async ({ registry, reviewStore }) => {
      const record = await this.requireRecord(registry, command, projectId);
      validateExpectedRevision(command?.expectedRevision);
      governanceInvariant(record.revision === command.expectedRevision,
        'REVISION_CONFLICT', 'Governance review revision does not match registry revision', {
          expectedRevision: command.expectedRevision,
          actualRevision: record.revision,
          key: record.key,
        });
      governanceInvariant(record.knowledge.status === 'REVIEWING',
        'KNOWLEDGE_NOT_REVIEWING', 'Only REVIEWING knowledge can receive a review decision', {
          key: record.key,
          status: record.knowledge.status,
        });
      this.policy.assertReviewerAllowed(record, command?.actor);
      const decision = await reviewStore.append({
        schemaVersion: REVIEW_DECISION_SCHEMA_VERSION,
        decisionId: command?.decisionId,
        projectId,
        knowledgeKey: record.key,
        knowledgeId: record.knowledge.id,
        version: record.knowledge.version,
        reviewRevision: record.revision,
        decision: command?.decision,
        reviewer: command?.actor,
        at: command?.at,
        reason: command?.reason,
      });
      if (decision.decision === 'REQUEST_CHANGES') {
        const transitioned = await registry.transition({
          id: record.knowledge.id,
          version: record.knowledge.version,
          expectedRevision: record.revision,
          toStatus: 'DRAFT',
          actor: command?.actor,
          at: command?.at,
          reason: command?.reason,
        });
        return { decision, record: transitioned };
      }
      return { decision, record };
    });
  }

  async publish(command) {
    const projectId = validateProjectId(command?.projectId);
    const visible = await this.requireRecord(this.registry, command, projectId);
    await this.assertAuthorized(projectId, command?.actor, 'KNOWLEDGE_PUBLISH', resource(visible));
    return this.unitOfWork.execute(async ({ registry, reviewStore }) => {
      const record = await this.requireRecord(registry, command, projectId);
      validateExpectedRevision(command?.expectedRevision);
      governanceInvariant(record.revision === command.expectedRevision,
        'REVISION_CONFLICT', 'Publish revision does not match registry revision', {
          expectedRevision: command.expectedRevision,
          actualRevision: record.revision,
          key: record.key,
        });
      const decisions = await reviewStore.list({
        projectId,
        knowledgeKey: record.key,
        reviewRevision: record.revision,
      });
      const evidence = this.policy.evaluatePublish(record, decisions, command?.actor);
      const published = await registry.transition({
        id: record.knowledge.id,
        version: record.knowledge.version,
        expectedRevision: record.revision,
        toStatus: 'PUBLISHED',
        actor: command?.actor,
        at: command?.at,
        reason: command?.reason,
      });
      return { record: published, evidence };
    });
  }

  async deprecate(command) {
    return this.transitionGoverned(command, 'KNOWLEDGE_DEPRECATE', 'DEPRECATED');
  }

  async archive(command) {
    return this.transitionGoverned(command, 'KNOWLEDGE_ARCHIVE', 'ARCHIVED');
  }

  async persistSnapshot(command) {
    const envelope = createSnapshotEnvelope(command);
    await this.assertAuthorized(envelope.projectId, command?.actor, 'SNAPSHOT_PERSIST', {
      snapshotId: envelope.snapshotId,
      environmentId: envelope.environmentId,
      releaseId: envelope.releaseId,
    });
    return this.unitOfWork.execute(({ snapshotStore }) => snapshotStore.save(envelope));
  }

  async transitionGoverned(command, action, toStatus) {
    const projectId = validateProjectId(command?.projectId);
    const visible = await this.requireRecord(this.registry, command, projectId);
    await this.assertAuthorized(projectId, command?.actor, action, resource(visible));
    return this.unitOfWork.execute(async ({ registry }) => {
      const record = await this.requireRecord(registry, command, projectId);
      return registry.transition({
        id: record.knowledge.id,
        version: record.knowledge.version,
        expectedRevision: command?.expectedRevision,
        toStatus,
        actor: command?.actor,
        at: command?.at,
        reason: command?.reason,
      });
    });
  }

  async requireRecord(registry, command, projectId) {
    const key = knowledgeKey(command?.id, command?.version);
    const record = await registry.get({ id: command?.id, version: command?.version });
    if (!record) throw new GovernanceError('KNOWLEDGE_NOT_FOUND', `Knowledge ${key} was not found`, { key });
    assertProjectBinding(projectId, record.knowledge);
    return record;
  }

  async assertAuthorized(projectId, actorInput, action, resourceInput) {
    const actor = validateActor(actorInput);
    const result = await this.authorization.authorize({ projectId, actor, action, resource: resourceInput });
    governanceInvariant(result && typeof result === 'object' && typeof result.allowed === 'boolean',
      'INVALID_AUTHORIZATION_RESULT', 'Authorization port returned an invalid result', { action });
    governanceInvariant(result.allowed,
      'GOVERNANCE_FORBIDDEN', 'Actor is not authorized for governance action', {
        projectId,
        actor,
        action,
        reason: result.reason,
      });
    return result;
  }
}

function resource(record) {
  return {
    knowledgeKey: record.key,
    knowledgeId: record.knowledge.id,
    version: record.knowledge.version,
    scope: structuredClone(record.knowledge.scope),
    status: record.knowledge.status,
    riskLevel: record.knowledge.riskLevel,
  };
}

function assertProjectBinding(projectId, knowledge) {
  if (knowledge?.scope?.level === 'PROJECT') {
    governanceInvariant(knowledge.scope.key === projectId,
      'KNOWLEDGE_PROJECT_MISMATCH', 'Project-scoped knowledge does not belong to governance project', {
        projectId,
        scopeKey: knowledge.scope.key,
        knowledgeId: knowledge.id,
      });
  }
}
