import { readFile } from 'node:fs/promises';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  ACCEPTED_P3,
  P3_CATALOG_PATH,
  P4_ARTIFACT_NAME,
  P4_ARTIFACT_PATHS,
  P4_CATALOG_PATH,
  P4_EVIDENCE_SCHEMA_PATH,
  P4_EVIDENCE_SCHEMA_VERSION,
  TEST_PATHS,
  VALIDATOR_MODULE_PATHS,
  VALIDATOR_PATH,
  WORKFLOW_PATH,
} from './constants.js';

const REQUIRED_PATHS = Object.freeze([
  WORKFLOW_PATH, VALIDATOR_PATH, ...VALIDATOR_MODULE_PATHS, 'package.json',
  P4_CATALOG_PATH, P3_CATALOG_PATH, P4_EVIDENCE_SCHEMA_PATH,
  'packages/k6-api-adapter/src/node-process-adapter.js',
  'packages/k6-api-adapter/src/process-execution-contracts.js',
  'packages/k6-api-adapter/src/runtime-result-contracts.js',
  ...TEST_PATHS,
  'docs/02-development/m3-r3-p4-fault-security-compatibility-handoff.md',
  'docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md',
  'docs/04-governance/'
    + 'm3-r3-p4-fault-security-compatibility-acceptance-matrix.md',
  'docs/04-governance/m3-r3-p4-exact-head-acceptance.md',
  'docs/05-adr/ADR-0034-linux-node22-node24-runtime-acceptance.md',
  'docs/06-security/'
    + 'm3-r3-p4-fault-security-compatibility-threat-model.md',
  'docs/releases/M3-R3-P4-fault-security-compatibility-acceptance.md',
  'docs/m3-r3-p4-index.md', 'docs/README.md',
]);

export function resolveM3R3P4Branch(options = {}, env = process.env) {
  const head = env.GITHUB_HEAD_REF;
  const branch = options.branch ?? env.M3_R3_P4_BRANCH
    ?? (head === '' ? undefined : head) ?? env.GITHUB_REF_NAME ?? 'local';
  invariant(typeof branch === 'string' && branch.length > 0
    && branch.length <= 256, 'M3-R3-P4 branch is invalid');
  return branch;
}

export async function loadM3R3P4RepositoryFiles() {
  const p4 = JSON.parse(await readFile(P4_CATALOG_PATH, 'utf8'));
  const p3 = JSON.parse(await readFile(P3_CATALOG_PATH, 'utf8'));
  const paths = new Set([
    ...REQUIRED_PATHS,
    ...p4.schemas.map((entry) => entry.path),
    ...p3.schemas.map((entry) => entry.path),
  ]);
  return Object.fromEntries(await Promise.all([...paths].map(async (path) => [
    path, await readFile(path, 'utf8'),
  ])));
}

export async function validateM3R3P4Repository(options = {}) {
  const files = options.files ?? await loadM3R3P4RepositoryFiles();
  for (const path of REQUIRED_PATHS) {
    invariant(typeof files[path] === 'string' && files[path].length > 0,
      `Missing M3-R3-P4 repository path: ${path}`);
  }
  validateWorkflow(files);
  validatePackage(files['package.json']);
  validateRuntimeBoundary(files);
  validateGovernance(files);
  const p4SchemaCatalogDigest = catalogDigest(
    JSON.parse(files[P4_CATALOG_PATH]), files,
    'k6-fault-security-compatibility-p4-schema-catalog/v1', 8);
  const p3SchemaCatalogDigest = catalogDigest(
    JSON.parse(files[P3_CATALOG_PATH]), files,
    'k6-sanitized-runtime-result-schema-catalog/v1', 7);
  invariant(p3SchemaCatalogDigest === ACCEPTED_P3.p3SchemaCatalogDigest,
    'Accepted P3 Schema Catalog identity changed');
  const schema = JSON.parse(files[P4_EVIDENCE_SCHEMA_PATH]);
  invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
    && schema.type === 'object' && schema.additionalProperties === false
    && schema.properties?.schemaVersion?.const === P4_EVIDENCE_SCHEMA_VERSION,
  'P4 Evidence Schema is not a closed Draft 2020-12 contract');
  scanSensitiveValues({
    workflow: files[WORKFLOW_PATH],
    roadmap: files['docs/03-roadmap/'
      + 'm3-r3-p4-fault-security-compatibility-acceptance.md'],
    exactHead: files['docs/04-governance/m3-r3-p4-exact-head-acceptance.md'],
  }, 'M3-R3-P4 repository governance');
  return Object.freeze({
    validator: 'm3-r3-p4-fault-security-compatibility',
    status: 'success',
    p3SchemaCatalogDigest,
    p4SchemaCatalogDigest,
    artifactPathCount: P4_ARTIFACT_PATHS.length,
  });
}

function validateWorkflow(files) {
  const workflow = files[WORKFLOW_PATH];
  const execution = [workflow, ...VALIDATOR_MODULE_PATHS.map((path) => files[path])]
    .join('\n');
  for (const token of [
    'pull_request:', 'push:', 'branches: [main]', 'contents: read',
    'persist-credentials: false',
    '${{ github.event.pull_request.head.sha || github.sha }}',
    'node-version: 22', 'node-version: 24', 'npm ci --ignore-scripts',
    'actions/upload-artifact@v4', P4_ARTIFACT_NAME,
    'M3_R3_P4_EMIT_EVIDENCE: true',
  ]) invariant(workflow.includes(token), `P4 Workflow missing: ${token}`);
  for (const path of [...TEST_PATHS, ...P4_ARTIFACT_PATHS]) {
    invariant(execution.includes(path), `P4 Workflow allow-list missing: ${path}`);
  }
  for (const token of [
    'workflow_dispatch', 'workflow_call', 'id-token: write', 'contents: write',
    'actions: write', 'packages: write', 'secrets:', 'k6 run', 'xk6 run',
    'playwright test', 'docker run', 'kubectl', 'psql ', 'curl ', 'wget ',
  ]) invariant(!execution.includes(token),
    `P4 Workflow contains forbidden token: ${token}`);
}

