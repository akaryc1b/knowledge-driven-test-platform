import test from 'node:test';
import assert from 'node:assert/strict';
import { GovernanceError, GovernancePolicy } from '../src/index.js';

test('governance policy rejects invalid approval counts', () => {
  assert.throws(
    () => new GovernancePolicy({ requiredApprovals: { critical: 0 } }),
    (error) => error instanceof GovernanceError && error.code === 'INVALID_GOVERNANCE_POLICY',
  );
});

test('governance policy can require more approvals for a project profile', () => {
  const policy = new GovernancePolicy({ requiredApprovals: { high: 2 } });
  assert.equal(policy.requiredApprovals.high, 2);
  assert.equal(policy.requiredApprovals.critical, 2);
});
