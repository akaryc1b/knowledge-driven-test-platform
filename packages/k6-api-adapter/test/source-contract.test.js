import test from 'node:test';
import assert from 'node:assert/strict';
import {
  K6_API_SOURCE_ALLOWED_MODULES,
  K6_API_SOURCE_FORMAT_VERSION,
  K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
  K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
  K6_API_SOURCE_IMPLEMENTATION_STATUS,
  K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
  canonicalStringifyK6ApiSourceContract,
  computeK6ApiCompilationEvidenceDigest,
  computeK6ApiSourceGenerationRequestDigest,
  createK6ApiSourceGenerationRequest,
  createK6ApiSourceGeneratorDescriptor,
  createK6ApiSourceRenderingPolicy,
  validateK6ApiSourceGenerationRequest,
  validateK6ApiSourceGeneratorDescriptor,
  validateK6ApiSourceRenderingPolicy,
} from '../src/index.js';
import { compilation } from './test-helpers.js';

const REQUESTED_AT = '2026-07-31T05:00:00.000Z';
const REQUESTED_BY = 'm3-r2-p1-contract-test';

async function fixture(overrides = {}) {
  const compiled = await compilation();
  const descriptor = createK6ApiSourceGeneratorDescriptor();
  const command = {
    descriptor,
    spec: compiled.spec,
    bundle: compiled.bundle,
    compilationEvidence: compiled.evidence,
    requestedAt: REQUESTED_AT,
    requestedBy: REQUESTED_BY,
    ...overrides,
  };
  return {
    compiled,
    descriptor,
    request: createK6ApiSourceGenerationRequest(command),
    command,
  };
}

test('P1 rendering policy and generator descriptor are fixed deterministic contracts', () => {
  const policy = createK6ApiSourceRenderingPolicy();
  assert.equal(policy.schemaVersion, K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION);
  assert.equal(policy.encoding, 'UTF-8');
  assert.equal(policy.lineEnding, 'LF');
  assert.equal(policy.indentationSpaces, 2);
  assert.equal(policy.trailingNewline, true);
  assert.deepEqual(validateK6ApiSourceRenderingPolicy(policy), policy);

  const descriptor = createK6ApiSourceGeneratorDescriptor();
  assert.equal(descriptor.schemaVersion,
    K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION);
  assert.equal(descriptor.implementationStatus, K6_API_SOURCE_IMPLEMENTATION_STATUS);
  assert.equal(descriptor.sourceFormatVersion, K6_API_SOURCE_FORMAT_VERSION);
  assert.deepEqual(descriptor.allowedModules, [...K6_API_SOURCE_ALLOWED_MODULES]);
  assert.deepEqual(validateK6ApiSourceGeneratorDescriptor(descriptor), descriptor);
  assert.deepEqual(createK6ApiSourceGeneratorDescriptor(), descriptor);
});

test('P1 request binds exact M3-R1 Spec, Bundle and Compilation Evidence', async () => {
  const { compiled, descriptor, request } = await fixture();
  assert.equal(request.schemaVersion, K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION);
  assert.equal(request.generator.descriptorDigest, descriptor.descriptorDigest);
  assert.equal(request.input.specDigest, compiled.spec.specDigest);
  assert.equal(request.input.bundleDigest, compiled.bundle.bundleDigest);
  assert.equal(request.input.compilationEvidenceDigest, compiled.evidence.evidenceDigest);
  assert.equal(request.sourceIdentity.specDigest, compiled.spec.specDigest);
  assert.equal(request.sourceIdentity.sourceFormatVersion, K6_API_SOURCE_FORMAT_VERSION);
  assert.equal(computeK6ApiSourceGenerationRequestDigest(request), request.requestDigest);
  assert.deepEqual(validateK6ApiSourceGenerationRequest(request, {
    descriptor,
    spec: compiled.spec,
    bundle: compiled.bundle,
    compilationEvidence: compiled.evidence,
  }), request);
});

