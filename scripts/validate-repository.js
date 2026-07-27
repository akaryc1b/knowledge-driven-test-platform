import { readdir, readFile, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { buildKnowledgeSnapshot, resolveKnowledge } from '../packages/knowledge-core/src/index.js';
import { createSnapshotEnvelope, validateSnapshotEnvelope } from '../packages/knowledge-governance/src/index.js';
import { loadGovernancePostgresMigrations } from '../packages/knowledge-governance-postgres/src/index.js';
import { validateKnowledgeObject } from '../packages/knowledge-registry/src/index.js';
import { loadPostgresMigrations } from '../packages/knowledge-registry-postgres/src/index.js';
import { loadProjectInput } from '../apps/knowledge-cli/src/project-loader.js';

const root = process.cwd();
const required = [
  'README.md',
  'docs/README.md',
  'packages/knowledge-core/src/index.js',
  'packages/knowledge-registry/src/index.js',
  'packages/knowledge-registry-postgres/src/index.js',
  'packages/knowledge-registry-postgres/migrations/0001_create_registry.sql',
  'packages/knowledge-governance/src/index.js',
  'packages/knowledge-governance-postgres/src/index.js',
  'packages/knowledge-governance-postgres/migrations/0001_create_governance_evidence.sql',
  'deploy/postgres/compose.yaml',
  'schemas/knowledge/schema-catalog.json',
  'schemas/knowledge/v1/knowledge-rule.schema.json',
  'schemas/registry/v1/knowledge-registry-record.schema.json',
  'schemas/governance/schema-catalog.json',
  'schemas/governance/v1/review-decision.schema.json',
  'schemas/governance/v1/snapshot-envelope.schema.json',
  'apps/knowledge-cli/src/cli.js',
  'examples/approval-platform/project-manifest.json',
  'examples/governance-lifecycle.js',
  'examples/postgres-governance.js',
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

const postgresMigrations = await loadPostgresMigrations();
if (postgresMigrations.map((item) => item.version).join(',') !== '0001_create_registry') {
  throw new Error('PostgreSQL migration catalog is not deterministic');
}
const governanceMigrations = await loadGovernancePostgresMigrations();
if (governanceMigrations.map((item) => item.version).join(',') !== '0001_create_governance_evidence') {
  throw new Error('Governance PostgreSQL migration catalog is not deterministic');
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