function validatePackage(source) {
  const pkg = JSON.parse(source);
  invariant(pkg.type === 'module' && pkg.engines?.node === '>=22'
    && canonicalStringify(pkg.workspaces)
      === canonicalStringify(['apps/*', 'packages/*']),
  'P4 changed Node/ESM/workspaces baseline');
  invariant(pkg.scripts?.['validate:m3-r3-p4-fault-security-compatibility']
    === `node ${VALIDATOR_PATH}`, 'P4 explicit Validator script is missing');
  const ordered = [
    'validate-m3-r3-runtime-admission.js',
    'validate-m3-r3-p1-local-process-boundary.js',
    'validate-m3-r3-p2-bounded-process-lifecycle.js',
    'validate-m3-r3-p3-sanitized-runtime-result.js',
    'validate-m3-r3-p4-fault-security-compatibility.js',
    'validate-m2-final-release-closure.js',
  ];
  let previous = -1;
  for (const name of ordered) {
    const position = pkg.scripts.validate.indexOf(name);
    invariant(position > previous, `Root Validator missing or reordered: ${name}`);
    previous = position;
  }
}

function validateRuntimeBoundary(files) {
  const nodeAdapter = files[
    'packages/k6-api-adapter/src/node-process-adapter.js'];
  const production = [
    nodeAdapter,
    files['packages/k6-api-adapter/src/process-execution-contracts.js'],
    files['packages/k6-api-adapter/src/runtime-result-contracts.js'],
  ].join('\n');
  invariant((nodeAdapter.match(/from 'node:child_process'/gu) ?? []).length === 1
    && nodeAdapter.includes("import { spawn } from 'node:child_process';"),
  'Dedicated Node adapter spawn import changed');
  for (const pattern of [
    /\bexec(?:File|Sync)?\s*\(/u, /\bfork\s*\(/u, /\bspawnSync\s*\(/u,
    /\bnode:vm\b/u, /\beval\s*\(/u, /\bnew\s+Function\b/u,
    /\bWorker\s*\(/u, /\bimport\s*\(/u,
  ]) invariant(!pattern.test(production),
    `P4 production source contains forbidden process primitive: ${pattern}`);
  invariant(nodeAdapter.includes("stdio: ['ignore', 'ignore', 'ignore']")
    && !nodeAdapter.includes('inheritHostEnvironment: true'),
  'P4 changed stdio or host environment isolation');
  const results = files[
    'packages/k6-api-adapter/src/runtime-result-contracts.js'];
  invariant(results.includes('DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED')
    && results.includes('sourceBundleRemainsImmutable: true'),
  'P4 removed file-result deferral or immutable Source Bundle decision');
}

function validateGovernance(files) {
  const roadmap = files['docs/03-roadmap/'
    + 'm3-r3-p4-fault-security-compatibility-acceptance.md'];
  for (const token of [
    `p3ExactMainArtifactDigest=${ACCEPTED_P3.p3ExactMainArtifactDigest}`,
    `p3CanonicalEvidenceDigest=${ACCEPTED_P3.p3CanonicalEvidenceDigest}`,
    'platformCompatibility=linux', 'windowsCompatibilityClaimed=false',
    'macosCompatibilityClaimed=false', 'm3R3G1Started=false',
    'fileResultCollectionImplemented=false',
    'sourceBundleRemainsImmutable=true',
  ]) invariant(roadmap.includes(token), `P4 roadmap missing frozen claim: ${token}`);
  const exact = files[
    'docs/04-governance/m3-r3-p4-exact-head-acceptance.md'];
  for (const token of [
    'prState=open', 'prDraft=true', 'prMerged=false',
    'recordBinding=workflow-generated-exact-head',
    'securityDashboardEnumerationAvailable=false', 'zeroAlertClaimMade=false',
    'm3R3G1Started=false',
  ]) invariant(exact.includes(token),
    `P4 exact-Head record missing merge control: ${token}`);
  for (const token of [
    'prDraft=false', 'prMerged=true', 'm3R3P4ReadyMarked=true',
    'm3R3P4Merged=true', 'm3R3G1Started=true',
  ]) invariant(!exact.includes(token),
    `P4 exact-Head record widens merge control: ${token}`);
}

function catalogDigest(catalog, files, version, length) {
  invariant(catalog?.schemaVersion === version
    && Array.isArray(catalog.schemas) && catalog.schemas.length === length,
  `Schema Catalog is invalid: ${version}`);
  const versions = new Set();
  const paths = new Set();
  const schemas = [];
  for (const entry of catalog.schemas) {
    invariant(entry && typeof entry.schemaVersion === 'string'
      && typeof entry.path === 'string'
      && !versions.has(entry.schemaVersion) && !paths.has(entry.path),
    `Schema Catalog entry is invalid: ${version}`);
    versions.add(entry.schemaVersion);
    paths.add(entry.path);
    const schema = JSON.parse(files[entry.path]);
    invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
      && schema.type === 'object' && schema.additionalProperties === false,
    `Catalog Schema is not closed Draft 2020-12: ${entry.path}`);
    schemas.push({ ...entry, schemaDigest: sha256(schema) });
  }
  return sha256({ schemaVersion: catalog.schemaVersion, schemas });
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
