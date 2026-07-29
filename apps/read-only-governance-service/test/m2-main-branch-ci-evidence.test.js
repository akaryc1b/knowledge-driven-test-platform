import test from 'node:test';
import assert from 'node:assert/strict';
import { collectM2MainBranchCiEvidence } from '../../../scripts/collect-m2-main-branch-ci-evidence.js';

const SOURCE_SHA = '991b5f0f9cfa3a382f9aff3c600f98b76aed9c08';
const PROMOTION = {
  releaseId: 'M2-RC1',
  version: '0.12.0',
  promotionSource: { mainSha: SOURCE_SHA },
};

const SUCCESS_RUN = {
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

const SUCCESS_JOBS = [
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

const COMPLETE_ARTIFACTS = [
  artifact(8685000001, 'm1-release-candidate-evidence', '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'),
  artifact(8685000002, 'm2-release-candidate-evidence', '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0'),
  artifact(8685000003, 'm2-post-merge-acceptance-evidence', '23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01'),
  artifact(8685000004, 'postgres-test-log', '3456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef012'),
  artifact(8685000005, 'repository-validation-log', '456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123'),
  artifact(8685000006, 'deployment-validation-log', '56789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01234'),
];

test('main CI collector binds an exact successful push and marks complete evidence eligible', async () => {
  const requested = [];
  const evidence = await collectM2MainBranchCiEvidence({
    promotion: PROMOTION,
    collectedAt: '2026-07-29T00:00:00.000Z',
    credential: 'masked-runtime-credential',
    fetchImpl: async (url, options) => {
      requested.push({ url, authorization: options.headers.Authorization });
      if (url.includes('/actions/runs?')) return response({ workflow_runs: [SUCCESS_RUN] });
      if (url.includes('/jobs?')) return response({ jobs: SUCCESS_JOBS });
      if (url.includes('/artifacts?')) return response({ artifacts: COMPLETE_ARTIFACTS });
      return response({}, false, 404);
    },
  });

  assert.equal(evidence.schemaVersion, 'm2-main-branch-ci-evidence/v1');
  assert.equal(evidence.run.id, SUCCESS_RUN.id);
  assert.equal(evidence.run.event, 'push');
  assert.equal(evidence.run.headSha, SOURCE_SHA);
  assert.equal(evidence.jobs.validate.deploymentValidationStep.conclusion, 'success');
  assert.equal(evidence.jobs.postgresIntegration.conclusion, 'success');
  assert.equal(evidence.artifacts.m2PostMergeEvidence.name, 'm2-post-merge-acceptance-evidence');
  assert.equal(evidence.artifacts.deploymentValidation.name, 'deployment-validation-log');
  assert.equal(evidence.eligibleForClosure, true);
  assert.equal(requested.length, 3);
  assert(requested.every((item) => item.authorization === 'Bearer masked-runtime-credential'));
  assert(!JSON.stringify(evidence).includes('masked-runtime-credential'));
});

test('main CI collector preserves the real failed push observation without closing the blocker', async () => {
  const failedRun = {
    ...SUCCESS_RUN,
    id: 30356400001,
    conclusion: 'failure',
    html_url: 'https://github.com/akaryc1b/knowledge-driven-test-platform/actions/runs/30356400001',
  };
  const failedJobs = structuredClone(SUCCESS_JOBS);
  failedJobs[0].id = 90265505895;
  failedJobs[0].conclusion = 'failure';
  failedJobs[0].steps = [];
  failedJobs[1].id = 90265505920;
  const partialArtifacts = [
    artifact(8686972491, 'postgres-test-log', 'ff900fd49517bbc469891017e741d9bcff8b8389b6a9d0881759f42f6a6dbfff'),
  ];

  const evidence = await collectM2MainBranchCiEvidence({
    promotion: PROMOTION,
    fetchImpl: mockFetch({ run: failedRun, jobs: failedJobs, artifacts: partialArtifacts }),
  });

  assert.equal(evidence.run.id, 30356400001);
  assert.equal(evidence.run.conclusion, 'failure');
  assert.equal(evidence.jobs.validate.conclusion, 'failure');
  assert.equal(evidence.jobs.validate.deploymentValidationStep, null);
  assert.equal(evidence.jobs.postgresIntegration.conclusion, 'success');
  assert.equal(evidence.artifacts.postgresValidation.digest,
    'sha256:ff900fd49517bbc469891017e741d9bcff8b8389b6a9d0881759f42f6a6dbfff');
  assert.equal(evidence.artifacts.repositoryValidation, null);
  assert.equal(evidence.eligibleForClosure, false);
});

test('main CI collector rejects PR validation and ambiguous exact runs', async () => {
  const prRun = { ...SUCCESS_RUN, event: 'pull_request', head_branch: 'agent/test' };
  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: async () => response({ workflow_runs: [prRun] }),
    }),
    /exactly one completed main push validation run/,
  );

  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: async () => response({ workflow_runs: [SUCCESS_RUN, { ...SUCCESS_RUN, id: 30360000124 }] }),
    }),
    /found 2/,
  );
});

test('main CI collector rejects placeholder or duplicate Artifact evidence', async () => {
  const placeholderArtifacts = structuredClone(COMPLETE_ARTIFACTS);
  placeholderArtifacts[0].digest = `sha256:${'a'.repeat(64)}`;
  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: mockFetch({ artifacts: placeholderArtifacts }),
    }),
    /looks like a placeholder/,
  );

  await assert.rejects(
    collectM2MainBranchCiEvidence({
      promotion: PROMOTION,
      fetchImpl: mockFetch({ artifacts: [...COMPLETE_ARTIFACTS, COMPLETE_ARTIFACTS[0]] }),
    }),
    /at most one m1-release-candidate-evidence Artifact/,
  );
});

function mockFetch({ run = SUCCESS_RUN, jobs = SUCCESS_JOBS, artifacts = COMPLETE_ARTIFACTS } = {}) {
  return async (url) => {
    if (url.includes('/actions/runs?')) return response({ workflow_runs: [run] });
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
