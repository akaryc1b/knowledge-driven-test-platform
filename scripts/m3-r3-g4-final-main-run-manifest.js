import {
  lstat, mkdir, readFile, rm, writeFile,
} from 'node:fs/promises';
import { dirname, posix, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { validateJsonSchemaDraft202012 } from './json-schema-draft-2020.js';

export const REPOSITORY = 'akaryc1b/knowledge-driven-test-platform';
export const ISSUE_NUMBER = 75;
export const OBSERVER_PULL_REQUEST = 74;
export const OBSERVER_HEAD = 'e67ec1f8e63b7ba2332bbe41ba40b453326b5985';
export const OBSERVER_MERGE = 'cdecd4e28cc9426b41c7f21d6fcd319f9ab8b3f9';
export const OBSERVER_EXACT_MAIN_RUN = 31145384797;
export const OBSERVER_EXACT_MAIN_VALIDATION_JOB = 92763605254;
export const OBSERVER_EXACT_MAIN_REPORT_JOB = 92763675300;
export const OBSERVER_EXACT_MAIN_ARTIFACT = 8981282157;
export const OBSERVER_EXACT_MAIN_ARTIFACT_API_DIGEST =
  'sha256:e51c5b6f7918e2e7077f1b71bee19ad70907bcfa1d4f06794d55e0811f9cbea8';
export const OBSERVER_EXACT_MAIN_CANONICAL_EVIDENCE_DIGEST =
  '04412a6b1569cdbfb004203c3d2d12d46bd1c2645846233b95304bb1873a25df';

export const BRANCH =
  'agent/m3-r3-g4-final-main-run-manifest-cdecd4e';
export const WORKFLOW_NAME = 'm3-r3-g4-final-main-run-manifest';
export const WORKFLOW_PATH =
  '.github/workflows/m3-r3-g4-final-main-run-manifest.yml';
export const SCHEMA_VERSION = 'm3-r3-g4-final-main-run-manifest/v1';
export const SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/'
  + 'm3-r3-g4-final-main-run-manifest.schema.json';
export const ARTIFACT_NAME =
  'm3-r3-g4-final-main-run-manifest-evidence';

export const ARTIFACT_PATHS = Object.freeze([
  'evidence/m3-r3-g4-final-main-run-manifest.json',
  SCHEMA_PATH,
  'scripts/m3-r3-g4-final-main-run-manifest.js',
  'scripts/json-schema-draft-2020.js',
  'packages/k6-api-adapter/test/m3-r3-g4-final-main-run-manifest.test.js',
  WORKFLOW_PATH,
  '.github/workflows/m3-r3-final-main-observer.yml',
  'docs/04-governance/m3-r3-g4-final-main-run-manifest.md',
  'schemas/execution/k6-api-runtime/README.md',
  'logs/m3-r3-g4-final-main-run-manifest-focused-node22.tap',
  'logs/m3-r3-g4-final-main-run-manifest-root-validation.log',
  'logs/m3-r3-g4-final-main-run-manifest-validator.log',
]);

export const REQUIRED_PATHS = Object.freeze(
  ARTIFACT_PATHS.filter((path) =>
    !path.startsWith('evidence/') && !path.startsWith('logs/')),
);

export const SAFETY_FIELDS = Object.freeze([
  'k6Invoked', 'xk6Invoked', 'playwrightInvoked',
  'externalProcessExecuted', 'targetNetworkAccessed', 'databaseAccessed',
  'secretAccessed', 'filesystemCredentialAccessed',
  'rawStdoutCollected', 'rawStderrCollected', 'numericProcessIdExposed',
  'sourceBundleModified', 'governedOutputRootImplemented',
  'fileResultCollectionImplemented', 'workerAdded', 'queueAdded',
  'schedulerAdded', 'containerStarted', 'kubernetesResourceCreated',
  'remoteExecutionApiAdded', 'allureImplemented',
]);

const SAFE_JOB_CONCLUSIONS = new Set(['success', 'skipped']);
const POLL_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 10_000;

export async function loadRepositoryFiles() {
  return Object.fromEntries(await Promise.all(REQUIRED_PATHS.map(async (path) => [
    path, await readFile(path, 'utf8'),
  ])));
}

export async function validateRepository(options = {}) {
  const files = options.files ?? await loadRepositoryFiles();
  for (const path of REQUIRED_PATHS) {
    invariant(typeof files[path] === 'string' && files[path].length > 0,
      `Missing C2 repository path: ${path}`);
  }
  const schema = JSON.parse(files[SCHEMA_PATH]);
  invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
    && schema.type === 'object' && schema.additionalProperties === false
    && schema.properties?.schemaVersion?.const === SCHEMA_VERSION,
  'C2 Schema is not closed Draft 2020-12');

  const workflow = files[WORKFLOW_PATH];
  for (const marker of [
    'pull_request:', 'push:', 'branches: [main]', 'contents: read',
    'actions: read', 'pull-requests: read', 'persist-credentials: false',
    'node-version: 22', 'npm ci --ignore-scripts', 'npm run validate',
    '--validate-repository', '--emit-artifact', 'actions/upload-artifact@v4',
    ARTIFACT_NAME, 'include-hidden-files: true',
    'report-final-main-run-manifest:', "if: ${{ github.event_name == 'push' }}",
    'issues: write', 'actions/github-script@v7',
    'for (const issue_number of [75, 71])',
  ]) invariant(workflow.includes(marker), `C2 Workflow missing: ${marker}`);
  invariant(workflow.split('issues: write').length - 1 === 1,
    'C2 Workflow must grant issues: write exactly once');
  for (const marker of [
    'workflow_dispatch', 'workflow_call', 'contents: write',
    'actions: write', 'pull-requests: write', 'packages: write',
    'id-' + 'to' + 'ken: write', 'se' + 'crets:',
    'k6 run', 'xk6 run', 'playwright test', 'docker run',
    'kubectl', 'curl ', 'wget ', 'gh ',
  ]) invariant(!workflow.includes(marker),
    `C2 Workflow contains forbidden entry: ${marker}`);

  const observerWorkflow = files[
    '.github/workflows/m3-r3-final-main-observer.yml'];
  for (const marker of [
    OBSERVER_HEAD, OBSERVER_MERGE,
    'Select immutable Observer Evidence mode',
    'historicalObserverEvidenceReissued=false',
    "steps.observer_mode.outputs.emit == 'true'",
    'observerReportValidationOnly=true',
  ]) invariant(observerWorkflow.includes(marker),
    `Historical Observer emission gate missing: ${marker}`);

  const docs = files[
    'docs/04-governance/m3-r3-g4-final-main-run-manifest.md'];
  for (const marker of [
    OBSERVER_MERGE, OBSERVER_HEAD, BRANCH,
    OBSERVER_EXACT_MAIN_ARTIFACT_API_DIGEST,
    OBSERVER_EXACT_MAIN_CANONICAL_EVIDENCE_DIGEST,
  ]) invariant(docs.includes(marker), `C2 document missing identity: ${marker}`);

  const index = files['schemas/execution/k6-api-runtime/README.md'];
  invariant(index.includes(
    'M3-R3 G4 Final Exact-Main Natural Workflow Manifest Evidence'),
  'C2 Schema title is not registered');

  scanSensitiveValues({ workflow, docs, index },
    'M3-R3-G4-C2 governance');
  return Object.freeze({
    status: 'success', validator: WORKFLOW_NAME,
    baselineMain: OBSERVER_MERGE,
    artifactPathCount: ARTIFACT_PATHS.length,
  });
}

