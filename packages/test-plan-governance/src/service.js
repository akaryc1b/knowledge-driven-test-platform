import { assertProjectAuthorizationPort } from '@kdtp/knowledge-governance';
import { createPlanReviewDecision, validatePlanRecord } from '@kdtp/test-plan-registry';
import { PLAN_GOVERNANCE_ACTIONS } from './constants.js';
import { PlanGovernanceError, planGovernanceInvariant } from './errors.js';
import { evaluateCoverageGate, normalizePlanApprovalPolicy } from './policy.js';

export class TestPlanGovernanceService {
  constructor({ registry, authorization, policy }) {
    planGovernanceInvariant(registry && typeof registry === 'object', 'INVALID_PLAN_REGISTRY', 'registry is required');
    for (const method of ['create', 'get', 'replaceDraft', 'transition', 'appendReviewDecision', 'listReviewDecisions']) {
      planGovernanceInvariant(typeof registry[method] === 'function', 'INVALID_PLAN_REGISTRY', `registry is missing ${method}`);
    }
    this.registry = registry;
    this.authorization = assertProjectAuthorizationPort(authorization);
    this.policy = normalizePlanApprovalPolicy(policy);
  }

  async create(command) { return this.#create(command, 'PLAN_CREATE'); }
  async generate(command) { return this.#create(command, 'PLAN_GENERATE'); }

  async edit(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_EDIT');
    return this.registry.replaceDraft(command);
  }

  async submit(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_SUBMIT');
    planGovernanceInvariant(command.actor === record.createdBy, 'PLAN_SUBMITTER_NOT_GENERATOR',
      'Only the plan generator can submit the plan', { planId: record.planId });
    return this.registry.transition({ ...command, expectedRevision: record.revision, toStatus: 'REVIEWING' });
  }

  async review(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_REVIEW');
    planGovernanceInvariant(['REVIEWING', 'APPROVED'].includes(record.status), 'PLAN_NOT_REVIEWABLE',
      'Plan must be REVIEWING or APPROVED to record review evidence');
    planGovernanceInvariant(command.actor !== record.createdBy, 'PLAN_SELF_REVIEW_FORBIDDEN',
      'Plan generator cannot review their own plan');
    const decision = createPlanReviewDecision({
      planId: record.planId,
      projectId: record.projectId,
      planRevision: record.revision,
      decision: command.decision,
      reviewer: command.actor,
      at: command.at,
      reason: command.reason,
      evidence: command.evidence ?? {},
    });
    const stored = await this.registry.appendReviewDecision(decision);
    if (stored.decision === 'REQUEST_CHANGES') {
      const next = await this.registry.transition({
        planId: record.planId,
        expectedRevision: record.revision,
        toStatus: 'DRAFT',
        actor: command.actor,
        at: command.at,
        reason: command.reason,
      });
      return { decision: stored, record: next };
    }
    return { decision: stored, record };
  }

  async approve(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_APPROVE');
    planGovernanceInvariant(record.status === 'REVIEWING', 'PLAN_NOT_APPROVABLE', 'Plan must be REVIEWING');
    planGovernanceInvariant(command.actor !== record.createdBy, 'PLAN_CREATOR_CANNOT_APPROVE',
      'Plan generator cannot approve the plan');
    const decisions = await this.registry.listReviewDecisions({
      planId: record.planId, projectId: record.projectId, planRevision: record.revision,
    });
    const gate = evaluateCoverageGate(record, decisions, this.policy);
    planGovernanceInvariant(gate.passed, 'PLAN_APPROVAL_GATE_FAILED', 'Plan approval gate failed', gate);
    const next = await this.registry.transition({
      planId: record.planId, expectedRevision: record.revision, toStatus: 'APPROVED',
      actor: command.actor, at: command.at, reason: command.reason,
    });
    return { record: next, gate };
  }

  async freeze(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_FREEZE');
    planGovernanceInvariant(record.status === 'APPROVED', 'PLAN_NOT_FREEZABLE', 'Plan must be APPROVED');
    const reviewRevision = record.revision - 1;
    const decisions = await this.registry.listReviewDecisions({
      planId: record.planId, projectId: record.projectId, planRevision: reviewRevision,
    });
    const reviewers = new Set(decisions.filter((item) => item.decision === 'APPROVE').map((item) => item.reviewer));
    planGovernanceInvariant(!reviewers.has(command.actor), 'REVIEWER_CANNOT_FREEZE',
      'A reviewer of the approved revision cannot freeze the plan');
    const reviewedRecord = { ...record, revision: reviewRevision };
    const gate = evaluateCoverageGate(reviewedRecord, decisions, this.policy);
    planGovernanceInvariant(gate.passed, 'PLAN_FREEZE_GATE_FAILED', 'Plan freeze gate failed', gate);
    const next = await this.registry.transition({
      planId: record.planId, expectedRevision: record.revision, toStatus: 'FROZEN',
      actor: command.actor, at: command.at, reason: command.reason,
    });
    return { record: next, gate };
  }

  async read(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_READ');
    return record;
  }

  async auditTimeline(command) {
    const record = await this.#record(command?.planId);
    await this.#authorize(record.projectId, command?.actor, 'PLAN_AUDIT_READ');
    const decisions = await this.registry.listReviewDecisions({ planId: record.planId, projectId: record.projectId });
    return [
      ...record.history.map((item) => ({ kind: 'PLAN_HISTORY', at: item.at, revision: item.revision, actor: item.actor, event: item })),
      ...decisions.map((item) => ({ kind: 'PLAN_REVIEW_DECISION', at: item.at, revision: item.planRevision, actor: item.reviewer, event: item })),
    ].sort((a, b) => a.at.localeCompare(b.at) || a.kind.localeCompare(b.kind));
  }

  async #create(command, action) {
    planGovernanceInvariant(PLAN_GOVERNANCE_ACTIONS.includes(action), 'INVALID_PLAN_ACTION', 'Invalid plan action');
    const projectId = command?.planningResult?.plan?.projectId;
    await this.#authorize(projectId, command?.actor, action);
    return this.registry.create(command);
  }

  async #record(planId) {
    const record = await this.registry.get({ planId });
    if (!record) throw new PlanGovernanceError('PLAN_NOT_FOUND', 'Test plan was not found', { planId });
    return validatePlanRecord(record);
  }

  async #authorize(projectId, actor, action) {
    const result = await this.authorization.authorize({ projectId, actor, action });
    planGovernanceInvariant(result?.allowed === true, 'PLAN_ACTION_FORBIDDEN', 'Plan governance action is forbidden', {
      projectId, actor, action, reason: result?.reason,
    });
    return result;
  }
}
