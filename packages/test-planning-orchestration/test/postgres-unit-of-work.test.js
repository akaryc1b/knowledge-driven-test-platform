import test from 'node:test';
import assert from 'node:assert/strict';
import { PostgresPlanningUnitOfWork } from '../src/index.js';

test('PostgresPlanningUnitOfWork validates the pool contract', () => {
  assert.throws(() => new PostgresPlanningUnitOfWork({}), /pool/i);
});
