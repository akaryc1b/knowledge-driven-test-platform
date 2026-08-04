import test from 'node:test';
import assert from 'node:assert/strict';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_PROCESS_BOUNDARY_DECISION,
  K6_PROCESS_BOUNDARY_SAFETY,
  computeK6LocalProcessPortDigest,
  computeK6ProcessBoundaryEvidenceDigest,
  computeK6ProcessLaunchDecisionDigest,
  computeK6ProcessLaunchSpecificationDigest,
  createK6LocalProcessPortDescriptor,
  createK6LocalProcessPortReceipt,
  createK6ProcessBoundaryEvidence,
  createK6ProcessLaunchDecision,
  createK6ProcessLaunchSpecification,
  prepareK6LocalProcessLaunch,
  validateK6LocalProcessPortDescriptor,
  validateK6ProcessBoundaryEvidence,
  validateK6ProcessLaunchDecision,
  validateK6ProcessLaunchSpecification,
} from '../src/local-process-boundary.js';
import { clone, runtimeAdmissionFixture } from './runtime-admission-test-helpers.js';
import {
  fakeLocalProcessPort,
  localProcessBoundaryFixture,
} from './local-process-boundary-test-helpers.js';

function redigest(value, field) {
  const copy = clone(value);
  delete copy[field];
  value[field] = sha256(copy);
  return value;
}

function runtimeBindings(runtime) {
  return {
    policy: runtime.policy,
    admissionRequest: runtime.admissionRequest,
    invocationPlan: runtime.invocationPlan,
    admissionEvidence: runtime.admissionEvidence,
  };
}

function launchBindings(fixture) {
  return {
    portDescriptor: fixture.descriptor,
    launchSpecification: fixture.result.launchSpecification,
    portReceipt: fixture.result.launchDecision.portReceipt,
  };
}

test('P1 creates deterministic closed local process boundary contracts', async () => {
  const first = await localProcessBoundaryFixture();
  const second = await localProcessBoundaryFixture();
  assert.deepEqual(first.result, second.result);
  assert.equal(computeK6LocalProcessPortDigest(first.descriptor), first.descriptor.portDigest);
  assert.equal(computeK6ProcessLaunchSpecificationDigest(first.result.launchSpecification),
    first.result.launchSpecification.specificationDigest);
  assert.equal(computeK6ProcessLaunchDecisionDigest(first.result.launchDecision),
    first.result.launchDecision.decisionDigest);
  assert.equal(computeK6ProcessBoundaryEvidenceDigest(first.result.boundaryEvidence),
    first.result.boundaryEvidence.evidenceDigest);
  assert.equal(first.calls.length, 1);
});

test('P1 launch specification is shell-free and denies host inputs', async () => {
  const { runtime, result } = await localProcessBoundaryFixture();
  const specification = result.launchSpecification;
  assert.equal(specification.executable, 'k6');
  assert.deepEqual(specification.argv, runtime.invocationPlan.argv);
  assert.equal(specification.shell, false);
  assert.equal(specification.workingDirectory.absolutePathIncluded, false);
  assert.equal(specification.environment.valuesIncluded, false);
  assert.equal(specification.environment.inheritHostEnvironment, false);
  assert.deepEqual(specification.environment.allowedNames,
    runtime.invocationPlan.environmentVariableNames);
  assert.equal(specification.stdin.mode, 'DISABLED');
  assert.equal(specification.stdin.contentIncluded, false);
  assert.equal(specification.stdout.collected, false);
  assert.equal(specification.stderr.collected, false);
  assert.equal(specification.processStartAuthorized, false);
});

test('P1 fake port receives one frozen defensive launch specification', async () => {
  const { calls, result } = await localProcessBoundaryFixture();
  assert.equal(calls.length, 1);
  assert.ok(Object.isFrozen(calls[0]));
  assert.ok(Object.isFrozen(calls[0].argv));
  assert.notEqual(calls[0], result.launchSpecification);
  assert.deepEqual(calls[0], result.launchSpecification);
});

