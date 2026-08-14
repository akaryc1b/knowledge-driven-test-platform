import { cloneExecutionJson } from '@kdtp/execution-contract';
import { K6OutputRootContractError, outputRootInvariant } from './errors.js';
import {
  validateK6GovernedOutputRootContract,
  validateK6OutputArtifactDescriptor,
} from './output-root-contracts.js';
import {
  validateK6OutputArtifactResolutionReceipt,
  validateK6OutputArtifactResolutionRequest,
  validateK6OutputRootAllocationReceipt,
  validateK6OutputRootAllocationRequest,
  validateK6TrustedOutputRootBoundaryEvidence,
  validateK6TrustedOutputRootPortDescriptor,
} from './trusted-output-root-port.js';
import { deepFreeze, exactFields } from './bounded-result-collector-definitions.js';

export function validateAcceptedP2(bindings) {
  const expected = [
    'rootContract', 'contractBindings', 'portDescriptor',
    'allocationRequest', 'allocationReceipt', 'resolutionRequest',
    'resolutionReceipt', 'boundaryEvidence', 'collectorPortDescriptor',
  ];
  exactFields(bindings, expected,
    'INVALID_K6_OUTPUT_RESULT_P2_BINDINGS', 'P2 collector bindings');
  const rootContract = validateK6GovernedOutputRootContract(
    bindings.rootContract, bindings.contractBindings);
  const descriptor = validateK6OutputArtifactDescriptor(
    rootContract.artifacts[0]);
  const portDescriptor = validateK6TrustedOutputRootPortDescriptor(
    bindings.portDescriptor);
  const allocationRequest = validateK6OutputRootAllocationRequest(
    bindings.allocationRequest,
    {
      portDescriptor,
      rootContract,
      contractBindings: bindings.contractBindings,
    },
  );
  const allocationReceipt = validateK6OutputRootAllocationReceipt(
    bindings.allocationReceipt, portDescriptor, allocationRequest);
  const resolutionRequest = validateK6OutputArtifactResolutionRequest(
    bindings.resolutionRequest,
    {
      portDescriptor,
      rootContract,
      contractBindings: bindings.contractBindings,
      allocationRequest,
      allocationReceipt,
    },
  );
  const resolutionReceipt = validateK6OutputArtifactResolutionReceipt(
    bindings.resolutionReceipt, portDescriptor, resolutionRequest);
  const boundaryEvidence = validateK6TrustedOutputRootBoundaryEvidence(
    bindings.boundaryEvidence,
    {
      portDescriptor,
      rootContract,
      contractBindings: bindings.contractBindings,
      allocationRequest,
      allocationReceipt,
      resolutionRequest,
      resolutionReceipt,
    },
  );
  outputRootInvariant(
    boundaryEvidence.lifecycle.currentState === 'ALLOCATED'
      && boundaryEvidence.lifecycle.sealed === false
      && boundaryEvidence.lifecycle.collectionAuthorized === false
      && boundaryEvidence.artifact.resolved === true
      && boundaryEvidence.artifact.regularFileVerified === false
      && boundaryEvidence.artifact.opened === false
      && boundaryEvidence.artifact.read === false
      && boundaryEvidence.artifact.written === false,
    'K6_OUTPUT_RESULT_P2_PREDECESSOR_NOT_ACCEPTED',
    'P3 requires the accepted fake-only P2 output-root boundary');
  return deepFreeze({
    rootContract: cloneExecutionJson(rootContract),
    descriptor: cloneExecutionJson(descriptor),
    portDescriptor: cloneExecutionJson(portDescriptor),
    allocationRequest: cloneExecutionJson(allocationRequest),
    allocationReceipt: cloneExecutionJson(allocationReceipt),
    resolutionRequest: cloneExecutionJson(resolutionRequest),
    resolutionReceipt: cloneExecutionJson(resolutionReceipt),
    boundaryEvidence: cloneExecutionJson(boundaryEvidence),
  });
}

export function invokePort(port, method, request, code, message) {
  try {
    return port[method](deepFreeze(cloneExecutionJson(request)));
  } catch (error) {
    throw new K6OutputRootContractError(code, message, {
      causeName: typeof error?.name === 'string' ? error.name : 'Error',
    });
  }
}

export function validateMonotonicClock(clock) {
  outputRootInvariant(clock && typeof clock === 'object'
      && typeof clock.nowMs === 'function',
  'K6_OUTPUT_RESULT_CLOCK_UNAVAILABLE',
  'An injected monotonic clock is required');
  return clock;
}

export function readClock(clock) {
  let value;
  try {
    value = clock.nowMs();
  } catch (error) {
    throw new K6OutputRootContractError(
      'K6_OUTPUT_RESULT_CLOCK_REJECTED',
      'The injected monotonic clock failed',
      { causeName: typeof error?.name === 'string' ? error.name : 'Error' },
    );
  }
  outputRootInvariant(Number.isInteger(value) && value >= 0,
    'K6_OUTPUT_RESULT_CLOCK_INVALID',
    'Injected monotonic clock must return a non-negative integer');
  return value;
}

