import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateM2ReleaseCandidate, loadM2ReleaseCandidate } from '../../../scripts/validate-m2-release-candidate.js';

test('M2-RC1 binds eight planning slices, ten routes and remains ineligible for production', async () => {
  const evidence = await validateM2ReleaseCandidate({
    generatedAt: '2026-07-28T06:30:00.000Z', commitSha: 'local', branch: 'agent/m2-i-release-acceptance',
  });
  assert.equal(evidence.schemaVersion, 'm2-governed-planning-release-evidence/v1');
  assert.equal(evidence.stack.slices, 8);
  assert.deepEqual(evidence.stack.pullRequests, [12,13,14,15,16,17,18,19]);
  assert.equal(evidence.stack.continuous, true);
  assert.equal(evidence.verification.businessRoutes.length, 10);
  assert.deepEqual(evidence.verification.lifecycleEvidence,
    ['PUBLISHED_SNAPSHOT','GENERATED','SUBMITTED','REVIEWED','APPROVED','FROZEN','RELOADED']);
  for (const digest of Object.values(evidence.digests)) assert.match(digest, /^[a-f0-9]{64}$/);
  assert.equal(evidence.artifacts.deployment.resourceCount, 7);
  assert.equal(evidence.decision.productionEligible, false);
  assert(evidence.decision.blockers.includes('m2-stack-prs-not-merged'));
});

test('M2-RC1 rejects stack drift and production eligibility while preserving M1-RC1', async () => {
  const candidate = await loadM2ReleaseCandidate();
  const drifted = structuredClone(candidate);
  drifted.stack[3].base = 'main';
  await assert.rejects(validateM2ReleaseCandidate({ candidate: drifted }), /base does not match/);
  const promoted = structuredClone(candidate);
  promoted.decision.productionEligible = true;
  await assert.rejects(validateM2ReleaseCandidate({ candidate: promoted }), /cannot be production eligible/);
  const m1 = JSON.parse(await readFile('releases/m1/read-only-release-candidate.json', 'utf8'));
  assert.equal(m1.releaseId, 'M1-RC1');
  assert.equal(m1.decision.productionEligible, false);
});

test('M2-RC1 candidate validation rejects nested sensitive material', async () => {
  const candidate = await loadM2ReleaseCandidate();
  const leaked = structuredClone(candidate);
  leaked.decision.databaseUrl = 'postgresql://release:secret@database.example/kdtp';
  await assert.rejects(validateM2ReleaseCandidate({ candidate: leaked }), /sensitive material/);
});
