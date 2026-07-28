import { resolve } from 'node:path';
import { buildKnowledgeSnapshot, resolveKnowledge } from '@kdtp/knowledge-core';
import { createSnapshotEnvelope } from '@kdtp/knowledge-governance';
import {
  InMemoryCapabilityCatalog,
  createBaseCapabilityCatalog,
} from '@kdtp/test-capability';
import {
  createPlanningRequest,
  createTargetInventory,
} from '@kdtp/test-plan';
import {
  DeterministicTestPlanner,
  validatePlanningResult,
} from '@kdtp/test-planner';
import { loadProjectInput } from '../apps/knowledge-cli/src/project-loader.js';

const input = await loadProjectInput(resolve('examples/approval-platform'));
const snapshot = buildKnowledgeSnapshot(resolveKnowledge(input));
const envelope = createSnapshotEnvelope({
  projectId: snapshot.context.projectId,
  snapshot,
  actor: 'm2-example-publisher',
  at: '2026-07-27T17:00:00.000Z',
  reason: 'M2-C deterministic planning example',
});
const knowledge = snapshot.rules.find((rule) => rule.boundaryKey === 'workflow.approval-submit')
  ?? snapshot.rules[0];
const capabilityCatalog = createBaseCapabilityCatalog('1.0.0');
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
    attributes: { operationId: 'submitApproval' },
  }],
});
const planningRequest = createPlanningRequest({
  projectId: snapshot.context.projectId,
  environmentId: snapshot.context.environmentId,
  releaseId: snapshot.context.releaseId,
  knowledgeSnapshotId: envelope.snapshotId,
  knowledgeSnapshotDigest: envelope.digest,
  knowledgeSnapshot: envelope,
  plannerVersion: '1.0.0',
  capabilityCatalogVersion: capabilityCatalog.version,
  capabilityCatalogDigest: capabilityCatalog.digest,
  targetInventory,
  planningPolicy: {
    policyId: 'policy:m2-example',
    version: '1.0.0',
    entries: [{
      policyEntryId: 'policy-entry:approval-functional',
      priority: 10,
      selectors: {
        knowledgeIds: [knowledge.id],
        targetIds: ['api:approval-submit'],
      },
      capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
      mandatory: true,
    }],
    exemptions: [],
  },
  createdAt: '2026-07-27T17:00:00.000Z',
  createdBy: 'm2-example-planner',
});
const planner = new DeterministicTestPlanner({
  capabilityCatalogPort: new InMemoryCapabilityCatalog(capabilityCatalog),
});
const result = validatePlanningResult(await planner.plan({ planningRequest }));
console.log(JSON.stringify(result, null, 2));
