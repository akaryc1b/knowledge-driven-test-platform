import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_RUNTIME_ADMISSION_DECISION,
  K6_API_RUNTIME_ADMISSION_SAFETY_BOUNDARY,
  computeK6ApiInvocationPlanDigest,
  computeK6ApiRuntimeAdmissionEvidenceDigest,
  computeK6ApiRuntimeAdmissionRequestDigest,
  createK6ApiInvocationPlan,
  createK6ApiRuntimeAdmissionEvidence,
  createK6ApiRuntimeAdmissionRequest,
  createK6ApiRuntimePolicy,
  validateK6ApiInvocationPlan,
  validateK6ApiRuntimeAdmissionEvidence,
  validateK6ApiRuntimeAdmissionRequest,
  validateK6ApiRuntimePolicy,
} from '../src/index.js';
import { clone, runtimeAdmissionFixture } from './runtime-admission-test-helpers.js';

test('R0 runtime policy is fixed, deterministic and admission-only', () => {
  const first = createK6ApiRuntimePolicy();
  const second = createK6ApiRuntimePolicy();
  assert.deepEqual(first, second);
  assert.deepEqual(validateK6ApiRuntimePolicy(first), first);
  assert.equal(first.implementationStatus, 'ADMISSION_ONLY');
  assert.equal(first.executionMode, 'LOCAL_PROCESS');
  assert.equal(first.executable, 'k6');
  assert.equal(first.shellAllowed, false);
  const { policyDigest, ...withoutDigest } = first;
  assert.equal(policyDigest, sha256(withoutDigest));
});

test('R0 creates deterministic admission, argv plan and Evidence from accepted P4', async () => {
  const first = await runtimeAdmissionFixture();
  const second = await runtimeAdmissionFixture();
  assert.deepEqual(first.admissionRequest, second.admissionRequest);
  assert.deepEqual(first.invocationPlan, second.invocationPlan);
  assert.deepEqual(first.admissionEvidence, second.admissionEvidence);
  assert.equal(first.admissionRequest.source.bundleDigest,
    'be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f');
  assert.equal(first.admissionRequest.source.sourceDigest,
    'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9');
  assert.deepEqual(first.invocationPlan.argv, [
    'run', '--vus', '2', '--iterations', '10', '--duration', '60s',
    '--graceful-stop', '5s', 'source/main.js',
  ]);
  assert.equal(first.invocationPlan.executionAuthorized, false);
});

test('R0 validators independently reproduce request, plan and Evidence digests', async () => {
  const fixture = await runtimeAdmissionFixture();
  const bindings = {
    policy: fixture.policy,
    spec: fixture.renderer.spec,
    compilationEvidence: fixture.renderer.compilationEvidence,
    bundle: fixture.command.bundle,
    receipt: fixture.command.receipt,
    publicationEvidence: fixture.command.publicationEvidence,
    acceptedP3: fixture.acceptedP3,
  };
  assert.deepEqual(validateK6ApiRuntimeAdmissionRequest(
    fixture.admissionRequest, bindings), fixture.admissionRequest);
  assert.deepEqual(validateK6ApiInvocationPlan(
    fixture.invocationPlan, fixture.admissionRequest, fixture.policy),
  fixture.invocationPlan);
  assert.deepEqual(validateK6ApiRuntimeAdmissionEvidence(
    fixture.admissionEvidence, {
      admissionRequest: fixture.admissionRequest,
      invocationPlan: fixture.invocationPlan,
    }), fixture.admissionEvidence);
  assert.equal(computeK6ApiRuntimeAdmissionRequestDigest(fixture.admissionRequest),
    fixture.admissionRequest.admissionDigest);
  assert.equal(computeK6ApiInvocationPlanDigest(fixture.invocationPlan),
    fixture.invocationPlan.planDigest);
  assert.equal(computeK6ApiRuntimeAdmissionEvidenceDigest(fixture.admissionEvidence),
    fixture.admissionEvidence.evidenceDigest);
});