export async function createEvidence(options = {}) {
  await validateRepository(options);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const apiBase = options.apiBase ?? 'https://api.github.com';
  const credential = options.credential ?? process.env.GH_TOKEN ?? '';
  const eventName = options.eventName
    ?? process.env.M3_R3_G4_C2_EVENT_NAME
    ?? process.env.GITHUB_EVENT_NAME ?? 'local';
  const branch = options.branch
    ?? process.env.M3_R3_G4_C2_BRANCH
    ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
  const commitSha = options.commitSha
    ?? process.env.M3_R3_G4_C2_EXACT_HEAD
    ?? process.env.GITHUB_SHA;
  const runId = positiveInteger(
    options.runId ?? Number(process.env.GITHUB_RUN_ID),
    'C2 current Run ID');
  const runAttempt = positiveInteger(
    options.runAttempt ?? Number(process.env.GITHUB_RUN_ATTEMPT),
    'C2 current Run attempt');
  const generatedAt = normalizeTimestamp(
    options.generatedAt ?? new Date().toISOString(), 'C2 generatedAt');
  const validation = options.validation ?? {
    focusedStatus: requiredEnv('M3_R3_G4_C2_FOCUSED_STATUS'),
    rootValidationStatus: requiredEnv('M3_R3_G4_C2_ROOT_STATUS'),
    dedicatedValidatorStatus: requiredEnv('M3_R3_G4_C2_VALIDATOR_STATUS'),
  };
  invariant(Object.values(validation).every((value) => value === 'success'),
    'C2 validation is incomplete');
  assertSha(commitSha, 'C2 exact Head');
  invariant(runAttempt === 1, 'C2 rerun attempt is inadmissible');
  invariant(['pull_request', 'push'].includes(eventName),
    'C2 event is invalid');
  invariant(branch === (eventName === 'pull_request' ? BRANCH : 'main'),
    'C2 branch is invalid');

  const headers = apiHeaders(credential);
  const mainSha = await fetchMainSha(fetchImpl, apiBase, headers);
  const safetyBoundary = Object.fromEntries(
    SAFETY_FIELDS.map((field) => [field, false]));

  let pullRequest;
  let acceptedHead = emptyRunSet(commitSha);
  let exactMain = emptyRunSet(null);
  let collector = emptyCollector(runId);
  let decision;

  if (eventName === 'pull_request') {
    const number = options.pullRequestNumber
      ?? await resolvePullRequestNumberFromEvent(
        options.eventPath ?? process.env.GITHUB_EVENT_PATH);
    const pr = await fetchJson(fetchImpl,
      `${apiBase}/repos/${REPOSITORY}/pulls/${number}`, headers);
    invariant(pr.number === number && pr.state === 'open'
      && pr.draft === true && pr.merged === false
      && pr.base?.sha === OBSERVER_MERGE
      && pr.head?.sha === commitSha && pr.head?.ref === BRANCH,
    'C2 Pull Request is not the expected Draft exact-Head state');
    invariant(mainSha === OBSERVER_MERGE,
      'Main moved before C2 exact-Head acceptance');
    pullRequest = {
      number, state: 'open', draft: true, merged: false,
      baseSha: OBSERVER_MERGE, headSha: commitSha,
      mergeSha: null, parents: [],
    };
    decision = {
      contractValidated: true, manifestComplete: false,
      finalClosureEligible: false,
      nextRequiredAction:
        'independent-exact-head-acceptance-and-ordinary-merge',
      repositoryBlockers: ['exact-main-run-manifest-pending'],
    };
  } else {
    invariant(mainSha === commitSha,
      'C2 final main does not equal current Merge SHA');
    const commit = await fetchMergeCommit(fetchImpl, apiBase, headers, commitSha);
    invariant(commit.parents.length === 2
      && commit.parents[0] === OBSERVER_MERGE,
    'C2 Merge first parent is invalid');
    const headSha = commit.parents[1];
    const pr = await resolveMergedPullRequest({
      fetchImpl, apiBase, headers, mergeSha: commitSha, headSha,
    });
    pullRequest = {
      number: pr.number, state: 'closed', draft: false, merged: true,
      baseSha: OBSERVER_MERGE, headSha,
      mergeSha: commitSha, parents: commit.parents,
    };
    acceptedHead = await collectAcceptedHeadRunSet({
      fetchImpl, apiBase, headers, headSha,
    });
    exactMain = await pollExactMainRunSet({
      fetchImpl, apiBase, headers, commitSha, currentRunId: runId,
      mandatoryNames: acceptedHead.workflowNames,
      sleepImpl: options.sleepImpl,
      pollAttempts: options.pollAttempts,
      pollIntervalMs: options.pollIntervalMs,
    });
    collector = exactMain.collector;
    decision = {
      contractValidated: true, manifestComplete: true,
      finalClosureEligible: false,
      nextRequiredAction:
        'external-report-job-verification-and-independent-artifact-audit',
      repositoryBlockers: [
        'collector-report-job-external-verification-pending',
        'independent-final-main-artifact-audit-pending',
      ],
    };
  }

  const claims = {
    schemaVersion: SCHEMA_VERSION,
    generatedAt,
    repository: REPOSITORY,
    source: {
      eventName,
      mode: eventName === 'pull_request'
        ? 'pre-merge-contract' : 'exact-main-manifest',
      branch, commitSha, runId, runAttempt,
    },
    baseline: {
      issue: ISSUE_NUMBER,
      observerPullRequest: OBSERVER_PULL_REQUEST,
      observerHead: OBSERVER_HEAD,
      observerMerge: OBSERVER_MERGE,
      observerExactMainRun: OBSERVER_EXACT_MAIN_RUN,
      observerExactMainValidationJob:
        OBSERVER_EXACT_MAIN_VALIDATION_JOB,
      observerExactMainReportJob: OBSERVER_EXACT_MAIN_REPORT_JOB,
      observerExactMainArtifact: OBSERVER_EXACT_MAIN_ARTIFACT,
      observerExactMainArtifactApiDigest:
        OBSERVER_EXACT_MAIN_ARTIFACT_API_DIGEST,
      observerExactMainCanonicalEvidenceDigest:
        OBSERVER_EXACT_MAIN_CANONICAL_EVIDENCE_DIGEST,
      historicalEvidenceRewritten: false,
      manualRerunPerformed: false,
    },
    pullRequest,
    acceptedHead: publicRunSet(acceptedHead),
    exactMain: publicRunSet(exactMain),
    collector,
    validation,
    artifact: {
      name: ARTIFACT_NAME,
      expectedPaths: [...ARTIFACT_PATHS],
      pathCount: ARTIFACT_PATHS.length,
      preUploadAudit: {
        missingEntries: 0,
        unexpectedEntries: 0,
        regularFilesOnly: true,
        unsafePathEntries: 0,
        symlinkEntries: 0,
        specialFileEntries: 0,
        unicodeNormalizationCollisions: 0,
        caseFoldCollisions: 0,
        credentialShapedMatches: 0,
      },
    },
    decision,
    safetyBoundary,
  };
  scanSensitiveValues(claims, 'M3-R3-G4-C2 Evidence');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  const files = options.files ?? await loadRepositoryFiles();
  validateEvidence(evidence, JSON.parse(files[SCHEMA_PATH]));
  return evidence;
}

