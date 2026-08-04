import {
  createK6LocalProcessPortDescriptor,
  createK6LocalProcessPortReceipt,
  prepareK6LocalProcessLaunch,
} from '../src/local-process-boundary.js';
import { runtimeAdmissionFixture, clone } from './runtime-admission-test-helpers.js';

export async function localProcessBoundaryFixture(options = {}) {
  const runtime = await runtimeAdmissionFixture(options.runtimeOptions);
  const descriptor = createK6LocalProcessPortDescriptor();
  const calls = [];
  const localProcessPort = {
    descriptor,
    acceptLaunchSpecification(specification) {
      calls.push(specification);
      const receipt = createK6LocalProcessPortReceipt(descriptor, specification);
      return options.transformReceipt ? options.transformReceipt(clone(receipt), specification) : receipt;
    },
  };
  const result = prepareK6LocalProcessLaunch({
    localProcessPort,
    policy: runtime.policy,
    admissionRequest: runtime.admissionRequest,
    invocationPlan: runtime.invocationPlan,
    admissionEvidence: runtime.admissionEvidence,
  });
  return { runtime, descriptor, calls, localProcessPort, result };
}

export function fakeLocalProcessPort(descriptor, transformReceipt) {
  const calls = [];
  return {
    calls,
    descriptor,
    acceptLaunchSpecification(specification) {
      calls.push(specification);
      const receipt = createK6LocalProcessPortReceipt(descriptor, specification);
      return transformReceipt ? transformReceipt(clone(receipt), specification) : receipt;
    },
  };
}
