import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  createRuntimeEvent,
  isReadOnlyTestPlanPath,
  loadServiceConfig,
  publicServiceConfig,
} from '../apps/read-only-governance-service/src/index.js';
import { matchReadOnlyRoute } from '../packages/governance-http/src/index.js';
import { matchReadOnlyTestPlanRoute } from '../packages/test-plan-http/src/index.js';
import { buildKnowledgeSnapshot, resolveKnowledge } from '../packages/knowledge-core/src/index.js';
import { createSnapshotEnvelope, validateSnapshotEnvelope } from '../packages/knowledge-governance/src/index.js';
import { loadGovernancePostgresMigrations } from '../packages/knowledge-governance-postgres/src/index.js';
import { validateKnowledgeObject } from '../packages/knowledge-registry/src/index.js';
import { loadPostgresMigrations } from '../packages/knowledge-registry-postgres/src/index.js';
import {
  createMembershipRecord,
  createProjectRecord,
  validateMembershipRecord,
  validateProjectRecord,
} from '../packages/project-membership/src/index.js';
import { loadProjectAccessPostgresMigrations } from '../packages/project-membership-postgres/src/index.js';
import {
  createCoverageObligation,
  createPlanningRequest,
  createProvenanceEntry,
  createTargetInventory,
  createTestIntent,
  createTestPlan,
  validateTestPlan,
} from '../packages/test-plan/src/index.js';
import {
  InMemoryCapabilityCatalog,
  createBaseCapabilityCatalog,
  validateCapabilityCatalog,
} from '../packages/test-capability/src/index.js';
import {
  DeterministicTestPlanner,
  validatePlanningResult,
} from '../packages/test-planner/src/index.js';
import {
  InMemoryTestPlanRegistry,
  createPlanReviewDecision,
  validatePlanRecord,
} from '../packages/test-plan-registry/src/index.js';
import { loadTestPlanMigrations } from '../packages/test-plan-postgres/src/index.js';
import { loadProjectInput } from '../apps/knowledge-cli/src/project-loader.js';
import { validateKubernetesManifests } from './validate-kubernetes-manifests.js';
import { validateReleaseCandidate } from './validate-release-candidate.js';
import { validateM2PostMergeAcceptance } from './validate-m2-post-merge-acceptance.js';