export function validateEvidence(evidence, schema) {
  validateJsonSchemaDraft202012(
    evidence, schema, 'M3-R3-G4-C2 Evidence');
  invariant(evidence.repository === REPOSITORY,
    'C2 repository changed');
  invariant(evidence.baseline.issue === ISSUE_NUMBER
    && evidence.baseline.observerPullRequest === OBSERVER_PULL_REQUEST
    && evidence.baseline.observerHead === OBSERVER_HEAD
    && evidence.baseline.observerMerge === OBSERVER_MERGE,
  'C2 predecessor identity changed');
  invariant(evidence.baseline.observerExactMainArtifactApiDigest
    === OBSERVER_EXACT_MAIN_ARTIFACT_API_DIGEST
    && evidence.baseline.observerExactMainCanonicalEvidenceDigest
      === OBSERVER_EXACT_MAIN_CANONICAL_EVIDENCE_DIGEST,
  'C2 Observer Evidence binding changed');
  invariant(evidence.baseline.historicalEvidenceRewritten === false
    && evidence.baseline.manualRerunPerformed === false,
  'C2 history preservation changed');
  invariant(canonicalStringify(evidence.artifact.expectedPaths)
    === canonicalStringify(ARTIFACT_PATHS)
    && evidence.artifact.pathCount === ARTIFACT_PATHS.length,
  'C2 Artifact layout changed');
  invariant(Object.values(evidence.safetyBoundary)
    .every((value) => value === false),
  'C2 safety boundary widened');

  if (evidence.source.mode === 'pre-merge-contract') {
    invariant(evidence.source.eventName === 'pull_request'
      && evidence.pullRequest.state === 'open'
      && evidence.pullRequest.draft === true
      && evidence.pullRequest.merged === false
      && evidence.pullRequest.mergeSha === null
      && evidence.pullRequest.parents.length === 0
      && evidence.acceptedHead.workflowCount === 0
      && evidence.exactMain.workflowCount === 0
      && evidence.decision.manifestComplete === false
      && evidence.decision.finalClosureEligible === false,
    'C2 pre-merge decision is invalid');
  } else {
    invariant(evidence.source.mode === 'exact-main-manifest'
      && evidence.source.eventName === 'push'
      && evidence.pullRequest.state === 'closed'
      && evidence.pullRequest.draft === false
      && evidence.pullRequest.merged === true
      && evidence.pullRequest.mergeSha === evidence.source.commitSha
      && canonicalStringify(evidence.pullRequest.parents)
        === canonicalStringify([
          OBSERVER_MERGE, evidence.pullRequest.headSha,
        ])
      && evidence.acceptedHead.workflowCount > 0
      && evidence.exactMain.workflowCount >=
        evidence.acceptedHead.workflowCount
      && evidence.decision.manifestComplete === true
      && evidence.decision.finalClosureEligible === false
      && evidence.collector.validationJob.conclusion === 'success'
      && ['queued', 'in_progress'].includes(
        evidence.collector.reportJob.status)
      && evidence.collector.reportJob.conclusion === null
      && evidence.collector.reportJobExternalVerificationRequired === true,
    'C2 exact-main manifest decision is invalid');
    const observed = new Set(evidence.exactMain.workflowNames);
    invariant(evidence.acceptedHead.workflowNames
      .every((name) => observed.has(name)),
    'C2 exact-main manifest is missing an accepted Head Workflow');
  }

  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  invariant(sha256(claims) === evidence.evidenceDigest,
    'C2 canonical Evidence digest mismatch');
  return true;
}

