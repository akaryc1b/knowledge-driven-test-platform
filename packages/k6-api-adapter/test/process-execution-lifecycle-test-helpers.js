import { EventEmitter } from 'node:events';
import {
  createK6NodeProcessAdapterDescriptor,
  createK6ProcessExecutionCommand,
  createNodeK6ProcessAdapter,
} from '../src/process-execution-lifecycle.js';
import { localProcessBoundaryFixture } from './local-process-boundary-test-helpers.js';

export class FakeChildProcess extends EventEmitter {
  constructor(options = {}) {
    super();
    this.pid = options.pid ?? 4242;
    this.signals = [];
    this.killResult = options.killResult ?? true;
  }

  kill(signal) {
    this.signals.push(signal);
    return this.killResult;
  }
}

export function createManualTimers() {
  let nextId = 1;
  const tasks = [];
  return {
    tasks,
    setTimer(callback, delay) {
      const task = { id: nextId++, callback, delay, cleared: false, fired: false };
      tasks.push(task);
      return task.id;
    },
    clearTimer(id) {
      const task = tasks.find((candidate) => candidate.id === id);
      if (task) task.cleared = true;
    },
    fireDelay(delay) {
      const task = tasks.find((candidate) =>
        !candidate.cleared && !candidate.fired && candidate.delay === delay);
      if (!task) throw new Error(`No active timer for delay ${delay}`);
      task.fired = true;
      task.callback();
      return task;
    },
    fireNext() {
      const task = tasks.find((candidate) => !candidate.cleared && !candidate.fired);
      if (!task) throw new Error('No active timer');
      task.fired = true;
      task.callback();
      return task;
    },
  };
}

export async function processExecutionFixture(options = {}) {
  const p1 = await localProcessBoundaryFixture(options.p1Options);
  const adapterDescriptor = createK6NodeProcessAdapterDescriptor();
  const bindings = {
    adapterDescriptor,
    policy: p1.runtime.policy,
    admissionRequest: p1.runtime.admissionRequest,
    invocationPlan: p1.runtime.invocationPlan,
    admissionEvidence: p1.runtime.admissionEvidence,
    portDescriptor: p1.descriptor,
    launchSpecification: p1.result.launchSpecification,
    launchDecision: p1.result.launchDecision,
    boundaryEvidence: p1.result.boundaryEvidence,
  };
  const command = createK6ProcessExecutionCommand(bindings);
  const child = options.child ?? new FakeChildProcess(options.childOptions);
  const spawnCalls = [];
  const timers = options.timers ?? createManualTimers();
  const adapter = createNodeK6ProcessAdapter({
    spawnProcess(executable, argv, spawnOptions) {
      spawnCalls.push({ executable, argv, options: spawnOptions });
      if (options.spawnThrows) throw new Error('spawn failed with private detail');
      return child;
    },
    realpathPath(path) {
      return options.realPath ?? path;
    },
    statPath() {
      return { isDirectory: () => options.isDirectory ?? true };
    },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });
  const workingDirectoryPath = options.workingDirectoryPath
    ?? `/var/lib/kdtp/source-bundles/${command.source.bundleDigest}`;
  const executionContext = {
    resolveWorkingDirectory(binding) {
      if (options.resolverThrows) throw new Error('private resolver failure');
      if (options.assertBinding) options.assertBinding(binding);
      return workingDirectoryPath;
    },
    abortSignal: options.abortSignal ?? null,
  };
  return {
    p1,
    bindings,
    command,
    child,
    spawnCalls,
    timers,
    adapter,
    adapterDescriptor,
    executionContext,
    workingDirectoryPath,
  };
}