const root = process.cwd();
const required = [
  'README.md',
  'CHANGELOG.md',
  '.dockerignore',
  'docs/README.md',
  'docs/releases/M1-RC1.md',
  'docs/releases/M2-RC1.md',
  'docs/releases/M2-RC1-main-acceptance.md',
  'docs/03-roadmap/m2-rc1-post-merge-acceptance.md',
  'docs/05-adr/ADR-0024-post-merge-release-acceptance.md',
  'docs/03-roadmap/m2-h-planning-service-composition.md',
  'docs/05-adr/ADR-0022-unified-read-only-planning-service-composition.md',
  'apps/read-only-governance-service/package.json',
  'apps/read-only-governance-service/src/main.js',
  'apps/read-only-governance-service/src/composition.js',
  'apps/read-only-governance-service/src/business-http.js',
  'apps/read-only-governance-service/test/planning-service-integration.test.js',
  'apps/read-only-governance-service/Dockerfile',
  'apps/read-only-governance-service/service.env.example',
  'packages/knowledge-core/src/index.js',
  'packages/knowledge-registry/src/index.js',
  'packages/knowledge-registry-postgres/src/index.js',
  'packages/knowledge-registry-postgres/migrations/0001_create_registry.sql',
  'packages/knowledge-governance/src/index.js',
  'packages/knowledge-governance-postgres/src/index.js',
  'packages/knowledge-governance-postgres/migrations/0001_create_governance_evidence.sql',
  'packages/governance-query/src/index.js',
  'packages/project-membership/src/index.js',
  'packages/project-membership-postgres/src/index.js',
  'packages/project-membership-postgres/migrations/0001_create_project_access.sql',
  'packages/governance-http/src/index.js',
  'packages/governance-auth-oidc/src/index.js',
  'packages/test-plan/src/index.js',
  'packages/test-plan/test/schema.test.js',
  'packages/test-capability/src/index.js',
  'packages/test-capability/test/schema.test.js',
  'packages/test-planner/src/index.js',
  'packages/test-planner/test/schema.test.js',
  'packages/test-plan-registry/src/index.js',
  'packages/test-plan-registry/test/schema.test.js',
  'packages/test-plan-postgres/src/index.js',
  'packages/test-plan-postgres/migrations/0001_create_test_plan_registry.sql',
  'packages/test-plan-query/src/index.js',
  'packages/test-plan-query/test/schema.test.js',
  'packages/test-plan-http/src/index.js',
  'deploy/postgres/compose.yaml',
  'schemas/knowledge/schema-catalog.json',
  'schemas/registry/v1/knowledge-registry-record.schema.json',
  'schemas/governance/schema-catalog.json',
  'schemas/query/schema-catalog.json',
  'schemas/query/v1/test-plan-response-envelope.schema.json',
  'schemas/query/v1/test-plan-page.schema.json',
  'schemas/access/schema-catalog.json',
  'schemas/authentication/schema-catalog.json',
  'schemas/operations/schema-catalog.json',
  'schemas/operations/v1/service-runtime-event.schema.json',
  'schemas/operations/v1/service-health.schema.json',
  'schemas/deployment/schema-catalog.json',
  'schemas/deployment/v1/fault-acceptance.schema.json',
  'schemas/release/schema-catalog.json',
  'schemas/release/v1/release-candidate.schema.json',
  'schemas/release/v1/release-evidence.schema.json',
  'schemas/release/v2/planning-post-merge-acceptance.schema.json',
  'schemas/release/v2/planning-post-merge-evidence.schema.json',
  'schemas/planning/schema-catalog.json',
  'schemas/planning/v1/test-planning-request.schema.json',
  'schemas/planning/v1/test-target-inventory.schema.json',
  'schemas/planning/v1/test-intent.schema.json',
  'schemas/planning/v1/test-coverage-obligation.schema.json',
  'schemas/planning/v1/test-plan.schema.json',
  'schemas/planning/v1/test-planning-result.schema.json',
  'schemas/planning/v1/test-coverage-matrix.schema.json',
  'schemas/planning/v1/test-provenance-graph.schema.json',
  'schemas/planning/v1/test-dependency-dag.schema.json',
  'schemas/planning/v1/test-plan-record.schema.json',
  'schemas/planning/v1/test-plan-history-event.schema.json',
  'schemas/planning/v1/test-plan-review-decision.schema.json',
  'schemas/capability/schema-catalog.json',
  'schemas/capability/v1/test-capability.schema.json',
  'schemas/capability/v1/capability-catalog.schema.json',
  'releases/m1/read-only-release-candidate.json',
  'releases/m2/post-merge-acceptance.json',
  'deploy/kubernetes/read-only-governance-service/deployment.yaml',
  'deploy/kubernetes/read-only-governance-service/service.yaml',
  'deploy/kubernetes/read-only-governance-service/pdb.yaml',
  'deploy/kubernetes/read-only-governance-service/kustomization.yaml',
  'scripts/validate-kubernetes-manifests.js',
  'scripts/validate-release-candidate.js',
  'scripts/validate-m2-post-merge-acceptance.js',
  'examples/read-only-service-operational.js',
  'examples/read-only-release-candidate.js',
  'examples/m2-post-merge-acceptance.js',
  'examples/test-plan-contracts.js',
  'examples/capability-catalog.js',
  'examples/deterministic-test-plan.js',
  'examples/test-plan-registry.js',
  'examples/postgres-test-plan-registry.js',
  'examples/read-only-test-plan-query.js',
  'examples/read-only-test-plan-http.js',
  'examples/read-only-planning-service.js',
];
for (const path of required) await stat(join(root, path));

