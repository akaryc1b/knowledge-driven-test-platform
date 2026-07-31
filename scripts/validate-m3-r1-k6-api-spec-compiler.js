#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
  K6_API_ASSERTION_SCHEMA_VERSION,
  K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
  K6_API_OPERATION_SCHEMA_VERSION,
  K6_API_REQUEST_GROUP_SCHEMA_VERSION,
  K6_API_THRESHOLD_SCHEMA_VERSION,
  compileK6ApiExecutionSpec,
} from '../packages/k6-api-adapter/src/index.js';
import { compilerInput } from '../examples/k6-api-spec-compiler.js';

export const M3_R1_VALIDATION_EVIDENCE_SCHEMA_VERSION =
  'm3-r1-k6-api-spec-compiler-evidence/v1';

const ROOT = process.cwd();
const ACCEPTED_M3_R0 = Object.freeze({
  m3R0MergeSha: '42402fb82ca8b357a4c2a6dce56b9ce09c11c820',
  generalRunId: 30596506338,
  dedicatedRunId: 30596506339,
  artifactId: 8780302757,
  artifactDigest: 'sha256:42a998bc48e88a25c7ba1333a7344cb0db1b38535283a6ce6f19b4ed39dc4218',
});
const PATHS = Object.freeze({
  rootPackage: 'package.json',
  packageManifest: 'packages/k6-api-adapter/package.json',
  compiler: 'packages/k6-api-adapter/src/compiler.js',
  mapping: 'packages/k6-api-adapter/src/mapping.js',
  validation: 'packages/k6-api-adapter/src/validation.js',
  safety: 'packages/k6-api-adapter/src/safety.js',
  tests: 'packages/k6-api-adapter/test/compiler.test.js',
  schemaTests: 'packages/k6-api-adapter/test/schema.test.js',
  catalog: 'schemas/execution/k6-api/schema-catalog.json',
  example: 'examples/k6-api-spec-compiler.js',
  workflow: '.github/workflows/m3-r1-k6-api-spec-compiler.yml',
  roadmap: 'docs/03-roadmap/m3-r1-k6-api-spec-compiler.md',
  acceptance: 'docs/04-governance/m3-r1-k6-api-spec-compiler-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0028-deterministic-non-executing-k6-api-spec-compiler.md',
  release: 'docs/releases/M3-R1-k6-api-spec-compiler.md',
});

export async function validateM3R1K6ApiSpecCompiler(options = {}) {
  const packageJson = options.packageJson ?? await loadJson(PATHS.rootPackage);
  const packageManifest = options.packageManifest ?? await loadJson(PATHS.packageManifest);
  const catalog = options.catalog ?? await loadJson(PATHS.catalog);
  const sources = options.sources ?? await loadSources();
  validateCatalog(catalog);
  validateRepositoryWiring({ packageJson, packageManifest, sources });

  const input = options.input ?? await compilerInput();
  const output = compileK6ApiExecutionSpec(input);
  validateCompilation(output);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M3-R1 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R1 source commit SHA is invalid');

  return {
    schemaVersion: M3_R1_VALIDATION_EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch: resolveBranch(options), commitSha },
    acceptedFoundation: { ...ACCEPTED_M3_R0 },
    digests: {
      inputContract: output.evidence.inputContractDigest,
      spec: output.spec.specDigest,
      bundle: output.bundle.bundleDigest,
      compilationEvidence: output.evidence.evidenceDigest,
      schemaCatalog: sha256(catalog),
    },
    decision: { ...output.evidence.decision },
    safetyBoundary: { ...output.evidence.safetyBoundary },
  };
}

function validateCatalog(catalog) {
  const expected = {
    currentExecutionSpec: K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    currentRequestGroup: K6_API_REQUEST_GROUP_SCHEMA_VERSION,
    currentOperation: K6_API_OPERATION_SCHEMA_VERSION,
    currentAssertion: K6_API_ASSERTION_SCHEMA_VERSION,
    currentThreshold: K6_API_THRESHOLD_SCHEMA_VERSION,
    currentArtifactBundle: K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
    currentCompilationEvidence: K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
    currentValidationEvidence: M3_R1_VALIDATION_EVIDENCE_SCHEMA_VERSION,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert(catalog[key] === value, `M3-R1 Schema Catalog ${key} is invalid`);
  }
  const paths = Object.values(catalog.schemas ?? {});
  assert(paths.length === 8 && new Set(paths).size === paths.length,
    'M3-R1 Schema Catalog must contain eight unique paths');
}

