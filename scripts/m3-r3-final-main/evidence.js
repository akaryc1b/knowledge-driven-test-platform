import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import { validateJsonSchemaDraft202012 } from '../json-schema-draft-2020.js';
import {
  ARTIFACT_NAME, ARTIFACT_PATHS, CORRECTION_EXPECTED_CONCLUSIONS,
  CORRECTION_HEAD, CORRECTION_MERGE, CORRECTION_WORKFLOWS, FIXED_DIGESTS,
  OBSERVER_BRANCH, REPOSITORY, SAFETY_FIELDS, SCHEMA_PATH, SCHEMA_VERSION,
  SOURCE_BASE, SOURCE_EXPECTED_CONCLUSIONS, SOURCE_HEAD,
  SOURCE_HISTORICAL_FAILURE, SOURCE_MERGE, SOURCE_WORKFLOWS,
} from './constants.js';
import { loadRepositoryFiles, validateRepository } from './repository.js';
import {
  apiHeaders, assertSha, assertTimestamp, collectExactPushRunSet,
  collectRunArtifact, fetchMainSha, fetchMergeCommit, fetchPullRequest,
  positiveInteger, requireRun, resolveObserverPullRequestNumber,
  validateMergedPullRequest,
} from './github.js';

export async function createEvidence(options = {}) {
  const repository = await validateRepository(options);
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const apiBase = options.apiBase ?? 'https://api.github.com';
  const credential = options.credential ?? process.env.GH_TOKEN ?? '';
  const eventName = options.eventName ?? process.env.M3_R3_FINAL_OBSERVER_EVENT_NAME
    ?? process.env.GITHUB_EVENT_NAME ?? 'local';
  const branch = options.branch ?? process.env.M3_R3_FINAL_OBSERVER_BRANCH
    ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
  const commitSha = options.commitSha ?? process.env.M3_R3_FINAL_OBSERVER_EXACT_HEAD
    ?? process.env.GITHUB_SHA;
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const runId = positiveInteger(options.runId ?? Number(process.env.GITHUB_RUN_ID),
    'Observer current Run ID');
  const runAttempt = positiveInteger(options.runAttempt ?? Number(process.env.GITHUB_RUN_ATTEMPT),
    'Observer current Run attempt');
  const observerPrNumber = options.observerPullRequestNumber
    ?? await resolveObserverPullRequestNumber({
      fetchImpl, apiBase, credential, eventName, commitSha,
      eventPath: options.eventPath ?? process.env.GITHUB_EVENT_PATH,
    });
  assertSha(commitSha, 'Observer exact Head');
  assertTimestamp(generatedAt, 'Observer generatedAt');
  invariant(['pull_request', 'push'].includes(eventName), 'Observer event is invalid');
  invariant(branch === (eventName === 'pull_request' ? OBSERVER_BRANCH : 'main'),
    'Observer branch is invalid');
  invariant(runAttempt === 1, 'Observer workflow rerun is not admissible');

  const headers = apiHeaders(credential);
  const sourcePr = await fetchPullRequest(fetchImpl, apiBase, headers, 68);
  const correctionPr = await fetchPullRequest(fetchImpl, apiBase, headers, 73);
  const observerPr = await fetchPullRequest(fetchImpl, apiBase, headers, observerPrNumber);
  validateMergedPullRequest(sourcePr, {
    number: 68, baseSha: SOURCE_BASE, headSha: SOURCE_HEAD, mergeSha: SOURCE_MERGE,
  });
  validateMergedPullRequest(correctionPr, {
    number: 73, baseSha: SOURCE_MERGE, headSha: CORRECTION_HEAD, mergeSha: CORRECTION_MERGE,
  });
  const sourceCommit = await fetchMergeCommit(fetchImpl, apiBase, headers, SOURCE_MERGE,
    [SOURCE_BASE, SOURCE_HEAD]);
  const correctionCommit = await fetchMergeCommit(fetchImpl, apiBase, headers,
    CORRECTION_MERGE, [SOURCE_MERGE, CORRECTION_HEAD]);
  const mainSha = await fetchMainSha(fetchImpl, apiBase, headers);

  let observer;
  if (eventName === 'pull_request') {
    invariant(observerPr.state === 'open' && observerPr.draft === true
      && observerPr.merged === false && observerPr.base?.sha === CORRECTION_MERGE
      && observerPr.head?.sha === commitSha && observerPr.head?.ref === OBSERVER_BRANCH,
    'Observer Pull Request is not the expected Draft exact-Head state');
    invariant(mainSha === CORRECTION_MERGE, 'Main moved before Observer acceptance');
    observer = { pullRequest: observerPrNumber, headSha: commitSha,
      mergeSha: null, parents: [], merged: false };
  } else {
    validateMergedPullRequest(observerPr, {
      number: observerPrNumber, baseSha: CORRECTION_MERGE,
      headSha: observerPr.head?.sha, mergeSha: commitSha,
    });
    const commit = await fetchMergeCommit(fetchImpl, apiBase, headers, commitSha,
      [CORRECTION_MERGE, observerPr.head.sha]);
    invariant(mainSha === commitSha, 'Final main does not equal Observer Merge SHA');
    observer = { pullRequest: observerPrNumber, headSha: observerPr.head.sha,
      mergeSha: commitSha, parents: commit.parents, merged: true };
  }

  const sourceRuns = await collectExactPushRunSet({
    fetchImpl, apiBase, headers, commitSha: SOURCE_MERGE,
    expectedNames: SOURCE_WORKFLOWS,
    expectedConclusions: SOURCE_EXPECTED_CONCLUSIONS,
    label: 'source Merge',
  });
  const correctionRuns = await collectExactPushRunSet({
    fetchImpl, apiBase, headers, commitSha: CORRECTION_MERGE,
    expectedNames: CORRECTION_WORKFLOWS,
    expectedConclusions: CORRECTION_EXPECTED_CONCLUSIONS,
    label: 'correction Merge', allowAdditionalNames: true,
  });
  const sourceG1 = requireRun(sourceRuns, 'm3-r3-g1-formal-acceptance');
  const sourceFailure = requireRun(sourceRuns, SOURCE_HISTORICAL_FAILURE.workflow);
  const failedJobs = sourceFailure.jobs.filter((job) => job.conclusion === 'failure');
  invariant(sourceFailure.conclusion === 'failure' && failedJobs.length > 0,
    'Source historical validation failure is not preserved');
  const correctionC1 = requireRun(correctionRuns, 'm3-r3-g4-evidence-correction');
  const correctionWorkflowNames = correctionRuns.map((run) => run.name);
  const correctionObservedConclusions = Object.fromEntries(
    correctionRuns.map((run) => [run.name, run.expectedConclusion]),
  );
  const artifacts = {
    sourceMergeG1: await collectRunArtifact({ fetchImpl, apiBase, headers, run: sourceG1,
      name: 'm3-r3-g1-formal-acceptance-evidence', expectedHead: SOURCE_MERGE }),
    correctionMergeC1: await collectRunArtifact({ fetchImpl, apiBase, headers, run: correctionC1,
      name: 'm3-r3-g4-evidence-correction', expectedHead: CORRECTION_MERGE }),
  };
  const validation = options.validation ?? {
    focusedStatus: requiredEnv('M3_R3_FINAL_OBSERVER_FOCUSED_STATUS'),
    rootValidationStatus: requiredEnv('M3_R3_FINAL_OBSERVER_ROOT_STATUS'),
    observerValidatorStatus: requiredEnv('M3_R3_FINAL_OBSERVER_VALIDATOR_STATUS'),
  };
  invariant(Object.values(validation).every((value) => value === 'success'),
    'Observer validation is incomplete');

  const claims = {
    schemaVersion: SCHEMA_VERSION, generatedAt, repository: REPOSITORY,
    source: { eventName, branch, commitSha, runId, runAttempt },
    main: { observedSha: mainSha, requiredPreObserverSha: CORRECTION_MERGE },
    sourceMerge: { pullRequest: 68, baseSha: SOURCE_BASE, headSha: SOURCE_HEAD,
      mergeSha: SOURCE_MERGE, parents: sourceCommit.parents },
    correctionMerge: { pullRequest: 73, baseSha: SOURCE_MERGE,
      headSha: CORRECTION_HEAD, mergeSha: CORRECTION_MERGE,
      parents: correctionCommit.parents },
    observer,
    naturalRuns: {
      sourceMerge: runSet(SOURCE_MERGE, SOURCE_WORKFLOWS,
        SOURCE_EXPECTED_CONCLUSIONS, sourceRuns),
      correctionMerge: runSet(CORRECTION_MERGE, correctionWorkflowNames,
        correctionObservedConclusions, correctionRuns),
    },
    historicalFailures: [{
      stage: 'sourceMerge', workflow: SOURCE_HISTORICAL_FAILURE.workflow,
      runId: sourceFailure.id, runConclusion: sourceFailure.conclusion,
      failedJobIds: failedJobs.map((job) => job.id),
      classification: SOURCE_HISTORICAL_FAILURE.classification,
      correctedByPullRequest: SOURCE_HISTORICAL_FAILURE.correctedByPullRequest,
      correctedByHead: SOURCE_HISTORICAL_FAILURE.correctedByHead,
      correctedByMerge: SOURCE_HISTORICAL_FAILURE.correctedByMerge,
      preserved: SOURCE_HISTORICAL_FAILURE.preserved,
      manualRerunPerformed: SOURCE_HISTORICAL_FAILURE.manualRerunPerformed,
    }],
    artifacts, fixedDigests: { ...FIXED_DIGESTS }, validation,
    artifact: { name: ARTIFACT_NAME, expectedPaths: [...ARTIFACT_PATHS],
      pathCount: ARTIFACT_PATHS.length, preUploadAudit: {
        missingEntries: 0, unexpectedEntries: 0, regularFilesOnly: true,
        unsafePathEntries: 0, symlinkEntries: 0, specialFileEntries: 0,
        unicodeNormalizationCollisions: 0, caseFoldCollisions: 0,
        credentialShapedMatches: 0,
      } },
    decision: {
      sourceMergeExactMainVerified: true,
      sourceHistoricalFailurePreserved: true,
      correctionMergeExactMainVerified: true,
      correctionClosesHistoricalFailure: true,
      observerPullRequestVerified: true, observerMerged: eventName === 'push',
      finalClosureEligible: eventName === 'push',
      nextRequiredAction: eventName === 'push'
        ? 'independent-artifact-audit-and-issue-closure'
        : 'ready-and-ordinary-merge-commit',
      repositoryBlockers: [],
    },
    safetyBoundary: Object.fromEntries(SAFETY_FIELDS.map((field) => [field, false])),
  };
  scanSensitiveValues(claims, 'M3-R3 final observer Evidence');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  const files = options.files ?? await loadRepositoryFiles();
  validateEvidence(evidence, JSON.parse(files[SCHEMA_PATH]));
  invariant(repository.artifactPathCount === evidence.artifact.pathCount,
    'Observer repository and Artifact path counts differ');
  return evidence;
}

