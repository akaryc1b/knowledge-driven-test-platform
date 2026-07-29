import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const CLOSURE_PATH = 'releases/m2/r0-main-ci-closure.json';
const PROMOTION_PATH = 'releases/m2/r0-production-promotion.json';
const SOURCE_SHA = 'edf09333d9be9ea6839b8cf4d18efed95cfba821';
const RUN_ID = 30423781549;
const WORKFLOW_ID = 321111055;
const EXPECTED_ARTIFACTS = Object.freeze({
  m1ReleaseEvidence: [8712830165, 'm1-release-candidate-evidence', 'sha256:5fd6a0a992fc5042ec24e22ec5a9dbd83c73fd8f41179676b2cc0d0ec3b7c27b'],
  m2ReleaseEvidence: [8712830487, 'm2-release-candidate-evidence', 'sha256:52fa0384bf868e7dbe4115fcb5755eed971f624346d70f201c0c52e7530ba0c1'],
  m2PostMergeEvidence: [8712830783, 'm2-post-merge-acceptance-evidence', 'sha256:5b5cd301970cddd6aeea29b70108a128983262480a79d39d6371f3c5ef48b6ae'],
  postgresValidation: [8712828716, 'postgres-test-log', 'sha256:8008931c382ed28db60829d7ae729c3fb35547ec546dd5357c01498eac6dcd42'],
  repositoryValidation: [8712825672, 'repository-validation-log', 'sha256:1fd29192b102e0767a91d11649c6056f4a6261e8159f8dee34698a3ffd849cf1'],
  deploymentValidation: [8712826341, 'deployment-validation-log', 'sha256:99a28a45d3841ac234b05ca22442980871a9534ee2d92247b1d16b116b49d5a6'],
});
const OPEN_BLOCKERS = Object.freeze([
  'external-registry-digest-missing',
  'production-secrets-not-configured',
  'target-cluster-validation-not-run',
  'change-approval-missing',
  'release-owner-approval-missing',
]);

export async function loadM2R0MainCiClosure(path = CLOSURE_PATH) {
  return JSON.parse(await readFile(path, 'utf8'));
}

export async function validateM2R0MainCiClosure(options = {}) {
  const closure = options.closure ?? await loadM2R0MainCiClosure(options.path);
  const promotion = options.promotion
    ?? JSON.parse(await readFile(options.promotionPath ?? PROMOTION_PATH, 'utf8'));

  assertObject(closure, 'R0 main CI closure');
  assertExactKeys(closure, [
    'schemaVersion', 'releaseId', 'version', 'collectedAt', 'repository',
    'promotionSourceSha', 'run', 'jobs', 'artifacts', 'eligibleForClosure',
  ], 'R0 main CI closure');
  assert(closure.schemaVersion === 'm2-main-branch-ci-evidence/v1', 'R0 closure schemaVersion is invalid');
  assert(closure.releaseId === 'M2-RC1' && closure.version === '0.12.0', 'R0 closure release identity is invalid');
  normalizeTimestamp(closure.collectedAt, 'R0 closure collectedAt');
  assert(closure.repository === 'akaryc1b/knowledge-driven-test-platform', 'R0 closure repository is invalid');
  assert(closure.promotionSourceSha === SOURCE_SHA, 'R0 closure source SHA changed');
  assert(closure.eligibleForClosure === true, 'R0 closure must be eligible');

  validateRun(closure.run);
  validateJobs(closure.jobs);
  validateArtifacts(closure.artifacts);
  validatePromotionBinding(promotion, closure);
  assertNoSensitiveMaterial(closure);

  return closure;
}

function validateRun(run) {
  assertObject(run, 'R0 closure run');
  assertExactKeys(run, [
    'id', 'workflowId', 'workflowName', 'attempt', 'event', 'headBranch',
    'headSha', 'status', 'conclusion', 'url',
  ], 'R0 closure run');
  assert(run.id === RUN_ID, 'R0 closure run ID changed');
  assert(run.workflowId === WORKFLOW_ID && run.workflowName === 'validation', 'R0 closure workflow identity changed');
  assert(run.attempt === 1, 'R0 closure run attempt changed');
  assert(run.event === 'push' && run.headBranch === 'main' && run.headSha === SOURCE_SHA,
    'R0 closure is not bound to the exact main push');
  assert(run.status === 'completed' && run.conclusion === 'success', 'R0 closure run did not succeed');
  assert(run.url === `https://github.com/akaryc1b/knowledge-driven-test-platform/actions/runs/${RUN_ID}`,
    'R0 closure run URL changed');
}

