import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  validateM3R3P2WorkflowEvidence,
} from '../../../scripts/validate-m3-r3-p2-workflow-evidence.js';
import { M3_R3_P2_PATHS } from '../../../scripts/m3-r3-p2-baseline.js';

async function source() {
  return readFile(M3_R3_P2_PATHS.workflow, 'utf8');
}

test('P2 Workflow binds validation and Artifact production to the exact Head', async () => {
  assert.equal(validateM3R3P2WorkflowEvidence(await source()), true);
});

test('P2 Workflow validator rejects implicit PR merge-ref checkout', async () => {
  const forged = (await source()).replace(
    '        with:\n          ref: ${{ github.event.pull_request.head.sha || github.sha }}\n', '');
  assert.throws(() => validateM3R3P2WorkflowEvidence(forged), /missing ref:/u);
});

test('P2 Workflow validator rejects flattened Artifact copies', async () => {
  const forged = (await source()).replace('cp --parents schemas/', 'cp schemas/');
  assert.throws(() => validateM3R3P2WorkflowEvidence(forged), /missing cp --parents/u);
});

test('P2 Workflow validator rejects collision-gate removal', async () => {
  const forged = (await source()).replace(
    'duplicate Artifact path under case-insensitive storage', 'duplicate path disabled');
  assert.throws(() => validateM3R3P2WorkflowEvidence(forged), /case-insensitive storage/u);
});
