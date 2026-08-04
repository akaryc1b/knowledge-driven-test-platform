import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  createK6ApiInvocationPlan,
  createK6ApiRuntimeAdmissionEvidence,
  createK6ApiRuntimeAdmissionRequest,
  createK6ApiRuntimePolicy,
  validateK6ApiInvocationPlan,
  validateK6ApiRuntimeAdmissionEvidence,
  validateK6ApiRuntimeAdmissionRequest,
  validateK6ApiRuntimePolicy,
} from '../packages/k6-api-adapter/src/index.js';
import { runtimeAdmissionFixture } from '../packages/k6-api-adapter/test/runtime-admission-test-helpers.js';
import {
  ACCEPTED_M3_R2,
  M3_R3_R0_FALSE_SAFETY_FIELDS,
  M3_R3_R0_PATHS,
  assertM3R3R0,
} from './m3-r3-r0-baseline.js';

const ROOT = process.cwd();

export async function loadM3R3R0Repository() {
  const paths = [
    M3_R3_R0_PATHS.rootPackage,
    M3_R3_R0_PATHS.constants,
    M3_R3_R0_PATHS.errors,
    M3_R3_R0_PATHS.runtimeModule,
    M3_R3_R0_PATHS.index,
    M3_R3_R0_PATHS.testHelper,
    ...M3_R3_R0_PATHS.tests,
    M3_R3_R0_PATHS.schemaCatalog,
    ...M3_R3_R0_PATHS.schemas,
    M3_R3_R0_PATHS.baseline,
    M3_R3_R0_PATHS.repository,
    M3_R3_R0_PATHS.validator,
    M3_R3_R0_PATHS.workflow,
    M3_R3_R0_PATHS.handoff,
    M3_R3_R0_PATHS.roadmap,
    M3_R3_R0_PATHS.acceptance,
    M3_R3_R0_PATHS.adr,
    M3_R3_R0_PATHS.threatModel,
    M3_R3_R0_PATHS.release,
  ];
  const entries = await Promise.all(paths.map(async (path) =>
    [path, await readFile(join(ROOT, path), 'utf8')]));
  return {
    files: Object.fromEntries(entries),
    fixture: await runtimeAdmissionFixture(),
  };
}

export function validateM3R3R0Repository(repository) {
  validateAcceptedM3R2(repository.fixture);
  validateRuntimeContracts(repository.fixture);
  validateSchemas(repository.files);
  validatePackageWiring(repository.files);
  validateImplementationBoundary(repository.files);
  validateWorkflow(repository.files[M3_R3_R0_PATHS.workflow]);
  validateDocumentation(repository.files);
  return true;
}

function validateAcceptedM3R2(fixture) {
  const publication = fixture.acceptedFixture.receipt.publication;
  assertM3R3R0(ACCEPTED_M3_R2.mainSha === ACCEPTED_M3_R2.mergeSha
      && fixture.admissionRequest.source.bundleDigest === ACCEPTED_M3_R2.bundleDigest
      && fixture.admissionRequest.source.manifestDigest === ACCEPTED_M3_R2.manifestDigest
      && fixture.admissionRequest.source.sourceIdentity === ACCEPTED_M3_R2.sourceIdentity
      && fixture.admissionRequest.source.sourceDigest === ACCEPTED_M3_R2.sourceDigest
      && fixture.admissionRequest.source.sourceArtifactDigest
        === ACCEPTED_M3_R2.sourceArtifactDigest
      && fixture.admissionRequest.source.receiptDigest === ACCEPTED_M3_R2.receiptDigest
      && fixture.admissionRequest.source.publicationEvidenceDigest
        === ACCEPTED_M3_R2.publicationEvidenceDigest
      && publication.bundle.p3EvidenceDigest === ACCEPTED_M3_R2.p3EvidenceDigest,
  'M3-R3-R0 accepted M3-R2 exact-main binding changed');
}

