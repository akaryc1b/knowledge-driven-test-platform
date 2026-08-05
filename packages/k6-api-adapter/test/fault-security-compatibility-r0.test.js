import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createK6NodeProcessAdapterDescriptor,
  executeK6ProcessLifecycle,
  executeK6ProcessWithSanitizedResult,
} from '../src/process-execution-lifecycle.js';

async function readRepositoryFile(relativePath) {
  return readFile(new URL(`../../../${relativePath}`, import.meta.url), 'utf8');
}

function assertOrdered(text, fragments) {
  let previous = -1;
  for (const fragment of fragments) {
    const current = text.indexOf(fragment);
    assert.notEqual(current, -1, `Missing ordered fragment: ${fragment}`);
    assert.ok(current > previous, `Fragment is out of order: ${fragment}`);
    previous = current;
  }
}

test('P4 R0 freezes the accepted adapter descriptor and public lifecycle APIs', () => {
  assert.equal(typeof executeK6ProcessLifecycle, 'function');
  assert.equal(typeof executeK6ProcessWithSanitizedResult, 'function');
  const descriptor = createK6NodeProcessAdapterDescriptor();
  assert.equal(descriptor.processPrimitive, 'node:child_process.spawn');
  assert.equal(descriptor.executable, 'k6');
  assert.equal(descriptor.shell, false);
  assert.equal(descriptor.detached, false);
  assert.deepEqual(descriptor.stdio, {
    stdin: 'ignore',
    stdout: 'ignore',
    stderr: 'ignore',
  });
  assert.equal(descriptor.hostEnvironmentInherited, false);
  assert.equal(descriptor.numericProcessIdExposed, false);
  assert.equal(Object.isFrozen(descriptor), true);
  assert.equal(Object.isFrozen(descriptor.stdio), true);
  assert.equal(Object.isFrozen(descriptor.cancellation), true);
});

test('P4 R0 keeps one dedicated spawn site and excludes alternative process primitives', async () => {
  const source = await readRepositoryFile(
    'packages/k6-api-adapter/src/node-process-adapter.js');
  assert.equal(source.includes("import { spawn } from 'node:child_process';"), true);
  assert.equal((source.match(/runtime\.spawnProcess\(/gu) ?? []).length, 1);
  for (const forbidden of [
    "from 'node:vm'",
    "from 'node:worker_threads'",
    'node:child_process.exec',
    'node:child_process.execFile',
    'node:child_process.fork',
    'node:child_process.spawnSync',
    'node:child_process.execSync',
    'eval(',
    'new Function(',
    'shell: true',
    'detached: true',
  ]) {
    assert.equal(source.includes(forbidden), false,
      `Alternative process boundary detected: ${forbidden}`);
  }
  assert.equal(source.includes("stdio: ['ignore', 'ignore', 'ignore']"), true);
  assert.equal(source.includes('env: cloneExecutionJson(environment)'), true);
});

test('P4 R0 preserves ESM, Node 22 baseline, workspaces and predecessor Validator order', async () => {
  const packageDocument = JSON.parse(await readRepositoryFile('package.json'));
  assert.equal(packageDocument.type, 'module');
  assert.equal(packageDocument.engines.node, '>=22');
  assert.deepEqual(packageDocument.workspaces, ['apps/*', 'packages/*']);
  assertOrdered(packageDocument.scripts.validate, [
    'validate-m3-r3-runtime-admission.js',
    'validate-m3-r3-p1-local-process-boundary.js',
    'validate-m3-r3-p2-bounded-process-lifecycle.js',
    'validate-m3-r3-p3-sanitized-runtime-result.js',
    'validate-m2-final-release-closure.js',
  ]);
});

test('P4 R0 governance records freeze scope, matrices and deferred file-result boundary', async () => {
  const documents = await Promise.all([
    readRepositoryFile(
      'docs/03-roadmap/m3-r3-p4-fault-security-compatibility-acceptance.md'),
    readRepositoryFile(
      'docs/04-governance/m3-r3-p4-fault-security-compatibility-acceptance-matrix.md'),
    readRepositoryFile(
      'docs/06-security/m3-r3-p4-fault-security-compatibility-threat-model.md'),
    readRepositoryFile(
      'docs/02-development/m3-r3-p4-fault-security-compatibility-handoff.md'),
    readRepositoryFile('docs/m3-r3-p4-index.md'),
  ]);
  const combined = documents.join('\n');
  for (const claim of [
    'p4ProductCapabilityAdded=false',
    'p4ExistingRuntimeBehaviorChanged=false',
    'p4FaultMatrixFrozen=true',
    'p4SecurityMatrixFrozen=true',
    'p4CompatibilityMatrixFrozen=true',
    'governedOutputRootImplemented=false',
    'fileResultCollectionImplemented=false',
    'sourceBundleRemainsImmutable=true',
    'securityDashboardEnumerationAvailable=false',
    'zeroAlertClaimMade=false',
    'm3R3G1Started=false',
  ]) {
    assert.equal(combined.includes(claim), true, `Missing frozen R0 claim: ${claim}`);
  }
});