export function validateEvidence(evidence, schema) {
  validateJsonSchemaDraft202012(evidence, schema, 'M3-R3 final observer Evidence');
  invariant(canonicalStringify(evidence.sourceMerge.parents)
    === canonicalStringify([SOURCE_BASE, SOURCE_HEAD]), 'Source Merge parents changed');
  invariant(canonicalStringify(evidence.correctionMerge.parents)
    === canonicalStringify([SOURCE_MERGE, CORRECTION_HEAD]), 'Correction Merge parents changed');
  validateRunSet(evidence.naturalRuns.sourceMerge, SOURCE_MERGE,
    SOURCE_WORKFLOWS, SOURCE_EXPECTED_CONCLUSIONS, 'source Merge');
  const correctionRunSet = evidence.naturalRuns.correctionMerge;
  const correctionNames = new Set(correctionRunSet.expectedWorkflowNames);
  invariant(CORRECTION_WORKFLOWS.every((name) => correctionNames.has(name)),
    'Correction Merge mandatory Workflow set changed');
  invariant(Object.keys(correctionRunSet.expectedConclusions).length
      === correctionRunSet.expectedWorkflowNames.length
    && Object.values(correctionRunSet.expectedConclusions)
      .every((conclusion) => conclusion === 'success'),
  'Correction Merge expected conclusions changed');
  validateRunSet(correctionRunSet, CORRECTION_MERGE,
    correctionRunSet.expectedWorkflowNames, correctionRunSet.expectedConclusions,
    'correction Merge');
  const sourceFailure = requireRun(evidence.naturalRuns.sourceMerge.runs,
    SOURCE_HISTORICAL_FAILURE.workflow);
  const failedJobIds = sourceFailure.jobs.filter((job) => job.conclusion === 'failure')
    .map((job) => job.id);
  const failure = evidence.historicalFailures[0];
  invariant(evidence.historicalFailures.length === 1
    && failure.stage === 'sourceMerge'
    && failure.workflow === SOURCE_HISTORICAL_FAILURE.workflow
    && failure.runId === sourceFailure.id
    && failure.runConclusion === 'failure'
    && canonicalStringify(failure.failedJobIds) === canonicalStringify(failedJobIds)
    && failure.classification === SOURCE_HISTORICAL_FAILURE.classification
    && failure.correctedByPullRequest === 73
    && failure.correctedByHead === CORRECTION_HEAD
    && failure.correctedByMerge === CORRECTION_MERGE
    && failure.preserved === true && failure.manualRerunPerformed === false,
  'Observer historical failure identity changed');
  invariant(evidence.artifacts.sourceMergeG1.headSha === SOURCE_MERGE
    && evidence.artifacts.sourceMergeG1.runId
      === requireRun(evidence.naturalRuns.sourceMerge.runs,
        'm3-r3-g1-formal-acceptance').id, 'Source G1 Artifact binding changed');
  invariant(evidence.artifacts.correctionMergeC1.headSha === CORRECTION_MERGE
    && evidence.artifacts.correctionMergeC1.runId
      === requireRun(evidence.naturalRuns.correctionMerge.runs,
        'm3-r3-g4-evidence-correction').id, 'Correction C1 Artifact binding changed');
  invariant(canonicalStringify(evidence.fixedDigests) === canonicalStringify(FIXED_DIGESTS),
    'Observer fixed digest chain changed');
  invariant(evidence.decision.sourceHistoricalFailurePreserved === true
    && evidence.decision.correctionClosesHistoricalFailure === true,
  'Observer correction closure decision changed');
  invariant(canonicalStringify(evidence.artifact.expectedPaths)
    === canonicalStringify(ARTIFACT_PATHS)
    && evidence.artifact.pathCount === ARTIFACT_PATHS.length,
  'Observer Artifact layout changed');
  if (evidence.source.eventName === 'pull_request') {
    invariant(!evidence.observer.merged && evidence.observer.mergeSha === null
      && evidence.observer.parents.length === 0
      && evidence.main.observedSha === CORRECTION_MERGE
      && !evidence.decision.observerMerged && !evidence.decision.finalClosureEligible
      && evidence.source.branch === OBSERVER_BRANCH
      && evidence.decision.nextRequiredAction === 'ready-and-ordinary-merge-commit',
    'Observer pre-merge decision is invalid');
  } else {
    invariant(evidence.observer.merged
      && evidence.observer.mergeSha === evidence.source.commitSha
      && evidence.main.observedSha === evidence.source.commitSha
      && canonicalStringify(evidence.observer.parents)
        === canonicalStringify([CORRECTION_MERGE, evidence.observer.headSha])
      && evidence.decision.observerMerged && evidence.decision.finalClosureEligible
      && evidence.source.branch === 'main'
      && evidence.decision.nextRequiredAction
        === 'independent-artifact-audit-and-issue-closure',
    'Observer post-merge decision is invalid');
  }
  invariant(Object.values(evidence.safetyBoundary).every((value) => value === false),
    'Observer safety boundary widened');
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  invariant(sha256(claims) === evidence.evidenceDigest,
    'Observer canonical Evidence digest mismatch');
  return true;
}