function validateRuntimeContracts(fixture) {
  const policy = validateK6ApiRuntimePolicy(fixture.policy);
  const bindings = {
    policy,
    spec: fixture.renderer.spec,
    compilationEvidence: fixture.renderer.compilationEvidence,
    bundle: fixture.command.bundle,
    receipt: fixture.command.receipt,
    publicationEvidence: fixture.command.publicationEvidence,
    acceptedP3: fixture.acceptedP3,
  };
  const admission = validateK6ApiRuntimeAdmissionRequest(fixture.admissionRequest, bindings);
  const plan = validateK6ApiInvocationPlan(fixture.invocationPlan, admission, policy);
  const evidence = validateK6ApiRuntimeAdmissionEvidence(fixture.admissionEvidence, {
    admissionRequest: admission,
    invocationPlan: plan,
  });
  assertM3R3R0(canonicalStringify(policy) === canonicalStringify(createK6ApiRuntimePolicy())
      && canonicalStringify(admission) === canonicalStringify(
        createK6ApiRuntimeAdmissionRequest(fixture.command))
      && canonicalStringify(plan) === canonicalStringify(
        createK6ApiInvocationPlan(admission, policy))
      && canonicalStringify(evidence) === canonicalStringify(
        createK6ApiRuntimeAdmissionEvidence({ admissionRequest: admission, invocationPlan: plan }))
      && plan.executionAuthorized === false
      && Object.values(evidence.safetyBoundary).every((value) => value === false),
  'M3-R3-R0 runtime contract reproduction failed');
}

function validateSchemas(files) {
  const catalog = parseJson(files[M3_R3_R0_PATHS.schemaCatalog], 'runtime Schema Catalog');
  assertM3R3R0(catalog.schemaVersion === 'k6-api-runtime-schema-catalog/v1'
      && Array.isArray(catalog.schemas)
      && catalog.schemas.length === M3_R3_R0_PATHS.schemas.length
      && canonicalStringify(catalog.schemas.map((item) => item.path))
        === canonicalStringify(M3_R3_R0_PATHS.schemas),
  'M3-R3-R0 runtime Schema Catalog changed');
  for (const path of M3_R3_R0_PATHS.schemas) {
    const schema = parseJson(files[path], path);
    assertClosedSchema(schema, path);
    assertM3R3R0(schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
      `${path} must use Draft 2020-12`);
  }
  const policy = parseJson(files[M3_R3_R0_PATHS.schemas[0]], 'runtime policy schema');
  assertM3R3R0(policy.properties?.implementationStatus?.const === 'ADMISSION_ONLY'
      && policy.properties?.shellAllowed?.const === false
      && policy.properties?.executable?.const === 'k6',
  'Runtime policy schema widened the R0 boundary');
  const plan = parseJson(files[M3_R3_R0_PATHS.schemas[2]], 'invocation plan schema');
  assertM3R3R0(plan.properties?.executionAuthorized?.const === false
      && plan.properties?.runtime?.properties?.shellAllowed?.const === false,
  'Invocation Plan schema authorizes execution or shell');
  for (const path of [M3_R3_R0_PATHS.schemas[3], M3_R3_R0_PATHS.schemas[4]]) {
    const schema = parseJson(files[path], path);
    assertM3R3R0(schema.properties?.decision?.properties
      ?.executionImplementationStarted?.const === false
      && schema.properties?.decision?.properties?.nextRequiredSlice?.const === 'M3-R3-P1'
      && Object.values(schema.properties?.safetyBoundary?.properties ?? {})
        .every((property) => property.const === false),
    `${path} widened the non-execution decision`);
  }
}

function validatePackageWiring(files) {
  const pkg = parseJson(files[M3_R3_R0_PATHS.rootPackage], 'root package');
  const dedicated = pkg.scripts?.['validate:m3-r3-runtime-admission'] ?? '';
  const root = pkg.scripts?.validate ?? '';
  assertM3R3R0(dedicated.includes('validate-m3-r3-runtime-admission.js'),
    'Root package is missing the M3-R3-R0 validator script');
  assertM3R3R0(root.includes('validate-m3-r2-source-generation-p5.js')
      && root.includes('validate-m3-r3-runtime-admission.js')
      && root.includes('validate-m2-final-release-closure.js')
      && root.indexOf('validate-m3-r2-source-generation-p5.js')
        < root.indexOf('validate-m3-r3-runtime-admission.js')
      && root.indexOf('validate-m3-r3-runtime-admission.js')
        < root.indexOf('validate-m2-final-release-closure.js'),
  'Root validation must preserve P5 -> M3-R3-R0 -> M2 final closure order');
}

