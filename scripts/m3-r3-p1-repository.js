import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  K6_PROCESS_BOUNDARY_DECISION,
  K6_PROCESS_BOUNDARY_SAFETY,
  createK6LocalProcessPortDescriptor,
  createK6LocalProcessPortReceipt,
  createK6ProcessBoundaryEvidence,
  createK6ProcessLaunchDecision,
  createK6ProcessLaunchSpecification,
  validateK6LocalProcessPortDescriptor,
  validateK6ProcessBoundaryEvidence,
  validateK6ProcessLaunchDecision,
  validateK6ProcessLaunchSpecification,
} from '../packages/k6-api-adapter/src/index.js';
import { localProcessBoundaryFixture } from
  '../packages/k6-api-adapter/test/local-process-boundary-test-helpers.js';
import {
  ACCEPTED_M3_R3_R0,
  M3_R3_P1_FALSE_SAFETY_FIELDS,
  M3_R3_P1_PATHS,
  M3_R3_P1_SCHEMA_PATHS,
  assertM3R3P1,
} from './m3-r3-p1-baseline.js';

const ROOT = process.cwd();

export async function loadM3R3P1Repository() {
  const paths = [
    M3_R3_P1_PATHS.rootPackage,
    M3_R3_P1_PATHS.constants,
    M3_R3_P1_PATHS.errors,
    M3_R3_P1_PATHS.runtimeModule,
    M3_R3_P1_PATHS.boundaryModule,
    M3_R3_P1_PATHS.index,
    M3_R3_P1_PATHS.testHelper,
    ...M3_R3_P1_PATHS.tests,
    M3_R3_P1_PATHS.schemaCatalog,
    ...M3_R3_P1_PATHS.schemas,
    M3_R3_P1_PATHS.baseline,
    M3_R3_P1_PATHS.repository,
    M3_R3_P1_PATHS.validator,
    M3_R3_P1_PATHS.workflow,
    M3_R3_P1_PATHS.handoff,
    M3_R3_P1_PATHS.roadmap,
    M3_R3_P1_PATHS.acceptance,
    M3_R3_P1_PATHS.adr,
    M3_R3_P1_PATHS.threatModel,
    M3_R3_P1_PATHS.release,
    M3_R3_P1_PATHS.docsIndex,
  ];
  const entries = await Promise.all(paths.map(async (path) =>
    [path, await readFile(join(ROOT, path), 'utf8')]));
  return {
    files: Object.fromEntries(entries),
    fixture: await localProcessBoundaryFixture(),
  };
}

export function validateM3R3P1Repository(repository) {
  validateAcceptedR0(repository.fixture);
  validateContracts(repository.fixture);
  validateSchemas(repository.files);
  validatePackageWiring(repository.files);
  validateImplementationBoundary(repository.files);
  validateWorkflow(repository.files[M3_R3_P1_PATHS.workflow]);
  validateDocumentation(repository.files);
  return true;
}

function validateAcceptedR0(fixture) {
  const runtime = fixture.runtime;
  assertM3R3P1(ACCEPTED_M3_R3_R0.mainSha === ACCEPTED_M3_R3_R0.mergeSha
      && runtime.policy.policyDigest === ACCEPTED_M3_R3_R0.runtimePolicyDigest
      && runtime.admissionRequest.admissionDigest
        === ACCEPTED_M3_R3_R0.runtimeAdmissionRequestDigest
      && runtime.invocationPlan.planDigest === ACCEPTED_M3_R3_R0.invocationPlanDigest
      && runtime.admissionEvidence.evidenceDigest
        === ACCEPTED_M3_R3_R0.runtimeAdmissionEvidenceDigest,
  'M3-R3-P1 accepted R0 exact-main binding changed');
}

