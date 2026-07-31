#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
  K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
  K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
  validateK6ApiSourceGenerationRequest,
  validateK6ApiSourceGeneratorDescriptor,
} from '../packages/k6-api-adapter/src/index.js';
import { sourceGenerationContractFixture } from '../examples/k6-api-source-generation-contract.js';
import { validateM3R2SourceGenerationR0 } from './validate-m3-r2-source-generation-r0.js';

export const M3_R2_P1_EVIDENCE_SCHEMA_VERSION =
  'm3-r2-source-generation-p1-evidence/v1';

const ROOT = process.cwd();
const ACCEPTED_R0 = Object.freeze({
  headSha: '1a30d103ade7bd9eb954ddb097126c88f60dce9c',
  dedicatedRunId: 30605067352,
  artifactId: 8783292187,
  artifactDigest:
    'sha256:3ede3f765fece536acd1d704c14f0d559a75bfd6634639bbcd3105fbe59818b9',
});
const PATHS = Object.freeze({
  rootPackage: 'package.json',
  packageManifest: 'packages/k6-api-adapter/package.json',
  constants: 'packages/k6-api-adapter/src/constants.js',
  errors: 'packages/k6-api-adapter/src/errors.js',
  sourceContract: 'packages/k6-api-adapter/src/source-contract.js',
  index: 'packages/k6-api-adapter/src/index.js',
  contractTests: 'packages/k6-api-adapter/test/source-contract.test.js',
  schemaTests: 'packages/k6-api-adapter/test/source-contract-schema.test.js',
  catalog: 'schemas/execution/k6-api-source/schema-catalog.json',
  example: 'examples/k6-api-source-generation-contract.js',
  workflow: '.github/workflows/m3-r2-k6-api-source-generation.yml',
  handoff: 'docs/02-development/development-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r2-governed-k6-api-source-generation.md',
  topRoadmap: 'docs/03-roadmap/roadmap.md',
  acceptance: 'docs/04-governance/m3-r2-source-generation-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0029-governed-deterministic-k6-source-generation.md',
  threatModel: 'docs/06-security/m3-r2-source-generation-threat-model.md',
  release: 'docs/releases/M3-R2-k6-api-source-generation.md',
});

