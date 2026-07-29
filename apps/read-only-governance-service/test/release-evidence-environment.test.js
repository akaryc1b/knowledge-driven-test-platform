import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveEvidenceBranch } from '../../../scripts/release-evidence-environment.js';
import { validateReleaseCandidate } from '../../../scripts/validate-release-candidate.js';
import { validateM2ReleaseCandidate } from '../../../scripts/validate-m2-release-candidate.js';
import { validateM2PostMergeAcceptance } from '../../../scripts/validate-m2-post-merge-acceptance.js';

const GENERATED_AT = '2026-07-29T00:00:00.000Z';

test('release evidence branch resolver ignores an empty pull-request head ref on push', () => {
  assert.equal(resolveEvidenceBranch({ headRef: '', refName: 'main', fallback: 'fallback' }), 'main');
  assert.equal(resolveEvidenceBranch({ headRef: '   ', refName: 'main', fallback: 'fallback' }), 'main');
  assert.equal(resolveEvidenceBranch({ headRef: '', refName: '', fallback: 'fallback' }), 'fallback');
  assert.throws(() => resolveEvidenceBranch({ branch: '' }), /branch is invalid/i);
});

test('all historical release evidence generators resolve main in a push environment', async () => {
  const previousHeadRef = process.env.GITHUB_HEAD_REF;
  const previousRefName = process.env.GITHUB_REF_NAME;
  process.env.GITHUB_HEAD_REF = '';
  process.env.GITHUB_REF_NAME = 'main';
  try {
    const m1 = await validateReleaseCandidate({ generatedAt: GENERATED_AT, commitSha: 'local' });
    const m2 = await validateM2ReleaseCandidate({ generatedAt: GENERATED_AT, commitSha: 'local' });
    const postMerge = await validateM2PostMergeAcceptance({ generatedAt: GENERATED_AT, commitSha: 'local' });
    assert.equal(m1.source.branch, 'main');
    assert.equal(m2.source.branch, 'main');
    assert.equal(postMerge.source.branch, 'main');
  } finally {
    restoreEnvironment('GITHUB_HEAD_REF', previousHeadRef);
    restoreEnvironment('GITHUB_REF_NAME', previousRefName);
  }
});

function restoreEnvironment(name, value) {
  if (value === undefined) delete process.env[name];
  else process.env[name] = value;
}
