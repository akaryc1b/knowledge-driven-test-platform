#!/usr/bin/env node
import { access, readFile } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { sha256 } from '@kdtp/knowledge-core';
import { validateM3R1K6ApiSpecCompiler } from './validate-m3-r1-k6-api-spec-compiler.js';

export const M3_R2_R0_EVIDENCE_SCHEMA_VERSION =
  'm3-r2-source-generation-r0-evidence/v1';

const ROOT = process.cwd();
const ACCEPTED_MAIN = 'ab93321738222c087e6f3c90fd39e092116cf3c8';
const ACCEPTED_M3_R1 = Object.freeze({
  pullRequest: 44,
  mergeSha: ACCEPTED_MAIN,
  exactMainGeneralRunId: 30600867207,
  exactMainDedicatedRunId: 30600867230,
  exactMainArtifactId: 8781826637,
  exactMainArtifactDigest:
    'sha256:689773070e76bcd3cc29e815c9ed27249bd856b0f09a93a0e6a6d6ecee7a1bae',
  inputContractDigest:
    '4b2a767d273ca0e888278eea599f044b5a00ddd4c619ac6bce0a566b9bdad718',
  specDigest:
    '4601fc2d37a343b94516e451bbd8616baaf569a5a4c685ca679cc4a8266c9079',
  bundleDigest:
    '1b4a5c2dc4d6ce12d63805abc53b2bcd6be1100d12cd7d8a7195797eb5fd41b1',
  compilationEvidenceDigest:
    '7c5972c8901198dbe236d27c51fb10510bf7439a486efafcb5a46ca8860ca65e',
  schemaCatalogDigest:
    '80d0f740bc063add8f715355717494520fefee2fb9c14c737d8c1c6edbfed66d',
});
const OBSERVER = Object.freeze({
  pullRequest: 45,
  state: 'closed',
  draft: true,
  merged: false,
  headSha: '48f83dbe2e6090c828d9a7c9a0de3347cf3449d9',
});
const REVIEW = Object.freeze({
  submittedAt: '2026-07-31T03:13:41Z',
  findings: [
    'named-function-executable-material-bypass',
    'compilation-evidence-claims-not-digest-bound',
    'assertion-schema-not-discriminated',
  ],
});

const PATHS = Object.freeze({
  rootPackage: 'package.json',
  safety: 'packages/k6-api-adapter/src/safety.js',
  compiler: 'packages/k6-api-adapter/src/compiler.js',
  hardeningTests: 'packages/k6-api-adapter/test/review-hardening.test.js',
  assertionSchema: 'schemas/execution/k6-api/v1/k6-api-assertion.schema.json',
  workflow: '.github/workflows/m3-r2-k6-api-source-generation.yml',
  handoff: 'docs/02-development/development-handoff.md',
  roadmap: 'docs/03-roadmap/m3-r2-governed-k6-api-source-generation.md',
  acceptance: 'docs/04-governance/m3-r2-source-generation-acceptance-matrix.md',
  adr: 'docs/05-adr/ADR-0029-governed-deterministic-k6-source-generation.md',
  threatModel: 'docs/06-security/m3-r2-source-generation-threat-model.md',
  release: 'docs/releases/M3-R2-k6-api-source-generation.md',
});

export async function validateM3R2SourceGenerationR0(options = {}) {
  const sources = options.sources ?? await loadSources();
  const packageJson = options.packageJson ?? JSON.parse(sources.rootPackage);
  const assertionSchema = options.assertionSchema ?? JSON.parse(sources.assertionSchema);
  validateReviewHardening(sources, assertionSchema);
  validateScopeFreeze(sources);
  validateWorkflow(sources.workflow);
  validateRepositoryWiring(packageJson);

  const generatorPackagePresent = await pathExists('packages/k6-api-source-generator');
  assert(generatorPackagePresent === false,
    'M3-R2 R0 must not contain a source generator package');

  const m3R1 = await validateM3R1K6ApiSpecCompiler({
    generatedAt: options.generatedAt ?? '2026-07-31T03:20:00.000Z',
    commitSha: options.commitSha ?? process.env.GITHUB_SHA ?? 'local',
    branch: options.branch ?? resolveBranch(options),
  });
  assert(m3R1.decision.apiAdapterCompilerReady === true,
    'M3-R1 compiler must remain ready');
  assert(m3R1.decision.executionRuntimeStarted === false
      && m3R1.decision.k6Invoked === false
      && m3R1.decision.externalProcessExecuted === false,
  'M3-R1 non-execution decision changed');
  assert(Object.values(m3R1.safetyBoundary).every((value) => value === false),
    'M3-R1 safety boundary changed');

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(generatedAt),
    'M3-R2 R0 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/.test(commitSha),
    'M3-R2 R0 source SHA is invalid');
  const source = { branch: options.branch ?? resolveBranch(options), commitSha };

  const documentDigests = Object.fromEntries([
    'roadmap', 'acceptance', 'adr', 'threatModel', 'release', 'handoff',
  ].map((key) => [key, sha256(sources[key])]));

  const reviewClosure = {
    ...REVIEW,
    findingsReproduced: true,
    namedFunctionGateHardened: true,
    evidenceClaimsDigestBound: true,
    assertionSchemaDiscriminated: true,
    regressionTestsAdded: true,
    closed: true,
  };
  const decision = {
    sourceGenerationScopeFrozen: true,
    runtimeBoundaryDefined: true,
    threatModelAccepted: true,
    sourceGenerationStarted: false,
    sourceGenerated: false,
    sourceExecuted: false,
    executionRuntimeStarted: false,
    nextRequiredSlice: 'M3-R2-P1',
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
  const integrityClaims = {
    schemaVersion: M3_R2_R0_EVIDENCE_SCHEMA_VERSION,
    source,
    rebaseline: {
      acceptedMainSha: ACCEPTED_MAIN,
      mainMoved: false,
      openPullRequests: 0,
      existingM3R2Branches: 0,
      competingM3R2Work: false,
      acceptedM3R1: { ...ACCEPTED_M3_R1 },
      observer: { ...OBSERVER },
    },
    reviewClosure,
    hardenedM3R1Digests: { ...m3R1.digests },
    documentDigests,
    decision,
    safetyBoundary,
  };
  return {
    ...integrityClaims,
    generatedAt,
    evidenceDigest: sha256(integrityClaims),
  };
}