test('P1 decision and Evidence preserve every non-execution claim', async () => {
  const { result } = await localProcessBoundaryFixture();
  assert.deepEqual(result.launchDecision.decision, K6_PROCESS_BOUNDARY_DECISION);
  assert.deepEqual(result.boundaryEvidence.decision, K6_PROCESS_BOUNDARY_DECISION);
  assert.deepEqual(result.launchDecision.safetyBoundary, K6_PROCESS_BOUNDARY_SAFETY);
  assert.deepEqual(result.boundaryEvidence.safetyBoundary, K6_PROCESS_BOUNDARY_SAFETY);
  assert.ok(Object.values(result.boundaryEvidence.safetyBoundary)
    .every((value) => value === false));
});

test('P1 validators reproduce all accepted contracts', async () => {
  const fixture = await localProcessBoundaryFixture();
  assert.deepEqual(validateK6LocalProcessPortDescriptor(fixture.descriptor), fixture.descriptor);
  assert.deepEqual(validateK6ProcessLaunchSpecification(
    fixture.result.launchSpecification, runtimeBindings(fixture.runtime)),
  fixture.result.launchSpecification);
  assert.deepEqual(validateK6ProcessLaunchDecision(
    fixture.result.launchDecision, launchBindings(fixture)), fixture.result.launchDecision);
  assert.deepEqual(validateK6ProcessBoundaryEvidence(fixture.result.boundaryEvidence, {
    ...runtimeBindings(fixture.runtime),
    portDescriptor: fixture.descriptor,
    launchSpecification: fixture.result.launchSpecification,
    launchDecision: fixture.result.launchDecision,
  }), fixture.result.boundaryEvidence);
});

test('P1 fails closed when the injected port is absent', async () => {
  const runtime = await runtimeAdmissionFixture();
  assert.throws(() => prepareK6LocalProcessLaunch({
    localProcessPort: null,
    ...runtimeBindings(runtime),
  }), /injected LocalProcessPort/u);
});

test('P1 fails closed when the injected port has no method', async () => {
  const runtime = await runtimeAdmissionFixture();
  assert.throws(() => prepareK6LocalProcessLaunch({
    localProcessPort: { descriptor: createK6LocalProcessPortDescriptor() },
    ...runtimeBindings(runtime),
  }), /must accept a launch specification/u);
});

test('P1 fails closed when the injected port throws', async () => {
  const runtime = await runtimeAdmissionFixture();
  assert.throws(() => prepareK6LocalProcessLaunch({
    localProcessPort: {
      descriptor: createK6LocalProcessPortDescriptor(),
      acceptLaunchSpecification() { throw new Error('rejected'); },
    },
    ...runtimeBindings(runtime),
  }), /rejected the launch specification/u);
});

test('P1 rejects executable substitution', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.executable = 'bash';
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /widens the P1 non-execution boundary/u);
});

for (const fragment of [';', '&&', '|', '`id`', '$(id)']) {
  test(`P1 rejects argv shell fragment ${fragment}`, async () => {
    const fixture = await localProcessBoundaryFixture();
    const forged = clone(fixture.result.launchSpecification);
    forged.argv.splice(1, 0, fragment);
    redigest(forged, 'specificationDigest');
    assert.throws(() => validateK6ProcessLaunchSpecification(
      forged, runtimeBindings(fixture.runtime)), /shell-free string array/u);
  });
}

test('P1 rejects command-string replacement for argv', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.argv = 'run source/main.js';
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /shell-free string array/u);
});

test('P1 rejects shell=true', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.shell = true;
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /widens the P1 non-execution boundary/u);
});

for (const logicalName of [
  '/tmp/bundle', '../bundle', 'C:\\bundle', '\\\\server\\share',
  'file:///tmp/bundle', 'bundle\0name',
]) {
  test(`P1 rejects arbitrary working directory ${JSON.stringify(logicalName)}`, async () => {
    const fixture = await localProcessBoundaryFixture();
    const forged = clone(fixture.result.launchSpecification);
    forged.workingDirectory.logicalName = logicalName;
    redigest(forged, 'specificationDigest');
    assert.throws(() => validateK6ProcessLaunchSpecification(
      forged, runtimeBindings(fixture.runtime)), /widens the P1 non-execution boundary/u);
  });
}

test('P1 rejects an unapproved environment variable name', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.environment.allowedNames.push('PATH');
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /Runtime Policy allow-list/u);
});

