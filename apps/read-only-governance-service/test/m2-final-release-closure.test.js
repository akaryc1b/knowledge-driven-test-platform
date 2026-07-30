import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  loadM2FinalReleaseClosure,
  validateM2FinalReleaseClosure,
} from '../../../scripts/validate-m2-final-release-closure.js';
import { canonicalDigest } from '../../../scripts/validate-m2-portable-release-readiness.js';

const BRANCH = 'agent/m2-rc1-r3-final-release-closure';
const GENERATED_AT = '2026-07-30T09:00:00.000Z';

function options(overrides = {}) {
  return {
    generatedAt: GENERATED_AT,
    commitSha: 'local',
    branch: BRANCH,
    ...overrides,
  };
}

async function cloneClosure() {
  return structuredClone(await loadM2FinalReleaseClosure());
}

test('M2 final closure accepts the exact portable release evidence chain', async () => {
  const evidence = await validateM2FinalReleaseClosure(options());
  assert.equal(evidence.schemaVersion, 'm2-final-release-closure-evidence/v1');
  assert.equal(evidence.decision.m2Rc1Closed, true);
  assert.equal(evidence.decision.repositoryReleaseReady, true);
  assert.equal(evidence.decision.environmentPromotionEvaluated, false);
  assert.equal(evidence.decision.environmentPromotionEligible, null);
  assert.equal(evidence.decision.m3PlanningReady, true);
  assert.equal(evidence.decision.m3ImplementationStarted, false);
  assert.equal(evidence.decision.nextRequiredSlice, 'M3-R0');
  assert.deepEqual(evidence.decision.repositoryBlockers, []);
  assert.ok(Object.values(evidence.safetyBoundary).every((value) => value === false));
});

test('M2 final closure canonical digest is stable', async () => {
  const closure = await loadM2FinalReleaseClosure();
  assert.equal(canonicalDigest(closure),
    'sha256:7b4c3165e3913d857e45cb22f918cde0ae6cbacdd0f8298b45209c87ca297f2b');
});

test('M2 final closure rejects a changed main merge SHA', async () => {
  const closure = await cloneClosure();
  closure.source.mergeSha = 'a'.repeat(40);
  await assert.rejects(validateM2FinalReleaseClosure(options({ closure })),
    /source|canonical digest/);
});

test('M2 final closure rejects a changed observation Artifact', async () => {
  const closure = await cloneClosure();
  closure.postMergeVerification.observer.artifact.id += 1;
  await assert.rejects(validateM2FinalReleaseClosure(options({ closure })),
    /observer Artifact|canonical digest/);
});

test('M2 final closure rejects an environment promotion claim', async () => {
  const closure = await cloneClosure();
  closure.decision.environmentPromotionEvaluated = true;
  closure.decision.environmentPromotionEligible = true;
  await assert.rejects(validateM2FinalReleaseClosure(options({ closure })),
    /decision|canonical digest/);
});

test('M2 final closure rejects starting M3 implementation', async () => {
  const closure = await cloneClosure();
  closure.decision.m3ImplementationStarted = true;
  closure.safetyBoundary.executionAdapterImplemented = true;
  await assert.rejects(validateM2FinalReleaseClosure(options({ closure })),
    /decision|safety boundary|canonical digest/);
});

test('M2 final closure rejects stale release documentation', async () => {
  await assert.rejects(validateM2FinalReleaseClosure(options({
    releaseDoc: '# M2-RC1\n\nM2 堆叠尚未合并。',
  })), /release document remains stale/);
});

test('M2 final closure rejects an execution-capable M3-R0 roadmap', async () => {
  await assert.rejects(validateM2FinalReleaseClosure(options({
    m3Roadmap: '# M3-R0\n\n直接调用 k6，并创建 Worker。',
  })), /M3-R0 contract-only boundary/);
});

test('M2 final closure rejects an explicit blank evidence branch', async () => {
  await assert.rejects(validateM2FinalReleaseClosure(options({ branch: '   ' })),
    /evidence branch/);
});

test('M2 final closure record contains no secret values', async () => {
  const text = await readFile('releases/m2/final-release-closure.json', 'utf8');
  for (const pattern of [
    /postgres(?:ql)?:\/\//i,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /"password"\s*:/i,
    /"token"\s*:/i,
  ]) assert.doesNotMatch(text, pattern);
});
