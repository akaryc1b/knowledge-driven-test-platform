import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadM3R3R0Repository,
  validateM3R3R0Repository,
} from '../../../scripts/m3-r3-r0-repository.js';

test('R0 Repository Validator accepts the exact runtime admission scope', async () => {
  const repository = await loadM3R3R0Repository();
  assert.equal(validateM3R3R0Repository(repository), true);
});
