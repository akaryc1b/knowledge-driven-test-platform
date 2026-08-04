import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  computeK6NodeProcessAdapterDigest,
  computeK6ProcessExecutionCommandDigest,
  createK6NodeProcessAdapterDescriptor,
  createK6ProcessExecutionCommand,
  validateK6NodeProcessAdapterDescriptor,
  validateK6ProcessExecutionCommand,
} from '../packages/k6-api-adapter/src/process-execution-lifecycle.js';
import { processExecutionFixture } from
  '../packages/k6-api-adapter/test/process-execution-lifecycle-test-helpers.js';
import {
  ACCEPTED_M3_R3_P1,
  M3_R3_P2_CI_SAFETY_FIELDS,
  M3_R3_P2_PATHS,
  M3_R3_P2_SCHEMA_PATHS,
  assertM3R3P2,
} from './m3-r3-p2-baseline.js';

const ROOT = process.cwd();

export async function loadM3R3P2Repository() {
  const paths = [
    M3_R3_P2_PATHS.rootPackage,
    M3_R3_P2_PATHS.index,
    M3_R3_P2_PATHS.lifecycleModule,
    M3_R3_P2_PATHS.contractsModule,
    M3_R3_P2_PATHS.evidenceModule,
    M3_R3_P2_PATHS.adapterModule,
    M3_R3_P2_PATHS.testHelper,
    ...M3_R3_P2_PATHS.tests,
    M3_R3_P2_PATHS.p1BoundaryModule,
    M3_R3_P2_PATHS.p1SchemaCatalog,
    M3_R3_P2_PATHS.schemaCatalog,
    ...M3_R3_P2_PATHS.schemas,
    M3_R3_P2_PATHS.baseline,
    M3_R3_P2_PATHS.repository,
    M3_R3_P2_PATHS.validator,
    M3_R3_P2_PATHS.workflowValidator,
    M3_R3_P2_PATHS.workflow,
    M3_R3_P2_PATHS.handoff,
    M3_R3_P2_PATHS.roadmap,
    M3_R3_P2_PATHS.acceptance,
    M3_R3_P2_PATHS.adr,
    M3_R3_P2_PATHS.threatModel,
    M3_R3_P2_PATHS.release,
    M3_R3_P2_PATHS.docsIndex,
  ];
  const entries = await Promise.all(paths.map(async (path) =>
    [path, await readFile(join(ROOT, path), 'utf8')]));
  return {
    files: Object.fromEntries(entries),
    fixture: await processExecutionFixture(),
  };
}

export function validateM3R3P2Repository(repository) {
  validateAcceptedP1(repository);
  validateContracts(repository.fixture);
  validateSchemas(repository.files);
  validatePackageWiring(repository.files);
  validateImplementationBoundary(repository.files);
  validateWorkflow(repository.files[M3_R3_P2_PATHS.workflow]);
  validateDocumentation(repository.files);
  return true;
}

function validateAcceptedP1(repository) {
  const fixture = repository.fixture;
  const p1 = fixture.p1;
  const catalogDigest = sha256(parseJson(
    repository.files[M3_R3_P2_PATHS.p1SchemaCatalog], 'P1 Schema Catalog'));
  assertM3R3P2(ACCEPTED_M3_R3_P1.mainSha === ACCEPTED_M3_R3_P1.mergeSha
      && p1.descriptor.portDigest === ACCEPTED_M3_R3_P1.portDigest
      && p1.result.launchSpecification.specificationDigest
        === ACCEPTED_M3_R3_P1.launchSpecificationDigest
      && p1.result.launchDecision.decisionDigest
        === ACCEPTED_M3_R3_P1.launchDecisionDigest
      && p1.result.boundaryEvidence.evidenceDigest
        === ACCEPTED_M3_R3_P1.boundaryEvidenceDigest
      && catalogDigest === ACCEPTED_M3_R3_P1.schemaCatalogDigest
      && p1.result.boundaryEvidence.decision.nodeProcessAdapterImplemented === false
      && p1.result.boundaryEvidence.decision.nextRequiredSlice === 'M3-R3-P2',
  'M3-R3-P2 accepted P1 exact-main binding changed');
}

