import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalStringify } from '../packages/knowledge-core/src/index.js';

const ROOT = process.cwd();
const OBSERVATION_PATH = join(ROOT, 'releases/m2/main-branch-ci-observation.json');
const SOURCE_SHA = '991b5f0f9cfa3a382f9aff3c600f98b76aed9c08';
const RUN_ID = 30356400001;
const WORKFLOW_ID = 321111055;
const VALIDATE_JOB_ID = 90265505895;
const POSTGRES_JOB_ID = 90265505920;
const POSTGRES_ARTIFACT_ID = 8686972491;
const POSTGRES_ARTIFACT_DIGEST = 'sha256:ff900fd49517bbc469891017e741d9bcff8b8389b6a9d0881759f42f6a6dbfff';
const ARTIFACT_KEYS = Object.freeze([
  'm1ReleaseEvidence',
  'm2ReleaseEvidence',
  'm2PostMergeEvidence',
  'postgresValidation',
  'repositoryValidation',
  'deploymentValidation',
]);

export async function loadM2MainBranchCiObservation(path = OBSERVATION_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2MainBranchCiObservation(options = {}) {
  const observation = options.observation ?? await loadM2MainBranchCiObservation(options.path);
  assertObject(observation, 'M2 main CI observation');
  assertExactKeys(observation, [
    'schemaVersion',
    'releaseId',
    'version',
    'collectedAt',
    'repository',
    'promotionSourceSha',
    'run',
    'jobs',
    'artifacts',
    'eligibleForClosure',
  ], 'M2 main CI observation');
  assert(observation.schemaVersion === 'm2-main-branch-ci-evidence/v1', 'M2 main CI observation schema is invalid');
  assert(observation.releaseId === 'M2-RC1', 'M2 main CI observation releaseId is invalid');
  assert(observation.version === '0.12.0', 'M2 main CI observation version is invalid');
  normalizeTimestamp(observation.collectedAt);
  assert(observation.repository === 'akaryc1b/knowledge-driven-test-platform', 'M2 main CI repository is invalid');
  assert(observation.promotionSourceSha === SOURCE_SHA, 'M2 main CI promotion source SHA changed');

  validateRun(observation.run);
  validateJobs(observation.jobs);
  validateArtifacts(observation.artifacts);
  assert(observation.eligibleForClosure === false,
    'Failed M2 main CI observation cannot be eligible for blocker closure');
  assertNoSensitiveMaterial(observation);
  return structuredClone(observation);
}

function validateRun(run) {
  assertObject(run, 'M2 main CI run');
  assertExactKeys(run, [
    'id',
    'workflowId',
    'workflowName',
    'attempt',
    'event',
    'headBranch',
    'headSha',
    'status',
    'conclusion',
    'url',
  ], 'M2 main CI run');
  assert(run.id === RUN_ID, 'M2 main CI run ID changed');
  assert(run.workflowId === WORKFLOW_ID, 'M2 main CI workflow ID changed');
  assert(run.workflowName === 'validation', 'M2 main CI workflow name is invalid');
  assert(run.attempt === 1, 'M2 main CI run attempt is invalid');
  assert(run.event === 'push', 'M2 main CI evidence must come from push');
  assert(run.headBranch === 'main', 'M2 main CI branch must be main');
  assert(run.headSha === SOURCE_SHA, 'M2 main CI run SHA changed');
  assert(run.status === 'completed', 'M2 main CI run must be completed');
  assert(run.conclusion === 'failure', 'M2 main CI run conclusion changed');
  assert(run.url === `https://github.com/akaryc1b/knowledge-driven-test-platform/actions/runs/${RUN_ID}`,
    'M2 main CI run URL is invalid');
}

function validateJobs(jobs) {
  assertObject(jobs, 'M2 main CI jobs');
  assertExactKeys(jobs, ['validate', 'postgresIntegration'], 'M2 main CI jobs');

  const validate = jobs.validate;
  assertObject(validate, 'M2 main CI Validate job');
  assertExactKeys(validate, ['id', 'name', 'status', 'conclusion', 'deploymentValidationStep'],
    'M2 main CI Validate job');
  assert(validate.id === VALIDATE_JOB_ID, 'M2 main CI Validate job ID changed');
  assert(validate.name === 'validate', 'M2 main CI Validate job name is invalid');
  assert(validate.status === 'completed' && validate.conclusion === 'failure',
    'M2 main CI Validate job result changed');

  const step = validate.deploymentValidationStep;
  assertObject(step, 'M2 main CI Deployment Validator step');
  assertExactKeys(step, ['number', 'name', 'status', 'conclusion'], 'M2 main CI Deployment Validator step');
  assert(step.number === 16, 'M2 main CI Deployment Validator step number changed');
  assert(step.name === 'Run npm run validate:deployment', 'M2 main CI Deployment Validator step name changed');
  assert(step.status === 'completed' && step.conclusion === 'skipped',
    'M2 main CI Deployment Validator step result changed');

  const postgres = jobs.postgresIntegration;
  assertObject(postgres, 'M2 main CI PostgreSQL job');
  assertExactKeys(postgres, ['id', 'name', 'status', 'conclusion'], 'M2 main CI PostgreSQL job');
  assert(postgres.id === POSTGRES_JOB_ID, 'M2 main CI PostgreSQL job ID changed');
  assert(postgres.name === 'postgres-integration', 'M2 main CI PostgreSQL job name is invalid');
  assert(postgres.status === 'completed' && postgres.conclusion === 'success',
    'M2 main CI PostgreSQL job result changed');
}

function validateArtifacts(artifacts) {
  assertObject(artifacts, 'M2 main CI Artifacts');
  assertExactKeys(artifacts, ARTIFACT_KEYS, 'M2 main CI Artifacts');
  for (const key of [
    'm1ReleaseEvidence',
    'm2ReleaseEvidence',
    'm2PostMergeEvidence',
    'repositoryValidation',
    'deploymentValidation',
  ]) assert(artifacts[key] === null, `Failed M2 main CI cannot contain ${key}`);

  const postgres = artifacts.postgresValidation;
  assertObject(postgres, 'M2 main CI PostgreSQL Artifact');
  assertExactKeys(postgres, ['id', 'name', 'digest', 'expired'], 'M2 main CI PostgreSQL Artifact');
  assert(postgres.id === POSTGRES_ARTIFACT_ID, 'M2 main CI PostgreSQL Artifact ID changed');
  assert(postgres.name === 'postgres-test-log', 'M2 main CI PostgreSQL Artifact name is invalid');
  assert(postgres.digest === POSTGRES_ARTIFACT_DIGEST, 'M2 main CI PostgreSQL Artifact digest changed');
  assert(postgres.expired === false, 'M2 main CI PostgreSQL Artifact is expired');
}

function assertNoSensitiveMaterial(value) {
  const text = canonicalStringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings|kubeconfig|clientSecret|secretValue)"\s*:/i,
  ]) assert(!pattern.test(text), 'M2 main CI observation contains sensitive material');
}

function normalizeTimestamp(value) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), 'M2 main CI collectedAt is invalid');
  return new Date(value).toISOString();
}

function assertExactKeys(value, expected, label) {
  const actual = Object.keys(value).sort();
  const normalizedExpected = [...expected].sort();
  assert(actual.length === normalizedExpected.length
    && actual.every((key, index) => key === normalizedExpected[index]),
  `${label} fields are invalid`);
}

function assertObject(value, label) {
  assert(value && typeof value === 'object' && !Array.isArray(value), `${label} must be an object`);
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const isMain = process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url;
if (isMain) {
  process.stdout.write(`${JSON.stringify(await validateM2MainBranchCiObservation(), null, 2)}\n`);
}
