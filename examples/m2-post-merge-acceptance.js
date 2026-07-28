import { validateM2PostMergeAcceptance } from '../scripts/validate-m2-post-merge-acceptance.js';

const evidence = await validateM2PostMergeAcceptance({
  generatedAt: process.env.KDTP_RELEASE_GENERATED_AT ?? '2026-07-28T10:30:00.000Z',
  commitSha: process.env.KDTP_RELEASE_SOURCE_SHA ?? process.env.GITHUB_SHA ?? 'local',
  branch: process.env.KDTP_RELEASE_SOURCE_BRANCH ?? process.env.GITHUB_HEAD_REF
    ?? process.env.GITHUB_REF_NAME ?? 'agent/m2-rc1-post-merge-acceptance',
});
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