const files = await walk(root);
for (const path of files.filter((path) => path.endsWith('.json'))) {
  JSON.parse(await readFile(path, 'utf8'));
}
for (const path of files.filter((path) => /\.(js|json|md|sql|yaml|yml)$/.test(path))) {
  const content = await readFile(path, 'utf8');
  if (!content.endsWith('\n')) throw new Error(`${relative(root, path)} must end with a newline`);
  if (content.split('\n').some((line) => /[ \t]+$/.test(line))) {
    throw new Error(`${relative(root, path)} contains trailing whitespace`);
  }
}
for (const path of files.filter(isKnowledgeRuleFile)) {
  const rules = JSON.parse(await readFile(path, 'utf8'));
  if (!Array.isArray(rules)) throw new Error(`${relative(root, path)} must contain a knowledge rule array`);
  for (const rule of rules) validateKnowledgeObject(rule);
}

const schemaCatalog = JSON.parse(await readFile(join(root, 'schemas/knowledge/schema-catalog.json'), 'utf8'));
if (schemaCatalog.currentKnowledgeRule !== 'knowledge-rule/v1') throw new Error('Schema catalog must identify knowledge-rule/v1 as current');
if (schemaCatalog.currentRegistryRecord !== 'knowledge-registry-record/v1') throw new Error('Schema catalog must identify knowledge-registry-record/v1 as current');
const governanceCatalog = JSON.parse(await readFile(join(root, 'schemas/governance/schema-catalog.json'), 'utf8'));
if (governanceCatalog.currentReviewDecision !== 'knowledge-review-decision/v1') throw new Error('Governance catalog must identify knowledge-review-decision/v1 as current');
if (governanceCatalog.currentSnapshotEnvelope !== 'knowledge-snapshot-envelope/v1') throw new Error('Governance catalog must identify knowledge-snapshot-envelope/v1 as current');
const queryCatalog = JSON.parse(await readFile(join(root, 'schemas/query/schema-catalog.json'), 'utf8'));
if (queryCatalog.currentResponseEnvelope !== 'governance-query-response/v1') throw new Error('Query catalog must identify governance-query-response/v1 as current');
if (queryCatalog.currentPage !== 'governance-query-page/v1') throw new Error('Query catalog must identify governance-query-page/v1 as current');
if (queryCatalog.currentPlanResponseEnvelope !== 'test-plan-query-response/v1') throw new Error('Query catalog must identify test-plan-query-response/v1 as current');
if (queryCatalog.currentPlanPage !== 'test-plan-query-page/v1') throw new Error('Query catalog must identify test-plan-query-page/v1 as current');
const accessCatalog = JSON.parse(await readFile(join(root, 'schemas/access/schema-catalog.json'), 'utf8'));
if (accessCatalog.currentProjectDirectoryRecord !== 'project-directory-record/v1') throw new Error('Access catalog must identify project-directory-record/v1 as current');
if (accessCatalog.currentProjectMembershipRecord !== 'project-membership-record/v1') throw new Error('Access catalog must identify project-membership-record/v1 as current');
const authenticationCatalog = JSON.parse(await readFile(join(root, 'schemas/authentication/schema-catalog.json'), 'utf8'));
if (authenticationCatalog.currentOidcAuthenticationEvent !== 'oidc-authentication-event/v1') throw new Error('Authentication catalog must identify oidc-authentication-event/v1 as current');
const operationsCatalog = JSON.parse(await readFile(join(root, 'schemas/operations/schema-catalog.json'), 'utf8'));
if (operationsCatalog.currentRuntimeEvent !== 'service-runtime-event/v1') throw new Error('Operations catalog must identify service-runtime-event/v1 as current');
if (operationsCatalog.currentHealthResponse !== 'service-health/v1') throw new Error('Operations catalog must identify service-health/v1 as current');
const deploymentCatalog = JSON.parse(await readFile(join(root, 'schemas/deployment/schema-catalog.json'), 'utf8'));
if (deploymentCatalog.currentFaultAcceptance !== 'deployment-fault-acceptance/v1') throw new Error('Deployment catalog must identify deployment-fault-acceptance/v1 as current');
const releaseCatalog = JSON.parse(await readFile(join(root, 'schemas/release/schema-catalog.json'), 'utf8'));
if (releaseCatalog.currentReleaseCandidate !== 'm1-read-only-release-candidate/v1') throw new Error('Release catalog must identify the M1 candidate schema');
if (releaseCatalog.currentReleaseEvidence !== 'm1-read-only-release-evidence/v1') throw new Error('Release catalog must identify the M1 evidence schema');
if (releaseCatalog.m2PostMergeAcceptance !== 'm2-governed-planning-post-merge-acceptance/v1') throw new Error('Release catalog must identify the M2 post-merge acceptance schema');
if (releaseCatalog.m2PostMergeEvidence !== 'm2-governed-planning-post-merge-evidence/v1') throw new Error('Release catalog must identify the M2 post-merge evidence schema');
const planningCatalog = JSON.parse(await readFile(join(root, 'schemas/planning/schema-catalog.json'), 'utf8'));
if (planningCatalog.currentPlanningRequest !== 'test-planning-request/v1') throw new Error('Planning catalog must identify test-planning-request/v1 as current');
if (planningCatalog.currentTargetInventory !== 'test-target-inventory/v1') throw new Error('Planning catalog must identify test-target-inventory/v1 as current');
if (planningCatalog.currentTestIntent !== 'test-intent/v1') throw new Error('Planning catalog must identify test-intent/v1 as current');
if (planningCatalog.currentCoverageObligation !== 'test-coverage-obligation/v1') throw new Error('Planning catalog must identify test-coverage-obligation/v1 as current');
if (planningCatalog.currentTestPlan !== 'test-plan/v1') throw new Error('Planning catalog must identify test-plan/v1 as current');
if (planningCatalog.currentPlanningResult !== 'test-planning-result/v1') throw new Error('Planning catalog must identify test-planning-result/v1 as current');
if (planningCatalog.currentCoverageMatrix !== 'test-coverage-matrix/v1') throw new Error('Planning catalog must identify test-coverage-matrix/v1 as current');
if (planningCatalog.currentProvenanceGraph !== 'test-provenance-graph/v1') throw new Error('Planning catalog must identify test-provenance-graph/v1 as current');
if (planningCatalog.currentDependencyDag !== 'test-dependency-dag/v1') throw new Error('Planning catalog must identify test-dependency-dag/v1 as current');
if (planningCatalog.currentPlanRecord !== 'test-plan-record/v1') throw new Error('Planning catalog must identify test-plan-record/v1 as current');
if (planningCatalog.currentPlanHistoryEvent !== 'test-plan-history-event/v1') throw new Error('Planning catalog must identify test-plan-history-event/v1 as current');
if (planningCatalog.currentPlanReviewDecision !== 'test-plan-review-decision/v1') throw new Error('Planning catalog must identify test-plan-review-decision/v1 as current');
const capabilitySchemaCatalog = JSON.parse(await readFile(join(root, 'schemas/capability/schema-catalog.json'), 'utf8'));
if (capabilitySchemaCatalog.currentCapability !== 'test-capability/v1') throw new Error('Capability catalog must identify test-capability/v1 as current');
if (capabilitySchemaCatalog.currentCapabilityCatalog !== 'capability-catalog/v1') throw new Error('Capability catalog must identify capability-catalog/v1 as current');
await validateKubernetesManifests();
const releaseEvidence = await validateReleaseCandidate({
  generatedAt: '2026-07-27T12:30:00.000Z',
  commitSha: 'local',
  branch: 'agent/m1-k-release-acceptance',
});
if (releaseEvidence.decision.productionEligible !== false || releaseEvidence.stack.continuous !== true) {
  throw new Error('M1 release candidate decision or stack continuity changed');
}
const postMergeEvidence = await validateM2PostMergeAcceptance({
  generatedAt: '2026-07-28T10:30:00.000Z',
  commitSha: 'local',
  branch: 'agent/m2-rc1-post-merge-acceptance',
});
if (postMergeEvidence.decision.productionEligible !== false
    || postMergeEvidence.merge.fileDeltaCount !== 0
    || !postMergeEvidence.decision.resolvedBlockers.includes('m2-stack-prs-not-merged')) {
  throw new Error('M2 post-merge acceptance decision or merge evidence changed');
}

