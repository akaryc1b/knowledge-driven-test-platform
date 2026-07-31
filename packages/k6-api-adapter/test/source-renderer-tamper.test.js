import test from 'node:test';
import {
  clone,
  expectRejected,
  renderK6ApiSource,
  rendererBindings,
} from './source-renderer-test-support.js';

for (const [name, mutate] of [
  ['Spec digest', (input) => { input.spec.specDigest = '0'.repeat(64); }],
  ['Bundle digest', (input) => { input.bundle.bundleDigest = '0'.repeat(64); }],
  ['Compilation Evidence digest', (input) => {
    input.compilationEvidence.evidenceDigest = '0'.repeat(64);
  }],
  ['capability binding', (input) => { input.spec.capabilities[0].version = '2.0.0'; }],
  ['Artifact manifest binding', (input) => {
    input.bundle.artifactManifest[0].digest = 'a'.repeat(64);
  }],
  ['intent-set binding', (input) => { input.compilationEvidence.sourceIntentIds.pop(); }],
  ['Rendering Policy', (input) => { input.descriptor.renderingPolicy.indentationSpaces = 4; }],
  ['Generator Descriptor', (input) => { input.descriptor.generatorVersion = '2.0.0'; }],
  ['module allow-list expansion', (input) => {
    input.descriptor.allowedModules.push('k6/experimental/fs');
  }],
  ['resource limit expansion', (input) => { input.descriptor.limits.maxOperations += 1; }],
]) test(`${name} tampering fails closed`, () => {
  const input = clone(rendererBindings());
  mutate(input);
  expectRejected(() => renderK6ApiSource(input));
});

test('unbound query parameter declarations fail closed', () => {
  const input = rendererBindings({
    transformSpec(spec) {
      spec.requestGroups[1].operations[0].queryParameters = [{
        name: 'dryRun', required: false, source: 'CONSTANT_METADATA',
      }];
    },
  });
  expectRejected(() => renderK6ApiSource(input), /bound values|query/i);
});

test('request body Artifact mismatch fails closed', () => {
  const input = rendererBindings({
    transformSpec(spec) {
      const operation = spec.requestGroups[1].operations.find((item) => item.requestBodyArtifact);
      operation.requestBodyArtifact.digest = 'a'.repeat(64);
      operation.requestBodyArtifact.uri = `artifact://sha256/${'a'.repeat(64)}`;
    },
  });
  expectRejected(() => renderK6ApiSource(input), /Artifact reference|Artifact/i);
});

test('operation capability not present in Spec capability set fails closed', () => {
  const input = rendererBindings({
    transformSpec(spec) {
      spec.requestGroups[0].operations[0].capability.version = '2.0.0';
    },
  });
  expectRejected(() => renderK6ApiSource(input), /capability/i);
});

test('unsupported operation field after binding fails closed', () => {
  const input = rendererBindings();
  input.spec.requestGroups[0].operations[0].unsupportedField = true;
  expectRejected(() => renderK6ApiSource(input));
});

test('dependency cycle fails closed', () => {
  const input = rendererBindings({
    transformSpec(spec) {
      const group = spec.requestGroups.find((item) => item.groupId.includes('aaaaaaaa'));
      const [status, submit] = group.operations;
      submit.dependencyOperationIds = [status.operationId];
      submit.sourceDependencyIntentIds = [status.sourceIntentId];
    },
  });
  expectRejected(() => renderK6ApiSource(input), /cycle/i);
});
