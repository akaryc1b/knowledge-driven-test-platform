import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import {
  createRuntimeEvent,
  loadServiceConfig,
  publicServiceConfig,
} from '../apps/read-only-governance-service/src/index.js';
import { matchReadOnlyRoute } from '../packages/governance-http/src/index.js';
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
import { loadProjectInput } from '../apps/knowledge-cli/src/project-loader.js';

const root = process.cwd();
const required = [
  'README.md',
  '.dockerignore',
  'docs/README.md',
  'apps/read-only-governance-service/package.json',
  'apps/read-only-governance-service/src/main.js',
  'apps/read-only-governance-service/src/composition.js',
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
  'deploy/postgres/compose.yaml',
  'schemas/knowledge/schema-catalog.json',
  'schemas/registry/v1/knowledge-registry-record.schema.json',
  'schemas/governance/schema-catalog.json',
  'schemas/query/schema-catalog.json',
  'schemas/access/schema-catalog.json',
  'schemas/authentication/schema-catalog.json',
  'schemas/operations/schema-catalog.json',
  'schemas/operations/v1/service-runtime-event.schema.json',
  'schemas/operations/v1/service-health.schema.json',
  'examples/read-only-service-operational.js',
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
const accessCatalog = JSON.parse(await readFile(join(root, 'schemas/access/schema-catalog.json'), 'utf8'));
if (accessCatalog.currentProjectDirectoryRecord !== 'project-directory-record/v1') throw new Error('Access catalog must identify project-directory-record/v1 as current');
if (accessCatalog.currentProjectMembershipRecord !== 'project-membership-record/v1') throw new Error('Access catalog must identify project-membership-record/v1 as current');
const authenticationCatalog = JSON.parse(await readFile(join(root, 'schemas/authentication/schema-catalog.json'), 'utf8'));
if (authenticationCatalog.currentOidcAuthenticationEvent !== 'oidc-authentication-event/v1') throw new Error('Authentication catalog must identify oidc-authentication-event/v1 as current');
const operationsCatalog = JSON.parse(await readFile(join(root, 'schemas/operations/schema-catalog.json'), 'utf8'));
if (operationsCatalog.currentRuntimeEvent !== 'service-runtime-event/v1') throw new Error('Operations catalog must identify service-runtime-event/v1 as current');
if (operationsCatalog.currentHealthResponse !== 'service-health/v1') throw new Error('Operations catalog must identify service-health/v1 as current');

const postgresMigrations = await loadPostgresMigrations();
if (postgresMigrations.map((item) => item.version).join(',') !== '0001_create_registry') throw new Error('PostgreSQL migration catalog is not deterministic');
const governanceMigrations = await loadGovernancePostgresMigrations();
if (governanceMigrations.map((item) => item.version).join(',') !== '0001_create_governance_evidence') throw new Error('Governance PostgreSQL migration catalog is not deterministic');
const accessMigrations = await loadProjectAccessPostgresMigrations();
if (accessMigrations.map((item) => item.version).join(',') !== '0001_create_project_access') throw new Error('Project access PostgreSQL migration catalog is not deterministic');

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
console.log(`Validated ${files.length} files; snapshot ${snapshot.snapshotId}`);

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
