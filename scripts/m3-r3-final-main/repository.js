import { readFile } from 'node:fs/promises';
import { posix } from 'node:path';
import { canonicalStringify } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  ARTIFACT_NAME, ARTIFACT_PATHS, CORRECTION_MERGE, OBSERVER_BRANCH,
  REQUIRED_PATHS, SCHEMA_PATH, SCHEMA_VERSION, SOURCE_MERGE,
  WORKFLOW_PATH, SOURCE_WORKFLOWS, CORRECTION_WORKFLOWS,
} from './constants.js';

export async function loadRepositoryFiles() {
  return Object.fromEntries(await Promise.all(REQUIRED_PATHS.map(async (path) => [
    path, await readFile(path, 'utf8'),
  ])));
}

export async function validateRepository(options = {}) {
  const files = options.files ?? await loadRepositoryFiles();
  for (const path of REQUIRED_PATHS) {
    invariant(typeof files[path] === 'string' && files[path].length > 0,
      `Missing M3-R3 final observer path: ${path}`);
  }
  const schema = JSON.parse(files[SCHEMA_PATH]);
  invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
    && schema.type === 'object' && schema.additionalProperties === false
    && schema.properties?.schemaVersion?.const === SCHEMA_VERSION,
  'Observer Schema is not closed Draft 2020-12');

  const workflow = files[WORKFLOW_PATH];
  for (const marker of [
    'pull_request:', 'push:', 'branches: [main]', 'contents: read',
    'actions: read', 'pull-requests: read', 'persist-credentials: false',
    'node-version: 22', 'npm ci --ignore-scripts', 'npm run validate',
    '--validate-repository', '--emit-artifact', 'actions/upload-artifact@v4',
    ARTIFACT_NAME, 'include-hidden-files: true', 'report-final-closure:',
    "if: ${{ github.event_name == 'push' }}", 'issues: write',
    'actions/github-script@v7', 'issue_number: 71',
  ]) invariant(workflow.includes(marker), `Observer Workflow missing: ${marker}`);
  invariant(workflow.split('issues: write').length - 1 === 1,
    'Observer Workflow must grant issues: write exactly once');
  for (const marker of [
    'workflow_dispatch', 'workflow_call', 'contents: write', 'actions: write',
    'pull-requests: write', 'packages: write', 'id-' + 'to' + 'ken: write',
    'se' + 'crets:', 'k6 run', 'xk6 run', 'playwright test', 'docker run',
    'kubectl', 'curl ', 'wget ', 'gh ',
  ]) invariant(!workflow.includes(marker), `Observer Workflow contains forbidden entry: ${marker}`);

  const collector = files['scripts/collect-m2-main-branch-ci-evidence.js'];
  for (const marker of ['status=completed', 'head_sha=${encodeURIComponent(sourceSha)}']) {
    invariant(collector.includes(marker), `Historical main query correction missing: ${marker}`);
  }
  const docs = files['docs/04-governance/m3-r3-final-main-closure.md'];
  for (const marker of [SOURCE_MERGE, CORRECTION_MERGE, OBSERVER_BRANCH]) {
    invariant(docs.includes(marker), `Observer document missing identity: ${marker}`);
  }
  scanSensitiveValues({ workflow, docs }, 'M3-R3 final observer governance');
  return Object.freeze({
    validator: 'm3-r3-final-main-observer', status: 'success',
    sourceWorkflowCount: SOURCE_WORKFLOWS.length,
    correctionWorkflowCount: CORRECTION_WORKFLOWS.length,
    artifactPathCount: ARTIFACT_PATHS.length,
  });
}

export function auditArtifactFiles(files) {
  invariant(canonicalStringify(Object.keys(files).sort())
    === canonicalStringify([...ARTIFACT_PATHS].sort()),
  'Observer Artifact path set is not exact');
  const normalized = new Set();
  const folded = new Set();
  for (const [path, content] of Object.entries(files)) {
    invariant(typeof content === 'string', `Observer Artifact is not UTF-8: ${path}`);
    validateRelativePath(path);
    const nfc = path.normalize('NFC');
    const lower = nfc.toLowerCase();
    invariant(!normalized.has(nfc), `Observer Unicode path collision: ${path}`);
    invariant(!folded.has(lower), `Observer case-fold collision: ${path}`);
    normalized.add(nfc);
    folded.add(lower);
  }
  scanSensitiveValues(Object.values(files), 'M3-R3 final observer Artifact');
  return true;
}

function validateRelativePath(path) {
  invariant(typeof path === 'string' && path.length > 0 && !path.includes('\0')
    && !path.includes('\\') && !path.startsWith('/')
    && !/^[A-Za-z]:/u.test(path) && !/^[a-z][a-z0-9+.-]*:/iu.test(path)
    && posix.normalize(path) === path && !path.split('/').includes('..'),
  `Unsafe Observer Artifact path: ${path}`);
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