function validateContracts(fixture) {
  const descriptor = validateK6NodeProcessAdapterDescriptor(fixture.adapterDescriptor);
  const command = validateK6ProcessExecutionCommand(fixture.command, fixture.bindings);
  assertM3R3P2(canonicalStringify(descriptor)
      === canonicalStringify(createK6NodeProcessAdapterDescriptor())
      && canonicalStringify(command)
        === canonicalStringify(createK6ProcessExecutionCommand(fixture.bindings))
      && computeK6NodeProcessAdapterDigest(descriptor) === descriptor.adapterDigest
      && computeK6ProcessExecutionCommandDigest(command) === command.commandDigest
      && command.predecessor.boundaryEvidenceDigest
        === ACCEPTED_M3_R3_P1.boundaryEvidenceDigest
      && command.executable === 'k6'
      && command.shell === false
      && command.processStartAuthorized === true
      && command.environment.valuesIncluded === false
      && command.environment.inheritHostEnvironment === false
      && command.workingDirectory.absolutePathIncluded === false,
  'M3-R3-P2 contract reproduction failed');
}

function validateSchemas(files) {
  const catalog = parseJson(files[M3_R3_P2_PATHS.schemaCatalog], 'P2 Schema Catalog');
  assertM3R3P2(catalog.schemaVersion
      === 'k6-bounded-process-lifecycle-schema-catalog/v1'
      && Array.isArray(catalog.schemas)
      && canonicalStringify(catalog.schemas.map((entry) => entry.path))
        === canonicalStringify(M3_R3_P2_SCHEMA_PATHS),
  'M3-R3-P2 Schema Catalog changed');
  for (const path of M3_R3_P2_SCHEMA_PATHS) {
    const schema = parseJson(files[path], path);
    assertM3R3P2(schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
      `${path} must use Draft 2020-12`);
    assertClosedSchema(schema, path);
  }
  const adapter = parseJson(files[M3_R3_P2_SCHEMA_PATHS[0]], 'adapter schema');
  assertM3R3P2(adapter.properties?.processPrimitive?.const === 'node:child_process.spawn'
      && adapter.properties?.executable?.const === 'k6'
      && adapter.properties?.shell?.const === false
      && adapter.properties?.detached?.const === false
      && adapter.properties?.hostEnvironmentInherited?.const === false
      && adapter.properties?.numericProcessIdExposed?.const === false,
  'P2 adapter Schema widens the process boundary');
  const command = parseJson(files[M3_R3_P2_SCHEMA_PATHS[1]], 'command schema');
  assertM3R3P2(command.properties?.processStartAuthorized?.const === true
      && command.properties?.workingDirectory?.properties?.absolutePathIncluded?.const
        === false
      && command.properties?.environment?.properties?.valuesIncluded?.const === false
      && command.properties?.environment?.properties?.inheritHostEnvironment?.const
        === false
      && command.properties?.lifecycle?.properties?.startupTimeoutMs?.const === 5000
      && command.properties?.lifecycle?.properties?.forceSettleMs?.const === 1000,
  'P2 command Schema widens the bounded lifecycle');
  const lifecycle = parseJson(files[M3_R3_P2_SCHEMA_PATHS[2]], 'lifecycle schema');
  for (const field of [
    'numericProcessIdExposed', 'stdoutCollected', 'stderrCollected',
    'runtimeResultCollected',
  ]) assertM3R3P2(lifecycle.properties?.observations?.properties?.[field]?.const === false,
    `P2 lifecycle Schema exposes forbidden ${field}`);
  assertM3R3P2(Object.values(
    lifecycle.properties?.safetyBoundary?.properties ?? {})
    .every((property) => property.const === false),
  'P2 lifecycle Schema safety boundary changed');
  const acceptance = parseJson(files[M3_R3_P2_SCHEMA_PATHS[3]], 'acceptance schema');
  assertM3R3P2(acceptance.properties?.decision?.properties
    ?.nodeProcessAdapterImplemented?.const === true
      && acceptance.properties?.decision?.properties?.realProcessStartedInCi?.const
        === false
      && acceptance.properties?.decision?.properties?.nextRequiredSlice?.const
        === 'M3-R3-P3'
      && canonicalStringify(
        Object.keys(acceptance.properties?.safetyBoundary?.properties ?? {}).sort())
        === canonicalStringify([...M3_R3_P2_CI_SAFETY_FIELDS].sort()),
  'P2 acceptance Schema changes the CI or next-slice boundary');
}