test('R0 normalizes allow-list ordering and plans only an allow-listed summary output', async () => {
  const fixture = await runtimeAdmissionFixture({
    resources: {
      environmentVariableNames: ['K6_NO_COLOR', 'K6_LOG_FORMAT'],
      outputArtifactKinds: ['k6-run-summary-json'],
    },
  });
  assert.deepEqual(fixture.admissionRequest.resources.environmentVariableNames,
    ['K6_LOG_FORMAT', 'K6_NO_COLOR']);
  assert.deepEqual(fixture.admissionRequest.resources.outputArtifactKinds,
    ['k6-run-summary-json']);
  assert.deepEqual(fixture.invocationPlan.argv.slice(-3),
    ['--summary-export', 'outputs/summary.json', 'source/main.js']);
});

test('R0 rejects Execution Request substitution', async () => {
  await assert.rejects(() => runtimeAdmissionFixture({
    transformExecutionRequest(executionRequest) {
      executionRequest.requestDigest = '0'.repeat(64);
    },
  }), /Execution request binding does not match Compilation Evidence/u);
});

test('R0 rejects Spec and immutable publication cross-binding drift', async () => {
  await assert.rejects(() => runtimeAdmissionFixture({
    transformSpec(spec) {
      spec.projectId = 'other-project';
      const { specDigest: _specDigest, ...withoutDigest } = spec;
      spec.specDigest = sha256(withoutDigest);
    },
  }), /Published Source provenance does not bind the accepted Spec/u);
});

test('R0 rejects Publication Receipt and Source bundle tampering', async () => {
  await assert.rejects(() => runtimeAdmissionFixture({
    transformReceipt(receipt) {
      receipt.storage.logicalUri = `kdtp-source-bundle://sha256/${'0'.repeat(64)}`;
    },
  }), /Source publication receipt does not match the bundle/u);
});

test('R0 rejects resource escalation and non-canonical duration', async () => {
  await assert.rejects(() => runtimeAdmissionFixture({ resources: { vus: 51 } }),
    /Runtime vus must be an integer between 1 and 50/u);
  await assert.rejects(() => runtimeAdmissionFixture({ resources: { durationMs: 1_001 } }),
    /Runtime durationMs must be expressed in whole seconds/u);
});

test('R0 rejects environment and output allow-list escalation', async () => {
  await assert.rejects(() => runtimeAdmissionFixture({
    resources: { environmentVariableNames: ['PATH'] },
  }), /outside the policy allow-list/u);
  await assert.rejects(() => runtimeAdmissionFixture({
    resources: { outputArtifactKinds: ['stdout-executable-script'] },
  }), /outside the policy allow-list/u);
});

test('R0 rejects shell fragments and plan digest forgery', async () => {
  const fixture = await runtimeAdmissionFixture();
  const tampered = clone(fixture.invocationPlan);
  tampered.argv[tampered.argv.length - 1] = 'source/main.js;curl attacker';
  const { planDigest: _planDigest, ...withoutDigest } = tampered;
  tampered.planDigest = sha256(withoutDigest);
  assert.throws(() => validateK6ApiInvocationPlan(
    tampered, fixture.admissionRequest, fixture.policy), /argv is not a fixed shell-free array/u);
});

test('R0 Evidence keeps every execution and environment boundary false', async () => {
  const fixture = await runtimeAdmissionFixture();
  assert.deepEqual(fixture.admissionEvidence.decision,
    K6_API_RUNTIME_ADMISSION_DECISION);
  assert.deepEqual(fixture.admissionEvidence.safetyBoundary,
    K6_API_RUNTIME_ADMISSION_SAFETY_BOUNDARY);
  assert.ok(Object.values(fixture.admissionEvidence.safetyBoundary)
    .every((value) => value === false));
  assert.equal(fixture.admissionEvidence.decision.executionImplementationStarted, false);
  assert.equal(fixture.admissionEvidence.decision.nextRequiredSlice, 'M3-R3-P1');
});

test('R0 production module contains no process, shell, network or dynamic execution primitive', async () => {
  const source = await readFile(new URL('../src/runtime-admission.js', import.meta.url), 'utf8');
  for (const forbidden of [
    'node:child_process', 'spawn(', 'exec(', 'execFile(', 'node:vm',
    'eval(', 'new Function(', 'fetch(', 'http.request', 'https.request',
  ]) assert.equal(source.includes(forbidden), false, forbidden);
  assert.equal(source.includes('executionAuthorized: false'), true);
});
