import {
  K6_OUTPUT_ARTIFACT_KIND,
  createK6GovernedOutputRootContract,
  createK6GovernedOutputRootPolicy,
  createK6ProcessTerminalObservation,
  createK6RuntimeExecutionEvidence,
  createK6SanitizedRuntimeOutcome,
  executeK6ProcessLifecycle,
} from '../src/index.js';
import { processExecutionFixture } from './process-execution-lifecycle-test-helpers.js';

export async function outputRootContractFixture(options = {}) {
  const suppliedProcessOptions = options.processOptions ?? {};
  const suppliedP1Options = suppliedProcessOptions.p1Options ?? {};
  const suppliedRuntimeOptions = suppliedP1Options.runtimeOptions ?? {};
  const suppliedResources = suppliedRuntimeOptions.resources ?? {};
  const processFixture = await processExecutionFixture({
    ...suppliedProcessOptions,
    p1Options: {
      ...suppliedP1Options,
      runtimeOptions: {
        ...suppliedRuntimeOptions,
        resources: {
          ...suppliedResources,
          outputArtifactKinds: [K6_OUTPUT_ARTIFACT_KIND],
        },
      },
    },
  });
  const pending = executeK6ProcessLifecycle({
    adapter: processFixture.adapter,
    command: processFixture.command,
    bindings: processFixture.bindings,
    executionContext: processFixture.executionContext,
  });
  processFixture.child.emit('spawn');
  processFixture.child.emit('exit', 0, null);
  const lifecycleEvidence = await pending;
  const terminalObservation = createK6ProcessTerminalObservation({
    command: processFixture.command,
    adapterDescriptor: processFixture.adapterDescriptor,
    lifecycleEvidence,
    exitCode: 0,
    signal: null,
  });
  const runtimeOutcome = createK6SanitizedRuntimeOutcome({
    command: processFixture.command,
    adapterDescriptor: processFixture.adapterDescriptor,
    lifecycleEvidence,
    terminalObservation,
  });
  const runtimeEvidence = createK6RuntimeExecutionEvidence({
    bindings: processFixture.bindings,
    command: processFixture.command,
    adapterDescriptor: processFixture.adapterDescriptor,
    lifecycleEvidence,
    terminalObservation,
    runtimeOutcome,
  });
  const outputRootPolicy = createK6GovernedOutputRootPolicy();
  const contractBindings = {
    outputRootPolicy,
    runtimePolicy: processFixture.bindings.policy,
    admissionRequest: processFixture.bindings.admissionRequest,
    invocationPlan: processFixture.bindings.invocationPlan,
    admissionEvidence: processFixture.bindings.admissionEvidence,
    runtimeEvidence,
  };
  const outputRootContract = createK6GovernedOutputRootContract(contractBindings);
  return Object.freeze({
    processFixture,
    lifecycleEvidence,
    terminalObservation,
    runtimeOutcome,
    runtimeEvidence,
    outputRootPolicy,
    contractBindings,
    outputRootContract,
  });
}