function validateJobs(jobs) {
  assertObject(jobs, 'R0 closure jobs');
  assertExactKeys(jobs, ['validate', 'postgresIntegration'], 'R0 closure jobs');
  const validate = jobs.validate;
  assertObject(validate, 'R0 Validate job');
  assertExactKeys(validate, ['id', 'name', 'status', 'conclusion', 'deploymentValidationStep'], 'R0 Validate job');
  assert(validate.id === 90485717866 && validate.name === 'validate', 'R0 Validate job identity changed');
  assert(validate.status === 'completed' && validate.conclusion === 'success', 'R0 Validate job did not succeed');
  const step = validate.deploymentValidationStep;
  assertObject(step, 'R0 Deployment Validator step');
  assertExactKeys(step, ['number', 'name', 'status', 'conclusion'], 'R0 Deployment Validator step');
  assert(step.number === 16 && step.name === 'Run deployment validation', 'R0 Deployment Validator step identity changed');
  assert(step.status === 'completed' && step.conclusion === 'success', 'R0 Deployment Validator did not succeed');

  const postgres = jobs.postgresIntegration;
  assertObject(postgres, 'R0 PostgreSQL job');
  assertExactKeys(postgres, ['id', 'name', 'status', 'conclusion'], 'R0 closure jobs');
  assert(postgres.id === 90485717817 && postgres.name === 'postgres-integration', 'R0 PostgreSQL job identity changed');
  assert(postgres.status === 'completed' && postgres.conclusion === 'success', 'R0 PostgreSQL job did not succeed');
}

function validateArtifacts(artifacts) {
  assertObject(artifacts, 'R0 closure artifacts');
  assertExactKeys(artifacts, Object.keys(EXPECTED_ARTIFACTS), 'R0 closure artifacts');
  for (const [key, [id, name, digest]] of Object.entries(EXPECTED_ARTIFACTS)) {
    const artifact = artifacts[key];
    assertObject(artifact, `R0 closure ${key}`);
    assertExactKeys(artifact, ['id', 'name', 'digest', 'expired'], `R0 closure ${key}`);
    assert(artifact.id === id && artifact.name === name && artifact.digest === digest,
      `R0 closure ${key} identity or digest changed`);
    assert(artifact.expired === false, `R0 closure ${key} is expired`);
    assertDigest(artifact.digest, `R0 closure ${key}`);
  }
}

function validatePromotionBinding(promotion, closure) {
  assertObject(promotion, 'Frozen R0 Production Promotion');
  assert(promotion.promotionSource?.branch === 'main'
    && promotion.promotionSource?.mainSha === SOURCE_SHA,
  'Frozen R0 Production Promotion does not bind the R0 merge SHA');
  const mainCi = promotion.mainBranchFinalCi;
  assertObject(mainCi, 'Frozen R0 Production Promotion main CI');
  assert(mainCi.status === 'PASSED' && mainCi.event === 'push'
    && mainCi.sourceSha === SOURCE_SHA && mainCi.runId === RUN_ID,
  'Frozen R0 Production Promotion does not bind the successful R0 main run');
  for (const key of Object.keys(EXPECTED_ARTIFACTS)) {
    assert(mainCi.artifacts?.[key] === closure.artifacts[key].digest,
      `Frozen R0 Production Promotion ${key} digest does not match R0 closure`);
  }
  assert(promotion.decision?.productionEligible === false,
    'Frozen R0 Production Promotion cannot be eligible while external blockers remain');
  assertSet(promotion.decision?.resolvedBlockers, ['main-branch-final-ci-not-verified'], 'resolved blockers');
  assertSet(promotion.decision?.openBlockers, OPEN_BLOCKERS, 'open blockers');
}

function assertDigest(value, label) {
  assert(typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value), `${label} digest is invalid`);
  assert(new Set(value.slice('sha256:'.length)).size > 2, `${label} digest looks like a placeholder`);
}

function normalizeTimestamp(value, label) {
  assert(typeof value === 'string' && Number.isFinite(Date.parse(value)), `${label} is invalid`);
  return new Date(value).toISOString();
}

function assertNoSensitiveMaterial(value) {
  const text = JSON.stringify(value);
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /Bearer\s+[A-Za-z0-9._~-]+/i,
    /gh[pousr]_[A-Za-z0-9]{20,}/,
    /"(?:token|password|privateKey|databaseUrl|connectionString|subjectMappings|kubeconfig|clientSecret|secretValue)"\s*:/i,
    /:\/\/[^"@:\s]+:[^"@\s]+@/,
  ]) assert(!pattern.test(text), 'R0 main CI closure contains sensitive material');
}

function assertSet(actual, expected, label) {
  assert(Array.isArray(actual) && actual.length === expected.length, `${label} count is invalid`);
  assert(actual.every((value, index) => value === expected[index]), `${label} order is invalid`);
  assert(new Set(actual).size === actual.length, `${label} contains duplicates`);
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
  const closure = await validateM2R0MainCiClosure();
  process.stdout.write(`${JSON.stringify({
    releaseId: closure.releaseId,
    sourceSha: closure.promotionSourceSha,
    runId: closure.run.id,
    eligibleForClosure: closure.eligibleForClosure,
  }, null, 2)}\n`);
}
