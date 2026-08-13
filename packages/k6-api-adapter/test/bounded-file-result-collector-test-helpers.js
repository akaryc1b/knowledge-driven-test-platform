import {
  collectK6BoundedFileResult,
  createK6BoundedResultCollectorPortDescriptor,
  createK6OutputArtifactInspectionReceipt,
  createK6OutputArtifactPayloadReceipt,
  createK6OutputRootSealReceipt,
} from '../src/index.js';
import { trustedOutputRootPortFixture } from './trusted-output-root-port-test-helpers.js';

export const DEFAULT_K6_SUMMARY_JSON =
  '{"metrics":{"checks":{"passes":3,"fails":0}},"state":"complete"}\n';

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export function encodeK6SummaryJson(text = DEFAULT_K6_SUMMARY_JSON) {
  return new TextEncoder().encode(text);
}

export function createMonotonicClock(values = [1_000, 1_005]) {
  const queue = [...values];
  const calls = [];
  return {
    calls,
    nowMs() {
      const value = queue.length > 0
        ? queue.shift()
        : calls.at(-1) ?? 0;
      calls.push(value);
      return value;
    },
  };
}

export function createBoundedResultCollectorFake(options = {}) {
  const descriptor = createK6BoundedResultCollectorPortDescriptor();
  const bytes = Uint8Array.from(options.bytes ?? encodeK6SummaryJson());
  const calls = {
    sealRoot: [],
    inspectArtifact: [],
    provideArtifactPayload: [],
  };
  return {
    descriptor,
    calls,
    bytes,
    sealRoot(request) {
      calls.sealRoot.push(request);
      if (options.sealError) throw options.sealError;
      const receipt = createK6OutputRootSealReceipt(descriptor, request);
      return typeof options.mutateSealReceipt === 'function'
        ? options.mutateSealReceipt(clone(receipt), request)
        : receipt;
    },
    inspectArtifact(request) {
      calls.inspectArtifact.push(request);
      if (options.inspectionError) throw options.inspectionError;
      const receipt = createK6OutputArtifactInspectionReceipt(
        descriptor, request, bytes.byteLength);
      return typeof options.mutateInspectionReceipt === 'function'
        ? options.mutateInspectionReceipt(clone(receipt), request, bytes)
        : receipt;
    },
    provideArtifactPayload(request) {
      calls.provideArtifactPayload.push(request);
      if (options.payloadError) throw options.payloadError;
      let responseBytes = Uint8Array.from(bytes);
      let receipt = createK6OutputArtifactPayloadReceipt(
        descriptor, request, responseBytes);
      if (typeof options.mutatePayloadReceipt === 'function') {
        receipt = options.mutatePayloadReceipt(
          clone(receipt), request, responseBytes);
      }
      if (typeof options.mutatePayloadBytes === 'function') {
        responseBytes = options.mutatePayloadBytes(
          Uint8Array.from(responseBytes), request, receipt);
      }
      const response = { bytes: responseBytes, receipt };
      return typeof options.mutatePayloadResponse === 'function'
        ? options.mutatePayloadResponse(response, request)
        : response;
    },
  };
}

export async function boundedFileResultCollectorFixture(options = {}) {
  const p2 = options.p2Fixture
    ?? await trustedOutputRootPortFixture(options.p2Options);
  const p2Bindings = Object.freeze({
    rootContract: p2.p1.outputRootContract,
    contractBindings: p2.p1.contractBindings,
    portDescriptor: p2.portDescriptor,
    allocationRequest: p2.allocationRequest,
    allocationReceipt: p2.allocationReceipt,
    resolutionRequest: p2.resolutionRequest,
    resolutionReceipt: p2.resolutionReceipt,
    boundaryEvidence: p2.boundaryEvidence,
  });
  const boundedResultCollectorPort = options.boundedResultCollectorPort
    ?? createBoundedResultCollectorFake({
      ...options.fakeOptions,
      bytes: options.bytes ?? options.fakeOptions?.bytes,
    });
  const monotonicClock = options.monotonicClock
    ?? createMonotonicClock(options.clockValues);
  const collected = collectK6BoundedFileResult({
    boundedResultCollectorPort,
    monotonicClock,
    p2Bindings,
  });
  return Object.freeze({
    p2,
    p2Bindings,
    boundedResultCollectorPort,
    monotonicClock,
    ...collected,
  });
}