const postgresMigrations = await loadPostgresMigrations();
if (postgresMigrations.map((item) => item.version).join(',') !== '0001_create_registry') throw new Error('PostgreSQL migration catalog is not deterministic');
const governanceMigrations = await loadGovernancePostgresMigrations();
if (governanceMigrations.map((item) => item.version).join(',') !== '0001_create_governance_evidence') throw new Error('Governance PostgreSQL migration catalog is not deterministic');
const accessMigrations = await loadProjectAccessPostgresMigrations();
if (accessMigrations.map((item) => item.version).join(',') !== '0001_create_project_access') throw new Error('Project access PostgreSQL migration catalog is not deterministic');
const testPlanMigrations = await loadTestPlanMigrations();
if (testPlanMigrations.map((item) => item.version).join(',') !== '0001_create_test_plan_registry') throw new Error('Test Plan PostgreSQL migration catalog is not deterministic');

const project = validateProjectRecord(createProjectRecord({
  projectId: 'approval-platform', name: 'Approval Platform', actor: 'repository-validator',
  at: '2026-07-27T12:00:00.000Z', reason: 'validate project directory record',
}));
validateMembershipRecord(createMembershipRecord({
  projectId: project.projectId, subject: 'repository-reader', roles: ['VIEWER'],
  validFrom: '2026-07-27T12:00:00.000Z', validUntil: null,
  actor: 'repository-validator', at: '2026-07-27T12:00:00.000Z', reason: 'validate membership',
}));

