import { readFile } from 'node:fs/promises';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  ACCEPTED_BASE_MAIN,
  ACCEPTED_P4,
  G1_ARTIFACT_NAME,
  G1_ARTIFACT_PATHS,
  G1_DOCUMENT_PATHS,
  G1_EVIDENCE_SCHEMA_PATH,
  G1_EVIDENCE_SCHEMA_VERSION,
  G1_MODULE_PATHS,
  G1_SCHEMA_CATALOG_PATH,
  G1_SCOPE_MANIFEST_PATH,
  G1_TEST_PATH,
  G1_VALIDATOR_PATH,
  G1_WORKFLOW_PATH,
} from './constants.js';

const PACKAGE_PATH = 'package.json';
const P4_EXACT_PATH =
  'docs/04-governance/m3-r3-p4-exact-head-acceptance.md';
const P4_ROADMAP_PATH =
  'docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md';
const P4_RELEASE_PATH =
  'docs/releases/M3-R3-P4-fault-security-compatibility-acceptance.md';
const P4_SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/'
  + 'm3-r3-fault-security-compatibility-p4-evidence.schema.json';

const REQUIRED_PATHS = Object.freeze([
  G1_WORKFLOW_PATH,
  G1_VALIDATOR_PATH,
  ...G1_MODULE_PATHS,
  G1_SCHEMA_CATALOG_PATH,
  G1_EVIDENCE_SCHEMA_PATH,
  G1_SCOPE_MANIFEST_PATH,
  G1_TEST_PATH,
  ...G1_DOCUMENT_PATHS,
  PACKAGE_PATH,
  P4_EXACT_PATH,
  P4_ROADMAP_PATH,
  P4_RELEASE_PATH,
  P4_SCHEMA_PATH,
  'scripts/validate-m3-r3-p4-fault-security-compatibility.js',
  'packages/k6-api-adapter/src/node-process-adapter.js',
]);

export function resolveG1Branch(options = {}, env = process.env) {
  const head = env.GITHUB_HEAD_REF;
  const branch = options.branch ?? env.M3_R3_G1_BRANCH
    ?? (head === '' ? undefined : head) ?? env.GITHUB_REF_NAME ?? 'local';
  invariant(typeof branch === 'string' && branch.length > 0
    && branch.length <= 256, 'M3-R3-G1 branch is invalid');
  return branch;
}

export async function loadM3R3G1RepositoryFiles() {
  const manifest = JSON.parse(await readFile(G1_SCOPE_MANIFEST_PATH, 'utf8'));
  const paths = new Set([...REQUIRED_PATHS, ...manifest.paths]);
  return Object.fromEntries(await Promise.all([...paths].map(async (path) => [
    path, await readFile(path, 'utf8'),
  ])));
}

export async function validateM3R3G1Repository(options = {}) {
  const files = options.files ?? await loadM3R3G1RepositoryFiles();
  for (const path of REQUIRED_PATHS) {
    invariant(typeof files[path] === 'string' && files[path].length > 0,
      `Missing M3-R3-G1 repository path: ${path}`);
  }
  const manifest = validateScopeManifest(files);
  validateWorkflow(files);
  validatePackage(files[PACKAGE_PATH]);
  validatePredecessor(files);
  validateGovernance(files);
  const g1SchemaCatalogDigest = validateSchemaCatalog(files);
  scanSensitiveValues({
    workflow: files[G1_WORKFLOW_PATH],
    handoff: files[G1_DOCUMENT_PATHS[0]],
    acceptance: files[G1_DOCUMENT_PATHS[1]],
    release: files[G1_DOCUMENT_PATHS[2]],
    manifest,
  }, 'M3-R3-G1 repository governance');
  return Object.freeze({
    validator: 'm3-r3-g1-formal-acceptance',
    status: 'success',
    acceptedP4Head: ACCEPTED_P4.headSha,
    acceptedP4ArtifactId: ACCEPTED_P4.artifactId,
    acceptedP4CanonicalEvidenceDigest:
      ACCEPTED_P4.canonicalEvidenceDigest,
    g1SchemaCatalogDigest,
    scopeManifestDigest: sha256(manifest),
    scopePathCount: manifest.pathCount,
    artifactPathCount: G1_ARTIFACT_PATHS.length,
  });
}

