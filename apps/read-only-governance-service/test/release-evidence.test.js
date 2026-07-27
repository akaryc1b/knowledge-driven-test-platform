import test from 'node:test';
import assert from 'node:assert/strict';
import { validateReleaseCandidate } from '../../../scripts/validate-release-candidate.js';

test('M1-RC1 release definition is continuous, digestible and not production eligible', async () => {
  const evidence = await validateReleaseCandidate({
    generatedAt: '2026-07-27T12:30:00.000Z',
    commitSha: 'local',
    branch: 'agent/m1-k-release-acceptance',
  });
  assert.equal(evidence.schemaVersion, 'm1-read-only-release-evidence/v1');
  assert.equal(evidence.stack.slices, 10);
  assert.deepEqual(evidence.stack.pullRequests, [1,2,3,4,5,6,7,8,9,10]);
  assert.equal(evidence.stack.continuous, true);
  assert.match(evidence.digests.candidate, /^[a-f0-9]{64}$/);
  assert.match(evidence.digests.deploymentManifests, /^[a-f0-9]{64}$/);
  assert.equal(evidence.artifacts.deployment.resourceCount, 7);
  assert.equal(evidence.decision.productionEligible, false);
  assert(evidence.decision.blockers.includes('external-registry-digest-missing'));
});