function validateImplementationBoundary(files) {
  const constants = files[M3_R3_R0_PATHS.constants];
  const errors = files[M3_R3_R0_PATHS.errors];
  const runtime = files[M3_R3_R0_PATHS.runtimeModule];
  const index = files[M3_R3_R0_PATHS.index];
  for (const marker of [
    "K6_API_RUNTIME_IMPLEMENTATION_STATUS = 'ADMISSION_ONLY'",
    "K6_API_RUNTIME_EXECUTION_MODE = 'LOCAL_PROCESS'",
    "K6_API_RUNTIME_EXECUTABLE = 'k6'",
    'maxVus: 50',
    'maxDurationMs: 900_000',
  ]) assertM3R3R0(constants.includes(marker), `Runtime constants are missing ${marker}`);
  assertM3R3R0(errors.includes('K6ApiRuntimeAdmissionError')
      && index.includes("export * from './runtime-admission.js';"),
  'Runtime admission module is not exported through the package boundary');
  for (const marker of [
    'createK6ApiRuntimePolicy',
    'createK6ApiRuntimeAdmissionRequest',
    'createK6ApiInvocationPlan',
    'createK6ApiRuntimeAdmissionEvidence',
    'executionAuthorized: false',
    "nextRequiredSlice: 'M3-R3-P1'",
  ]) assertM3R3R0(runtime.includes(marker), `Runtime admission module is missing ${marker}`);
  for (const forbidden of [
    "from 'node:child_process'", "from 'node:vm'", "from 'node:worker_threads'",
    'spawn(', 'exec(', 'execFile(', 'fork(', 'eval(', 'new Function(',
    'fetch(', 'http.request', 'https.request', 'docker run', 'kubectl',
  ]) assertM3R3R0(!runtime.includes(forbidden),
    `Runtime admission module introduces forbidden execution primitive: ${forbidden}`);
  const combinedTests = [M3_R3_R0_PATHS.testHelper, ...M3_R3_R0_PATHS.tests]
    .map((path) => files[path]).join('\n');
  for (const marker of [
    'accepted P4', 'Execution Request substitution', 'allow-list escalation',
    'shell fragments', 'execution and environment boundary false',
    'closed Draft 2020-12 contracts',
  ]) assertM3R3R0(combinedTests.includes(marker),
    `Runtime admission tests are missing ${marker}`);
}

function validateWorkflow(source) {
  for (const marker of [
    'name: m3-r3-runtime-admission',
    '\n  pull_request:\n',
    '\n  push:\n    branches: [main]\n',
    'permissions:\n  contents: read',
    'persist-credentials: false',
    'node-version: 22',
    'npm ci --ignore-scripts',
    'runtime-admission*.test.js',
    'npm test',
    'npm run validate',
    'm3-r3-runtime-admission-evidence',
    'if-no-files-found: error',
    'retention-days: 90',
  ]) assertM3R3R0(source.includes(marker), `M3-R3-R0 workflow is missing ${marker}`);
  for (const forbidden of [
    'k6 run', 'xk6 run', 'playwright test', 'docker run', 'kubectl',
    'workflow_call', 'secrets:', 'id-token: write',
  ]) assertM3R3R0(!source.includes(forbidden),
    `M3-R3-R0 workflow introduces forbidden behavior: ${forbidden}`);
}

function validateDocumentation(files) {
  for (const path of [
    M3_R3_R0_PATHS.handoff,
    M3_R3_R0_PATHS.roadmap,
    M3_R3_R0_PATHS.acceptance,
    M3_R3_R0_PATHS.adr,
    M3_R3_R0_PATHS.threatModel,
    M3_R3_R0_PATHS.release,
  ]) {
    const source = files[path];
    for (const marker of [
      'M3-R3-R0',
      'nextRequiredSlice=M3-R3-P1',
      'executionImplementationStarted=false',
      'sourceExecuted=false',
      'k6Invoked=false',
      'externalProcessExecuted=false',
    ]) assertM3R3R0(source.includes(marker), `${path} is missing ${marker}`);
    assertM3R3R0(!source.includes('M3-R3-P1 started')
        && !source.includes('Ready=true')
        && !source.includes('merged=true'),
    `${path} starts a forbidden next slice or merge transition`);
  }
}

function assertClosedSchema(schema, label) {
  assertM3R3R0(schema.type === 'object' && schema.additionalProperties === false
      && Array.isArray(schema.required)
      && schema.properties
      && canonicalStringify([...schema.required].sort())
        === canonicalStringify(Object.keys(schema.properties).sort()),
  `${label} must be a closed object with every property required`);
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch { throw new Error(`${label} is not valid JSON`); }
}

export function computeM3R3R0SchemaCatalogDigest(repository) {
  return sha256(parseJson(repository.files[M3_R3_R0_PATHS.schemaCatalog],
    'runtime Schema Catalog'));
}
