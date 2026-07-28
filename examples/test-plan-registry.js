import { createBaseCapabilityCatalog } from '@kdtp/test-capability';
import { InMemoryTestPlanRegistry, createPlanReviewDecision } from '@kdtp/test-plan-registry';
import { request, planner } from '../packages/test-planner/test/test-helpers.js';

const catalog = createBaseCapabilityCatalog('1.0.0');
const planningResult = await planner(catalog).plan(request({ catalog }));
const registry = new InMemoryTestPlanRegistry();
let record = await registry.create({
  planningResult,
  actor: 'planner-service',
  at: '2026-07-27T18:00:00.000Z',
  reason: 'persist deterministic planning result',
});
record = await registry.transition({
  planId: record.planId,
  expectedRevision: record.revision,
  toStatus: 'REVIEWING',
  actor: 'plan-governor',
  at: '2026-07-27T18:01:00.000Z',
  reason: 'submit for review',
});
await registry.appendReviewDecision(createPlanReviewDecision({
  planId: record.planId,
  projectId: record.projectId,
  planRevision: record.revision,
  decision: 'APPROVE',
  reviewer: 'reviewer-one',
  at: '2026-07-27T18:02:00.000Z',
  reason: 'M2-D evidence storage example',
  evidence: { scope: 'storage-only; M2-E applies governance rules' },
}));

process.stdout.write(`${JSON.stringify({
  schemaVersion: record.schemaVersion,
  planId: record.planId,
  status: record.status,
  revision: record.revision,
  inputFingerprint: record.inputFingerprint,
  snapshot: record.knowledgeSnapshot,
  capabilityCatalog: record.capabilityCatalog,
  historyEvents: record.history.length,
  reviewDecisions: (await registry.listReviewDecisions({ planId: record.planId })).length,
}, null, 2)}\n`);