function validatePackageWiring(files) {
  const pkg = parseJson(files[M3_R3_P2_PATHS.rootPackage], 'root package');
  const dedicated = pkg.scripts?.['validate:m3-r3-p2-bounded-process-lifecycle'] ?? '';
  const root = pkg.scripts?.validate ?? '';
  assertM3R3P2(dedicated === 'node scripts/validate-m3-r3-p2-bounded-process-lifecycle.js',
    'Root package is missing the exact M3-R3-P2 validator command');
  assertM3R3P2(root.includes('validate-m3-r3-p1-local-process-boundary.js')
      && root.includes('validate-m3-r3-p2-bounded-process-lifecycle.js')
      && root.includes('validate-m2-final-release-closure.js')
      && root.indexOf('validate-m3-r3-p1-local-process-boundary.js')
        < root.indexOf('validate-m3-r3-p2-bounded-process-lifecycle.js')
      && root.indexOf('validate-m3-r3-p2-bounded-process-lifecycle.js')
        < root.indexOf('validate-m2-final-release-closure.js'),
  'Root validation must preserve P1 -> P2 -> M2 final closure order');
}

function validateImplementationBoundary(files) {
  const lifecycle = files[M3_R3_P2_PATHS.lifecycleModule];
  const contracts = files[M3_R3_P2_PATHS.contractsModule];
  const evidence = files[M3_R3_P2_PATHS.evidenceModule];
  const adapter = files[M3_R3_P2_PATHS.adapterModule];
  const index = files[M3_R3_P2_PATHS.index];
  assertM3R3P2(index.includes("export * from './process-execution-lifecycle.js';")
      && lifecycle.includes("export * from './process-execution-contracts.js';")
      && lifecycle.includes("export * from './process-lifecycle-evidence.js';")
      && lifecycle.includes("export * from './node-process-adapter.js';"),
  'P2 lifecycle modules are not exported');
  for (const marker of [
    "import { spawn } from 'node:child_process';",
    'const NODE_ADAPTER_EXECUTORS = new WeakMap()',
    'NODE_ADAPTER_EXECUTORS.has(adapter)',
    "stdio: ['ignore', 'ignore', 'ignore']",
  ]) assertM3R3P2(adapter.includes(marker), `P2 Node adapter is missing ${marker}`);
  for (const marker of [
    "processPrimitive: 'node:child_process.spawn'",
    'startupTimeoutMs: K6_PROCESS_STARTUP_ALLOWANCE_MS',
    "cooperativeSignal: 'SIGINT'",
    "forceKillSignal: 'SIGKILL'",
    'hostEnvironmentInherited: false',
    'numericProcessIdExposed: false',
  ]) assertM3R3P2(contracts.includes(marker), `P2 contracts are missing ${marker}`);
  assertM3R3P2(evidence.includes("nextRequiredSlice: 'M3-R3-P3'"),
    'P2 lifecycle Evidence does not point to P3');
  const production = [lifecycle, contracts, evidence, adapter].join('\n');
  for (const forbidden of [
    'exec(', 'execSync(', 'execFile(', 'fork(', 'spawnSync(',
    "from 'node:vm'", "from 'node:worker_threads'", 'shell: true',
    'eval(', 'new Function(', 'process.env', "stdio: 'pipe'",
    'docker run', 'kubectl', 'playwright test',
  ]) assertM3R3P2(!production.includes(forbidden),
    `P2 lifecycle introduces forbidden behavior: ${forbidden}`);
  assertM3R3P2((production.match(/from 'node:child_process'/gu) ?? []).length === 1,
    'P2 lifecycle must have one explicit child_process import');
  const combinedTests = [M3_R3_P2_PATHS.testHelper, ...M3_R3_P2_PATHS.tests]
    .map((path) => files[path]).join('\n');
  for (const marker of [
    'bounds missing spawn acknowledgement',
    'timeout sends cooperative SIGINT',
    'escalates to SIGKILL',
    'force-kill settlement',
    'cancels before start',
    'synchronous spawn failure',
    'pre-spawn child error',
    'never exposes a numeric host PID',
    'rejects an unregistered adapter',
    'argv structure substitution',
    'Source Bundle logical URI substitution',
    'event substitution after redigest',
  ]) assertM3R3P2(combinedTests.includes(marker), `P2 tests are missing ${marker}`);
}