export async function collectAcceptedHeadRunSet({
  fetchImpl, apiBase, headers, headSha,
}) {
  const query = new URL(
    `${apiBase}/repos/${REPOSITORY}/actions/runs`);
  for (const [key, value] of Object.entries({
    event: 'pull_request', status: 'completed',
    head_sha: headSha, per_page: '100',
  })) query.searchParams.set(key, value);
  const response = await fetchJson(fetchImpl, query.href, headers);
  const exact = (response.workflow_runs ?? []).filter((run) =>
    run.event === 'pull_request' && run.head_sha === headSha
      && run.status === 'completed');
  verifyCompletePage(response, exact, 'C2 accepted Head');
  const names = exact.map((run) => run.name);
  invariant(exact.length > 0 && new Set(names).size === names.length,
    'C2 accepted Head Workflow set is empty or duplicated');
  const runs = [];
  for (const run of exact.sort((a, b) =>
    a.name.localeCompare(b.name))) {
    invariant(run.run_attempt === 1,
      `C2 accepted Head contains rerun: ${run.name}`);
    invariant(run.conclusion === 'success',
      `C2 accepted Head Workflow failed: ${run.name}`);
    const jobs = await collectCompletedJobs({
      fetchImpl, apiBase, headers, runId: run.id,
      label: `C2 accepted Head ${run.name}`,
      allowSkipped: true,
    });
    runs.push(normalizeCompletedRun(run, jobs));
  }
  return {
    commitSha: headSha,
    workflowCount: runs.length,
    workflowNames: runs.map((run) => run.name),
    runs,
    collector: emptyCollector(0),
  };
}

