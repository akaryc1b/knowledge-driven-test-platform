import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import {
  CORRECTION_HEAD, CORRECTION_MERGE, CORRECTION_WORKFLOWS,
  OBSERVER_BRANCH, SCHEMA_PATH, SOURCE_BASE, SOURCE_HEAD, SOURCE_MERGE,
  SOURCE_HISTORICAL_FAILURE, SOURCE_WORKFLOWS, createEvidence, loadRepositoryFiles,
  validateEvidence, validateRepository,
} from '../../../scripts/m3-r3-final-main-observer.js';

const OBSERVER_HEAD = 'f0123456789abcdef0123456789abcdef0123456';
const OBSERVER_MERGE = 'e0123456789abcdef0123456789abcdef0123456';
const GENERATED_AT = '2026-08-07T03:00:00.000Z';

function redigest(evidence) {
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  evidence.evidenceDigest = sha256(claims);
  return evidence;
}

function evidenceOptions(overrides = {}) {
  return {
    eventName: 'pull_request', branch: OBSERVER_BRANCH, commitSha: OBSERVER_HEAD,
    generatedAt: GENERATED_AT, runId: 31150000001, runAttempt: 1,
    observerPullRequestNumber: 74, credential: '', apiBase: 'https://api.github.test',
    fetchImpl: fakeFetch(overrides), validation: successfulValidation(),
  };
}

const acceptedEvidence = (overrides = {}) => createEvidence(evidenceOptions(overrides));
const acceptedPushEvidence = (overrides = {}) => createEvidence({
  eventName: 'push', branch: 'main', commitSha: OBSERVER_MERGE,
  generatedAt: GENERATED_AT, runId: 31150000002, runAttempt: 1,
  credential: '', apiBase: 'https://api.github.test',
  fetchImpl: fakeFetch({ ...overrides, observerMerged: true,
    observerMergeSha: OBSERVER_MERGE, mainSha: OBSERVER_MERGE }),
  validation: successfulValidation(),
});

function successfulValidation() {
  return { focusedStatus: 'success', rootValidationStatus: 'success',
    observerValidatorStatus: 'success' };
}

test('M3-R3 final Observer repository contract is permanent and read-only', async () => {
  const result = await validateRepository();
  assert.equal(result.status, 'success');
  assert.equal(result.sourceWorkflowCount, 16);
  assert.equal(result.correctionWorkflowCount, 14);
  assert.equal(result.artifactPathCount, 16);
});

test('Observer binds source/correction merges, natural Runs, Jobs and Artifacts', async () => {
  const evidence = await acceptedEvidence({
    extraCorrectionWorkflow: 'm2-r2a-external-evidence-intake',
  });
  assert.deepEqual(evidence.sourceMerge.parents, [SOURCE_BASE, SOURCE_HEAD]);
  assert.deepEqual(evidence.correctionMerge.parents, [SOURCE_MERGE, CORRECTION_HEAD]);
  assert.equal(evidence.main.observedSha, CORRECTION_MERGE);
  assert.equal(evidence.naturalRuns.sourceMerge.workflowCount, 16);
  assert.equal(evidence.naturalRuns.correctionMerge.workflowCount, 15);
  assert(evidence.naturalRuns.correctionMerge.expectedWorkflowNames
    .includes('m2-r2a-external-evidence-intake'));
  assert.equal(evidence.naturalRuns.correctionMerge
    .expectedConclusions['m2-r2a-external-evidence-intake'], 'success');
  const preserved = evidence.naturalRuns.sourceMerge.runs.find(
    (run) => run.name === 'validation');
  assert.equal(preserved.conclusion, 'failure');
  assert.equal(preserved.expectedConclusion, 'failure');
  assert.deepEqual(evidence.historicalFailures, [{
    stage: 'sourceMerge', workflow: 'validation', runId: preserved.id,
    runConclusion: 'failure', failedJobIds: preserved.jobs.map((job) => job.id),
    classification: SOURCE_HISTORICAL_FAILURE.classification,
    correctedByPullRequest: 73, correctedByHead: CORRECTION_HEAD,
    correctedByMerge: CORRECTION_MERGE, preserved: true,
    manualRerunPerformed: false,
  }]);
  assert(evidence.naturalRuns.sourceMerge.runs.every((run) => run.jobs.length === 1));
  assert.equal(evidence.artifacts.sourceMergeG1.headSha, SOURCE_MERGE);
  assert.equal(evidence.artifacts.correctionMergeC1.headSha, CORRECTION_MERGE);
  assert.equal(evidence.decision.finalClosureEligible, false);
});

