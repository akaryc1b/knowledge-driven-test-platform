import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const M2_MAIN_BRANCH_CI_EVIDENCE_SCHEMA_VERSION = 'm2-main-branch-ci-evidence/v1';

const REPOSITORY = 'akaryc1b/knowledge-driven-test-platform';
const PROMOTION_PATH = 'releases/m2/production-promotion.json';
const WORKFLOW_PATH = '.github/workflows/validation.yml';
const REQUIRED_ARTIFACTS = Object.freeze({
  m1ReleaseEvidence: 'm1-release-candidate-evidence',
  m2ReleaseEvidence: 'm2-release-candidate-evidence',
  m2PostMergeEvidence: 'm2-post-merge-acceptance-evidence',
  postgresValidation: 'postgres-test-log',
  repositoryValidation: 'repository-validation-log',
});
const OPTIONAL_ARTIFACTS = Object.freeze({
  deploymentValidation: 'deployment-validation-log',
});
const PLACEHOLDER_PATTERN = /(?:example|placeholder|sample|dummy|fake|todo|tbd|changeme|replace[-_ ]?me|not[-_ ]?set|unknown)/i;

export async function collectM2MainBranchCiEvidence(options = {}) {
  const promotion = options.promotion
    ?? JSON.parse(await readFile(options.promotionPath ?? PROMOTION_PATH, 'utf8'));
  const repository = options.repository ?? process.env.GITHUB_REPOSITORY ?? REPOSITORY;
  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  const apiBase = options.apiBase ?? 'https://api.github.com';
  const credential = options.credential ?? process.env.GITHUB_TOKEN ?? null;
  const collectedAt = normalizeTimestamp(options.collectedAt ?? new Date().toISOString());

  assert(repository === REPOSITORY, 'Main CI collector repository is invalid');
  assert(typeof fetchImpl === 'function', 'Main CI collector requires fetch');
  assert(promotion?.releaseId === 'M2-RC1', 'Main CI collector releaseId is invalid');
  assert(promotion?.version === '0.12.0', 'Main CI collector version is invalid');
  const sourceSha = promotion?.promotionSource?.mainSha;
  assertSha(sourceSha, 'Main CI collector source SHA');

  const headers = {
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'kdtp-m2-production-promotion-evidence',
  };
  if (credential) headers.Authorization = `Bearer ${credential}`;

  const runs = await fetchJson(
    fetchImpl,
    `${apiBase}/repos/${repository}/actions/runs?head_sha=${sourceSha}&event=push&status=completed&per_page=100`,
    headers,
  );
  const matches = (runs.workflow_runs ?? []).filter((run) => run.path === WORKFLOW_PATH
    && run.event === 'push'
    && run.head_branch === 'main'
    && run.head_sha === sourceSha
    && run.status === 'completed'
    && run.conclusion === 'success');
  assert(matches.length === 1, `Expected exactly one successful main push validation run, found ${matches.length}`);
  const run = matches[0];

  const jobsResponse = await fetchJson(
    fetchImpl,
    `${apiBase}/repos/${repository}/actions/runs/${run.id}/jobs?filter=latest&per_page=100`,
    headers,
  );
  const validateJob = requireSuccessfulJob(jobsResponse.jobs, 'validate');
  const postgresJob = requireSuccessfulJob(jobsResponse.jobs, 'postgres-integration');
  const deploymentStep = (validateJob.steps ?? []).find((step) => [
    'Run npm run validate:deployment',
    'Run deployment validation',
  ].includes(step.name));
  assert(deploymentStep?.status === 'completed' && deploymentStep?.conclusion === 'success',
    'Main push Deployment Validator step did not succeed');

  const artifactsResponse = await fetchJson(
    fetchImpl,
    `${apiBase}/repos/${repository}/actions/runs/${run.id}/artifacts?per_page=100`,
    headers,
  );
  const artifacts = {};
  for (const [key, name] of Object.entries(REQUIRED_ARTIFACTS)) {
    artifacts[key] = requireArtifact(artifactsResponse.artifacts, name);
  }
  for (const [key, name] of Object.entries(OPTIONAL_ARTIFACTS)) {
    const artifact = (artifactsResponse.artifacts ?? []).find((item) => item.name === name);
    artifacts[key] = artifact ? normalizeArtifact(artifact) : null;
  }

  const evidence = {
    schemaVersion: M2_MAIN_BRANCH_CI_EVIDENCE_SCHEMA_VERSION,
    releaseId: promotion.releaseId,
    version: promotion.version,
    collectedAt,
    repository,
    promotionSourceSha: sourceSha,
    run: {
      id: positiveInteger(run.id, 'Main CI run ID'),
      workflowId: positiveInteger(run.workflow_id, 'Main CI workflow ID'),
      workflowName: run.name,
      attempt: positiveInteger(run.run_attempt, 'Main CI run attempt'),
      event: run.event,
      headBranch: run.head_branch,
      headSha: run.head_sha,
      status: run.status,
      conclusion: run.conclusion,
      url: assertHttpsUrl(run.html_url, 'Main CI run URL'),
    },
    jobs: {
      validate: {
        id: positiveInteger(validateJob.id, 'Validate job ID'),
        name: validateJob.name,
        status: validateJob.status,
        conclusion: validateJob.conclusion,
        deploymentValidationStep: {
          number: positiveInteger(deploymentStep.number, 'Deployment Validator step number'),
          name: deploymentStep.name,
          conclusion: deploymentStep.conclusion,
        },
      },
      postgresIntegration: {
        id: positiveInteger(postgresJob.id, 'PostgreSQL job ID'),
        name: postgresJob.name,
        status: postgresJob.status,
        conclusion: postgresJob.conclusion,
      },
    },
    artifacts,
  };
  assertNoSensitiveMaterial(evidence);
  return evidence;
}