function validateContracts(fixture) {
  const runtime = fixture.runtime;
  const bindings = {
    policy: runtime.policy,
    admissionRequest: runtime.admissionRequest,
    invocationPlan: runtime.invocationPlan,
    admissionEvidence: runtime.admissionEvidence,
  };
  const port = validateK6LocalProcessPortDescriptor(fixture.descriptor);
  const specification = validateK6ProcessLaunchSpecification(
    fixture.result.launchSpecification, bindings);
  const receipt = createK6LocalProcessPortReceipt(port, specification);
  const decision = validateK6ProcessLaunchDecision(fixture.result.launchDecision, {
    portDescriptor: port,
    launchSpecification: specification,
    portReceipt: receipt,
  });
  const evidence = validateK6ProcessBoundaryEvidence(fixture.result.boundaryEvidence, {
    ...bindings,
    portDescriptor: port,
    launchSpecification: specification,
    launchDecision: decision,
  });
  assertM3R3P1(
    canonicalStringify(port) === canonicalStringify(createK6LocalProcessPortDescriptor())
      && canonicalStringify(specification)
        === canonicalStringify(createK6ProcessLaunchSpecification(bindings))
      && canonicalStringify(decision) === canonicalStringify(
        createK6ProcessLaunchDecision({
          portDescriptor: port, launchSpecification: specification, portReceipt: receipt,
        }))
      && canonicalStringify(evidence) === canonicalStringify(
        createK6ProcessBoundaryEvidence({
          ...bindings, portDescriptor: port,
          launchSpecification: specification, launchDecision: decision,
        }))
      && canonicalStringify(evidence.decision)
        === canonicalStringify(K6_PROCESS_BOUNDARY_DECISION)
      && canonicalStringify(evidence.safetyBoundary)
        === canonicalStringify(K6_PROCESS_BOUNDARY_SAFETY)
      && Object.values(evidence.safetyBoundary).every((value) => value === false),
  'M3-R3-P1 process boundary contract reproduction failed');
}

function validateSchemas(files) {
  const catalog = parseJson(files[M3_R3_P1_PATHS.schemaCatalog], 'runtime Schema Catalog');
  assertM3R3P1(catalog.schemaVersion === 'k6-api-runtime-schema-catalog/v1'
      && Array.isArray(catalog.schemas)
      && canonicalStringify(catalog.schemas.map((item) => item.path))
        === canonicalStringify(M3_R3_P1_SCHEMA_PATHS),
  'M3-R3-P1 runtime Schema Catalog changed or is not additive');
  for (const path of M3_R3_P1_SCHEMA_PATHS) {
    const schema = parseJson(files[path], path);
    assertM3R3P1(schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
      `${path} must use Draft 2020-12`);
    assertClosedSchema(schema, path);
  }
  const port = parseJson(files[M3_R3_P1_SCHEMA_PATHS[5]], 'local process port schema');
  assertM3R3P1(port.properties?.implementationStatus?.const === 'INJECTED_NON_EXECUTING'
      && port.properties?.capabilities?.properties?.startProcess?.const === false
      && port.properties?.capabilities?.properties?.createProcessId?.const === false
      && port.properties?.capabilities?.properties?.shell?.const === false,
  'Local process port Schema authorizes process execution');
  const specification = parseJson(
    files[M3_R3_P1_SCHEMA_PATHS[6]], 'launch specification schema');
  assertM3R3P1(specification.properties?.executable?.const === 'k6'
      && specification.properties?.shell?.const === false
      && specification.properties?.processStartAuthorized?.const === false
      && specification.properties?.workingDirectory?.properties
        ?.absolutePathIncluded?.const === false
      && specification.properties?.environment?.properties?.valuesIncluded?.const === false
      && specification.properties?.environment?.properties
        ?.inheritHostEnvironment?.const === false
      && specification.properties?.stdin?.properties?.contentIncluded?.const === false,
  'Launch Specification Schema widens the P1 process boundary');
  for (const path of [M3_R3_P1_SCHEMA_PATHS[7], M3_R3_P1_SCHEMA_PATHS[8],
    M3_R3_P1_SCHEMA_PATHS[9]]) {
    const schema = parseJson(files[path], path);
    assertM3R3P1(schema.properties?.decision?.properties
      ?.nodeProcessAdapterImplemented?.const === false
      && schema.properties?.decision?.properties?.processStarted?.const === false
      && schema.properties?.decision?.properties?.nextRequiredSlice?.const === 'M3-R3-P2'
      && Object.values(schema.properties?.safetyBoundary?.properties ?? {})
        .every((property) => property.const === false)
      && canonicalStringify(
        Object.keys(schema.properties?.safetyBoundary?.properties ?? {}).sort())
        === canonicalStringify([...M3_R3_P1_FALSE_SAFETY_FIELDS].sort()),
    `${path} widens the non-execution decision`);
  }
}