test('Observer post-merge Evidence binds exact Observer Merge parents', async () => {
  const evidence = await acceptedPushEvidence();
  assert.equal(evidence.observer.mergeSha, OBSERVER_MERGE);
  assert.deepEqual(evidence.observer.parents, [CORRECTION_MERGE, OBSERVER_HEAD]);
  assert.equal(evidence.main.observedSha, OBSERVER_MERGE);
  assert.equal(evidence.decision.finalClosureEligible, true);
});

test('Observer rejects missing, unexpected or rerun natural Workflow evidence', async () => {
  await assert.rejects(acceptedEvidence({ omitCorrectionWorkflow: 'validation' }),
    /correction Merge missing mandatory Workflows/u);
  await assert.rejects(acceptedEvidence({ failedSourceWorkflow: 'm3-r3-g1-formal-acceptance' }),
    /source Merge Workflow outcome changed/u);
  await assert.rejects(acceptedEvidence({ sourceValidationConclusion: 'success' }),
    /source Merge Workflow outcome changed/u);
  await assert.rejects(acceptedEvidence({ rerunSourceWorkflow: 'validation' }),
    /source Merge contains a rerun attempt/u);
});

test('Observer rejects merge-parent and Artifact substitution', async () => {
  await assert.rejects(acceptedEvidence({ correctionParents: [SOURCE_MERGE, 'a'.repeat(40)] }),
    /Merge parent chain is invalid/u);
  await assert.rejects(acceptedEvidence({ correctionArtifactHead: SOURCE_MERGE }),
    /Artifact workflow binding is invalid/u);
});

test('Observer Evidence is closed, semantic and digest-bound', async () => {
  const files = await loadRepositoryFiles();
  const schema = JSON.parse(files[SCHEMA_PATH]);
  const evidence = await acceptedEvidence();
  assert.equal(validateEvidence(evidence, schema), true);

  const widened = structuredClone(evidence);
  widened.decision.unexpected = true;
  redigest(widened);
  assert.throws(() => validateEvidence(widened, schema), /Schema additional property/u);

  const forged = structuredClone(evidence);
  forged.decision.finalClosureEligible = true;
  redigest(forged);
  assert.throws(() => validateEvidence(forged, schema), /pre-merge decision is invalid/u);

  const reclassified = structuredClone(evidence);
  reclassified.historicalFailures[0].classification = 'productDefect';
  redigest(reclassified);
  assert.throws(() => validateEvidence(reclassified, schema),
    /Schema const mismatch|historical failure identity changed/u);
});

