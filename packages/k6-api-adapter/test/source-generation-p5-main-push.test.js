import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadP5Repository,
  validateP5Repository,
} from '../../../scripts/m3-r2-p5-repository.js';
import { P5_PATHS } from '../../../scripts/m3-r2-p5-baseline.js';

test('P5 permanent acceptance workflow binds natural exact-main push validation', async () => {
  const repository = await loadP5Repository();
  assert.equal(validateP5Repository(repository), true);

  const workflow = repository.files[P5_PATHS.workflow];
  assert.match(workflow, /\n  push:\n    branches: \[main\]\n/u);

  const tampered = {
    ...repository,
    files: {
      ...repository.files,
      [P5_PATHS.workflow]: workflow.replace('\n  push:\n', '\n  push-disabled:\n'),
    },
  };
  assert.throws(
    () => validateP5Repository(tampered),
    /P5 workflow is missing[\s\S]*push/u,
  );
});
