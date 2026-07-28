import { validateDigest, validatePlanId } from '@kdtp/test-plan';
import { TestPlanRegistryPort } from './port.js';
import { TestPlanRegistryError } from './errors.js';
import {
  createPlanRecord,
  replaceDraftRecord,
  transitionPlanRecord,
  validatePlanRecord,
  validatePlanRegistryFilter,
  validatePlanReviewDecision,
  validatePlanReviewDecisionFilter,
} from './validation.js';

export class InMemoryTestPlanRegistry extends TestPlanRegistryPort {
  #records = new Map();
  #fingerprints = new Map();
  #decisions = new Map();

  async create(command) {
    const record = createPlanRecord(command);
    if (this.#records.has(record.planId)) {
      throw new TestPlanRegistryError('PLAN_EXISTS', 'Test plan ID already exists', {
        planId: record.planId,
      });
    }
    const existingPlanId = this.#fingerprints.get(record.inputFingerprint);
    if (existingPlanId) {
      throw new TestPlanRegistryError('PLAN_INPUT_EXISTS',
        'A test plan already exists for the canonical planning input', {
          planId: existingPlanId,
          inputFingerprint: record.inputFingerprint,
        });
    }
    this.#records.set(record.planId, record);
    this.#fingerprints.set(record.inputFingerprint, record.planId);
    return structuredClone(record);
  }

  async get(query) {
    const planId = validatePlanId(query?.planId);
    const record = this.#records.get(planId);
    return record ? structuredClone(record) : null;
  }

  async getByFingerprint(query) {
    const inputFingerprint = validateDigest(query?.inputFingerprint, 'inputFingerprint');
    const planId = this.#fingerprints.get(inputFingerprint);
    return planId ? structuredClone(this.#records.get(planId)) : null;
  }

  async list(filter = {}) {
    const normalized = validatePlanRegistryFilter(filter);
    return [...this.#records.values()]
      .filter((record) => matchesFilter(record, normalized))
      .sort((a, b) => a.planId.localeCompare(b.planId))
      .map((record) => structuredClone(record));
  }

  async replaceDraft(command) {
    const planId = validatePlanId(command?.planId);
    const current = this.#require(planId);
    const next = replaceDraftRecord(current, command);
    this.#records.set(planId, next);
    return structuredClone(next);
  }

  async transition(command) {
    const planId = validatePlanId(command?.planId);
    const current = this.#require(planId);
    const next = transitionPlanRecord(current, command);
    this.#records.set(planId, next);
    return structuredClone(next);
  }

  async appendReviewDecision(input) {
    const decision = validatePlanReviewDecision(input);
    const record = this.#require(decision.planId);
    if (record.projectId !== decision.projectId) {
      throw new TestPlanRegistryError('PLAN_REVIEW_BINDING_MISMATCH',
        'Review decision project does not match plan project');
    }
    if (!record.history.some((event) => event.revision === decision.planRevision)) {
      throw new TestPlanRegistryError('PLAN_REVISION_NOT_FOUND',
        'Review decision references an unknown plan revision', {
          planId: decision.planId,
          planRevision: decision.planRevision,
        });
    }
    if (this.#decisions.has(decision.decisionId)) {
      throw new TestPlanRegistryError('PLAN_REVIEW_DECISION_EXISTS',
        'Plan review decision already exists', { decisionId: decision.decisionId });
    }
    const reviewerAlreadyDecided = [...this.#decisions.values()].some((item) =>
      item.planId === decision.planId
      && item.planRevision === decision.planRevision
      && item.reviewer === decision.reviewer);
    if (reviewerAlreadyDecided) {
      throw new TestPlanRegistryError('REVIEWER_ALREADY_DECIDED',
        'Reviewer already recorded a decision for this plan revision', {
          planId: decision.planId,
          planRevision: decision.planRevision,
          reviewer: decision.reviewer,
        });
    }
    this.#decisions.set(decision.decisionId, decision);
    return structuredClone(decision);
  }

  async listReviewDecisions(filter = {}) {
    const normalized = validatePlanReviewDecisionFilter(filter);
    return [...this.#decisions.values()]
      .filter((decision) => matchesDecisionFilter(decision, normalized))
      .sort((a, b) => a.at.localeCompare(b.at) || a.decisionId.localeCompare(b.decisionId))
      .map((decision) => structuredClone(decision));
  }

  #require(planId) {
    const record = this.#records.get(planId);
    if (!record) throw new TestPlanRegistryError('PLAN_NOT_FOUND', 'Test plan was not found', { planId });
    return validatePlanRecord(record);
  }
}

function matchesFilter(record, filter) {
  if (filter.projectId !== undefined && record.projectId !== filter.projectId) return false;
  if (filter.status !== undefined && record.status !== filter.status) return false;
  if (filter.environmentId !== undefined && record.environmentId !== filter.environmentId) return false;
  if (filter.releaseId !== undefined && record.releaseId !== filter.releaseId) return false;
  if (filter.inputFingerprint !== undefined && record.inputFingerprint !== filter.inputFingerprint) return false;
  if (filter.snapshotId !== undefined && record.knowledgeSnapshot.snapshotId !== filter.snapshotId) return false;
  return true;
}

function matchesDecisionFilter(decision, filter) {
  if (filter.planId !== undefined && decision.planId !== filter.planId) return false;
  if (filter.projectId !== undefined && decision.projectId !== filter.projectId) return false;
  if (filter.planRevision !== undefined && decision.planRevision !== filter.planRevision) return false;
  if (filter.decision !== undefined && decision.decision !== filter.decision) return false;
  if (filter.reviewer !== undefined && decision.reviewer !== filter.reviewer) return false;
  return true;
}