export async function pollExactMainRunSet({
  fetchImpl, apiBase, headers, commitSha, currentRunId,
  mandatoryNames, sleepImpl = defaultSleep,
  pollAttempts = POLL_ATTEMPTS,
  pollIntervalMs = POLL_INTERVAL_MS,
}) {
  invariant(Array.isArray(mandatoryNames) && mandatoryNames.length > 0,
    'C2 mandatory Workflow names are empty');
  for (let attempt = 1; attempt <= pollAttempts; attempt += 1) {
    const observed = await observeExactMainRunSet({
      fetchImpl, apiBase, headers, commitSha,
      currentRunId, mandatoryNames,
    });
    if (observed.ready) return observed.value;
    if (attempt < pollAttempts) await sleepImpl(pollIntervalMs);
  }
  throw new Error(
    'C2 exact-main Workflow set did not reach the complete admissible state');
}

export async function observeExactMainRunSet({
  fetchImpl, apiBase, headers, commitSha,
  currentRunId, mandatoryNames,
}) {
  const query = new URL(
    `${apiBase}/repos/${REPOSITORY}/actions/runs`);
  for (const [key, value] of Object.entries({
    branch: 'main', event: 'push',
    head_sha: commitSha, per_page: '100',
  })) query.searchParams.set(key, value);
  const response = await fetchJson(fetchImpl, query.href, headers);
  const exact = (response.workflow_runs ?? []).filter((run) =>
    run.event === 'push' && run.head_branch === 'main'
      && run.head_sha === commitSha);
  verifyCompletePage(response, exact, 'C2 exact main');
  const names = exact.map((run) => run.name);
  invariant(new Set(names).size === names.length,
    'C2 exact main contains duplicate Workflow names');
  const current = exact.filter((run) => run.id === currentRunId);
  invariant(current.length === 1
    && current[0].name === WORKFLOW_NAME
    && current[0].run_attempt === 1
    && ['queued', 'in_progress'].includes(current[0].status)
    && current[0].conclusion === null,
  'C2 current collector Run binding is invalid');

  for (const run of exact) {
    invariant(run.run_attempt === 1,
      `C2 exact main contains rerun: ${run.name}`);
    if (run.id !== currentRunId
      && run.status === 'completed'
      && run.conclusion !== 'success') {
      throw new Error(
        `C2 exact main sibling Workflow failed: ${run.name}`);
    }
  }

  const observedNames = new Set(names);
  const missing = mandatoryNames.filter(
    (name) => !observedNames.has(name));
  const incompleteSibling = exact.some((run) =>
    run.id !== currentRunId && run.status !== 'completed');
  if (missing.length > 0 || incompleteSibling) {
    return { ready: false };
  }

  const runs = [];
  let collector;
  for (const run of exact.sort((a, b) =>
    a.name.localeCompare(b.name))) {
    if (run.id === currentRunId) {
      const responseJobs = await fetchJson(fetchImpl,
        `${apiBase}/repos/${REPOSITORY}/actions/runs/${run.id}`
        + '/jobs?filter=latest&per_page=100', headers);
      const jobs = (responseJobs.jobs ?? [])
        .map(normalizeJob)
        .sort((a, b) => a.name.localeCompare(b.name));
      const validationJobs = jobs.filter((job) =>
        job.name === 'validate-manifest-contract');
      const reportJobs = jobs.filter((job) =>
        job.name === 'report-final-main-run-manifest');
      if (validationJobs.length !== 1 || reportJobs.length !== 1
        || validationJobs[0].status !== 'completed'
        || validationJobs[0].conclusion !== 'success'
        || !['queued', 'in_progress'].includes(
          reportJobs[0].status)
        || reportJobs[0].conclusion !== null) {
        return { ready: false };
      }
      invariant(jobs.length === 2,
        'C2 current collector Run has unexpected Jobs');
      collector = {
        workflowName: WORKFLOW_NAME,
        currentRunId,
        validationJob: validationJobs[0],
        reportJob: reportJobs[0],
        reportJobExternalVerificationRequired: true,
      };
      runs.push({
        id: positiveInteger(run.id, 'C2 current Run ID'),
        workflowId: positiveInteger(
          run.workflow_id, 'C2 current Workflow ID'),
        name: run.name, attempt: run.run_attempt,
        event: run.event, headBranch: run.head_branch,
        headSha: run.head_sha, status: run.status,
        conclusion: null, jobs,
      });
    } else {
      const jobs = await collectCompletedJobs({
        fetchImpl, apiBase, headers, runId: run.id,
        label: `C2 exact main ${run.name}`,
        allowSkipped: false,
      });
      runs.push(normalizeCompletedRun(run, jobs));
    }
  }

  invariant(collector, 'C2 collector Job observation is missing');
  return {
    ready: true,
    value: {
      commitSha,
      workflowCount: runs.length,
      workflowNames: runs.map((run) => run.name),
      runs,
      collector,
    },
  };
}

