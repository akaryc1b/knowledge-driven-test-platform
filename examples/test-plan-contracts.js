import { buildKnowledgeSnapshot, resolveKnowledge, sha256 } from '@kdtp/knowledge-core';
import { createSnapshotEnvelope } from '@kdtp/knowledge-governance';
import {
  createCoverageObligation,
  createPlanningRequest,
  createProvenanceEntry,
  createTargetInventory,
  createTestIntent,
  createTestPlan,
  validateTestPlan,
} from '@kdtp/test-plan';
import { loadProjectInput } from '../apps/knowledge-cli/src/project-loader.js';

const input = await loadProjectInput(new URL('./approval-platform/', import.meta.url).pathname);
const snapshot = buildKnowledgeSnapshot(resolveKnowledge(input));
const envelope = createSnapshotEnvelope({
  projectId: snapshot.context.projectId,
  snapshot,
  actor: 'm2-planning-example',
  at: '2026-07-27T16:00:00.000Z',
  reason: 'M2-A deterministic planning example',
});
const targetInventory = createTargetInventory({
  projectId: snapshot.context.projectId,
  environmentId: snapshot.context.environmentId,
  releaseId: snapshot.context.releaseId,
  targets: [{
    targetId: 'api:approval-submit',
    kind: 'api',
    name: 'Submit approval API',
    locator: 'POST /v1/approvals',
    tags: ['approval', 'critical'],
    attributes: { protocol: 'https', operationId: 'submitApproval' },
  }],
});
const sourceRule = snapshot.rules.find((rule) => rule.boundaryKey === 'workflow.approval-submit')
  ?? snapshot.rules[0];
const planningRequest = createPlanningRequest({
  projectId: snapshot.context.projectId,
  environmentId: snapshot.context.environmentId,
  releaseId: snapshot.context.releaseId,
  knowledgeSnapshotId: envelope.snapshotId,
  knowledgeSnapshotDigest: envelope.digest,
  knowledgeSnapshot: envelope,
  plannerVersion: '1.0.0',
  capabilityCatalogVersion: '1.0.0',
  capabilityCatalogDigest: sha256({ catalogId: 'm2-base-capabilities', version: '1.0.0' }),
  targetInventory,
  planningPolicy: {
    policyId: 'policy:release-quality',
    version: '1.0.0',
    entries: [{
      policyEntryId: 'policy-entry:approval-api',
      priority: 10,
      selectors: {
        knowledgeIds: [sourceRule.id],
        boundaryKeys: [sourceRule.boundaryKey],
        targetIds: ['api:approval-submit'],
      },
      capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
      mandatory: true,
    }],
    exemptions: [],
  },
  createdAt: '2026-07-27T16:00:00.000Z',
  createdBy: 'm2-planning-example',
});
const knowledgeRef = {
  knowledgeId: sourceRule.id,
  version: sourceRule.version,
  boundaryKey: sourceRule.boundaryKey,
  snapshotId: envelope.snapshotId,
  snapshotDigest: envelope.digest,
};
const intent = createTestIntent({
  planInputFingerprint: planningRequest.inputFingerprint,
  intentKind: 'api-functional',
  targetId: 'api:approval-submit',
  capability: { capabilityId: 'api-functional', version: '1.0.0' },
  sourceKnowledge: [knowledgeRef],
  policyEntryId: 'policy-entry:approval-api',
  input: { operationId: 'submitApproval', payloadProfile: 'valid-approval' },
  assertions: { statusCode: 201, responseSchema: 'approval/v1' },
  thresholds: {},
  dependencies: [],
  tags: ['mandatory'],
});
const obligation = createCoverageObligation({
  planInputFingerprint: planningRequest.inputFingerprint,
  targetId: intent.targetId,
  capability: intent.capability,
  sourceKnowledge: intent.sourceKnowledge,
  policyEntryId: intent.policyEntryId,
  mandatory: true,
  status: 'COVERED',
  intentIds: [intent.intentId],
});
const provenance = createProvenanceEntry({
  intentId: intent.intentId,
  knowledgeId: knowledgeRef.knowledgeId,
  knowledgeVersion: knowledgeRef.version,
  boundaryKey: knowledgeRef.boundaryKey,
  snapshotId: knowledgeRef.snapshotId,
  snapshotDigest: knowledgeRef.snapshotDigest,
  capabilityId: intent.capability.capabilityId,
  capabilityVersion: intent.capability.version,
  targetId: intent.targetId,
  policyEntryId: intent.policyEntryId,
});
const plan = validateTestPlan(createTestPlan({
  planningRequest,
  intents: [intent],
  coverageObligations: [obligation],
  provenance: [provenance],
}));
process.stdout.write(`${JSON.stringify(plan, null, 2)}\n`);
