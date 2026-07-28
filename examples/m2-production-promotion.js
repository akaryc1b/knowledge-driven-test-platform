import { validateM2ProductionPromotion } from '../scripts/validate-m2-production-promotion.js';

const evidence = await validateM2ProductionPromotion({
  generatedAt: process.env.KDTP_RELEASE_GENERATED_AT ?? '2026-07-28T12:30:00.000Z',
  commitSha: process.env.KDTP_RELEASE_SOURCE_SHA ?? process.env.GITHUB_SHA ?? 'local',
  branch: process.env.KDTP_RELEASE_SOURCE_BRANCH ?? process.env.GITHUB_HEAD_REF
    ?? process.env.GITHUB_REF_NAME ?? 'agent/m2-rc1-production-promotion-contract',
});
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