function validatePackageWiring(files) {
  const pkg = parseJson(files[M3_R3_P1_PATHS.rootPackage], 'root package');
  const dedicated = pkg.scripts?.['validate:m3-r3-p1-local-process-boundary'] ?? '';
  const root = pkg.scripts?.validate ?? '';
  assertM3R3P1(dedicated.includes('validate-m3-r3-p1-local-process-boundary.js'),
    'Root package is missing the M3-R3-P1 validator script');
  assertM3R3P1(root.includes('validate-m3-r3-runtime-admission.js')
      && root.includes('validate-m3-r3-p1-local-process-boundary.js')
      && root.includes('validate-m2-final-release-closure.js')
      && root.indexOf('validate-m3-r3-runtime-admission.js')
        < root.indexOf('validate-m3-r3-p1-local-process-boundary.js')
      && root.indexOf('validate-m3-r3-p1-local-process-boundary.js')
        < root.indexOf('validate-m2-final-release-closure.js'),
  'Root validation must preserve R0 -> P1 -> M2 final closure order');
}

function validateImplementationBoundary(files) {
  const constants = files[M3_R3_P1_PATHS.constants];
  const boundary = files[M3_R3_P1_PATHS.boundaryModule];
  const index = files[M3_R3_P1_PATHS.index];
  for (const marker of [
    "K6_LOCAL_PROCESS_PORT_SCHEMA_VERSION = 'k6-local-process-port/v1'",
    "K6_PROCESS_LAUNCH_SPECIFICATION_SCHEMA_VERSION =",
    "K6_PROCESS_LAUNCH_DECISION_SCHEMA_VERSION =",
    "K6_PROCESS_BOUNDARY_EVIDENCE_SCHEMA_VERSION =",
    "K6_PROCESS_LOGICAL_WORKING_DIRECTORY = 'accepted-source-bundle-root'",
    'K6_PROCESS_CAPTURE_MAX_BYTES = 65_536',
  ]) assertM3R3P1(constants.includes(marker), `P1 constants are missing ${marker}`);
  assertM3R3P1(index.includes("export * from './local-process-boundary.js';"),
    'Local process boundary module is not exported');
  for (const marker of [
    'createK6LocalProcessPortDescriptor',
    'createK6ProcessLaunchSpecification',
    'prepareK6LocalProcessLaunch',
    'createK6ProcessLaunchDecision',
    'createK6ProcessBoundaryEvidence',
    'processStartAuthorized: false',
    'inheritHostEnvironment: false',
    "nextRequiredSlice: 'M3-R3-P2'",
  ]) assertM3R3P1(boundary.includes(marker), `P1 boundary module is missing ${marker}`);
  for (const forbidden of [
    "node:child_process", "node:vm", "node:worker_threads",
    'spawn(', 'spawnSync(', 'exec(', 'execSync(', 'execFile(', 'fork(',
    'shell: true', 'eval(', 'new Function(', 'process.env',
    'k6 run', 'xk6 run', 'playwright test', 'docker run', 'kubectl',
  ]) assertM3R3P1(!boundary.includes(forbidden),
    `P1 boundary module introduces forbidden execution primitive: ${forbidden}`);
  const combinedTests = [M3_R3_P1_PATHS.testHelper, ...M3_R3_P1_PATHS.tests]
    .map((path) => files[path]).join('\n');
  for (const marker of [
    'rejects executable substitution', 'rejects argv shell fragment',
    'rejects command-string replacement', 'rejects shell=true',
    'rejects arbitrary working directory', 'rejects an unapproved environment variable',
    'rejects environment values', 'rejects full host environment inheritance',
    'rejects stdin content injection', 'rejects predecessor digest drift',
    'rejects an unaccepted Source Bundle', 'rejects an unbound fake-port receipt',
    'rejects fake-port execution claim', 'rejects Evidence execution escalation',
    'rejects forbidden process primitive injection',
  ]) assertM3R3P1(combinedTests.includes(marker),
    `P1 tests are missing ${marker}`);
}

