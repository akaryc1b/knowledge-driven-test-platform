import { validateM2ProductionPromotion } from '../scripts/validate-m2-production-promotion-entry.js';

const evidence = await validateM2ProductionPromotion({
  generatedAt: process.env.KDTP_RELEASE_GENERATED_AT ?? '2026-07-28T12:30:00.000Z',
  commitSha: process.env.KDTP_RELEASE_SOURCE_SHA ?? process.env.GITHUB_SHA ?? 'local',
  branch: process.env.KDTP_RELEASE_SOURCE_BRANCH,
});
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