function runSet(commitSha, names, expectedConclusions, runs) {
  return { commitSha, expectedWorkflowNames: [...names], workflowCount: names.length,
    expectedConclusions: { ...expectedConclusions }, runs };
}
function validateRunSet(value, sha, names, expectedConclusions, label) {
  invariant(value.commitSha === sha && value.workflowCount === names.length
    && canonicalStringify([...value.expectedWorkflowNames].sort())
      === canonicalStringify([...names].sort())
    && canonicalStringify(value.expectedConclusions)
      === canonicalStringify(expectedConclusions)
    && canonicalStringify(value.runs.map((run) => run.name).sort())
      === canonicalStringify([...names].sort()), `${label} Evidence run set changed`);
  invariant(value.runs.every((run) => {
    const expected = expectedConclusions[run.name];
    const jobsObserved = run.jobs.length > 0 && run.jobs.every((job) =>
      job.status === 'completed' && ['success', 'failure'].includes(job.conclusion));
    const jobsMatch = expected === 'success'
      ? run.jobs.every((job) => job.conclusion === 'success')
      : run.jobs.some((job) => job.conclusion === 'failure');
    return run.event === 'push' && run.headBranch === 'main'
      && run.headSha === sha && run.attempt === 1 && run.status === 'completed'
      && run.expectedConclusion === expected && run.conclusion === expected
      && jobsObserved && jobsMatch;
  }), `${label} Evidence contains an unexpected natural Run or Job outcome`);
}
function requiredEnv(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0 && value.length <= 256,
    `${name} is required`);
  return value;
}
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