function validateWorkflow(source) {
  for (const marker of [
    'name: m3-r3-p1-local-process-boundary',
    '\n  pull_request:\n',
    '\n  push:\n    branches: [main]\n',
    'permissions:\n  contents: read',
    'persist-credentials: false',
    'node-version: 22',
    'npm ci --ignore-scripts',
    'local-process-boundary*.test.js',
    'npm test',
    'npm run validate',
    'npm run validate:m3-r3-runtime-admission',
    'm3-r3-p1-local-process-boundary-evidence',
    'if-no-files-found: error',
    'retention-days: 90',
  ]) assertM3R3P1(source.includes(marker), `M3-R3-P1 Workflow is missing ${marker}`);
  for (const forbidden of [
    'workflow_call', 'secrets:', 'id-token: write', 'contents: write',
    'actions: write', 'packages: write', 'k6 run', 'xk6 run',
    'playwright test', 'docker run', 'kubectl',
  ]) assertM3R3P1(!source.includes(forbidden),
    `M3-R3-P1 Workflow introduces forbidden behavior: ${forbidden}`);
}

function validateDocumentation(files) {
  for (const path of [
    M3_R3_P1_PATHS.handoff,
    M3_R3_P1_PATHS.roadmap,
    M3_R3_P1_PATHS.acceptance,
    M3_R3_P1_PATHS.adr,
    M3_R3_P1_PATHS.threatModel,
    M3_R3_P1_PATHS.release,
  ]) {
    const source = files[path];
    for (const marker of [
      'M3-R3-P1',
      'nextRequiredSlice=M3-R3-P2',
      'nodeProcessAdapterImplemented=false',
      'processStarted=false',
      'processIdCreated=false',
      'k6Invoked=false',
      'externalProcessExecuted=false',
    ]) assertM3R3P1(source.includes(marker), `${path} is missing ${marker}`);
    const lines = source.split(/\r?\n/u).map((line) => line.trim());
    assertM3R3P1(!lines.includes('M3-R3-P2 started')
        && !lines.includes('Ready=true')
        && !lines.includes('merged=true'),
    `${path} starts a forbidden next slice or merge transition`);
  }
  const index = files[M3_R3_P1_PATHS.docsIndex];
  for (const path of [
    M3_R3_P1_PATHS.handoff,
    M3_R3_P1_PATHS.roadmap,
    M3_R3_P1_PATHS.acceptance,
    M3_R3_P1_PATHS.adr,
    M3_R3_P1_PATHS.threatModel,
    M3_R3_P1_PATHS.release,
  ]) assertM3R3P1(index.includes(path.replace(/^docs\//u, '')),
    `docs/README.md is missing ${path}`);
}

function assertClosedSchema(schema, label) {
  assertM3R3P1(schema.type === 'object' && schema.additionalProperties === false
      && Array.isArray(schema.required)
      && schema.properties
      && canonicalStringify([...schema.required].sort())
        === canonicalStringify(Object.keys(schema.properties).sort()),
  `${label} must be a closed object with every property required`);
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch { throw new Error(`${label} is not valid JSON`); }
}

export function computeM3R3P1SchemaCatalogDigest(repository) {
  return sha256(parseJson(repository.files[M3_R3_P1_PATHS.schemaCatalog],
    'runtime Schema Catalog'));
}