const httpRoute = matchReadOnlyRoute('GET', '/v1/projects/approval-platform/knowledge');
if (httpRoute.handler !== 'listKnowledge' || httpRoute.projectId !== 'approval-platform') {
  throw new Error('Read-only HTTP route catalog is not deterministic');
}
const planHttpRoute = matchReadOnlyTestPlanRoute(
  'GET',
  '/v1/projects/approval-platform/test-plans/tp-approval-platform-123456789abc/coverage',
);
if (planHttpRoute.handler !== 'getCoverage'
    || planHttpRoute.projectId !== 'approval-platform'
    || planHttpRoute.params.planId !== 'tp-approval-platform-123456789abc') {
  throw new Error('Read-only Test Plan HTTP route catalog is not deterministic');
}
if (!isReadOnlyTestPlanPath('/v1/projects/approval-platform/test-plans')
    || isReadOnlyTestPlanPath('/v1/projects/approval-platform/knowledge')) {
  throw new Error('Unified read-only business route dispatch is not deterministic');
}
const servicePackage = JSON.parse(await readFile(join(root, 'apps/read-only-governance-service/package.json'), 'utf8'));
for (const dependency of ['@kdtp/test-plan-http', '@kdtp/test-plan-postgres', '@kdtp/test-plan-query']) {
  if (servicePackage.dependencies?.[dependency] !== '0.1.0') {
    throw new Error(`Read-only service composition is missing dependency ${dependency}`);
  }
}
const config = loadServiceConfig({
  KDTP_DATABASE_URL: 'postgresql://validator:password@postgres.example/kdtp',
  KDTP_OIDC_ISSUER: 'https://id.example.com/tenant',
  KDTP_OIDC_JWKS_URI: 'https://id.example.com/tenant/jwks',
  KDTP_OIDC_AUDIENCE: 'kdtp-read-api',
  KDTP_OIDC_SUBJECT_MAPPINGS_JSON: '[{"subject":"subject-1","actor":"reader-1"}]',
});
const publicConfig = JSON.stringify(publicServiceConfig(config));
if (publicConfig.includes('password') || publicConfig.includes('subject-1')) {
  throw new Error('Public service configuration leaked sensitive values');
}
const runtimeEvent = createRuntimeEvent({ type: 'SERVICE_STARTING', service: config.serviceName });
if (runtimeEvent.schemaVersion !== 'service-runtime-event/v1') throw new Error('Runtime event schema changed');
const dockerfile = await readFile(join(root, 'apps/read-only-governance-service/Dockerfile'), 'utf8');
if (!/^USER node$/m.test(dockerfile) || !dockerfile.includes('/live')) {
  throw new Error('Read-only service Dockerfile must run as node and define liveness healthcheck');
}