function validateWorkflow(source) {
  for (const marker of [
    'name: m3-r3-p2-bounded-process-lifecycle',
    '\n  pull_request:\n',
    '\n  push:\n    branches: [main]\n',
    'permissions:\n  contents: read',
    'persist-credentials: false',
    'node-version: 22',
    'npm ci --ignore-scripts',
    'process-execution-lifecycle*.test.js',
    'npm test',
    'npm run validate',
    'npm run validate:m3-r3-p1-local-process-boundary',
    'm3-r3-p2-bounded-process-lifecycle-evidence',
    'credential-shaped scan: zero matches',
    'if-no-files-found: error',
    'retention-days: 90',
  ]) assertM3R3P2(source.includes(marker), `M3-R3-P2 Workflow is missing ${marker}`);
  for (const forbidden of [
    'workflow_call', 'secrets:', 'id-token: write', 'contents: write',
    'actions: write', 'packages: write', '\nk6 run', '\nxk6 run',
    'playwright test', 'docker run', 'kubectl', 'workflow_dispatch',
  ]) assertM3R3P2(!source.includes(forbidden),
    `M3-R3-P2 Workflow introduces forbidden behavior: ${forbidden}`);
}

function validateDocumentation(files) {
  for (const path of [
    M3_R3_P2_PATHS.handoff,
    M3_R3_P2_PATHS.roadmap,
    M3_R3_P2_PATHS.acceptance,
    M3_R3_P2_PATHS.adr,
    M3_R3_P2_PATHS.threatModel,
    M3_R3_P2_PATHS.release,
  ]) {
    const source = files[path];
    for (const marker of [
      'M3-R3-P2',
      'nodeProcessAdapterImplemented=true',
      'boundedLifecycleImplemented=true',
      'realProcessStartedInCi=false',
      'runtimeResultCollected=false',
      'nextRequiredSlice=M3-R3-P3',
    ]) assertM3R3P2(source.includes(marker), `${path} is missing ${marker}`);
    const lines = source.split(/\r?\n/u).map((line) => line.trim());
    assertM3R3P2(!lines.includes('M3-R3-P3 started')
        && !lines.includes('Ready=true')
        && !lines.includes('merged=true'),
    `${path} starts a forbidden next slice or merge transition`);
  }
  const index = files[M3_R3_P2_PATHS.docsIndex];
  for (const path of [
    M3_R3_P2_PATHS.handoff,
    M3_R3_P2_PATHS.roadmap,
    M3_R3_P2_PATHS.acceptance,
    M3_R3_P2_PATHS.adr,
    M3_R3_P2_PATHS.threatModel,
    M3_R3_P2_PATHS.release,
  ]) assertM3R3P2(index.includes(path.replace(/^docs\//u, '')),
    `docs/README.md is missing ${path}`);
}

function assertClosedSchema(schema, label) {
  assertM3R3P2(schema.type === 'object' && schema.additionalProperties === false
      && Array.isArray(schema.required) && schema.properties
      && canonicalStringify([...schema.required].sort())
        === canonicalStringify(Object.keys(schema.properties).sort()),
  `${label} must be a closed object with every property required`);
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch { throw new Error(`${label} is not valid JSON`); }
}

export function computeM3R3P2SchemaCatalogDigest(repository) {
  return sha256(parseJson(repository.files[M3_R3_P2_PATHS.schemaCatalog],
    'P2 Schema Catalog'));
}
