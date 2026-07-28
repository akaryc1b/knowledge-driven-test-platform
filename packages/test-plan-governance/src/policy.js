import { DEFAULT_PLAN_APPROVAL_POLICY } from './constants.js';
import { planGovernanceInvariant } from './errors.js';

const RISKS = ['low', 'medium', 'high', 'critical'];

export function normalizePlanApprovalPolicy(input = DEFAULT_PLAN_APPROVAL_POLICY) {
  const source = { ...DEFAULT_PLAN_APPROVAL_POLICY, ...input };
  const required = { ...DEFAULT_PLAN_APPROVAL_POLICY.requiredApprovalsByRisk, ...(input.requiredApprovalsByRisk ?? {}) };
  for (const risk of RISKS) {
    planGovernanceInvariant(Number.isInteger(required[risk]) && required[risk] >= 1 && required[risk] <= 10,
      'INVALID_PLAN_APPROVAL_POLICY', `required approvals for ${risk} must be between 1 and 10`);
  }
  return Object.freeze({
    requiredApprovalsByRisk: Object.freeze(required),
    allowMandatoryPartial: source.allowMandatoryPartial === true,
  });
}

export function evaluateCoverageGate(record, decisions, policyInput) {
  const policy = normalizePlanApprovalPolicy(policyInput);
  const obligations = record.planningResult.plan.coverage.obligations;
  const riskLevel = determinePlanRisk(record);
  const approvals = decisions.filter((item) => item.decision === 'APPROVE');
  const requestChanges = decisions.filter((item) => item.decision === 'REQUEST_CHANGES');
  const reviewers = [...new Set(approvals.map((item) => item.reviewer))].sort();
  const requiredApprovals = policy.requiredApprovalsByRisk[riskLevel];
  const blockers = [];

  for (const obligation of obligations) {
    if (obligation.mandatory && obligation.status === 'UNPLANNED') {
      blockers.push({ code: 'MANDATORY_UNPLANNED', obligationId: obligation.obligationId });
    }
    if (obligation.mandatory && obligation.status === 'PARTIAL' && !policy.allowMandatoryPartial) {
      blockers.push({ code: 'MANDATORY_PARTIAL', obligationId: obligation.obligationId });
    }
    if (obligation.status === 'EXEMPT') {
      const approved = approvals.some((decision) =>
        Array.isArray(decision.evidence?.approvedExemptions)
        && decision.evidence.approvedExemptions.includes(obligation.obligationId));
      if (!approved) blockers.push({ code: 'EXEMPTION_NOT_APPROVED', obligationId: obligation.obligationId });
    }
  }
  if (requestChanges.length > 0) blockers.push({ code: 'REQUEST_CHANGES_PRESENT' });
  if (reviewers.length < requiredApprovals) {
    blockers.push({ code: 'INSUFFICIENT_APPROVALS', required: requiredApprovals, actual: reviewers.length });
  }
  return Object.freeze({
    passed: blockers.length === 0,
    planId: record.planId,
    planRevision: record.revision,
    riskLevel,
    requiredApprovals,
    reviewers,
    blockers: structuredClone(blockers),
  });
}

export function determinePlanRisk(record) {
  const rules = record.planningResult.plan.knowledgeSnapshot.snapshot.rules ?? [];
  let index = 0;
  for (const rule of rules) {
    const next = RISKS.indexOf(rule.riskLevel);
    if (next > index) index = next;
  }
  return RISKS[index];
}