function fakeFetch(options = {}) {
  const sourceRuns = SOURCE_WORKFLOWS.map((name, index) => {
    let conclusion = name === 'validation' ? 'failure' : 'success';
    if (name === options.failedSourceWorkflow) conclusion = 'failure';
    if (name === 'validation' && options.sourceValidationConclusion) {
      conclusion = options.sourceValidationConclusion;
    }
    return run(41000000000 + index, name, SOURCE_MERGE, conclusion,
      name === options.rerunSourceWorkflow ? 2 : 1);
  });
  const correctionNames = [
    ...CORRECTION_WORKFLOWS,
    ...(options.extraCorrectionWorkflow ? [options.extraCorrectionWorkflow] : []),
  ];
  const correctionRuns = correctionNames
    .filter((name) => name !== options.omitCorrectionWorkflow)
    .map((name, index) => run(42000000000 + index, name, CORRECTION_MERGE));
  const byId = new Map([...sourceRuns, ...correctionRuns].map((item) => [item.id, item]));
  const sourceG1 = sourceRuns.find((item) => item.name === 'm3-r3-g1-formal-acceptance');
  const correctionC1 = correctionRuns.find((item) => item.name === 'm3-r3-g4-evidence-correction');

  return async (rawUrl) => {
    const url = new URL(rawUrl);
    if (url.pathname.endsWith('/actions/runs')) {
      return response({ workflow_runs: url.searchParams.get('head_sha') === SOURCE_MERGE
        ? sourceRuns : correctionRuns });
    }
    const jobs = url.pathname.match(/\/actions\/runs\/(\d+)\/jobs$/u);
    if (jobs) {
      const item = byId.get(Number(jobs[1]));
      return response({ jobs: [{ id: item.id + 100000, name: `${item.name}-job`,
        status: 'completed', conclusion: item.conclusion }] });
    }
    const artifacts = url.pathname.match(/\/actions\/runs\/(\d+)\/artifacts$/u);
    if (artifacts) {
      const id = Number(artifacts[1]);
      if (id === sourceG1?.id) return response({ artifacts: [artifact(
        9100000001, 'm3-r3-g1-formal-acceptance-evidence', sourceG1, SOURCE_MERGE,
        '123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef0')] });
      if (id === correctionC1?.id) return response({ artifacts: [artifact(
        9100000002, 'm3-r3-g4-evidence-correction', correctionC1,
        options.correctionArtifactHead ?? CORRECTION_MERGE,
        '23456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef01')] });
      return response({ artifacts: [] });
    }
    if (url.pathname.endsWith('/pulls/68')) return response(
      pull(68, SOURCE_BASE, SOURCE_HEAD, SOURCE_MERGE, 'source'));
    if (url.pathname.endsWith('/pulls/73')) return response(
      pull(73, SOURCE_MERGE, CORRECTION_HEAD, CORRECTION_MERGE, 'correction'));
    if (url.pathname.endsWith('/pulls/74')) return response(options.observerMerged
      ? { number: 74, state: 'closed', merged: true, draft: false,
        base: { sha: CORRECTION_MERGE, ref: 'main' },
        head: { sha: OBSERVER_HEAD, ref: OBSERVER_BRANCH },
        merge_commit_sha: OBSERVER_MERGE }
      : { number: 74, state: 'open', merged: false, draft: true,
        base: { sha: CORRECTION_MERGE, ref: 'main' },
        head: { sha: OBSERVER_HEAD, ref: OBSERVER_BRANCH }, merge_commit_sha: null });
    if (options.observerMergeSha
      && url.pathname.endsWith(`/commits/${options.observerMergeSha}/pulls`)) {
      return response([{ number: 74, merged_at: GENERATED_AT,
        base: { ref: 'main' }, head: { ref: OBSERVER_BRANCH },
        merge_commit_sha: options.observerMergeSha }]);
    }
    if (url.pathname.endsWith(`/commits/${SOURCE_MERGE}`)) return response(
      commit(SOURCE_MERGE, [SOURCE_BASE, SOURCE_HEAD]));
    if (url.pathname.endsWith(`/commits/${CORRECTION_MERGE}`)) return response(
      commit(CORRECTION_MERGE, options.correctionParents ?? [SOURCE_MERGE, CORRECTION_HEAD]));
    if (options.observerMergeSha
      && url.pathname.endsWith(`/commits/${options.observerMergeSha}`)) return response(
      commit(options.observerMergeSha, [CORRECTION_MERGE, OBSERVER_HEAD]));
    if (url.pathname.endsWith('/git/ref/heads/main')) return response(
      { object: { sha: options.mainSha ?? CORRECTION_MERGE } });
    return response({}, false, 404);
  };
}

function run(id, name, headSha, conclusion = 'success', attempt = 1) {
  return { id, workflow_id: id + 1000, name,
    path: `.github/workflows/${name}.yml`, run_attempt: attempt,
    event: 'push', head_branch: 'main', head_sha: headSha,
    status: 'completed', conclusion };
}
function artifact(id, name, sourceRun, headSha, digest) {
  return { id, name, size_in_bytes: 1024, digest: `sha256:${digest}`,
    expired: false, created_at: '2026-08-07T02:00:00Z',
    expires_at: '2026-11-05T02:00:00Z',
    workflow_run: { id: sourceRun.id, head_sha: headSha } };
}
function pull(number, baseSha, headSha, mergeSha, prefix) {
  return { number, state: 'closed', merged: true, draft: false,
    base: { sha: baseSha, ref: 'main' }, head: { sha: headSha, ref: `agent/${prefix}` },
    merge_commit_sha: mergeSha };
}
const commit = (sha, parents) => ({ sha, parents: parents.map((parent) => ({ sha: parent })) });
const response = (payload, ok = true, status = 200) =>
  ({ ok, status, async json() { return payload; } });
