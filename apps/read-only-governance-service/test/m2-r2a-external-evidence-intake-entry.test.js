import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { validateM2ExternalEvidenceIntakeEntry } from '../../../scripts/validate-m2-external-evidence-intake-entry.js';

const GENERATED_AT = '2026-07-30T04:59:00.000Z';
const MERGE_SHA = '5acb578ec799d3ab6d1c6e217787231cba23c104';

test('R2-A CLI resolves main when push GITHUB_HEAD_REF is empty', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/validate-m2-external-evidence-intake-entry.js'],
    {
      cwd: process.cwd(),
      encoding: 'utf8',
      env: {
        ...process.env,
        GITHUB_SHA: MERGE_SHA,
        GITHUB_HEAD_REF: '',
        GITHUB_REF_NAME: 'main',
      },
    },
  );
  assert.equal(result.status, 0, result.stderr);
  const evidence = JSON.parse(result.stdout);
  assert.equal(evidence.source.branch, 'main');
  assert.equal(evidence.source.commitSha, MERGE_SHA);
  assert.equal(evidence.decision.productionEligible, false);
  assert.equal(evidence.decision.openBlockers.length, 4);
});

test('R2-A entry prefers a non-empty pull request head ref', async () => {
  const evidence = await validateM2ExternalEvidenceIntakeEntry({
    generatedAt: GENERATED_AT,
    commitSha: 'local',
    headRef: 'agent/m2-rc1-r2a-main-branch-resolution',
    refName: '35/merge',
  });
  assert.equal(evidence.source.branch, 'agent/m2-rc1-r2a-main-branch-resolution');
});

test('R2-A entry rejects an explicitly blank evidence branch', async () => {
  await assert.rejects(
    validateM2ExternalEvidenceIntakeEntry({
      generatedAt: GENERATED_AT,
      commitSha: 'local',
      branch: '   ',
      refName: 'main',
    }),
    /R2-A evidence branch is invalid/,
  );
});
