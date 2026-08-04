import { readFile } from 'node:fs/promises';
import { M3_R3_P2_PATHS, assertM3R3P2 } from './m3-r3-p2-baseline.js';

export async function loadAndValidateM3R3P2WorkflowEvidence(options = {}) {
  const source = options.source ?? await readFile(M3_R3_P2_PATHS.workflow, 'utf8');
  validateM3R3P2WorkflowEvidence(source);
  return true;
}

export function validateM3R3P2WorkflowEvidence(source) {
  for (const marker of [
    'M3_R3_P2_EXACT_HEAD: ${{ github.event.pull_request.head.sha || github.sha }}',
    'ref: ${{ github.event.pull_request.head.sha || github.sha }}',
    'actual_head="$(git rev-parse HEAD)"',
    'test "$actual_head" = "$M3_R3_P2_EXACT_HEAD"',
    'persist-credentials: false',
    'cp --parents schemas/execution/k6-api-runtime/p2-schema-catalog.json',
    'cp --parents docs/02-development/m3-r3-p2-bounded-process-lifecycle-handoff.md',
    'duplicate Artifact path under case-insensitive storage',
    'missing Artifact path',
    'unexpected Artifact path',
    'scanSensitiveValues',
  ]) assertM3R3P2(source.includes(marker),
    `M3-R3-P2 Workflow evidence is missing ${marker}`);
  for (const forbidden of [
    'uses: actions/checkout@v4\n      -',
    'refs/pull/',
    'github.event.pull_request.merge_commit_sha',
    'cp schemas/execution/k6-api-runtime/v1/*.schema.json /tmp',
    '\nk6 run', '\nxk6 run', 'exec(', 'spawn(', 'child_process',
  ]) assertM3R3P2(!source.includes(forbidden),
    `M3-R3-P2 Workflow evidence introduces forbidden ${forbidden}`);
  return true;
}