export async function validateM3R2SourceGenerationP1(options = {}) {
  const packageJson = options.packageJson ?? await loadJson(PATHS.rootPackage);
  const packageManifest = options.packageManifest ?? await loadJson(PATHS.packageManifest);
  const catalog = options.catalog ?? await loadJson(PATHS.catalog);
  const sources = options.sources ?? await loadSources();

  validateCatalog(catalog);
  validateRepositoryWiring({ packageJson, packageManifest, sources });
  validateContractOnlyBoundary(sources);
  assert(await pathExists('packages/k6-api-source-generator') === false,
    'M3-R2 P1 must not contain a source generator package');

  const fixture = options.fixture ?? await sourceGenerationContractFixture();
  const descriptor = validateK6ApiSourceGeneratorDescriptor(fixture.descriptor);
  const request = validateK6ApiSourceGenerationRequest(fixture.request, {
    descriptor,
    spec: fixture.compiled.spec,
    bundle: fixture.compiled.bundle,
    compilationEvidence: fixture.compiled.evidence,
  });

  const r0 = await validateM3R2SourceGenerationR0({
    generatedAt: options.generatedAt ?? '2026-07-31T05:00:00.000Z',
    commitSha: options.commitSha ?? process.env.GITHUB_SHA ?? 'local',
    branch: options.branch ?? resolveBranch(options),
  });
  assert(r0.decision.sourceGenerationScopeFrozen === true
      && r0.decision.sourceGenerationStarted === false
      && r0.decision.sourceGenerated === false
      && r0.decision.sourceExecuted === false
      && r0.decision.executionRuntimeStarted === false,
  'M3-R2 R0 anti-regression decision changed');
  assert(Object.values(r0.safetyBoundary).every((value) => value === false),
    'M3-R2 R0 safety boundary changed');

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M3-R2 P1 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R2 P1 source commit SHA is invalid');

  const decision = {
    sourceGenerationContractReady: true,
    sourceGenerationScopeFrozen: true,
    runtimeBoundaryDefined: true,
    sourceGenerationStarted: false,
    sourceGenerated: false,
    sourceExecuted: false,
    executionRuntimeStarted: false,
    nextRequiredSlice: 'M3-R2-P2',
    repositoryBlockers: [],
  };
  const safetyBoundary = {
    k6Invoked: false,
    xk6Invoked: false,
    playwrightInvoked: false,
    externalProcessExecuted: false,
    sourceGenerated: false,
    sourceExecuted: false,
    nodeVmUsed: false,
    evalUsed: false,
    dynamicImportUsed: false,
    targetNetworkAccessed: false,
    databaseAccessed: false,
    secretAccessed: false,
    filesystemCredentialAccessed: false,
    temporaryExecutionDirectoryCreated: false,
    containerStarted: false,
    kubernetesResourceCreated: false,
    workerAdded: false,
    queueAdded: false,
    schedulerAdded: false,
    runtimeResultCollected: false,
    allureImplemented: false,
  };
  const evidenceClaims = {
    schemaVersion: M3_R2_P1_EVIDENCE_SCHEMA_VERSION,
    source: { branch: options.branch ?? resolveBranch(options), commitSha },
    acceptedR0: { ...ACCEPTED_R0 },
    contracts: {
      renderingPolicy: K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
      generatorDescriptor: K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
      generationRequest: K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
    },
    digests: {
      renderingPolicy: descriptor.renderingPolicy.policyDigest,
      generatorDescriptor: descriptor.descriptorDigest,
      generationRequest: request.requestDigest,
      sourceIdentity: request.sourceIdentity.identityDigest,
      schemaCatalog: sha256(catalog),
    },
    decision,
    safetyBoundary,
  };
  return {
    ...evidenceClaims,
    generatedAt,
    evidenceDigest: sha256(evidenceClaims),
  };
}

function validateCatalog(catalog) {
  const expected = {
    currentRenderingPolicy: K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION,
    currentGeneratorDescriptor: K6_API_SOURCE_GENERATOR_DESCRIPTOR_SCHEMA_VERSION,
    currentGenerationRequest: K6_API_SOURCE_GENERATION_REQUEST_SCHEMA_VERSION,
    currentValidationEvidence: M3_R2_P1_EVIDENCE_SCHEMA_VERSION,
  };
  for (const [key, value] of Object.entries(expected)) {
    assert(catalog[key] === value, `M3-R2 P1 Schema Catalog ${key} is invalid`);
  }
  const paths = Object.values(catalog.schemas ?? {});
  assert(paths.length === 4 && new Set(paths).size === paths.length,
    'M3-R2 P1 Schema Catalog must contain four unique paths');
}