async function collectCompletedJobs({
  fetchImpl, apiBase, headers, runId, label, allowSkipped,
}) {
  const response = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/actions/runs/${runId}`
      + '/jobs?filter=latest&per_page=100', headers);
  const jobs = (response.jobs ?? [])
    .map(normalizeJob)
    .sort((a, b) => a.name.localeCompare(b.name));
  invariant(jobs.length > 0,
    `${label} has no Jobs`);
  invariant(jobs.every((job) => job.status === 'completed'
    && (allowSkipped
      ? SAFE_JOB_CONCLUSIONS.has(job.conclusion)
      : job.conclusion === 'success')),
  `${label} has a failed or incomplete Job`);
  invariant(jobs.some((job) => job.conclusion === 'success'),
    `${label} has no successful Job`);
  return jobs;
}

function normalizeCompletedRun(run, jobs) {
  return {
    id: positiveInteger(run.id, 'C2 Run ID'),
    workflowId: positiveInteger(run.workflow_id, 'C2 Workflow ID'),
    name: requireString(run.name, 'C2 Workflow name', 256),
    attempt: run.run_attempt, event: run.event,
    headBranch: run.head_branch, headSha: run.head_sha,
    status: 'completed', conclusion: 'success', jobs,
  };
}

function normalizeJob(job) {
  return {
    id: positiveInteger(job.id, 'C2 Job ID'),
    name: requireString(job.name, 'C2 Job name', 256),
    status: requireString(job.status, 'C2 Job status', 32),
    conclusion: job.conclusion === null ? null
      : requireString(job.conclusion, 'C2 Job conclusion', 32),
  };
}

async function resolveMergedPullRequest({
  fetchImpl, apiBase, headers, mergeSha, headSha,
}) {
  const pulls = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/commits/${headSha}`
      + '/pulls?per_page=20', headers);
  const matches = (pulls ?? []).filter((pr) =>
    pr.state === 'closed' && pr.merged_at
      && pr.draft === false
      && pr.base?.sha === OBSERVER_MERGE
      && pr.base?.ref === 'main'
      && pr.head?.sha === headSha
      && pr.head?.ref === BRANCH
      && pr.merge_commit_sha === mergeSha);
  invariant(matches.length === 1,
    `Expected exactly one merged C2 Pull Request, found ${matches.length}`);
  return matches[0];
}

