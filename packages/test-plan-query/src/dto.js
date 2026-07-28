import { validatePlanRecord, validatePlanReviewDecision } from '@kdtp/test-plan-registry';

export function toPlanSummary(recordInput) {
  const record = validatePlanRecord(recordInput);
  const result = record.planningResult;
  const plan = result.plan;
  return {
    planId: record.planId,
    projectId: record.projectId,
    environmentId: record.environmentId,
    releaseId: record.releaseId,
    status: record.status,
    revision: record.revision,
    knowledgeSnapshot: structuredClone(record.knowledgeSnapshot),
    capabilityCatalog: structuredClone(record.capabilityCatalog),
    contentDigest: record.contentDigest,
    planDigest: plan.digest,
    createdAt: record.createdAt,
    createdBy: record.createdBy,
    updatedAt: record.updatedAt,
    updatedBy: record.updatedBy,
    counts: {
      targets: plan.targets.targets.length,
      intents: plan.intents.length,
      obligations: plan.coverage.obligations.length,
      unsupportedObligations: result.unsupportedObligations.length,
      provenanceNodes: result.provenanceGraph.nodes.length,
      provenanceEdges: result.provenanceGraph.edges.length,
    },
    coverageSummary: structuredClone(result.coverageMatrix.summary),
  };
}

export function toPlanDetail(recordInput) {
  const record = validatePlanRecord(recordInput);
  const result = record.planningResult;
  const plan = result.plan;
  return {
    ...toPlanSummary(record),
    schemaVersion: record.schemaVersion,
    planner: structuredClone(plan.planner),
    targets: structuredClone(plan.targets),
    planningPolicy: structuredClone(plan.planningPolicy),
    intents: structuredClone(plan.intents),
    dependencyDag: structuredClone(result.dependencyDag),
    unsupportedObligations: structuredClone(result.unsupportedObligations),
    planningResultDigest: result.digest,
  };
}

export function toCoverageView(recordInput) {
  const record = validatePlanRecord(recordInput);
  const result = record.planningResult;
  return baseRevisionView(record, {
    coverage: structuredClone(result.plan.coverage),
    matrix: structuredClone(result.coverageMatrix),
    unsupportedObligations: structuredClone(result.unsupportedObligations),
  });
}

export function toProvenanceView(recordInput) {
  const record = validatePlanRecord(recordInput);
  const result = record.planningResult;
  return baseRevisionView(record, {
    knowledgeSnapshot: structuredClone(record.knowledgeSnapshot),
    capabilityCatalog: structuredClone(record.capabilityCatalog),
    provenance: structuredClone(result.plan.provenance),
    graph: structuredClone(result.provenanceGraph),
  });
}

export function toPlanTimeline(recordInput, decisionsInput) {
  const record = validatePlanRecord(recordInput);
  const decisions = decisionsInput.map(validatePlanReviewDecision);
  const events = [
    ...record.history.map((event) => ({
      kind: 'PLAN_HISTORY',
      at: event.at,
      revision: event.revision,
      actor: event.actor,
      eventType: event.type,
      fromStatus: event.fromStatus,
      toStatus: event.toStatus,
      reason: event.reason,
      contentDigest: event.contentDigest,
      previousContentDigest: event.previousContentDigest,
      decisionId: null,
      decision: null,
      evidence: null,
    })),
    ...decisions.map((decision) => ({
      kind: 'PLAN_REVIEW_DECISION',
      at: decision.at,
      revision: decision.planRevision,
      actor: decision.reviewer,
      eventType: null,
      fromStatus: null,
      toStatus: null,
      reason: decision.reason,
      contentDigest: null,
      previousContentDigest: null,
      decisionId: decision.decisionId,
      decision: decision.decision,
      evidence: structuredClone(decision.evidence),
    })),
  ].sort((left, right) => left.at.localeCompare(right.at)
    || left.kind.localeCompare(right.kind)
    || String(left.decisionId ?? left.eventType).localeCompare(String(right.decisionId ?? right.eventType)));
  return {
    planId: record.planId,
    projectId: record.projectId,
    status: record.status,
    revision: record.revision,
    contentDigest: record.contentDigest,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
    events,
  };
}

function baseRevisionView(record, value) {
  return {
    planId: record.planId,
    projectId: record.projectId,
    status: record.status,
    revision: record.revision,
    contentDigest: record.contentDigest,
    planDigest: record.planningResult.plan.digest,
    planningResultDigest: record.planningResult.digest,
    ...value,
  };
}
