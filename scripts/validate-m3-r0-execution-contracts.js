#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@kdtp/knowledge-core';
import {
  EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION,
  EXECUTION_EVIDENCE_SCHEMA_VERSION,
  EXECUTION_FAILURE_SCHEMA_VERSION,
  EXECUTION_REQUEST_SCHEMA_VERSION,
  EXECUTION_RESULT_SCHEMA_VERSION,
  validateExecutionAdapterDescriptor,
  validateExecutionEvidence,
  validateExecutionRequest,
  validateExecutionResult,
} from '../packages/execution-contract/src/index.js';
import { buildExecutionContractExample } from '../examples/execution-contracts.js';

export const M3_R0_EXECUTION_CONTRACT_EVIDENCE_SCHEMA_VERSION =
  'm3-r0-execution-contract-evidence/v1';

const ROOT = process.cwd();
const PATHS = Object.freeze({
  package: 'package.json',
  catalog: 'schemas/execution/schema-catalog.json',
  packageManifest: 'packages/execution-contract/package.json',
  packageIndex: 'packages/execution-contract/src/index.js',
  packageValidation: 'packages/execution-contract/src/validation.js',
  packageStateMachine: 'packages/execution-contract/src/state-machine.js',
  packageJsonSafety: 'packages/execution-contract/src/json.js',
  packageTests: 'packages/execution-contract/test/contracts.test.js',
  schemaTests: 'packages/execution-contract/test/schema.test.js',
  example: 'examples/execution-contracts.js',
  workflow: '.github/workflows/m3-r0-execution-contract-foundation.yml',
  roadmap: 'docs/03-roadmap/m3-r0-execution-adapter-foundation.md',
  handoff: 'docs/02-development/development-handoff.md',
  docsIndex: 'docs/README.md',
});

export async function validateM3R0ExecutionContracts(options = {}) {
  const catalog = options.catalog ?? await loadJson(join(ROOT, PATHS.catalog));
  const packageJson = options.packageJson ?? await loadJson(join(ROOT, PATHS.package));
  const packageManifest = options.packageManifest ?? await loadJson(join(ROOT, PATHS.packageManifest));
  const sources = options.sources ?? await loadSources();
  validateCatalog(catalog);
  validateRepositoryWiring({ catalog, packageJson, packageManifest, sources });

  const example = options.example ?? buildExecutionContractExample();
  const descriptor = validateExecutionAdapterDescriptor(example.descriptor);
  const request = validateExecutionRequest(example.request, descriptor);
  const result = validateExecutionResult(example.result, request, descriptor);
  const evidence = validateExecutionEvidence(example.evidence, request, result, descriptor);

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M3-R0 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R0 evidence commit SHA is invalid');
  const branch = resolveBranch(options);

  return {
    schemaVersion: M3_R0_EXECUTION_CONTRACT_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    contracts: {
      adapterDescriptor: descriptor.schemaVersion,
      executionRequest: request.schemaVersion,
      executionFailure: EXECUTION_FAILURE_SCHEMA_VERSION,
      executionResult: result.schemaVersion,
      executionEvidence: evidence.schemaVersion,
    },
    digests: {
      adapterDescriptor: descriptor.descriptorDigest,
      executionRequest: request.requestDigest,
      executionResult: result.resultDigest,
      executionEvidence: evidence.evidenceDigest,
      schemaCatalog: sha256(catalog),
    },
    decision: {
      contractFoundationReady: true,
      executionImplementationStarted: false,
      nextRequiredSlice: 'M3-R1',
      repositoryBlockers: [],
    },
    safetyBoundary: {
      k6Invoked: false,
      xk6Invoked: false,
      playwrightInvoked: false,
      externalProcessExecuted: false,
      networkEndpointAccessed: false,
      secretAccessed: false,
      workerAdded: false,
      queueAdded: false,
      schedulerAdded: false,
      kubernetesJobAdded: false,
      remoteExecutionApiAdded: false,
      resultCollectionImplemented: false,
      allureImplemented: false,
    },
  };
}

