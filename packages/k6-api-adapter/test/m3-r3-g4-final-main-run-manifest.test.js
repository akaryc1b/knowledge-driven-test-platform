import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import {
  ARTIFACT_PATHS, BRANCH, OBSERVER_MERGE, SCHEMA_PATH,
  WORKFLOW_NAME, auditArtifactFiles, createEvidence,
  loadRepositoryFiles, validateEvidence, validateRepository,
} from '../../../scripts/m3-r3-g4-final-main-run-manifest.js';

const HEAD = '0123456789abcdef0123456789abcdef01234567';
const MERGE = '89abcdef0123456789abcdef0123456789abcdef';
const RUN_ID = 31160000003;
const GENERATED_AT = '2026-08-07T06:00:00.000Z';

function validation() {
  return {
    focusedStatus: 'success',
    rootValidationStatus: 'success',
    dedicatedValidatorStatus: 'success',
  };
}

test('C2 repository contract is permanent and read-only', async () => {
  const result = await validateRepository();
  assert.equal(result.status, 'success');
  assert.equal(result.baselineMain, OBSERVER_MERGE);
  assert.equal(result.artifactPathCount, 12);
  assert.equal(ARTIFACT_PATHS.length, 12);
});

test('C2 pre-merge Evidence preserves the exact baseline and remains blocked', async () => {
  const evidence = await createEvidence({
    eventName: 'pull_request', branch: BRANCH, commitSha: HEAD,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    pullRequestNumber: 76, credential: '',
    apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch({ mainSha: OBSERVER_MERGE }), validation: validation(),
  });
  assert.equal(evidence.source.mode, 'pre-merge-contract');
  assert.equal(evidence.pullRequest.number, 76);
  assert.equal(evidence.pullRequest.draft, true);
  assert.equal(evidence.acceptedHead.workflowCount, 0);
  assert.equal(evidence.exactMain.workflowCount, 0);
  assert.equal(evidence.decision.manifestComplete, false);
  assert.deepEqual(evidence.decision.repositoryBlockers,
    ['exact-main-run-manifest-pending']);
});

test('C2 exact-main Evidence derives accepted Head names and records all successful push Runs', async () => {
  const evidence = await createEvidence({
    eventName: 'push', branch: 'main', commitSha: MERGE,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    credential: '', apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch(), validation: validation(),
    pollAttempts: 1, sleepImpl: async () => {},
  });
  assert.equal(evidence.source.mode, 'exact-main-manifest');
  assert.deepEqual(evidence.pullRequest.parents, [OBSERVER_MERGE, HEAD]);
  assert.equal(evidence.acceptedHead.workflowCount, 3);
  assert.equal(evidence.exactMain.workflowCount, 4);
  assert(evidence.exactMain.workflowNames.includes('push-only-governance'));
  assert(evidence.acceptedHead.workflowNames
    .every((name) => evidence.exactMain.workflowNames.includes(name)));
  assert.equal(evidence.collector.currentRunId, RUN_ID);
  assert.equal(evidence.collector.validationJob.conclusion, 'success');
  assert.equal(evidence.collector.reportJob.status, 'in_progress');
  assert.equal(evidence.collector.reportJob.conclusion, null);
  assert.equal(evidence.collector.reportJobExternalVerificationRequired, true);
  assert.equal(evidence.decision.manifestComplete, true);
  assert.equal(evidence.decision.finalClosureEligible, false);
});

test('C2 collector rejects a missing accepted Head Workflow', async () => {
  await assert.rejects(createEvidence({
    eventName: 'push', branch: 'main', commitSha: MERGE,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    credential: '', apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch({ missingMainWorkflow: 'validation' }),
    validation: validation(), pollAttempts: 1,
    sleepImpl: async () => {},
  }), /did not reach the complete admissible state/u);
});

test('C2 collector rejects duplicate exact-main Workflow names', async () => {
  await assert.rejects(createEvidence({
    eventName: 'push', branch: 'main', commitSha: MERGE,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    credential: '', apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch({ duplicateMainWorkflow: true }),
    validation: validation(), pollAttempts: 1,
    sleepImpl: async () => {},
  }), /duplicate Workflow names/u);
});

test('C2 collector rejects rerun attempts and failed sibling Jobs', async () => {
  await assert.rejects(createEvidence({
    eventName: 'push', branch: 'main', commitSha: MERGE,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    credential: '', apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch({ rerunWorkflow: 'validation' }),
    validation: validation(), pollAttempts: 1,
    sleepImpl: async () => {},
  }), /contains rerun/u);

  await assert.rejects(createEvidence({
    eventName: 'push', branch: 'main', commitSha: MERGE,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    credential: '', apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch({ failedJobWorkflow: 'validation' }),
    validation: validation(), pollAttempts: 1,
    sleepImpl: async () => {},
  }), /failed or incomplete Job/u);
});

test('C2 closed Schema and canonical digest reject widening and tampering', async () => {
  const files = await loadRepositoryFiles();
  const schema = JSON.parse(files[SCHEMA_PATH]);
  const evidence = await createEvidence({
    eventName: 'pull_request', branch: BRANCH, commitSha: HEAD,
    runId: RUN_ID, runAttempt: 1, generatedAt: GENERATED_AT,
    pullRequestNumber: 76, credential: '',
    apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch({ mainSha: OBSERVER_MERGE }), validation: validation(), files,
  });
  evidence.decision.unexpected = true;
  redigest(evidence);
  assert.throws(() => validateEvidence(evidence, schema),
    /Schema additional property/u);

  delete evidence.decision.unexpected;
  redigest(evidence);
  evidence.evidenceDigest = 'f'.repeat(64);
  assert.throws(() => validateEvidence(evidence, schema),
    /canonical Evidence digest mismatch/u);
});