function validateRepositoryWiring({ packageJson, packageManifest, sources }) {
  assert(packageManifest.name === '@kdtp/k6-api-adapter'
      && packageManifest.exports === './src/index.js',
  'M3-R2 P1 package manifest is invalid');
  assert(packageJson.scripts?.test?.includes('packages/k6-api-adapter/test/*.test.js'),
    'Root Node suite is missing P1 contract tests');
  assert(packageJson.scripts?.['validate:m3-r2-source-generation-p1'] ===
      'node scripts/validate-m3-r2-source-generation-p1.js',
  'Root package is missing M3-R2 P1 validator');
  assert(packageJson.scripts?.['example:k6-api-source-generation-contract'] ===
      'node examples/k6-api-source-generation-contract.js',
  'Root package is missing M3-R2 P1 example');
  assert(packageJson.scripts?.validate?.includes('validate-m3-r2-source-generation-r0.js')
      && packageJson.scripts.validate.includes('validate-m3-r2-source-generation-p1.js')
      && packageJson.scripts.validate.indexOf('validate-m3-r2-source-generation-r0.js')
        < packageJson.scripts.validate.indexOf('validate-m3-r2-source-generation-p1.js')
      && packageJson.scripts.validate.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must preserve R0, P1 and M2 final closure');

  for (const marker of [
    "export * from './source-contract.js'",
    'K6_API_SOURCE_RENDERING_POLICY_SCHEMA_VERSION',
    'K6ApiSourceContractError',
    'createK6ApiSourceGenerationRequest',
  ]) assert([sources.index, sources.constants, sources.errors, sources.sourceContract]
    .join('\n').includes(marker), `M3-R2 P1 implementation marker is missing: ${marker}`);

  for (const required of [
    'name: m3-r2-k6-api-source-generation',
    'contents: read',
    'Run focused M3-R2 P1 contract tests',
    'Run full Node test suite',
    'Run repository validation',
    'Run M3-R2 R0 anti-regression',
    'Run M3-R1 anti-regression',
    'Run PostgreSQL 18 integration suite',
    'name: m3-r2-source-generation-p1-evidence',
    'retention-days: 90',
  ]) assert(sources.workflow.includes(required),
    `M3-R2 P1 Workflow is missing ${required}`);
}

function validateContractOnlyBoundary(sources) {
  const implementation = [sources.constants, sources.errors, sources.sourceContract,
    sources.index, sources.example].join('\n');
  for (const pattern of [
    /from\s+['"](?:node:)?child_process['"]/,
    /from\s+['"](?:node:)?fs['"]/,
    /from\s+['"](?:node:)?http['"]/,
    /from\s+['"](?:node:)?https['"]/,
    /from\s+['"](?:node:)?net['"]/,
    /\bfetch\s*\(/,
    /\beval\s*\(/,
    /\bnew\s+Function\b/,
    /\bimport\s*\(/,
    /\brenderK6\b/,
  ]) assert(!pattern.test(implementation),
    'M3-R2 P1 imports or exposes generation/runtime capabilities');

  for (const marker of [
    'CONTRACT_ONLY',
    "Object.freeze(['k6', 'k6/http'])",
    'maxSerializedSpecBytes',
    'generatorConfigurationDigest',
    'canonicalRenderingPolicyDigest',
    'identityExcludedFields',
    'sourceGenerationStarted=false',
    'sourceGenerated=false',
    'sourceExecuted=false',
    'executionRuntimeStarted=false',
    'nextRequiredSlice=M3-R2-P2',
  ]) assert(Object.values(sources).some((source) => source.includes(marker)),
    `M3-R2 P1 contract marker is missing: ${marker}`);

  for (const forbidden of [
    'actions: write', 'contents: write', 'packages: write',
    'k6 run', 'xk6 build', 'playwright test', 'child_process',
    'node --experimental-vm', 'kubectl', 'helm install',
    'docker push', 'npm publish',
  ]) assert(!sources.workflow.toLowerCase().includes(forbidden),
    `M3-R2 P1 Workflow contains forbidden capability: ${forbidden}`);

  for (const doc of [
    sources.handoff, sources.roadmap, sources.acceptance, sources.adr,
    sources.threatModel, sources.release,
  ]) {
    assert(doc.includes('sourceGenerationStarted=false')
        && doc.includes('sourceGenerated=false')
        && doc.includes('sourceExecuted=false')
        && doc.includes('executionRuntimeStarted=false')
        && doc.includes('k6Invoked=false'),
    'M3-R2 P1 documentation does not preserve non-execution evidence');
  }
}

async function loadSources() {
  return Object.fromEntries(await Promise.all(Object.entries(PATHS)
    .filter(([key]) => !['rootPackage', 'packageManifest', 'catalog'].includes(key))
    .map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')])));
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(ROOT, path), 'utf8'));
}

async function pathExists(path) {
  try {
    await access(join(ROOT, path), fsConstants.F_OK);
    return true;
  } catch (error) {
    if (error?.code === 'ENOENT') return false;
    throw error;
  }
}

function resolveBranch(options) {
  if (typeof options.branch === 'string' && options.branch.trim()) return options.branch;
  for (const value of [process.env.GITHUB_HEAD_REF, process.env.GITHUB_REF_NAME]) {
    if (typeof value === 'string' && value.trim()) return value;
  }
  return 'local';
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(await validateM3R2SourceGenerationP1(), null, 2)}\n`);
}
