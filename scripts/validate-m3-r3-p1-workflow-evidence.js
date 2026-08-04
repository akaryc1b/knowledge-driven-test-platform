import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const M3_R3_P1_WORKFLOW_PATH =
  '.github/workflows/m3-r3-p1-local-process-boundary.yml';

const EXACT_HEAD_EXPRESSION = '${{ github.event.pull_request.head.sha || github.sha }}';

const EXPECTED_ARTIFACT_PATHS = Object.freeze([
  'evidence/m3-r3-p1-local-process-boundary-evidence.json',
  'schemas/execution/k6-api-runtime/schema-catalog.json',
  'schemas/execution/k6-api-runtime/p1-schema-catalog.json',
  'schemas/execution/k6-api-runtime/v1/k6-local-process-port.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-launch-specification.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-launch-decision.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-process-boundary-evidence.schema.json',
  'schemas/execution/k6-api-runtime/v1/m3-r3-local-process-boundary-p1-evidence.schema.json',
  'docs/02-development/m3-r3-p1-local-process-boundary-handoff.md',
  'docs/03-roadmap/m3-r3-p1-local-process-boundary.md',
  'docs/04-governance/m3-r3-p1-local-process-boundary-acceptance-matrix.md',
  'docs/05-adr/ADR-0031-injected-local-process-boundary.md',
  'docs/06-security/m3-r3-p1-local-process-boundary-threat-model.md',
  'docs/releases/M3-R3-P1-local-process-boundary.md',
  'logs/m3-r3-p1-focused.tap',
  'logs/m3-r3-p1-adapter.tap',
  'logs/m3-r3-p1-full-node.tap',
]);

export function validateM3R3P1WorkflowEvidence(source) {
  invariant(typeof source === 'string' && source.length > 0,
    'M3-R3-P1 Workflow source is empty');

  const checkoutPattern = new RegExp([
    'uses: actions/checkout@v4',
    '\\s+with:',
    `\\s+ref: \\${\\{\\{ github\\.event\\.pull_request\\.head\\.sha \\|\\| github\\.sha \\}\\}`,
    '\\s+fetch-depth: 1',
    '\\s+persist-credentials: false',
  ].join(''), 'u');
  invariant(checkoutPattern.test(source),
    'M3-R3-P1 Workflow must check out the exact PR Head or push SHA');

  for (const marker of [
    `M3_R3_P1_EXACT_HEAD: ${EXACT_HEAD_EXPRESSION}`,
    'name: Verify exact Head checkout',
    'actual_head="$(git rev-parse HEAD)"',
    'test "$actual_head" = "$M3_R3_P1_EXACT_HEAD"',
    'test -z "$(git status --porcelain)"',
    'cp --parents schemas/execution/k6-api-runtime/schema-catalog.json',
    'cp --parents docs/02-development/m3-r3-p1-local-process-boundary-handoff.md',
    'case-insensitively unique',
  ]) invariant(source.includes(marker), `M3-R3-P1 Workflow is missing ${marker}`);

  invariant(!source.includes('refs/pull/'),
    'M3-R3-P1 Workflow must not explicitly check out a PR merge ref');
  invariant(!source.includes('cp schemas/execution/k6-api-runtime/'),
    'M3-R3-P1 Workflow must preserve Schema paths with cp --parents');
  invariant(!source.includes('cp docs/02-development/'),
    'M3-R3-P1 Workflow must preserve document paths with cp --parents');

  for (const path of EXPECTED_ARTIFACT_PATHS) {
    invariant(source.includes(`'${path}'`) || source.includes(`"${path}"`),
      `M3-R3-P1 Workflow does not verify Artifact path ${path}`);
  }

  invariant(source.includes("relative(root, path).split(sep).join('/')")
      && source.includes('relativePath.toLowerCase()')
      && source.includes('duplicate Artifact path under case-insensitive storage'),
  'M3-R3-P1 Workflow must reject case-insensitive Artifact path collisions');

  return true;
}

export async function loadAndValidateM3R3P1WorkflowEvidence() {
  const source = await readFile(resolve(M3_R3_P1_WORKFLOW_PATH), 'utf8');
  validateM3R3P1WorkflowEvidence(source);
  return {
    schemaVersion: 'm3-r3-p1-workflow-evidence-validation/v1',
    workflowPath: M3_R3_P1_WORKFLOW_PATH,
    exactHeadCheckout: true,
    cleanCheckoutVerified: true,
    artifactPathsPreserved: true,
    caseInsensitiveCollisionsRejected: true,
    expectedArtifactPathCount: EXPECTED_ARTIFACT_PATHS.length,
  };
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(
    await loadAndValidateM3R3P1WorkflowEvidence(), null, 2)}\n`);
}
