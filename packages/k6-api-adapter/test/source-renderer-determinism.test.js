import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clone,
  createK6ApiSourceGeneratorDescriptor,
  renderK6ApiSource,
  rendererBindings,
  reverseObjectKeys,
} from './source-renderer-test-support.js';

test('same immutable input renders byte-for-byte identical Source', () => {
  const input = rendererBindings();
  const first = renderK6ApiSource(input);
  const second = renderK6ApiSource(clone(input));
  assert.equal(first.source, second.source);
  assert.equal(first.sourceDigest, second.sourceDigest);
  assert.equal(first.resultDigest, second.resultDigest);
});

test('object field insertion order does not affect Source or identity', () => {
  const input = rendererBindings();
  const reordered = reverseObjectKeys(input);
  const first = renderK6ApiSource(input);
  const second = renderK6ApiSource(reordered);
  assert.equal(first.source, second.source);
  assert.deepEqual(first.sourceIdentity, second.sourceIdentity);
});

test('sortable collection order does not affect canonical Source bytes', () => {
  const first = renderK6ApiSource(rendererBindings());
  const second = renderK6ApiSource(rendererBindings({
    transformSpec(spec) {
      spec.capabilities.reverse();
      spec.requestGroups.reverse();
      for (const group of spec.requestGroups) {
        group.operations.reverse();
        for (const operation of group.operations) {
          operation.assertions.reverse();
          operation.thresholds.reverse();
          operation.tags.reverse();
          operation.sourceDependencyIntentIds.reverse();
          operation.dependencyOperationIds.reverse();
          for (const assertion of operation.assertions) {
            if (assertion.kind === 'STATUS_CODE_IN') assertion.expected.reverse();
          }
        }
      }
      spec.inputArtifacts.reverse();
    },
  }));
  assert.equal(first.source, second.source);
  assert.equal(first.sourceDigest, second.sourceDigest);
});

test('volatile request metadata does not affect Source identity or Source bytes', () => {
  const first = renderK6ApiSource(rendererBindings({
    requestedAt: '2026-07-31T07:00:00.000Z', requestedBy: 'renderer-one',
  }));
  const second = renderK6ApiSource(rendererBindings({
    requestedAt: '2026-08-01T08:30:00.000Z', requestedBy: 'renderer-two',
  }));
  assert.notEqual(first.generationRequestDigest, second.generationRequestDigest);
  assert.deepEqual(first.sourceIdentity, second.sourceIdentity);
  assert.equal(first.source, second.source);
});

test('P1 rendering policy and descriptor digests remain fixed', () => {
  const descriptor = createK6ApiSourceGeneratorDescriptor();
  assert.equal(descriptor.renderingPolicy.policyDigest,
    '4e5a423ac56c80c65bea05fad297dd03a0238b5b0bd6136f150177195b58aa22');
  assert.equal(descriptor.descriptorDigest,
    '97a6e5022797323120c0feaf2d317443167a4f545413c6927448becf55c51ad9');
});
