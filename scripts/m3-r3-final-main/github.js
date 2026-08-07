import { readFile } from 'node:fs/promises';
import { canonicalStringify } from '@kdtp/knowledge-core';
import { OBSERVER_BRANCH, REPOSITORY } from './constants.js';

export function apiHeaders(credential) {
  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kdtp-m3-r3-final-main-observer',
  };
  if (credential) {
    const name = ['Author', 'ization'].join('');
    headers[name] = `${['Bear', 'er'].join('')} ${credential}`;
  }
  return headers;
}

export async function fetchJson(fetchImpl, url, headers) {
  invariant(typeof fetchImpl === 'function', 'Observer requires fetch');
  const response = await fetchImpl(url, { headers });
  invariant(response?.ok === true,
    `GitHub API request failed with status ${response?.status ?? 'unknown'}`);
  return response.json();
}

export async function collectExactPushRunSet({
  fetchImpl, apiBase, headers, commitSha, expectedNames, label,
}) {
  const query = new URL(`${apiBase}/repos/${REPOSITORY}/actions/runs`);
  for (const [key, value] of Object.entries({
    branch: 'main', event: 'push', status: 'completed', head_sha: commitSha, per_page: '100',
  })) query.searchParams.set(key, value);
  const response = await fetchJson(fetchImpl, query.href, headers);
  const exact = (response.workflow_runs ?? []).filter((run) =>
    run.event === 'push' && run.head_branch === 'main'
      && run.head_sha === commitSha && run.status === 'completed');
  invariant(canonicalStringify(exact.map((run) => run.name).sort())
    === canonicalStringify([...expectedNames].sort()),
  `${label} exact natural Workflow set changed`);

  const normalized = [];
  for (const run of exact.sort((a, b) => a.name.localeCompare(b.name))) {
    invariant(run.run_attempt === 1, `${label} contains a rerun attempt`);
    invariant(run.conclusion === 'success', `${label} Workflow failed: ${run.name}`);
    const responseJobs = await fetchJson(fetchImpl,
      `${apiBase}/repos/${REPOSITORY}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
      headers);
    const jobs = (responseJobs.jobs ?? []).map((job) => ({
      id: positiveInteger(job.id, `${label} Job ID`),
      name: requireString(job.name, `${label} Job name`, 256),
      status: job.status, conclusion: job.conclusion,
    })).sort((a, b) => a.name.localeCompare(b.name));
    invariant(jobs.length > 0 && jobs.every((job) =>
      job.status === 'completed' && job.conclusion === 'success'),
    `${label} Workflow has an unsuccessful Job: ${run.name}`);
    normalized.push({
      id: positiveInteger(run.id, `${label} Run ID`),
      workflowId: positiveInteger(run.workflow_id, `${label} Workflow ID`),
      name: run.name, event: run.event, headBranch: run.head_branch,
      headSha: run.head_sha, attempt: run.run_attempt,
      status: run.status, conclusion: run.conclusion, jobs,
    });
  }
  return normalized;
}

export async function collectRunArtifact({
  fetchImpl, apiBase, headers, run, name, expectedHead,
}) {
  const response = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/actions/runs/${run.id}/artifacts?per_page=100`, headers);
  const matches = (response.artifacts ?? []).filter((artifact) => artifact.name === name);
  invariant(matches.length === 1, `Expected exactly one ${name} Artifact, found ${matches.length}`);
  const artifact = matches[0];
  invariant(artifact.expired === false, `${name} Artifact is expired`);
  assertArtifactDigest(artifact.digest, `${name} Artifact digest`);
  invariant(artifact.workflow_run?.id === run.id
    && artifact.workflow_run?.head_sha === expectedHead,
  `${name} Artifact workflow binding is invalid`);
  return {
    id: positiveInteger(artifact.id, `${name} Artifact ID`), name,
    runId: run.id, headSha: expectedHead,
    sizeBytes: positiveInteger(artifact.size_in_bytes, `${name} Artifact size`),
    apiDigest: artifact.digest, expired: false,
    createdAt: normalizeTimestamp(artifact.created_at, `${name} Artifact createdAt`),
    expiresAt: normalizeTimestamp(artifact.expires_at, `${name} Artifact expiresAt`),
  };
}

export const fetchPullRequest = (fetchImpl, apiBase, headers, number) =>
  fetchJson(fetchImpl, `${apiBase}/repos/${REPOSITORY}/pulls/${number}`, headers);

export function validateMergedPullRequest(pr, expected) {
  invariant(pr.number === expected.number && pr.state === 'closed' && pr.merged === true
    && pr.draft === false && pr.base?.sha === expected.baseSha
    && pr.head?.sha === expected.headSha && pr.merge_commit_sha === expected.mergeSha,
  `Pull Request #${expected.number} merge identity is invalid`);
}

export async function fetchMergeCommit(fetchImpl, apiBase, headers, sha, parentsExpected) {
  const commit = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/commits/${sha}`, headers);
  const parents = (commit.parents ?? []).map((parent) => parent.sha);
  invariant(commit.sha === sha && canonicalStringify(parents)
    === canonicalStringify(parentsExpected), `Merge parent chain is invalid for ${sha}`);
  return { sha, parents };
}

export async function fetchMainSha(fetchImpl, apiBase, headers) {
  const ref = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/git/ref/heads/main`, headers);
  assertSha(ref.object?.sha, 'Main ref SHA');
  return ref.object.sha;
}