const input = await loadProjectInput(join(root, 'examples/approval-platform'));
const snapshot = buildKnowledgeSnapshot(resolveKnowledge(input));
if (!snapshot.snapshotId.startsWith('kb-approval-platform-')) throw new Error('Approval example did not produce the expected snapshot namespace');
const envelope = validateSnapshotEnvelope(createSnapshotEnvelope({
  projectId: snapshot.context.projectId,
  snapshot,
  actor: 'repository-validator',
  at: '2026-07-27T12:00:00.000Z',
  reason: 'validate governance snapshot envelope',
}));
if (envelope.snapshotId !== snapshot.snapshotId) throw new Error('Governance snapshot envelope identity changed');
const planningTargetInventory = createTargetInventory({
  projectId: snapshot.context.projectId,
  environmentId: snapshot.context.environmentId,
  releaseId: snapshot.context.releaseId,
  targets: [{
    targetId: 'api:approval-submit',
    kind: 'api',
    name: 'Submit approval API',
    locator: 'POST /v1/approvals',
    tags: ['approval'],
    attributes: { operationId: 'submitApproval' },
  }],
});
const planningKnowledge = snapshot.rules.find((rule) => rule.boundaryKey === 'workflow.approval-submit')
  ?? snapshot.rules[0];
const capabilityCatalog = validateCapabilityCatalog(createBaseCapabilityCatalog('1.0.0'));
const capabilityAdapter = new InMemoryCapabilityCatalog(capabilityCatalog);
const resolvedCapability = await capabilityAdapter.assertCompatible(
  { capabilityId: 'api-functional', version: '1.0.0' },
  'api',
);
if (resolvedCapability.intentKind !== 'api-functional') {
  throw new Error('M2-B capability resolution is not deterministic');
}
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
  targetInventory: planningTargetInventory,
  planningPolicy: {
    policyId: 'policy:repository-validation',
    version: '1.0.0',
    entries: [{
      policyEntryId: 'policy-entry:approval-api',
      priority: 1,
      selectors: { knowledgeIds: [planningKnowledge.id], targetIds: ['api:approval-submit'] },
      capabilityRefs: [{ capabilityId: 'api-functional', version: '1.0.0' }],
      mandatory: true,
    }],
    exemptions: [],
  },
  createdAt: '2026-07-27T12:00:00.000Z',
  createdBy: 'repository-validator',
});
const planningKnowledgeRef = {
  knowledgeId: planningKnowledge.id,
  version: planningKnowledge.version,
  boundaryKey: planningKnowledge.boundaryKey,
  snapshotId: envelope.snapshotId,
  snapshotDigest: envelope.digest,
};
const planningIntent = createTestIntent({
  planInputFingerprint: planningRequest.inputFingerprint,
  intentKind: 'api-functional',
  targetId: 'api:approval-submit',
  capability: { capabilityId: 'api-functional', version: '1.0.0' },
  sourceKnowledge: [planningKnowledgeRef],
  policyEntryId: 'policy-entry:approval-api',
  input: { operationId: 'submitApproval' },
  assertions: { statusCode: 201 },
  thresholds: {},
  dependencies: [],
  tags: ['mandatory'],
});
const planningObligation = createCoverageObligation({
  planInputFingerprint: planningRequest.inputFingerprint,
  targetId: planningIntent.targetId,
  capability: planningIntent.capability,
  sourceKnowledge: planningIntent.sourceKnowledge,
  policyEntryId: planningIntent.policyEntryId,
  mandatory: true,
  status: 'COVERED',
  intentIds: [planningIntent.intentId],
});
const planningProvenance = createProvenanceEntry({
  intentId: planningIntent.intentId,
  knowledgeId: planningKnowledgeRef.knowledgeId,
  knowledgeVersion: planningKnowledgeRef.version,
  boundaryKey: planningKnowledgeRef.boundaryKey,
  snapshotId: planningKnowledgeRef.snapshotId,
  snapshotDigest: planningKnowledgeRef.snapshotDigest,
  capabilityId: planningIntent.capability.capabilityId,
  capabilityVersion: planningIntent.capability.version,
  targetId: planningIntent.targetId,
  policyEntryId: planningIntent.policyEntryId,
});
const planningPlan = validateTestPlan(createTestPlan({
  planningRequest,
  intents: [planningIntent],
  coverageObligations: [planningObligation],
  provenance: [planningProvenance],
}));
if (planningPlan.coverage.summary.covered !== 1 || planningPlan.provenance.length !== 1) {
  throw new Error('M2-A planning contracts are not deterministic');
}
const deterministicPlanner = new DeterministicTestPlanner({
  capabilityCatalogPort: capabilityAdapter,
});
const planningResult = validatePlanningResult(await deterministicPlanner.plan({ planningRequest }));
if (planningResult.plan.planId !== planningPlan.planId
    || planningResult.plan.coverage.summary.covered !== 1
    || planningResult.coverageMatrix.cells[0]?.status !== 'COVERED'
    || planningResult.provenanceGraph.edges.length === 0
    || planningResult.dependencyDag.topologicalOrder.length !== 1) {
  throw new Error('M2-C deterministic planning result is incomplete');
}
const planRegistry = new InMemoryTestPlanRegistry();
let planRecord = validatePlanRecord(await planRegistry.create({
  planningResult,
  actor: 'repository-validator',
  at: '2026-07-27T12:01:00.000Z',
  reason: 'validate durable Test Plan Registry contract',
}));
planRecord = await planRegistry.transition({
  planId: planRecord.planId,
  expectedRevision: planRecord.revision,
  toStatus: 'REVIEWING',
  actor: 'repository-validator',
  at: '2026-07-27T12:02:00.000Z',
  reason: 'validate revision CAS and lifecycle',
});
await planRegistry.appendReviewDecision(createPlanReviewDecision({
  planId: planRecord.planId,
  projectId: planRecord.projectId,
  planRevision: planRecord.revision,
  decision: 'APPROVE',
  reviewer: 'repository-reviewer',
  at: '2026-07-27T12:03:00.000Z',
  reason: 'validate exact revision evidence',
  evidence: { validator: true },
}));
if (planRecord.status !== 'REVIEWING'
    || planRecord.history.length !== 2
    || (await planRegistry.listReviewDecisions({ planId: planRecord.planId })).length !== 1) {
  throw new Error('M2-D Test Plan Registry contract is incomplete');
}
console.log(`Validated ${files.length} files; snapshot ${snapshot.snapshotId}; release ${releaseEvidence.releaseId}; post-merge ${postMergeEvidence.merge.mainSha.slice(0, 12)}; catalog ${capabilityCatalog.digest.slice(0, 12)}; plan ${planningResult.plan.planId}; planning ${planningResult.digest.slice(0, 12)}; registry ${planRecord.revision}`);

function isKnowledgeRuleFile(path) {
  const normalized = path.replaceAll('\\', '/');
  return normalized.includes('/examples/') && (normalized.endsWith('/rules.json') || normalized.endsWith('.rules.json'));
}
async function walk(directory) {
  const output = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name === '.git' || entry.name === 'node_modules') continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) output.push(...await walk(path));
    else output.push(path);
  }
  return output;
}