test('P1 source identity excludes request metadata but request digest preserves it', async () => {
  const { command, request } = await fixture();
  const changedMetadata = createK6ApiSourceGenerationRequest({
    ...command,
    requestedAt: '2026-07-31T05:01:00.000Z',
    requestedBy: 'another-contract-client',
  });
  assert.equal(changedMetadata.requestId, request.requestId);
  assert.deepEqual(changedMetadata.sourceIdentity, request.sourceIdentity);
  assert.notEqual(changedMetadata.requestDigest, request.requestDigest);
});

test('P1 request is stable across object insertion order', async () => {
  const { command, request } = await fixture();
  const reordered = {
    requestedBy: command.requestedBy,
    compilationEvidence: structuredClone(command.compilationEvidence),
    bundle: structuredClone(command.bundle),
    requestedAt: command.requestedAt,
    spec: structuredClone(command.spec),
    descriptor: structuredClone(command.descriptor),
  };
  assert.equal(
    canonicalStringifyK6ApiSourceContract(
      createK6ApiSourceGenerationRequest(reordered)),
    canonicalStringifyK6ApiSourceContract(request),
  );
});

test('P1 rejects Spec, Bundle and Compilation Evidence tampering', async () => {
  const { command } = await fixture();
  for (const [field, changed] of [
    ['spec', { ...command.spec, projectId: 'different-project' }],
    ['bundle', { ...command.bundle, specId: 'k6spec-00000000000000000000' }],
    ['compilationEvidence', {
      ...command.compilationEvidence,
      decision: { ...command.compilationEvidence.decision, k6Invoked: true },
    }],
  ]) {
    assert.throws(() => createK6ApiSourceGenerationRequest({
      ...command,
      [field]: changed,
    }));
  }
});

test('P1 rejects recomputed Evidence with altered manifest, capability or intent bindings', async () => {
  const { command } = await fixture();
  const mutations = [
    (evidence) => { evidence.capabilityDigest = 'a'.repeat(64); },
    (evidence) => { evidence.artifactManifestDigest = 'b'.repeat(64); },
    (evidence) => { evidence.sourceIntentIds = ['intent-outside-accepted-spec']; },
  ];
  for (const mutate of mutations) {
    const evidence = structuredClone(command.compilationEvidence);
    mutate(evidence);
    evidence.evidenceDigest = computeK6ApiCompilationEvidenceDigest(evidence);
    assert.throws(() => createK6ApiSourceGenerationRequest({
      ...command,
      compilationEvidence: evidence,
    }));
  }
});

test('P1 rejects module, policy, limit and descriptor escalation', async () => {
  const { command, descriptor } = await fixture();
  for (const changed of [
    { ...descriptor, allowedModules: [...descriptor.allowedModules, 'k6/ws'] },
    {
      ...descriptor,
      renderingPolicy: {
        ...descriptor.renderingPolicy,
        trailingNewline: false,
      },
    },
    {
      ...descriptor,
      limits: {
        ...descriptor.limits,
        maxOperations: descriptor.limits.maxOperations + 1,
      },
    },
    { ...descriptor, implementationStatus: 'IMPLEMENTED' },
  ]) {
    assert.throws(() => createK6ApiSourceGenerationRequest({
      ...command,
      descriptor: changed,
    }), (error) => error.code === 'K6_API_SOURCE_GENERATOR_DESCRIPTOR_MISMATCH');
  }
});

test('P1 rejects executable, network, filesystem and unknown source material', async () => {
  const { command } = await fixture();
  for (const requestedBy of [
    'function payload() { return 1; }',
    'https://target.example.test',
    '/tmp/runtime-output',
  ]) {
    assert.throws(() => createK6ApiSourceGenerationRequest({
      ...command,
      requestedBy,
    }));
  }
  assert.throws(() => createK6ApiSourceGenerationRequest({
    ...command,
    javascriptSource: 'export default function () {}',
  }), (error) => error.code === 'INVALID_K6_API_SOURCE_GENERATION_COMMAND');
});

test('P1 request contains no generated source, runtime or artifact output fields', async () => {
  const { request } = await fixture();
  const serialized = JSON.stringify(request);
  for (const field of [
    'sourceText', 'sourceBytes', 'generatedSource', 'javascriptSource',
    'runtimeCommand', 'artifactManifest', 'executionResult',
  ]) {
    assert.equal(serialized.includes(`"${field}"`), false);
  }
});