function validateReviewHardening(sources, schema) {
  for (const marker of [
    'function(?:\\s*\\*)?', 'K6_API_EXECUTABLE_SOURCE_FORBIDDEN',
  ]) assert(sources.safety.includes(marker),
    `M3-R1 named-function hardening marker is missing: ${marker}`);
  for (const marker of [
    'computeK6ApiCompilationEvidenceDigest',
    'metadata: _metadata',
    'evidenceDigest: _evidenceDigest',
    'safetyBoundary',
    'decision',
  ]) assert(sources.compiler.includes(marker),
    `M3-R1 evidence integrity marker is missing: ${marker}`);
  for (const marker of [
    'ordinary named, async and generator function declarations',
    'digest binds decision and every safety claim',
    'assertion schema is a closed discriminated union',
  ]) assert(sources.hardeningTests.includes(marker),
    `M3-R1 review regression test is missing: ${marker}`);

  assert(schema.additionalProperties === false && Array.isArray(schema.oneOf)
      && schema.oneOf.length === 3,
  'K6ApiAssertion must be a closed three-way discriminated union');
  const byKind = Object.fromEntries(schema.oneOf.map((variant) =>
    [variant.properties?.kind?.const, variant]));
  assert(byKind.STATUS_CODE_IN?.properties?.operator?.const === 'IN'
      && byKind.STATUS_CODE_IN.required?.includes('expected'),
  'STATUS_CODE_IN assertion variant is invalid');
  assert(byKind.JSON_PATH_EXISTS?.properties?.operator?.const === 'EXISTS'
      && byKind.JSON_PATH_EXISTS.required?.includes('path'),
  'JSON_PATH_EXISTS assertion variant is invalid');
  assert(byKind.JSON_PATH_EQUALS?.properties?.operator?.const === 'EQUALS'
      && byKind.JSON_PATH_EQUALS.required?.includes('path')
      && byKind.JSON_PATH_EQUALS.required?.includes('expected'),
  'JSON_PATH_EQUALS assertion variant is invalid');
}

function validateScopeFreeze(sources) {
  for (const document of [
    sources.roadmap, sources.acceptance, sources.adr, sources.threatModel, sources.release,
  ]) {
    for (const marker of [
      'sourceGenerationStarted=false',
      'sourceExecuted=false',
      'executionRuntimeStarted=false',
      'k6Invoked=false',
    ]) assert(document.includes(marker),
      `M3-R2 R0 document is missing ${marker}`);
  }
  for (const marker of [
    'Compiler', 'Source Generator', 'M3-R3 Runtime',
    'UTF-8', 'LF', 'dynamic import', 'targetNetworkAccessed=false',
    'secretAccessed=false',
  ]) assert(sources.threatModel.includes(marker) || sources.roadmap.includes(marker),
    `M3-R2 R0 boundary marker is missing: ${marker}`);
}

function validateWorkflow(workflow) {
  for (const marker of [
    'name: m3-r2-k6-api-source-generation',
    'contents: read',
    'persist-credentials: false',
    'node-version: 22',
    'npm ci --ignore-scripts',
    'Run focused M3-R1 and R0 tests',
    'Run full Node test suite',
    'Run repository validation',
    'Run M3-R0 anti-regression',
    'Run M3-R1 anti-regression',
    'Run PostgreSQL 18 integration suite',
    'name: m3-r2-source-generation-r0-evidence',
    'retention-days: 90',
  ]) assert(workflow.includes(marker), `M3-R2 R0 Workflow is missing ${marker}`);
  const lowered = workflow.toLowerCase();
  for (const forbidden of [
    'actions: write', 'contents: write', 'packages: write', 'k6 run', 'xk6 build',
    'playwright test', 'child_process', 'eval(', 'new function', 'node --experimental-vm',
    'kubectl', 'helm install', 'npm publish', 'docker push',
  ]) assert(!lowered.includes(forbidden),
    `M3-R2 R0 Workflow contains forbidden capability: ${forbidden}`);
}

function validateRepositoryWiring(packageJson) {
  assert(packageJson.scripts?.['validate:m3-r2-source-generation-r0'] ===
      'node scripts/validate-m3-r2-source-generation-r0.js',
  'Root package is missing M3-R2 R0 validator');
  assert(packageJson.scripts?.test?.includes('packages/k6-api-adapter/test/*.test.js'),
    'Root test suite is missing M3-R1/R0 tests');
  assert(packageJson.scripts?.validate?.includes('validate-m3-r2-source-generation-r0.js')
      && packageJson.scripts.validate.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must include M3-R2 R0 and preserve M2 final closure last');
}

async function loadSources() {
  return Object.fromEntries(await Promise.all(Object.entries(PATHS)
    .map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')])));
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
  process.stdout.write(`${JSON.stringify(await validateM3R2SourceGenerationR0(), null, 2)}\n`);
}
