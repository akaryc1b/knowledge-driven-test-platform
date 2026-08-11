import {
  createK6OutputArtifactResolutionReceipt,
  createK6OutputRootAllocationReceipt,
  createK6TrustedOutputRootPortDescriptor,
  prepareK6TrustedOutputRoot,
} from '../src/index.js';
import { outputRootContractFixture } from './output-root-contract-test-helpers.js';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function createTrustedOutputRootFake(options = {}) {
  const descriptor = createK6TrustedOutputRootPortDescriptor();
  const calls = { allocateRoot: [], resolveArtifact: [] };
  return {
    descriptor,
    calls,
    allocateRoot(request) {
      calls.allocateRoot.push(request);
      if (options.allocationError) throw options.allocationError;
      const receipt = createK6OutputRootAllocationReceipt(descriptor, request);
      return typeof options.mutateAllocationReceipt === 'function'
        ? options.mutateAllocationReceipt(clone(receipt), request)
        : receipt;
    },
    resolveArtifact(request) {
      calls.resolveArtifact.push(request);
      if (options.resolutionError) throw options.resolutionError;
      const receipt = createK6OutputArtifactResolutionReceipt(descriptor, request);
      return typeof options.mutateResolutionReceipt === 'function'
        ? options.mutateResolutionReceipt(clone(receipt), request)
        : receipt;
    },
  };
}

export async function trustedOutputRootPortFixture(options = {}) {
  const p1 = options.p1Fixture
    ?? await outputRootContractFixture(options.p1Options);
  const trustedOutputRootPort = options.trustedOutputRootPort
    ?? createTrustedOutputRootFake(options.fakeOptions);
  const prepared = prepareK6TrustedOutputRoot({
    trustedOutputRootPort,
    rootContract: p1.outputRootContract,
    contractBindings: p1.contractBindings,
  });
  return Object.freeze({
    p1,
    trustedOutputRootPort,
    ...prepared,
  });
}
