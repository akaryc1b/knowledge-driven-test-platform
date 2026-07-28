export const PLAN_GOVERNANCE_ACTIONS = Object.freeze([
  'PLAN_CREATE', 'PLAN_GENERATE', 'PLAN_EDIT', 'PLAN_SUBMIT', 'PLAN_REVIEW',
  'PLAN_APPROVE', 'PLAN_FREEZE', 'PLAN_READ', 'PLAN_AUDIT_READ',
]);

export const DEFAULT_PLAN_APPROVAL_POLICY = Object.freeze({
  requiredApprovalsByRisk: Object.freeze({ low: 1, medium: 1, high: 2, critical: 2 }),
  allowMandatoryPartial: true,
});