function validateCatalog(catalog) {
  const expected = {
    currentAdapterDescriptor: EXECUTION_ADAPTER_DESCRIPTOR_SCHEMA_VERSION,
    currentExecutionRequest: EXECUTION_REQUEST_SCHEMA_VERSION,
    currentExecutionFailure: EXECUTION_FAILURE_SCHEMA_VERSION,
    currentExecutionResult: EXECUTION_RESULT_SCHEMA_VERSION,
    currentExecutionEvidence: EXECUTION_EVIDENCE_SCHEMA_VERSION,
    currentValidationEvidence: M3_R0_EXECUTION_CONTRACT_EVIDENCE_SCHEMA_VERSION,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert(catalog[key] === value, `Execution Schema Catalog ${key} is invalid`);
  }
  const paths = Object.values(catalog.schemas ?? {});
  assert(paths.length === 6 && new Set(paths).size === paths.length,
    'Execution Schema Catalog must contain six unique paths');
}

function validateRepositoryWiring({ packageJson, packageManifest, sources }) {
  assert(packageManifest.name === '@kdtp/execution-contract'
      && packageManifest.exports === './src/index.js',
  'Execution contract package manifest is invalid');
  assert(packageJson.scripts?.test?.includes('packages/execution-contract/test/*.test.js'),
    'Root Node test suite is missing execution contracts');
  assert(packageJson.scripts?.['validate:m3-r0-execution-contracts'] ===
      'node scripts/validate-m3-r0-execution-contracts.js',
  'Root package is missing M3-R0 validation script');
  assert(packageJson.scripts?.validate?.includes('validate-m3-r0-execution-contracts.js')
      && packageJson.scripts.validate.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must include M3-R0 and preserve final M2 closure last');
  assert(packageJson.scripts?.['example:execution-contracts'] ===
      'node examples/execution-contracts.js',
  'Root package is missing execution contract example');

  for (const required of [
    'name: m3-r0-execution-contract-foundation',
    'Run focused execution contract tests',
    'Run full Node test suite',
    'Run repository validation',
    'name: m3-r0-execution-contract-evidence',
  ]) assert(sources.workflow.includes(required), `M3-R0 Workflow is missing ${required}`);
  for (const forbidden of [
    'kubectl apply', 'helm install', 'helm upgrade', 'packages: write', 'contents: write',
    'k6 run', 'xk6 build', 'playwright test',
  ]) assert(!sources.workflow.toLowerCase().includes(forbidden),
    `M3-R0 Workflow contains forbidden ${forbidden}`);

  assert(sources.roadmap.includes('Contract-only')
      && sources.roadmap.includes('contractFoundationReady=true')
      && sources.roadmap.includes('不调用 k6')
      && sources.roadmap.includes('不创建 Worker'),
  'M3-R0 roadmap contract boundary is incomplete');
  assert(sources.handoff.includes('M3-R0')
      && sources.handoff.includes('不得启动执行器实现'),
  'Development handoff is not constrained to M3-R0');
  assert(sources.docsIndex.includes('M3-R0 Execution Adapter Foundation'),
    'Documentation index is missing M3-R0');

  const implementationSources = [
    sources.packageIndex,
    sources.packageValidation,
    sources.packageStateMachine,
    sources.packageJsonSafety,
    sources.example,
  ].join('\n');
  for (const pattern of [
    /from\s+['"](?:node:)?child_process['"]/,
    /require\s*\(\s*['"](?:node:)?child_process['"]\s*\)/,
    /from\s+['"](?:node:)?net['"]/,
    /from\s+['"](?:node:)?http['"]/,
    /from\s+['"](?:node:)?https['"]/,
  ]) assert(!pattern.test(implementationSources),
    'M3-R0 contract package imports execution or network runtime primitives');
}

async function loadSources() {
  const entries = await Promise.all(Object.entries({
    packageIndex: PATHS.packageIndex,
    packageValidation: PATHS.packageValidation,
    packageStateMachine: PATHS.packageStateMachine,
    packageJsonSafety: PATHS.packageJsonSafety,
    packageTests: PATHS.packageTests,
    schemaTests: PATHS.schemaTests,
    example: PATHS.example,
    workflow: PATHS.workflow,
    roadmap: PATHS.roadmap,
    handoff: PATHS.handoff,
    docsIndex: PATHS.docsIndex,
  }).map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')]));
  return Object.fromEntries(entries);
}

function resolveBranch(options) {
  const explicit = options.branch;
  if (explicit !== undefined) {
    assert(typeof explicit === 'string' && explicit.trim().length > 0,
      'M3-R0 evidence branch is invalid');
    return explicit;
  }
  for (const candidate of [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME]) {
    if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate;
  }
  return 'local';
}

async function loadJson(path) {
  return JSON.parse(await readFile(path, 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R0ExecutionContracts(), null, 2)}\n`);
}