test('P1 rejects environment values', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.environment.values = { K6_NO_COLOR: '1' };
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /fields do not match/u);
});

test('P1 rejects full host environment inheritance', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.environment.inheritHostEnvironment = true;
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /widens the P1 non-execution boundary/u);
});

test('P1 rejects stdin content injection', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.launchSpecification);
  forged.stdin.content = 'command';
  redigest(forged, 'specificationDigest');
  assert.throws(() => validateK6ProcessLaunchSpecification(
    forged, runtimeBindings(fixture.runtime)), /fields do not match/u);
});

for (const field of [
  'runtimePolicyDigest', 'runtimeAdmissionRequestDigest',
  'invocationPlanDigest', 'runtimeAdmissionEvidenceDigest',
]) {
  test(`P1 rejects predecessor digest drift in ${field}`, async () => {
    const fixture = await localProcessBoundaryFixture();
    const forged = clone(fixture.result.launchSpecification);
    forged[field] = 'f'.repeat(64);
    redigest(forged, 'specificationDigest');
    assert.throws(() => validateK6ProcessLaunchSpecification(
      forged, runtimeBindings(fixture.runtime)), /does not match the accepted runtime chain/u);
  });
}

test('P1 rejects an unaccepted Source Bundle through invocation binding', async () => {
  const runtime = await runtimeAdmissionFixture();
  const plan = clone(runtime.invocationPlan);
  plan.source.bundleDigest = 'f'.repeat(64);
  redigest(plan, 'planDigest');
  assert.throws(() => createK6ProcessLaunchSpecification({
    ...runtimeBindings(runtime), invocationPlan: plan,
  }), /does not match the admitted immutable Source bundle/u);
});

test('P1 rejects an unbound fake-port receipt', async () => {
  const runtime = await runtimeAdmissionFixture();
  const descriptor = createK6LocalProcessPortDescriptor();
  const port = fakeLocalProcessPort(descriptor, (receipt) => ({
    ...receipt, launchSpecificationDigest: 'f'.repeat(64),
  }));
  assert.throws(() => prepareK6LocalProcessLaunch({
    localProcessPort: port, ...runtimeBindings(runtime),
  }), /unbound or claims process execution/u);
});

for (const field of [
  'processStarted', 'processIdCreated', 'k6Invoked', 'externalProcessExecuted',
]) {
  test(`P1 rejects fake-port execution claim ${field}`, async () => {
    const runtime = await runtimeAdmissionFixture();
    const descriptor = createK6LocalProcessPortDescriptor();
    const port = fakeLocalProcessPort(descriptor, (receipt) => ({ ...receipt, [field]: true }));
    assert.throws(() => prepareK6LocalProcessLaunch({
      localProcessPort: port, ...runtimeBindings(runtime),
    }), /unbound or claims process execution/u);
  });
}

test('P1 rejects Evidence execution escalation', async () => {
  const fixture = await localProcessBoundaryFixture();
  const forged = clone(fixture.result.boundaryEvidence);
  forged.safetyBoundary.k6Invoked = true;
  redigest(forged, 'evidenceDigest');
  assert.throws(() => validateK6ProcessBoundaryEvidence(forged, {
    ...runtimeBindings(fixture.runtime),
    portDescriptor: fixture.descriptor,
    launchSpecification: fixture.result.launchSpecification,
    launchDecision: fixture.result.launchDecision,
  }), /violates the P1 non-execution decision/u);
});

test('P1 constructors defensively copy and freeze caller input', async () => {
  const runtime = await runtimeAdmissionFixture();
  const specification = createK6ProcessLaunchSpecification(runtimeBindings(runtime));
  const descriptor = createK6LocalProcessPortDescriptor();
  const receipt = createK6LocalProcessPortReceipt(descriptor, specification);
  const decision = createK6ProcessLaunchDecision({
    portDescriptor: descriptor, launchSpecification: specification, portReceipt: receipt,
  });
  const evidence = createK6ProcessBoundaryEvidence({
    ...runtimeBindings(runtime), portDescriptor: descriptor,
    launchSpecification: specification, launchDecision: decision,
  });
  for (const value of [descriptor, specification, decision, evidence]) {
    assert.ok(Object.isFrozen(value));
  }
});
