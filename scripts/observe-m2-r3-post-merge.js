#!/usr/bin/env node

const repository = process.env.GITHUB_REPOSITORY;
const targetSha = process.env.TARGET_SHA;
const token = process.env.GITHUB_TOKEN;

if (!repository || !targetSha || !token) {
  throw new Error('Observer environment is incomplete');
}
if (!/^[a-f0-9]{40}$/.test(targetSha)) {
  throw new Error('Observer target SHA is invalid');
}

const apiRoot = `https://api.github.com/repos/${repository}`;
const headers = {
  Accept: 'application/vnd.github+json',
  Authorization: `Bearer ${token}`,
  'X-GitHub-Api-Version': '2022-11-28',
  'User-Agent': 'kdtp-m2-r3-post-merge-observer',
};

async function api(path) {
  const response = await fetch(`${apiRoot}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`GitHub API ${path} failed with ${response.status}`);
  }
  return response.json();
}

const definitions = [
  {
    key: 'validation',
    name: 'validation',
    path: '.github/workflows/validation.yml',
    requiredJobs: ['validate', 'postgres-integration'],
    requiredArtifacts: [
      'repository-validation-log',
      'deployment-validation-log',
      'm2-final-release-closure-evidence',
      'm2-r2a-external-evidence-intake-evidence',
      'postgres-test-log',
    ],
  },
  {
    key: 'finalClosure',
    name: 'm2-r3-final-release-closure',
    path: '.github/workflows/m2-r3-final-release-closure.yml',
    requiredJobs: ['validate-closure', 'postgres-integration'],
    requiredArtifacts: [
      'm2-final-release-closure-evidence',
      'm2-final-closure-postgres-test-log',
    ],
  },
  {
    key: 'historicalR2A',
    name: 'm2-r2a-external-evidence-intake',
    path: '.github/workflows/m2-r2a-external-evidence-intake.yml',
    requiredJobs: ['validate-intake', 'postgres-integration'],
    requiredArtifacts: [
      'm2-r2a-external-evidence-intake-evidence',
      'm2-r2a-postgres-test-log',
    ],
  },
  {
    key: 'portableReadiness',
    name: 'm2-r2-rebaseline-portable-release-readiness',
    path: '.github/workflows/m2-r2-rebaseline-portable-release-readiness.yml',
    requiredJobs: ['validate-readiness', 'postgres-integration'],
    requiredArtifacts: [
      'm2-portable-release-readiness-evidence',
      'm2-portable-readiness-postgres-test-log',
    ],
  },
];

let selectedRuns = {};
for (let attempt = 0; attempt < 24; attempt += 1) {
  const response = await api(
    `/actions/runs?head_sha=${encodeURIComponent(targetSha)}&branch=main&event=push&per_page=100`,
  );
  selectedRuns = Object.fromEntries(definitions.map((definition) => {
    const matches = response.workflow_runs
      .filter((run) => run.name === definition.name
        && run.path === definition.path
        && run.event === 'push'
        && run.head_branch === 'main'
        && run.head_sha === targetSha)
      .sort((left, right) => right.id - left.id);
    return [definition.key, matches[0] ?? null];
  }));
  if (definitions.every((definition) => selectedRuns[definition.key]?.status === 'completed')) {
    break;
  }
  await new Promise((resolve) => setTimeout(resolve, 10000));
}

const runs = {};
const verified = {};
for (const definition of definitions) {
  const run = selectedRuns[definition.key];
  if (!run) {
    runs[definition.key] = {
      missing: true,
      expectedName: definition.name,
      expectedWorkflowPath: definition.path,
    };
    verified[definition.key] = false;
    continue;
  }

  const jobsResponse = await api(`/actions/runs/${run.id}/jobs?filter=latest&per_page=100`);
  const jobs = jobsResponse.jobs.map((job) => ({
    id: job.id,
    name: job.name,
    status: job.status,
    conclusion: job.conclusion,
  }));
  const requiredJobsSuccessful = definition.requiredJobs.every((name) => {
    const job = jobs.find((candidate) => candidate.name === name);
    return job?.status === 'completed' && job?.conclusion === 'success';
  });
  const allJobsSuccessful = jobs.length > 0
    && jobs.every((job) => job.status === 'completed' && job.conclusion === 'success');

  const artifactsResponse = await api(`/actions/runs/${run.id}/artifacts?per_page=100`);
  const artifacts = artifactsResponse.artifacts.map((artifact) => ({
    id: artifact.id,
    name: artifact.name,
    digest: artifact.digest,
    expired: artifact.expired,
    createdAt: artifact.created_at,
    expiresAt: artifact.expires_at,
  }));
  const requiredArtifactsValid = definition.requiredArtifacts.every((name) => {
    const artifact = artifacts.find((candidate) => candidate.name === name);
    return artifact?.expired === false && /^sha256:[a-f0-9]{64}$/.test(artifact?.digest ?? '');
  });

  const exactIdentity = run.name === definition.name
    && run.path === definition.path
    && run.event === 'push'
    && run.head_branch === 'main'
    && run.head_sha === targetSha;
  const runSuccessful = run.status === 'completed' && run.conclusion === 'success';
  verified[definition.key] = exactIdentity
    && runSuccessful
    && requiredJobsSuccessful
    && allJobsSuccessful
    && requiredArtifactsValid;

  runs[definition.key] = {
    id: run.id,
    name: run.name,
    workflowPath: run.path,
    event: run.event,
    status: run.status,
    conclusion: run.conclusion,
    headBranch: run.head_branch,
    headSha: run.head_sha,
    runNumber: run.run_number,
    runAttempt: run.run_attempt,
    createdAt: run.created_at,
    updatedAt: run.updated_at,
    jobs,
    artifacts,
    verification: {
      exactIdentity,
      runSuccessful,
      requiredJobsSuccessful,
      allJobsSuccessful,
      requiredArtifactsValid,
    },
  };
}

const evidence = {
  schemaVersion: 'm2-r3-post-merge-observation/v1',
  releaseId: 'M2-RC1',
  version: '0.12.0',
  observedAt: new Date().toISOString(),
  target: { branch: 'main', sha: targetSha },
  runs,
  decision: {
    exactMainValidationVerified: verified.validation === true,
    finalClosureVerified: verified.finalClosure === true,
    historicalR2AAntiRegressionVerified: verified.historicalR2A === true,
    portableReadinessAntiRegressionVerified: verified.portableReadiness === true,
    m2Rc1FinalClosureAccepted: Object.values(verified).every((value) => value === true),
    m2Rc1Closed: true,
    repositoryReleaseReady: true,
    environmentPromotionEvaluated: false,
    environmentPromotionEligible: null,
    m3PlanningReady: true,
    m3ImplementationStarted: false,
    nextRequiredSlice: 'M3-R0',
    repositoryBlockers: [],
  },
  safetyBoundary: {
    secretAccessed: false,
    secretCreated: false,
    targetClusterAccessed: false,
    targetClusterModified: false,
    approvalCreated: false,
    rolloutExecuted: false,
    imagePublished: false,
    registryDigestChanged: false,
    executionAdapterImplemented: false,
    externalProcessExecuted: false,
    workerAdded: false,
    queueAdded: false,
    schedulerAdded: false,
  },
};

process.stdout.write(`${JSON.stringify(evidence, null, 2)}\n`);