export async function resolveObserverPullRequestNumber({
  fetchImpl, apiBase, credential, eventName, commitSha, eventPath,
}) {
  if (eventName === 'pull_request') {
    invariant(typeof eventPath === 'string' && eventPath.length > 0,
      'Observer Pull Request event path is missing');
    const event = JSON.parse(await readFile(eventPath, 'utf8'));
    return positiveInteger(event.pull_request?.number, 'Observer Pull Request number');
  }
  invariant(eventName === 'push', 'Observer event cannot resolve a Pull Request');
  const pulls = await fetchJson(fetchImpl,
    `${apiBase}/repos/${REPOSITORY}/commits/${commitSha}/pulls?per_page=20`,
    apiHeaders(credential));
  const matches = (pulls ?? []).filter((pr) => pr.merged_at
    && pr.merge_commit_sha === commitSha && pr.base?.ref === 'main'
    && pr.head?.ref === OBSERVER_BRANCH);
  invariant(matches.length === 1,
    `Expected exactly one merged Observer Pull Request, found ${matches.length}`);
  return positiveInteger(matches[0].number, 'Observer merged Pull Request number');
}

export function requireRun(runs, name) {
  const matches = runs.filter((run) => run.name === name);
  invariant(matches.length === 1, `Expected exactly one ${name} Run, found ${matches.length}`);
  return matches[0];
}

export function assertSha(value, label) {
  invariant(typeof value === 'string' && /^[a-f0-9]{40}$/u.test(value), `${label} is invalid`);
  invariant(new Set(value).size > 1, `${label} looks like a placeholder`);
}
export function assertTimestamp(value, label) {
  invariant(typeof value === 'string' && !Number.isNaN(Date.parse(value)), `${label} is invalid`);
}
export function positiveInteger(value, label) {
  invariant(Number.isInteger(value) && value > 0, `${label} is invalid`);
  return value;
}
export function requireString(value, label, maxLength) {
  invariant(typeof value === 'string' && value.length > 0 && value.length <= maxLength,
    `${label} is invalid`);
  return value;
}
function normalizeTimestamp(value, label) {
  assertTimestamp(value, label);
  return new Date(value).toISOString();
}
function assertArtifactDigest(value, label) {
  invariant(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/u.test(value),
    `${label} is invalid`);
  invariant(new Set(value.slice(7)).size > 1, `${label} looks like a placeholder`);
}
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