function validateScopeManifest(files) {
  const manifest = JSON.parse(files[G1_SCOPE_MANIFEST_PATH]);
  invariant(manifest?.schemaVersion === 'm3-r3-g1-scope-manifest/v1'
    && manifest.baseMain === ACCEPTED_BASE_MAIN
    && manifest.pullRequest === 68
    && manifest.issue === 69
    && manifest.pathCount === 45
    && Array.isArray(manifest.paths)
    && manifest.paths.length === manifest.pathCount
    && new Set(manifest.paths).size === manifest.pathCount,
  'M3-R3-G1 scope manifest identity is invalid');
  const sorted = [...manifest.paths].sort();
  invariant(canonicalStringify(sorted) === canonicalStringify(manifest.paths),
    'M3-R3-G1 scope manifest paths are not sorted');
  for (const path of manifest.paths) {
    invariant(typeof path === 'string' && path.length > 0
      && !path.includes('\0') && !path.startsWith('/')
      && !path.split('/').includes('..') && !/^[a-z]:/iu.test(path)
      && !path.startsWith('\\\\'),
    `M3-R3-G1 scope contains unsafe path: ${path}`);
    invariant(manifest.allowedRoots.some((root) =>
      root === path || path.startsWith(root)),
    `M3-R3-G1 scope contains unauthorized path: ${path}`);
    invariant(typeof files[path] === 'string' && files[path].length > 0,
      `M3-R3-G1 scope path is missing: ${path}`);
  }
  invariant(manifest.decision?.fullScopeFrozen === true
    && manifest.decision.newRuntimeCapabilityAdded === false
    && manifest.decision.readyMarked === false
    && manifest.decision.merged === false
    && manifest.decision.g2Started === false,
  'M3-R3-G1 scope decision widened');
  return manifest;
}

function validateWorkflow(files) {
  const workflow = files[G1_WORKFLOW_PATH];
  const execution = [
    workflow,
    files['scripts/m3-r3-g1/scope-audit.js'],
    files['scripts/m3-r3-g1/ci-node22.sh'],
    files['scripts/m3-r3-g1/ci-node24.sh'],
    files['scripts/m3-r3-g1/ci-artifact.js'],
  ].join('\n');
  for (const token of [
    'pull_request:', 'push:', 'branches: [main]',
    'contents: read', 'persist-credentials: false', 'fetch-depth: 0',
    '${{ github.event.pull_request.head.sha || github.sha }}',
    '${{ github.event.pull_request.base.sha || github.event.before }}',
    'node-version: 22', 'node-version: 24',
    'npm ci --ignore-scripts', 'actions/upload-artifact@v4',
    G1_ARTIFACT_NAME, 'M3_R3_G1_EMIT_EVIDENCE: true',
  ]) invariant(workflow.includes(token),
    `M3-R3-G1 Workflow missing: ${token}`);
  for (const token of [
    'workflow_dispatch', 'workflow_call', 'schedule:', 'id-token: write',
    'contents: write', 'actions: write', 'packages: write', 'secrets:',
    'k6 run', 'xk6 run', 'playwright test', 'docker run', 'kubectl',
    'psql ', 'curl ', 'wget ', 'npm publish', 'gh ',
  ]) invariant(!execution.includes(token),
    `M3-R3-G1 Workflow contains forbidden token: ${token}`);
  invariant(execution.includes(G1_TEST_PATH)
    && execution.includes('scope-audit.js')
    && execution.includes('validate-m3-r3-g1-formal-acceptance.js'),
  'M3-R3-G1 Workflow does not execute all permanent gates');
  invariant(G1_ARTIFACT_PATHS.length === 16
    && new Set(G1_ARTIFACT_PATHS).size === 16
    && execution.includes('for (const path of G1_ARTIFACT_PATHS)')
    && execution.includes('const expected = [...G1_ARTIFACT_PATHS].sort()'),
  'M3-R3-G1 Artifact allow-list is not enforced');
}

function validatePackage(source) {
  const pkg = JSON.parse(source);
  invariant(pkg.type === 'module' && pkg.engines?.node === '>=22'
    && canonicalStringify(pkg.workspaces)
      === canonicalStringify(['apps/*', 'packages/*']),
  'M3-R3-G1 changed Node/ESM/workspaces baseline');
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
    const index = pkg.scripts?.validate?.indexOf(name) ?? -1;
    invariant(index > previous,
      `M3-R3-G1 root Validator missing or reordered: ${name}`);
    previous = index;
  }
}

