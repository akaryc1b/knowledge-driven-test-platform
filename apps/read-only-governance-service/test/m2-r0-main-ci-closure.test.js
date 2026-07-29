import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  M2_R0_MAIN_SHA,
  collectM2R0MainCiClosureEvidence,
} from '../../../scripts/collect-m2-r0-main-ci-closure.js';

function digest(label) {
  return `sha256:${createHash('sha256').update(label).digest('hex')}`;
}

const run = {
  id: 30420000001,
  workflow_id: 321111055,
  name: 'validation',
  path: '.github/workflows/validation.yml',
  run_attempt: 1,
  event: 'push',
  head_branch: 'main',
  head_sha: M2_R0_MAIN_SHA,
  status: 'completed',
  conclusion: 'success',
  html_url: 'https://github.com/akaryc1b/knowledge-driven-test-platform/actions/runs/30420000001',
};

const jobs = [
  {
    id: 90470000001,
    name: 'validate',
    status: 'completed',
    conclusion: 'success',
    steps: [{
      number: 16,
      name: 'Run deployment validation',
      status: 'completed',
      conclusion: 'success',
    }],
  },
  {
    id: 90470000002,
    name: 'postgres-integration',
    status: 'completed',
    conclusion: 'success',
    steps: [],
  },
];

const artifacts = [
  artifact(8700000001, 'm1-release-candidate-evidence', digest('r0-m1')),
  artifact(8700000002, 'm2-release-candidate-evidence', digest('r0-m2')),
  artifact(8700000003, 'm2-post-merge-acceptance-evidence', digest('r0-post-merge')),
  artifact(8700000004, 'postgres-test-log', digest('r0-postgres')),
  artifact(8700000005, 'repository-validation-log', digest('r0-repository')),
  artifact(8700000006, 'deployment-validation-log', digest('r0-deployment')),
];

test('R0 closure collector queries the exact merged main SHA and requires complete evidence', async () => {
  const requested = [];
  const evidence = await collectM2R0MainCiClosureEvidence({
    promotion: {
      releaseId: 'M2-RC1',
      version: '0.12.0',
      promotionSource: { branch: 'main', mainSha: '991b5f0f9cfa3a382f9aff3c600f98b76aed9c08' },
    },
    collectedAt: '2026-07-29T05:00:00.000Z',
    credential: 'masked-runtime-token',
    fetchImpl: async (url, options) => {
      requested.push({ url, authorization: options.headers.Authorization });
      if (url.includes('/actions/runs?')) return response({ workflow_runs: [run] });
      if (url.includes('/jobs?')) return response({ jobs });
      if (url.includes('/artifacts?')) return response({ artifacts });
      return response({}, false, 404);
    },
  });

  assert.equal(evidence.promotionSourceSha, M2_R0_MAIN_SHA);
  assert.equal(evidence.run.headSha, M2_R0_MAIN_SHA);
  assert.equal(evidence.run.event, 'push');
  assert.equal(evidence.jobs.validate.conclusion, 'success');
  assert.equal(evidence.jobs.postgresIntegration.conclusion, 'success');
  assert.equal(evidence.artifacts.deploymentValidation.name, 'deployment-validation-log');
  assert.equal(evidence.eligibleForClosure, true);
  assert.equal(requested.length, 3);
  assert(requested[0].url.includes(`head_sha=${M2_R0_MAIN_SHA}`));
  assert(requested.every((item) => item.authorization === 'Bearer masked-runtime-token'));
  assert(!JSON.stringify(evidence).includes('masked-runtime-token'));
});

function artifact(id, name, value) {
  return { id, name, digest: value, expired: false };
}

function response(payload, ok = true, status = 200) {
  return { ok, status, async json() { return payload; } };
}
