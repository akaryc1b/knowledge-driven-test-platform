import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { canonicalize, sha256 } from '@kdtp/knowledge-core';
import {
  loadM2PostMergeAcceptance,
  validateM2PostMergeAcceptance,
} from '../../../scripts/validate-m2-post-merge-acceptance.js';

const CANDIDATE_DIGEST = '5ab9439d357921119d7ca9387e661cf3f28b8420a27b3dd201df57c6419b6697';

test('M2 post-merge acceptance preserves the candidate and resolves only proven blockers', async () => {
  const evidence = await validateM2PostMergeAcceptance({
    generatedAt: '2026-07-28T10:30:00.000Z',
    commitSha: 'local',
    branch: 'agent/m2-rc1-post-merge-acceptance',
  });
  assert.equal(evidence.schemaVersion, 'm2-governed-planning-post-merge-evidence/v1');
  assert.equal(evidence.digests.sourceCandidate, CANDIDATE_DIGEST);
  assert.equal(evidence.merge.pullRequests.length, 9);
  assert.equal(evidence.merge.pullRequests.at(-1).pr, 20);
  assert.equal(evidence.merge.fileDeltaCount, 0);
  assert.deepEqual(evidence.decision.resolvedBlockers, ['m2-stack-prs-not-merged']);
  assert(evidence.decision.openBlockers.includes('main-branch-final-ci-not-verified'));
  assert(!evidence.decision.openBlockers.includes('m2-stack-prs-not-merged'));
  assert(!evidence.decision.openBlockers.includes('main-branch-final-ci-not-run'));
  assert.equal(evidence.decision.productionEligible, false);
});

test('M2 post-merge acceptance rejects stale, overlapping or fabricated release evidence', async () => {
  const acceptance = await loadM2PostMergeAcceptance();
  const stale = structuredClone(acceptance);
  stale.decision.openBlockers[0] = 'm2-stack-prs-not-merged';
  await assert.rejects(validateM2PostMergeAcceptance({ acceptance: stale }), /open blockers order|cannot remain open/);

  const fabricatedCi = structuredClone(acceptance);
  fabricatedCi.verification.mainBranchFinalCi.status = 'PASSED';
  await assert.rejects(validateM2PostMergeAcceptance({ acceptance: fabricatedCi }), /requires a run ID/);

  const promoted = structuredClone(acceptance);
  promoted.decision.productionEligible = true;
  await assert.rejects(validateM2PostMergeAcceptance({ acceptance: promoted }), /cannot be production eligible/);

  const secret = structuredClone(acceptance);
  secret.verification.mainBranchFinalCi.databaseUrl = 'postgresql://secret';
  await assert.rejects(validateM2PostMergeAcceptance({ acceptance: secret }), /sensitive material|status is invalid/);
});

test('original M2-RC1 candidate remains byte-independent and digest-stable', async () => {
  const candidate = JSON.parse(await readFile('releases/m2/planning-release-candidate.json', 'utf8'));
  assert.equal(sha256(canonicalize(candidate)), CANDIDATE_DIGEST);
  assert(candidate.decision.blockers.includes('m2-stack-prs-not-merged'));
  assert(candidate.decision.blockers.includes('main-branch-final-ci-not-run'));
});

test('M2 post-merge acceptance can clear only the main CI blocker when permanent CI evidence is supplied', async () => {
  const acceptance = await loadM2PostMergeAcceptance();
  const verified = structuredClone(acceptance);
  verified.verification.mainBranchFinalCi = {
    status: 'PASSED',
    commitSha: verified.merge.mainSha,
    runId: 30359999999,
    m2EvidenceArtifactDigest: 'sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    postgresArtifactDigest: 'sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  };
  verified.decision.openBlockers = verified.decision.openBlockers.slice(1);
  const evidence = await validateM2PostMergeAcceptance({ acceptance: verified, commitSha: 'local' });
  assert.equal(evidence.verification.mainBranchFinalCi.status, 'PASSED');
  assert(!evidence.decision.openBlockers.includes('main-branch-final-ci-not-verified'));
  assert.equal(evidence.decision.productionEligible, false);
});
