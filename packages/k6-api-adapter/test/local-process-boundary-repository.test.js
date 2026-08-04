import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadM3R3P1Repository,
  validateM3R3P1Repository,
} from '../../../scripts/m3-r3-p1-repository.js';
import { M3_R3_P1_PATHS } from '../../../scripts/m3-r3-p1-baseline.js';

function clone(repository) {
  return {
    ...repository,
    files: { ...repository.files },
  };
}

test('P1 Repository Validator accepts the complete local process boundary', async () => {
  assert.equal(validateM3R3P1Repository(await loadM3R3P1Repository()), true);
});

test('P1 Repository Validator rejects forbidden process primitive injection', async () => {
  const repository = clone(await loadM3R3P1Repository());
  repository.files[M3_R3_P1_PATHS.boundaryModule] += "\n// node:child_process\n";
  assert.throws(() => validateM3R3P1Repository(repository),
    /forbidden execution primitive/u);
});

test('P1 Repository Validator rejects deletion of natural push main trigger', async () => {
  const repository = clone(await loadM3R3P1Repository());
  repository.files[M3_R3_P1_PATHS.workflow] = repository.files[M3_R3_P1_PATHS.workflow]
    .replace('\n  push:\n    branches: [main]\n', '\n');
  assert.throws(() => validateM3R3P1Repository(repository), /Workflow is missing/u);
});

test('P1 Repository Validator rejects write permission', async () => {
  const repository = clone(await loadM3R3P1Repository());
  repository.files[M3_R3_P1_PATHS.workflow] = repository.files[M3_R3_P1_PATHS.workflow]
    .replace('contents: read', 'contents: write');
  assert.throws(() => validateM3R3P1Repository(repository), /Workflow is missing|forbidden/u);
});

test('P1 Repository Validator rejects workflow_call', async () => {
  const repository = clone(await loadM3R3P1Repository());
  repository.files[M3_R3_P1_PATHS.workflow] += '\n# workflow_call\n';
  assert.throws(() => validateM3R3P1Repository(repository), /forbidden behavior/u);
});

test('P1 Repository Validator rejects Secret declaration', async () => {
  const repository = clone(await loadM3R3P1Repository());
  repository.files[M3_R3_P1_PATHS.workflow] += '\n# secrets:\n';
  assert.throws(() => validateM3R3P1Repository(repository), /forbidden behavior/u);
});

test('P1 Repository Validator rejects launch Schema execution escalation', async () => {
  const repository = clone(await loadM3R3P1Repository());
  const path = M3_R3_P1_PATHS.schemas[1];
  repository.files[path] = repository.files[path]
    .replace('"processStartAuthorized":{"const":false}',
      '"processStartAuthorized":{"const":true}');
  assert.throws(() => validateM3R3P1Repository(repository), /widens the P1 process boundary/u);
});
