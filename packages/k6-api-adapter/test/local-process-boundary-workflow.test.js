import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  M3_R3_P1_WORKFLOW_PATH,
  validateM3R3P1WorkflowEvidence,
} from '../../../scripts/validate-m3-r3-p1-workflow-evidence.js';

async function workflowSource() {
  return readFile(new URL(`../../../${M3_R3_P1_WORKFLOW_PATH}`, import.meta.url), 'utf8');
}

test('P1 Workflow binds validation and Artifact production to the exact Head', async () => {
  assert.equal(validateM3R3P1WorkflowEvidence(await workflowSource()), true);
});

test('P1 Workflow validator rejects implicit PR merge-ref checkout', async () => {
  const source = (await workflowSource()).replace(
    '          ref: ${{ github.event.pull_request.head.sha || github.sha }}\n', '');
  assert.throws(() => validateM3R3P1WorkflowEvidence(source), /exact PR Head/u);
});

test('P1 Workflow validator rejects flattened Artifact copies', async () => {
  const source = (await workflowSource())
    .replace('cp --parents schemas/execution/', 'cp schemas/execution/');
  assert.throws(() => validateM3R3P1WorkflowEvidence(source),
    /preserve Schema paths|missing cp --parents/u);
});

test('P1 Workflow validator rejects case-insensitive Artifact collision bypass', async () => {
  const source = (await workflowSource())
    .replace('relativePath.toLowerCase()', 'relativePath');
  assert.throws(() => validateM3R3P1WorkflowEvidence(source),
    /case-insensitive Artifact path collisions/u);
});
