import test from 'node:test';
import assert from 'node:assert/strict';
import {
  loadM2MainBranchCiObservation,
  validateM2MainBranchCiObservation,
} from '../../../scripts/validate-m2-main-branch-ci-evidence.js';

const POSTGRES_DIGEST = 'sha256:ff900fd49517bbc469891017e741d9bcff8b8389b6a9d0881759f42f6a6dbfff';

test('repository preserves the exact failed final main push observation', async () => {
  const observation = await validateM2MainBranchCiObservation();
  assert.equal(observation.run.id, 30356400001);
  assert.equal(observation.run.event, 'push');
  assert.equal(observation.run.headBranch, 'main');
  assert.equal(observation.run.conclusion, 'failure');
  assert.equal(observation.jobs.validate.conclusion, 'failure');
  assert.equal(observation.jobs.postgresIntegration.conclusion, 'success');
  assert.equal(observation.jobs.validate.deploymentValidationStep.conclusion, 'skipped');
  assert.equal(observation.artifacts.postgresValidation.digest, POSTGRES_DIGEST);
  assert.equal(observation.artifacts.repositoryValidation, null);
  assert.equal(observation.eligibleForClosure, false);
});

test('failed final main push observation cannot be promoted or rewritten as success', async () => {
  const observation = await loadM2MainBranchCiObservation();

  const promoted = structuredClone(observation);
  promoted.eligibleForClosure = true;
  await assert.rejects(
    validateM2MainBranchCiObservation({ observation: promoted }),
    /cannot be eligible/,
  );

  const rewrittenRun = structuredClone(observation);
  rewrittenRun.run.conclusion = 'success';
  await assert.rejects(
    validateM2MainBranchCiObservation({ observation: rewrittenRun }),
    /run conclusion changed/,
  );

  const fabricatedArtifact = structuredClone(observation);
  fabricatedArtifact.artifacts.repositoryValidation = {
    id: 1,
    name: 'repository-validation-log',
    digest: `sha256:${'a'.repeat(64)}`,
    expired: false,
  };
  await assert.rejects(
    validateM2MainBranchCiObservation({ observation: fabricatedArtifact }),
    /cannot contain repositoryValidation/,
  );
});

test('final main push observation rejects credential material', async () => {
  const observation = await loadM2MainBranchCiObservation();
  const leaked = structuredClone(observation);
  leaked.run.token = 'ghp_abcdefghijklmnopqrstuvwxyz123456';
  await assert.rejects(
    validateM2MainBranchCiObservation({ observation: leaked }),
    /fields are invalid|sensitive material/,
  );
});
