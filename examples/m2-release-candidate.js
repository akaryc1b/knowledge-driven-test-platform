import { validateM2ReleaseCandidate } from '../scripts/validate-m2-release-candidate.js';

const evidence = await validateM2ReleaseCandidate({
  generatedAt: process.env.KDTP_RELEASE_GENERATED_AT ?? '2026-07-28T06:30:00.000Z',
  commitSha: process.env.KDTP_RELEASE_SOURCE_SHA ?? process.env.GITHUB_SHA ?? 'local',
  branch: process.env.KDTP_RELEASE_SOURCE_BRANCH ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'agent/m2-i-release-acceptance',
  imageId: process.env.KDTP_RELEASE_IMAGE_ID ?? null,
  registryDigest: process.env.KDTP_RELEASE_REGISTRY_DIGEST ?? null,
});
process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
