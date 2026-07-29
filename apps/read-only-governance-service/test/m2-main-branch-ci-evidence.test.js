import test from 'node:test';
import assert from 'node:assert/strict';
import { collectM2MainBranchCiEvidence } from '../../../scripts/collect-m2-main-branch-ci-evidence.js';

const SOURCE_SHA = '991b5f0f9cfa3a382f9aff3c600f98b76aed9c08';
const PROMOTION = {
  releaseId: 'M2-RC1',
  version: '0.12.0',
  promotionSource: { mainSha: SOURCE_SHA },
};

const RUN = {
  id: 30360000123,
  workflow_id: 321111055,
  name: 'validation',
  path: '.github/workflows/validation.yml',
  run_attempt: 1,
  event: 'push',
  head_branch: 'main',
  head_sha: SOURCE_SHA,
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://github.com/akaryc1b/knowledge-driven-test-platform/actions/runs/30360000123',
};

const JOBS = [
  {
    id: 90270000101,
    name: 'validate',
    status: 'completed',
    conclusion: 'success',
    steps: [
      { number: 16, name: 'Run npm run validate:deployment', status: 'completed', conclusion: 'success' },
    ],
  },
  {
    id: 90270000102,
    name: 'postgres-integration',
    status: 'completed',
    conclusion: 'success',
    steps: [],
  },
];

const ARTIFACTS = [
  artifact(8685000001, 'm1-release-candidate-evidence', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  artifact(8685000002, 'm2-release-candidate-evidence', '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0'),
  artifact(8685000003, 'm2-post-merge-acceptance-evidence', '23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01'),
  artifact(8685000004, 'postgres-test-log', '3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012'),
  artifact(8685000005, 'repository-validation-log', '456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123'),
];

test('main CI collector binds the exact successful push run, jobs, step and permanent Artifacts', async () => {
  const requested = [];
  const evidence = await collectM2MainBranchCiEvidence({
    promotion: PROMOTION,
    collectedAt: '2026-07-29T00:00:00.000Z',
    credential: 'masked-runtime-credential',
    fetchImpl: async (url, options) => {
      requested.push({ url, authorization: options.headers.Authorization });
      if (url.includes('/actions/runs?')) return response({ workflow_runs: [RUN] });
      if (url.includes('/jobs?')) return response({ jobs: JOBS });
      if (url.includes('/artifacts?')) return response({ artifacts: ARTIFACTS });
      return response({}, false, 404);
    },
  });

  assert.equal(evidence.schemaVersion, 'm2-main-branch-ci-evidence/v1');
  assert.equal(evidence.run.id, RUN.id);
  assert.equal(evidence.run.event, 'push');
  assert.equal(evidence.run.headSha, SOURCE_SHA);
  assert.equal(evidence.jobs.validate.deploymentValidationStep.conclusion, 'success');
  assert.equal(evidence.jobs.postgresIntegration.conclusion, 'success');
  assert.equal(evidence.artifacts.m2PostMergeEvidence.name, 'm2-post-merge-acceptance-evidence');
  assert.equal(evidence.artifacts.deploymentValidation, null);
  assert.equal(requested.length, 3);
  assert(requested.every((item) => item.authorization === 'Bearer masked-runtime-credential'));
  assert(!JSON.stringify(evidence).includes('masked-runtime-credential'));
});

test('main CI collector rejects PR validation and unsuccessful deployment validation', async () => {
  const prRun = { ...RUN, event: 'pull_request', head_branch: 'agent/test' };
  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: async () => response({ workflow_runs: [prRun] }),
    }),
    /exactly one successful main push validation run/,
  );

  const failedJobs = structuredClone(JOBS);
  failedJobs[0].steps[0].conclusion = 'failure';
  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: mockFetch({ jobs: failedJobs, artifacts: ARTIFACTS }),
    }),
    /Deployment Validator step did not succeed/,
  );
});

test('main CI collector rejects missing or placeholder Artifact evidence', async () => {
  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: mockFetch({ artifacts: ARTIFACTS.slice(0, -1) }),
    }),
    /repository-validation-log Artifact, found 0/,
  );

  const placeholderArtifacts = structuredClone(ARTIFACTS);
  placeholderArtifacts[0].digest = `sha256:${'a'.repeat(64)}`;
  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: mockFetch({ artifacts: placeholderArtifacts }),
    }),
    /looks like a placeholder/,
  );
});

function mockFetch({ jobs = JOBS, artifacts = ARTIFACTS } = {}) {
  return async (url) => {
    if (url.includes('/actions/runs?')) return response({ workflow_runs: [RUN] });
    if (url.includes('/jobs?')) return response({ jobs });
    if (url.includes('/artifacts?')) return response({ artifacts });
    return response({}, false, 404);
  };
}

function artifact(id, name, hex) {
  return { id, name, digest: `sha256:${hex}`, expired: false };
}

function response(payload, ok = true, status = 200) {
  return { ok, status, async json() { return payload; } };
}