async function fetchJson(fetchImpl, url, headers) {
  const response = await fetchImpl(url, { headers });
  assert(response?.ok === true, `GitHub Actions API request failed with status ${response?.status ?? 'unknown'}`);
  return response.json();
}

function requireSuccessfulJob(jobs, name) {
  const matches = (jobs ?? []).filter((job) => job.name === name);
  assert(matches.length === 1, `Expected exactly one ${name} job, found ${matches.length}`);
  const job = matches[0];
  assert(job.status === 'completed' && job.conclusion === 'success', `${name} job did not succeed`);
  return job;
}

function requireArtifact(artifacts, name) {
  const matches = (artifacts ?? []).filter((artifact) => artifact.name === name);
  assert(matches.length === 1, `Expected exactly one ${name} Artifact, found ${matches.length}`);
  return normalizeArtifact(matches[0]);
}

function normalizeArtifact(artifact) {
  assert(artifact.expired === false, `${artifact.name} Artifact is expired`);
  assertArtifactDigest(artifact.digest, `${artifact.name} Artifact digest`);
  return {
    id: positiveInteger(artifact.id, `${artifact.name} Artifact ID`),
    name: artifact.name,
    digest: artifact.digest,
    expired: false,
  };
}

function assertArtifactDigest(value, label) {
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), `${label} is invalid`);
  const hex = value.slice('sha256:'.length);
  assert(!PLACEHOLDER_PATTERN.test(value) && new Set(hex).size > 1, `${label} looks like a placeholder`);
  return value;
}

function assertSha(value, label) {
  assert(typeof value === 'string' && /^[a-f0-9]{40}$/.test(value), `${label} is invalid`);
  assert(!PLACEHOLDER_PATTERN.test(value) && new Set(value).size > 1, `${label} looks like a placeholder`);
}

function assertHttpsUrl(value, label) {
  assert(typeof value === 'string' && /^https:\/\//.test(value), `${label} is invalid`);
  assert(!/@/.test(value.replace(/^https:\/\//, '').split('/')[0]), `${label} cannot contain credentials`);
  return value;
}

function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'Main CI collectedAt is invalid');
  return new Date(value).toISOString();
}

function positiveInteger(value, label) {
  assert(Number.isInteger(value) && value > 0, `${label} is invalid`);
  return value;
}

function assertNoSensitiveMaterial(value) {
  const text = JSON.stringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings|kubeconfig)"\s*:/i,
  ]) assert(!pattern.test(text), 'Main CI evidence contains sensitive material');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await collectM2MainBranchCiEvidence(), null, 2)}\n`);
}