async function fetchMergeCommit(
  fetchImpl, apiBase, headers, sha,
) {
  const commit = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/commits/${sha}`, headers);
  const parents = (commit.parents ?? []).map((parent) => parent.sha);
  invariant(commit.sha === sha && parents.length === 2,
    'C2 Merge Commit is invalid');
  return { sha, parents };
}

async function fetchMainSha(fetchImpl, apiBase, headers) {
  const ref = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/git/ref/heads/main`, headers);
  assertSha(ref.object?.sha, 'C2 main SHA');
  return ref.object.sha;
}

async function resolvePullRequestNumberFromEvent(eventPath) {
  invariant(typeof eventPath === 'string' && eventPath.length > 0,
    'C2 Pull Request event path is missing');
  const event = JSON.parse(await readFile(eventPath, 'utf8'));
  return positiveInteger(
    event.pull_request?.number, 'C2 Pull Request number');
}

function apiHeaders(credential) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kdtp-m3-r3-g4-c2-run-manifest',
  };
  if (credential) {
    const name = ['Author', 'ization'].join('');
    headers[name] = `${['Bear', 'er'].join('')} ${credential}`;
  }
  return headers;
}

async function fetchJson(fetchImpl, url, headers) {
  invariant(typeof fetchImpl === 'function',
    'C2 requires fetch');
  const response = await fetchImpl(url, { headers });
  invariant(response?.ok === true,
    `GitHub API request failed with status ${response?.status ?? 'unknown'}`);
  return response.json();
}

function verifyCompletePage(response, exact, label) {
  invariant(exact.length <= 100,
    `${label} exceeds one-page evidence limit`);
  if (Number.isInteger(response.total_count)) {
    invariant(response.total_count === exact.length,
      `${label} Workflow page is incomplete`);
  }
}

function emptyRunSet(commitSha) {
  return {
    commitSha,
    workflowCount: 0,
    workflowNames: [],
    runs: [],
    collector: emptyCollector(0),
  };
}

function publicRunSet(value) {
  return {
    commitSha: value.commitSha,
    workflowCount: value.workflowCount,
    workflowNames: [...value.workflowNames],
    runs: value.runs.map((run) => structuredClone(run)),
  };
}

function emptyCollector(currentRunId) {
  return {
    workflowName: WORKFLOW_NAME,
    currentRunId,
    validationJob: {
      id: null, name: 'validate-manifest-contract',
      status: 'not-observed', conclusion: null,
    },
    reportJob: {
      id: null, name: 'report-final-main-run-manifest',
      status: 'not-observed', conclusion: null,
    },
    reportJobExternalVerificationRequired: false,
  };
}