function validateRepositoryWiring({ packageJson, packageManifest, sources }) {
  assert(packageManifest.name === '@kdtp/k6-api-adapter'
      && packageManifest.exports === './src/index.js',
  'M3-R1 package manifest is invalid');
  assert(packageJson.scripts?.test?.includes('packages/k6-api-adapter/test/*.test.js'),
    'Root Node suite is missing M3-R1 tests');
  assert(packageJson.scripts?.['validate:m3-r1-k6-api-spec-compiler'] ===
      'node scripts/validate-m3-r1-k6-api-spec-compiler.js',
  'Root package is missing M3-R1 validator');
  assert(packageJson.scripts?.validate?.includes('validate-m3-r1-k6-api-spec-compiler.js')
      && packageJson.scripts.validate.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must include M3-R1 and preserve M2 final closure last');
  assert(packageJson.scripts?.['example:k6-api-spec-compiler'] ===
      'node examples/k6-api-spec-compiler.js',
  'Root package is missing M3-R1 example');

  for (const required of [
    'name: m3-r1-k6-api-spec-compiler', 'contents: read',
    'Run focused M3-R1 compiler tests', 'Run full Node test suite',
    'Run repository validation', 'name: m3-r1-k6-api-spec-compiler-evidence',
  ]) assert(sources.workflow.includes(required), `M3-R1 Workflow is missing ${required}`);
  for (const forbidden of [
    'actions: write', 'contents: write', 'packages: write', 'k6 run', 'xk6 build',
    'playwright test', 'kubectl', 'helm install', 'docker run',
  ]) assert(!sources.workflow.toLowerCase().includes(forbidden),
    `M3-R1 Workflow contains forbidden ${forbidden}`);

  const implementation = [sources.compiler, sources.mapping, sources.validation, sources.safety].join('\n');
  for (const pattern of [
    /from\s+['"](?:node:)?child_process['"]/, /from\s+['"](?:node:)?fs['"]/,
    /from\s+['"](?:node:)?http['"]/, /from\s+['"](?:node:)?https['"]/,
    /from\s+['"](?:node:)?net['"]/, /\bfetch\s*\(/,
  ]) assert(!pattern.test(implementation),
    'M3-R1 compiler imports runtime, filesystem or network primitives');
  for (const marker of [
    'K6_API_TEST_PLAN_NOT_FROZEN', 'K6_API_CAPABILITY_NOT_AUTHORIZED',
    'K6_API_NETWORK_TARGET_FORBIDDEN', 'K6_API_EXECUTABLE_SOURCE_FORBIDDEN',
  ]) assert([sources.compiler, sources.mapping, sources.validation, sources.safety, sources.tests].join('\n').includes(marker),
    `M3-R1 safety marker is missing: ${marker}`);
  for (const doc of [sources.roadmap, sources.acceptance, sources.adr, sources.release]) {
    assert(doc.includes('executionRuntimeStarted=false') && doc.includes('k6Invoked=false'),
      'M3-R1 documentation does not preserve the non-execution decision');
  }
}

function validateCompilation(output) {
  assert(output.spec.schemaVersion === K6_API_EXECUTION_SPEC_SCHEMA_VERSION,
    'M3-R1 Spec schema version is invalid');
  assert(output.bundle.schemaVersion === K6_API_ARTIFACT_BUNDLE_SCHEMA_VERSION,
    'M3-R1 Bundle schema version is invalid');
  assert(output.evidence.schemaVersion === K6_API_COMPILATION_EVIDENCE_SCHEMA_VERSION,
    'M3-R1 Compilation Evidence schema version is invalid');
  assert(output.evidence.decision.apiAdapterCompilerReady === true
      && output.evidence.decision.executionRuntimeStarted === false
      && output.evidence.decision.k6Invoked === false
      && output.evidence.decision.externalProcessExecuted === false
      && output.evidence.decision.nextRequiredSlice === 'M3-R2'
      && output.evidence.decision.repositoryBlockers.length === 0,
  'M3-R1 decision is invalid');
  assert(Object.values(output.evidence.safetyBoundary).every((value) => value === false),
    'M3-R1 non-execution safety boundary changed');
}

async function loadSources() {
  return Object.fromEntries(await Promise.all(Object.entries(PATHS)
    .filter(([key]) => !['rootPackage', 'packageManifest', 'catalog'].includes(key))
    .map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')])));
}

function resolveBranch(options) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  for (const value of [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'local';
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(ROOT, path), 'utf8'));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R1K6ApiSpecCompiler(), null, 2)}\n`);
}
