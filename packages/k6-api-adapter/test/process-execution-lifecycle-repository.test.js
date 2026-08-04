import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadM3R3P2Repository,
  validateM3R3P2Repository,
} from '../../../scripts/m3-r3-p2-repository.js';
import { M3_R3_P2_PATHS } from '../../../scripts/m3-r3-p2-baseline.js';

function clone(repository) {
  return { ...repository, files: { ...repository.files } };
}

test('P2 Repository Validator accepts the complete bounded lifecycle slice', async () => {
  assert.equal(validateM3R3P2Repository(await loadM3R3P2Repository()), true);
});

test('P2 Repository Validator rejects an extra child_process primitive', async () => {
  const repository = clone(await loadM3R3P2Repository());
  repository.files[M3_R3_P2_PATHS.lifecycleModule] += '\n// exec(command)\n';
  assert.throws(() => validateM3R3P2Repository(repository), /forbidden behavior/u);
});

test('P2 Repository Validator rejects host environment inheritance', async () => {
  const repository = clone(await loadM3R3P2Repository());
  repository.files[M3_R3_P2_PATHS.lifecycleModule] += '\n// process.env\n';
  assert.throws(() => validateM3R3P2Repository(repository), /forbidden behavior/u);
});

test('P2 Repository Validator rejects accepted P1 Catalog drift', async () => {
  const repository = clone(await loadM3R3P2Repository());
  repository.files[M3_R3_P2_PATHS.p1SchemaCatalog] =
    repository.files[M3_R3_P2_PATHS.p1SchemaCatalog].replace(
      'k6-local-process-port/v1', 'k6-local-process-port/v2');
  assert.throws(() => validateM3R3P2Repository(repository), /accepted P1/u);
});

test('P2 Repository Validator rejects adapter Schema primitive escalation', async () => {
  const repository = clone(await loadM3R3P2Repository());
  const path = M3_R3_P2_PATHS.schemas[0];
  repository.files[path] = repository.files[path].replace(
    'node:child_process.spawn', 'node:child_process.exec');
  assert.throws(() => validateM3R3P2Repository(repository), /adapter Schema/u);
});

test('P2 Repository Validator rejects deletion of natural main push validation', async () => {
  const repository = clone(await loadM3R3P2Repository());
  repository.files[M3_R3_P2_PATHS.workflow] =
    repository.files[M3_R3_P2_PATHS.workflow].replace(
      '\n  push:\n    branches: [main]\n', '\n');
  assert.throws(() => validateM3R3P2Repository(repository), /Workflow is missing/u);
});

test('P2 Repository Validator rejects write permission', async () => {
  const repository = clone(await loadM3R3P2Repository());
  repository.files[M3_R3_P2_PATHS.workflow] =
    repository.files[M3_R3_P2_PATHS.workflow].replace('contents: read', 'contents: write');
  assert.throws(() => validateM3R3P2Repository(repository), /Workflow is missing|forbidden/u);
});

test('P2 Repository Validator rejects documentation that starts P3', async () => {
  const repository = clone(await loadM3R3P2Repository());
  repository.files[M3_R3_P2_PATHS.roadmap] += '\nM3-R3-P3 started\n';
  assert.throws(() => validateM3R3P2Repository(repository), /forbidden next slice/u);
});