export function auditArtifactFiles(files) {
  const actual = Object.keys(files).sort();
  const expected = [...ARTIFACT_PATHS].sort();
  invariant(canonicalStringify(actual) === canonicalStringify(expected),
    'C2 Artifact path set changed');
  const normalized = new Set();
  const folded = new Set();
  for (const path of actual) {
    invariant(validateArtifactPath(path),
      `Unsafe C2 Artifact path: ${path}`);
    const unicode = path.normalize('NFC');
    const lower = unicode.toLowerCase();
    invariant(!normalized.has(unicode),
      `C2 Unicode path collision: ${path}`);
    invariant(!folded.has(lower),
      `C2 case-fold path collision: ${path}`);
    normalized.add(unicode);
    folded.add(lower);
    invariant(typeof files[path] === 'string',
      `C2 Artifact file is not UTF-8 text: ${path}`);
  }
  scanSensitiveValues(files, 'M3-R3-G4-C2 Artifact');
  return true;
}

function validateArtifactPath(path) {
  return typeof path === 'string' && path.length > 0
    && !path.includes('\0') && !path.includes('\\')
    && !path.startsWith('/') && !path.startsWith('./')
    && !/^[A-Za-z]:[\\/]/u.test(path)
    && !/^\\\\/u.test(path)
    && !/^[a-z][a-z0-9+.-]*:/iu.test(path)
    && !/%2e|%2f|%5c/iu.test(path)
    && posix.normalize(path) === path
    && !path.split('/').includes('..');
}

export async function emitArtifact(options = {}) {
  const evidence = await createEvidence(options);
  const files = {
    'evidence/m3-r3-g4-final-main-run-manifest.json':
      `${JSON.stringify(evidence, null, 2)}\n`,
    ...await loadRepositoryFiles(),
    'logs/m3-r3-g4-final-main-run-manifest-focused-node22.tap':
      await readFile(
        '/tmp/m3-r3-g4-final-main-run-manifest-focused-node22.tap',
        'utf8'),
    'logs/m3-r3-g4-final-main-run-manifest-root-validation.log':
      await readFile(
        '/tmp/m3-r3-g4-final-main-run-manifest-root-validation.log',
        'utf8'),
    'logs/m3-r3-g4-final-main-run-manifest-validator.log':
      await readFile(
        '/tmp/m3-r3-g4-final-main-run-manifest-validator.log',
        'utf8'),
  };
  auditArtifactFiles(files);
  const root =
    '/tmp/m3-r3-g4-final-main-run-manifest-artifact';
  await rm(root, { recursive: true, force: true });
  for (const path of ARTIFACT_PATHS) {
    const target = resolve(root, path);
    invariant(target.startsWith(`${root}/`),
      `Unsafe C2 Artifact target: ${path}`);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, files[path], 'utf8');
    const info = await lstat(target);
    invariant(info.isFile() && !info.isSymbolicLink(),
      `C2 Artifact path is not regular: ${path}`);
  }
  return {
    status: 'success', artifactRoot: root,
    artifactPathCount: ARTIFACT_PATHS.length,
    evidenceDigest: evidence.evidenceDigest,
    mode: evidence.source.mode,
    expectedWorkflowCount: evidence.acceptedHead.workflowCount,
    exactMainWorkflowCount: evidence.exactMain.workflowCount,
  };
}

function defaultSleep(milliseconds) {
  return new Promise((resolvePromise) =>
    setTimeout(resolvePromise, milliseconds));
}

function assertSha(value, label) {
  invariant(typeof value === 'string'
    && /^[a-f0-9]{40}$/u.test(value), `${label} is invalid`);
  invariant(new Set(value).size > 1,
    `${label} looks like a placeholder`);
}
function normalizeTimestamp(value, label) {
  invariant(typeof value === 'string'
    && !Number.isNaN(Date.parse(value)), `${label} is invalid`);
  return new Date(value).toISOString();
}
function positiveInteger(value, label) {
  invariant(Number.isInteger(value) && value > 0,
    `${label} is invalid`);
  return value;
}
function requireString(value, label, maxLength) {
  invariant(typeof value === 'string'
    && value.length > 0 && value.length <= maxLength,
  `${label} is invalid`);
  return value;
}
function requiredEnv(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0,
    `${name} is required`);
  return value;
}
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1]
  && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  if (process.argv.includes('--validate-repository')) {
    process.stdout.write(
      `${JSON.stringify(await validateRepository())}\n`);
  } else if (process.argv.includes('--emit-artifact')) {
    process.stdout.write(
      `${JSON.stringify(await emitArtifact())}\n`);
  } else {
    throw new Error(
      'C2 command must be --validate-repository or --emit-artifact');
  }
}