function validatePredecessor(files) {
  const exact = files[P4_EXACT_PATH];
  for (const token of [
    `p4BaseMain=${ACCEPTED_BASE_MAIN}`,
    'p4Issue=67', 'p4Pr=68',
    'm3R3P4ImplementationComplete=true',
    'm3R3P4ExactHeadAcceptanceComplete=true',
    'm3R3P4MergeReadinessEvidenceComplete=true',
    'm3R3P4ReadyMarked=false', 'm3R3P4Merged=false',
    'm3R3G1Started=false', 'nextRequiredSlice=M3-R3-G1',
  ]) invariant(exact.includes(token),
    `Accepted P4 exact-Head record changed: ${token}`);
  const roadmap = files[P4_ROADMAP_PATH];
  for (const token of [
    `p4BaselineMain=${ACCEPTED_BASE_MAIN}`,
    'p4ProductCapabilityAdded=false',
    'sourceBundleRemainsImmutable=true',
    'fileResultCollectionImplemented=false',
    'nextRequiredSlice=M3-R3-G1',
  ]) invariant(roadmap.includes(token),
    `Accepted P4 roadmap changed: ${token}`);
  const p4Schema = JSON.parse(files[P4_SCHEMA_PATH]);
  invariant(p4Schema?.properties?.schemaVersion?.const
      === 'm3-r3-fault-security-compatibility-p4-evidence/v1'
    && p4Schema.additionalProperties === false,
  'Accepted P4 Evidence Schema changed');
}

function validateGovernance(files) {
  const handoff = files[G1_DOCUMENT_PATHS[0]];
  const formal = files[G1_DOCUMENT_PATHS[1]];
  const release = files[G1_DOCUMENT_PATHS[2]];
  for (const token of [
    `acceptedP4Head=${ACCEPTED_P4.headSha}`,
    `acceptedP4Run=${ACCEPTED_P4.runId}`,
    `acceptedP4Job=${ACCEPTED_P4.jobId}`,
    `acceptedP4Artifact=${ACCEPTED_P4.artifactId}`,
    `acceptedP4ArtifactApiDigest=${ACCEPTED_P4.artifactApiDigest}`,
    `acceptedP4DownloadedZipSha256=${ACCEPTED_P4.downloadedZipSha256}`,
    `acceptedP4CanonicalEvidenceDigest=${ACCEPTED_P4.canonicalEvidenceDigest}`,
    'g1Complete=true', 'readyMarked=false', 'merged=false',
    'g2Started=false', 'nextRequiredSlice=M3-R3-G2',
  ]) invariant(handoff.includes(token),
    `M3-R3-G1 handoff missing: ${token}`);
  for (const token of [
    `p4Head=${ACCEPTED_P4.headSha}`,
    `p4Run=${ACCEPTED_P4.runId}`,
    `p4Job=${ACCEPTED_P4.jobId}`,
    `p4Artifact=${ACCEPTED_P4.artifactId}`,
    `p4CanonicalEvidenceDigest=${ACCEPTED_P4.canonicalEvidenceDigest}`,
    'fullPrScopeMatchesManifest=true',
    'securityDashboardEnumerationAvailable=false',
    'zeroAlertClaimMade=false', 'readyMarked=false',
    'merged=false', 'g2Started=false',
  ]) invariant(formal.includes(token),
    `M3-R3-G1 formal acceptance missing: ${token}`);
  invariant(release.includes('newRuntimeCapabilityAdded=false')
    && release.includes('readyMarked=false')
    && release.includes('nextRequiredSlice=M3-R3-G2'),
  'M3-R3-G1 release record widened');
  for (const forbidden of [
    'readyMarked=true', 'merged=true', 'g2Started=true',
    'newRuntimeCapabilityAdded=true',
  ]) invariant(![handoff, formal, release].some((text) =>
    text.includes(forbidden)),
  `M3-R3-G1 governance contains forbidden claim: ${forbidden}`);
}

function validateSchemaCatalog(files) {
  const catalog = JSON.parse(files[G1_SCHEMA_CATALOG_PATH]);
  invariant(catalog?.schemaVersion === 'm3-r3-g1-schema-catalog/v1'
    && Array.isArray(catalog.schemas) && catalog.schemas.length === 1,
  'M3-R3-G1 Schema Catalog is invalid');
  const entry = catalog.schemas[0];
  invariant(entry.schemaVersion === G1_EVIDENCE_SCHEMA_VERSION
    && entry.path === G1_EVIDENCE_SCHEMA_PATH,
  'M3-R3-G1 Schema Catalog entry is invalid');
  const schema = JSON.parse(files[entry.path]);
  invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
    && schema.type === 'object' && schema.additionalProperties === false
    && schema.properties?.schemaVersion?.const
      === G1_EVIDENCE_SCHEMA_VERSION,
  'M3-R3-G1 Evidence Schema is not a closed Draft 2020-12 contract');
  return sha256({
    schemaVersion: catalog.schemaVersion,
    schemas: [{ ...entry, schemaDigest: sha256(schema) }],
  });
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