test('C2 Artifact audit rejects unexpected or unsafe paths', () => {
  const files = Object.fromEntries(ARTIFACT_PATHS.map((path) => [path, 'ok\n']));
  assert.equal(auditArtifactFiles(files), true);
  assert.throws(() => auditArtifactFiles({ ...files, unexpected: 'x' }),
    /path set changed/u);
  const unsafe = { ...files };
  delete unsafe[ARTIFACT_PATHS[0]];
  unsafe['../escape'] = 'x';
  assert.throws(() => auditArtifactFiles(unsafe),
    /path set changed|Unsafe/u);
});

function redigest(evidence) {
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  evidence.evidenceDigest = sha256(claims);
}

function fakeFetch(options = {}) {
  const headRuns = [
    run(31160000001, 401, 'validation', 'pull_request', HEAD, 'agent/c2'),
    run(31160000002, 402, 'm3-r3-final-main-observer',
      'pull_request', HEAD, 'agent/c2'),
    run(31160000004, 403, WORKFLOW_NAME,
      'pull_request', HEAD, 'agent/c2'),
  ];
  let mainRuns = [
    run(31160000011, 401, 'validation', 'push', MERGE, 'main'),
    run(31160000012, 402, 'm3-r3-final-main-observer',
      'push', MERGE, 'main'),
    {
      ...run(RUN_ID, 403, WORKFLOW_NAME, 'push', MERGE, 'main'),
      status: 'in_progress', conclusion: null,
    },
    run(31160000014, 404, 'push-only-governance', 'push', MERGE, 'main'),
  ];
  if (options.missingMainWorkflow) {
    mainRuns = mainRuns.filter((item) =>
      item.name !== options.missingMainWorkflow);
  }
  if (options.duplicateMainWorkflow) {
    mainRuns.push({
      ...mainRuns.find((item) => item.name === 'validation'),
      id: 31160000015,
    });
  }
  if (options.rerunWorkflow) {
    mainRuns = mainRuns.map((item) => item.name === options.rerunWorkflow
      ? { ...item, run_attempt: 2 } : item);
  }

  return async (url) => {
    const parsed = new URL(url);
    if (parsed.pathname.endsWith('/git/ref/heads/main')) {
      return response({ object: { sha: options.mainSha ?? MERGE } });
    }
    if (parsed.pathname.endsWith('/pulls/76')) {
      return response({
        number: 76, state: 'open', draft: true, merged: false,
        base: { sha: OBSERVER_MERGE, ref: 'main' },
        head: { sha: HEAD, ref: BRANCH },
        merge_commit_sha: null,
      });
    }
    if (parsed.pathname.endsWith(`/commits/${MERGE}`)) {
      return response({
        sha: MERGE,
        parents: [{ sha: OBSERVER_MERGE }, { sha: HEAD }],
      });
    }
    if (parsed.pathname.endsWith(`/commits/${HEAD}/pulls`)) {
      return response([{
        number: 76, state: 'closed', draft: false,
        merged_at: GENERATED_AT,
        base: { sha: OBSERVER_MERGE, ref: 'main' },
        head: { sha: HEAD, ref: BRANCH },
        merge_commit_sha: MERGE,
      }]);
    }
    if (parsed.pathname.endsWith('/actions/runs')) {
      const event = parsed.searchParams.get('event');
      if (event === 'pull_request') {
        return response({
          total_count: headRuns.length,
          workflow_runs: headRuns,
        });
      }
      if (event === 'push') {
        return response({
          total_count: mainRuns.length,
          workflow_runs: mainRuns,
        });
      }
    }
    const match = parsed.pathname.match(/\/actions\/runs\/(\d+)\/jobs$/u);
    if (match) {
      const runId = Number(match[1]);
      if (runId === RUN_ID) {
        return response({ jobs: [
          job(92770000001, 'validate-manifest-contract',
            'completed', 'success'),
          job(92770000002, 'report-final-main-run-manifest',
            'in_progress', null),
        ] });
      }
      const target = [...headRuns, ...mainRuns].find((item) => item.id === runId);
      const conclusion = options.failedJobWorkflow
        && target?.name === options.failedJobWorkflow ? 'failure' : 'success';
      return response({ jobs: [
        job(92770000000 + (runId % 1000),
          `${target?.name ?? 'unknown'}-job`, 'completed', conclusion),
        ...(target?.event === 'pull_request' && target?.name === WORKFLOW_NAME
          ? [job(92770001000 + (runId % 1000),
            'report-final-main-run-manifest', 'completed', 'skipped')]
          : []),
      ] });
    }
    return response({}, false, 404);
  };
}

function run(id, workflowId, name, event, sha, branch) {
  return {
    id, workflow_id: workflowId, name, event,
    head_sha: sha, head_branch: branch, run_attempt: 1,
    status: 'completed', conclusion: 'success',
  };
}
function job(id, name, status, conclusion) {
  return { id, name, status, conclusion };
}
function response(payload, ok = true, status = 200) {
  return { ok, status, async json() { return payload; } };
}
