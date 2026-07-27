import { validateReleaseCandidate } from '../scripts/validate-release-candidate.js';

const evidence = await validateReleaseCandidate({
  generatedAt: process.env.KDTP_RELEASE_GENERATED_AT ?? '2026-07-27T12:30:00.000Z',
  commitSha: process.env.KDTP_RELEASE_SOURCE_SHA ?? process.env.GITHUB_SHA ?? 'local',
  branch: process.env.KDTP_RELEASE_SOURCE_BRANCH ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'agent/m1-k-release-acceptance',
  imageId: process.env.KDTP_RELEASE_IMAGE_ID ?? null,
  registryDigest: process.env.KDTP_RELEASE_REGISTRY_DIGEST ?? null,
});

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
