import test from 'node:test';
import assert from 'node:assert/strict';
import { GOVERNANCE_ACTIONS } from '@kdtp/knowledge-governance';
import { DEFAULT_ROLE_ACTIONS } from '@kdtp/project-membership';
import { PLAN_GOVERNANCE_ACTIONS } from '../src/index.js';

test('all plan governance actions are versioned governance actions', () => {
  for (const action of PLAN_GOVERNANCE_ACTIONS) assert.equal(GOVERNANCE_ACTIONS.includes(action), true);
});

test('default role mapping separates author, reviewer, freezer and automation responsibilities', () => {
  assert.equal(DEFAULT_ROLE_ACTIONS.AUTHOR.includes('PLAN_SUBMIT'), true);
  assert.equal(DEFAULT_ROLE_ACTIONS.REVIEWER.includes('PLAN_REVIEW'), true);
  assert.equal(DEFAULT_ROLE_ACTIONS.REVIEWER.includes('PLAN_FREEZE'), false);
  assert.equal(DEFAULT_ROLE_ACTIONS.PUBLISHER.includes('PLAN_FREEZE'), true);
  assert.equal(DEFAULT_ROLE_ACTIONS.AUTOMATION.includes('PLAN_GENERATE'), true);
  assert.equal(DEFAULT_ROLE_ACTIONS.AUTOMATION.includes('PLAN_APPROVE'), false);
  assert.equal(DEFAULT_ROLE_ACTIONS.AUTOMATION.includes('PLAN_FREEZE'), false);
});
