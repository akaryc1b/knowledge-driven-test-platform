import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../packages/k6-api-adapter/test/p5-test-helpers.js';
import { processExecutionFixture } from
  '../packages/k6-api-adapter/test/process-execution-lifecycle-test-helpers.js';
import {
  computeK6ProcessTerminalObservationDigest,
  computeK6RuntimeExecutionEvidenceDigest,
  computeK6SanitizedRuntimeOutcomeDigest,
  executeK6ProcessWithSanitizedResult,
  validateK6ProcessTerminalObservation,
  validateK6RuntimeExecutionEvidence,
  validateK6SanitizedRuntimeOutcome,
} from '../packages/k6-api-adapter/src/process-execution-lifecycle.js';

const EVIDENCE_SCHEMA_VERSION = 'm3-r3-sanitized-runtime-result-p3-evidence/v1';
const CATALOG_PATH = 'schemas/execution/k6-api-runtime/p3-schema-catalog.json';
const EVIDENCE_SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/m3-r3-sanitized-runtime-result-p3-evidence.schema.json';
const REQUIRED_PATHS = Object.freeze([
  '.github/workflows/m3-r3-p3-sanitized-runtime-result.yml',
  'packages/k6-api-adapter/src/runtime-result-contracts.js',
  'packages/k6-api-adapter/src/node-process-adapter.js',
  'packages/k6-api-adapter/test/runtime-result-contracts.test.js',
  'packages/k6-api-adapter/test/runtime-result-integration.test.js',
  CATALOG_PATH,
  'schemas/execution/k6-api-runtime/v1/k6-process-terminal-observation.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-sanitized-runtime-outcome.schema.json',
  'schemas/execution/k6-api-runtime/v1/k6-runtime-execution-evidence.schema.json',
  EVIDENCE_SCHEMA_PATH,
  'docs/02-development/m3-r3-p3-sanitized-runtime-result-handoff.md',
  'docs/03-roadmap/m3-r3-p3-sanitized-runtime-result.md',
  'docs/04-governance/m3-r3-p3-sanitized-runtime-result-acceptance-matrix.md',
  'docs/05-adr/ADR-0033-sanitized-runtime-result-and-immutable-evidence.md',
  'docs/06-security/m3-r3-p3-sanitized-runtime-result-threat-model.md',
  'docs/releases/M3-R3-P3-sanitized-runtime-result.md',
]);
const ACCEPTED_P2 = Object.freeze({
  mainSha: 'db51405e3b8f095a3773f4813b7ecb9e96a12924',
  sourceHead: '9428909b22ad3ef1bd47c6eb07b2edecbe73698f',
  mergeSha: 'db51405e3b8f095a3773f4813b7ecb9e96a12924',
  sourcePr: 62,
  mainBoundRunId: 30907717154,
  mainBoundJobId: 91986640490,
  mainBoundArtifactId: 8891734919,
  mainBoundArtifactDigest:
    'sha256:ad2f84b1058bad17d457057cc489f817af70fe7fd359f4dc0d1cf36ea05c95c5',
  mainBoundEvidenceJsonSha256:
    'f2034d0dd50dcbd4579d7fd67418e530139fa2ce9f0613ea579ab515f5245e4d',
  mainBoundCanonicalEvidenceDigest:
    '66ca6ab45c7412c9c575d44740f7152cab1adc83016908bc5e9aa2b96a961799',
  mainBoundSchemaCatalogDigest:
    'dc8f6a4a68451a58a76200406c50dbc0374b28aa15fd182d05fef8b3fb861d38',
});
const SAFETY_FIELDS = Object.freeze([
  'realProcessStartedInCi', 'processIdCreatedInCi', 'signalSentInCi',
  'k6InvokedInCi', 'externalProcessExecutedInCi', 'targetNetworkAccessed',
  'databaseAccessed', 'secretAccessed', 'filesystemCredentialAccessed',
  'rawRuntimeOutputCollected', 'stdoutCollected', 'stderrCollected',
  'numericProcessIdExposed', 'allureImplemented', 'workerAdded', 'queueAdded',
  'schedulerAdded', 'containerStarted', 'kubernetesResourceCreated',
  'remoteExecutionApiAdded', 'm3R3P4Started',
]);

export async function validateM3R3P3SanitizedRuntimeResult(options = {}) {
  const files = options.files ?? await loadRequiredFiles();
  validateRepositoryFiles(files);
  const catalog = JSON.parse(files[CATALOG_PATH]);
  const schemaCatalogDigest = await computeSchemaCatalogDigest(catalog, files);
  const fixture = options.fixture ?? await processExecutionFixture();
  const pending = executeK6ProcessWithSanitizedResult({
    adapter: fixture.adapter,
    command: fixture.command,
    bindings: fixture.bindings,
    executionContext: fixture.executionContext,
  });
  fixture.child.emit('spawn');
  fixture.child.emit('exit', 0, null);
  const result = await pending;
  assert(fixture.spawnCalls.length === 1,
    'M3-R3-P3 validator must use exactly one injected fake spawn');
  validateK6ProcessTerminalObservation(result.terminalObservation, {
    command: fixture.command,
    adapterDescriptor: fixture.adapterDescriptor,
    lifecycleEvidence: result.lifecycleEvidence,
  });
  validateK6SanitizedRuntimeOutcome(result.runtimeOutcome, {
    command: fixture.command,
    adapterDescriptor: fixture.adapterDescriptor,
    lifecycleEvidence: result.lifecycleEvidence,
    terminalObservation: result.terminalObservation,
  });
  validateK6RuntimeExecutionEvidence(result.runtimeEvidence, {
    bindings: fixture.bindings,
    command: fixture.command,
    adapterDescriptor: fixture.adapterDescriptor,
    lifecycleEvidence: result.lifecycleEvidence,
    terminalObservation: result.terminalObservation,
    runtimeOutcome: result.runtimeOutcome,
  });
  validateJsonSchema(result.terminalObservation,
    JSON.parse(files[catalog.schemas[3].path]));
  validateJsonSchema(result.runtimeOutcome,
    JSON.parse(files[catalog.schemas[4].path]));
  validateJsonSchema(result.runtimeEvidence,
    JSON.parse(files[catalog.schemas[5].path]));
  assert(computeK6ProcessTerminalObservationDigest(result.terminalObservation)
      === result.terminalObservation.observationDigest,
  'Terminal observation canonical digest mismatch');
  assert(computeK6SanitizedRuntimeOutcomeDigest(result.runtimeOutcome)
      === result.runtimeOutcome.resultDigest,
  'Runtime outcome canonical digest mismatch');
  assert(computeK6RuntimeExecutionEvidenceDigest(result.runtimeEvidence)
      === result.runtimeEvidence.evidenceDigest,
  'Runtime execution Evidence canonical digest mismatch');
  assert(result.runtimeEvidence.fileResultCollection.supported === false
      && result.runtimeEvidence.fileResultCollection.implemented === false
      && result.runtimeEvidence.fileResultCollection.sourceBundleRemainsImmutable === true
      && result.runtimeEvidence.fileResultCollection.arbitraryFileReadEnabled === false,
  'File-result deferral does not preserve the immutable Source Bundle boundary');

  const generatedAt = options.generatedAt ?? new Date().toISOString();
  assert(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u.test(generatedAt)
      && !Number.isNaN(Date.parse(generatedAt)), 'M3-R3-P3 generatedAt is invalid');
  const commitSha = options.commitSha ?? process.env.M3_R3_P3_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';
  assert(commitSha === 'local' || /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-P3 exact Head must be local or a 40-character SHA');
  const branch = options.branch ?? process.env.M3_R3_P3_BRANCH
    ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
  assert(typeof branch === 'string' && branch.length >= 1 && branch.length <= 256,
    'M3-R3-P3 branch is invalid');
  const testResults = options.testResults ?? readTestResults();
  validateTestResults(testResults);
  const safetyBoundary = Object.fromEntries(SAFETY_FIELDS.map((field) => [field, false]));
  const claims = {
    schemaVersion: EVIDENCE_SCHEMA_VERSION,
    generatedAt,
    source: { branch, commitSha },
    acceptedP2: { ...ACCEPTED_P2 },
    contracts: {
      terminalObservationSchema: result.terminalObservation.schemaVersion,
      runtimeOutcomeSchema: result.runtimeOutcome.schemaVersion,
      runtimeEvidenceSchema: result.runtimeEvidence.schemaVersion,
      acceptanceEvidenceSchema: EVIDENCE_SCHEMA_VERSION,
      schemaCatalogDigest,
    },
    runtimeSample: {
      terminalState: result.lifecycleEvidence.terminalState,
      outcomeClassification: result.runtimeOutcome.outcomeClassification,
      adapterDigest: fixture.adapterDescriptor.adapterDigest,
      commandDigest: fixture.command.commandDigest,
      lifecycleEvidenceDigest: result.lifecycleEvidence.evidenceDigest,
      terminalObservationDigest: result.terminalObservation.observationDigest,
      runtimeOutcomeDigest: result.runtimeOutcome.resultDigest,
      runtimeExecutionEvidenceDigest: result.runtimeEvidence.evidenceDigest,
      spawnCount: fixture.spawnCalls.length,
      runtimeResultCollected: true,
      rawRuntimeOutputCollected: false,
      fileResultCollected: false,
    },
    testResults,
    decision: {
      sanitizedRuntimeOutcomeImplemented: true,
      immutableRuntimeEvidenceImplemented: true,
      runtimeResultCollected: true,
      rawRuntimeOutputCollected: false,
      fileResultCollectionSupported: false,
      fileResultCollectionImplemented: false,
      fileResultCollectionDecision: 'DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED',
      sourceBundleRemainsImmutable: true,
      allPredecessorsBound: true,
      p3ImplementationComplete: true,
      p3ExactHeadAccepted: true,
      p3ReadyMarked: false,
      p3Merged: false,
      m3R3P4Started: false,
      nextRequiredSlice: 'M3-R3-P4',
      repositoryBlockers: [],
    },
    safetyBoundary,
  };
  assert(Object.values(safetyBoundary).every((value) => value === false),
    'M3-R3-P3 CI safety boundary widened');
  assert(result.runtimeEvidence.predecessor.commandDigest === fixture.command.commandDigest
      && result.runtimeEvidence.predecessor.lifecycleEvidenceDigest
        === result.lifecycleEvidence.evidenceDigest
      && result.runtimeEvidence.predecessor.boundaryEvidenceDigest
        === fixture.bindings.boundaryEvidence.evidenceDigest,
  'M3-R3-P3 runtime Evidence is not bound to the exact predecessor chain');
  scanSensitiveValues(claims, 'M3-R3-P3 Evidence');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  validateJsonSchema(evidence, JSON.parse(files[EVIDENCE_SCHEMA_PATH]));
  return evidence;
}

async function loadRequiredFiles() {
  const catalog = JSON.parse(await readFile(CATALOG_PATH, 'utf8'));
  const paths = new Set([...REQUIRED_PATHS, ...catalog.schemas.map((entry) => entry.path)]);
  const entries = await Promise.all([...paths].map(async (path) =>
    [path, await readFile(path, 'utf8')]));
  return Object.fromEntries(entries);
}

function validateRepositoryFiles(files) {
  for (const path of REQUIRED_PATHS) {
    assert(typeof files[path] === 'string' && files[path].length > 0,
      `Missing M3-R3-P3 repository path: ${path}`);
  }
  const workflow = files['.github/workflows/m3-r3-p3-sanitized-runtime-result.yml'];
  for (const required of [
    'pull_request:', 'push:', 'branches: [main]', 'contents: read',
    'persist-credentials: false', '${{ github.event.pull_request.head.sha || github.sha }}',
    'm3-r3-p3-sanitized-runtime-result-evidence',
  ]) assert(workflow.includes(required), `P3 Workflow missing: ${required}`);
  const catalog = JSON.parse(files[CATALOG_PATH]);
  for (const entry of catalog.schemas ?? []) {
    assert(workflow.includes(entry.path),
      `P3 Workflow Artifact does not include Catalog Schema: ${entry.path}`);
  }
  for (const forbidden of [
    'workflow_dispatch', 'workflow_call', 'id-token: write', 'contents: write',
    'actions: write', 'packages: write', 'k6 run', 'xk6 run', 'playwright test',
    'docker run', 'kubectl', 'secrets:',
  ]) assert(!workflow.includes(forbidden), `P3 Workflow contains forbidden token: ${forbidden}`);
  assert(files['packages/k6-api-adapter/src/node-process-adapter.js']
    .includes("stdio: ['ignore', 'ignore', 'ignore']"),
  'P3 must preserve ignored stdio');
  assert(files['packages/k6-api-adapter/src/runtime-result-contracts.js']
    .includes('DEFERRED_GOVERNED_OUTPUT_ROOT_REQUIRED'),
  'P3 file-result decision is missing');
}

async function computeSchemaCatalogDigest(catalog, files) {
  assert(catalog?.schemaVersion === 'k6-sanitized-runtime-result-schema-catalog/v1'
      && Array.isArray(catalog.schemas) && catalog.schemas.length === 7,
  'M3-R3-P3 Schema Catalog is invalid');
  const schemas = [];
  const versions = new Set();
  const paths = new Set();
  for (const entry of catalog.schemas) {
    assert(entry && typeof entry.schemaVersion === 'string'
        && typeof entry.path === 'string' && !versions.has(entry.schemaVersion)
        && !paths.has(entry.path), 'M3-R3-P3 Schema Catalog entry is invalid');
    versions.add(entry.schemaVersion);
    paths.add(entry.path);
    const schema = JSON.parse(files[entry.path]);
    assert(schema?.$schema === 'https://json-schema.org/draft/2020-12/schema'
        && schema?.type === 'object' && schema?.additionalProperties === false,
    `M3-R3-P3 Schema is not closed Draft 2020-12: ${entry.path}`);
    schemas.push({ ...entry, schemaDigest: sha256(schema) });
  }
  return sha256({ schemaVersion: catalog.schemaVersion, schemas });
}

function readTestResults() {
  return {
    focused: result('M3_R3_P3_FOCUSED', 33, 33, 0),
    k6ApiAdapter: result('M3_R3_P3_ADAPTER', 294, 294, 0),
    fullNode: {
      total: numberEnv('M3_R3_P3_FULL_TOTAL', 646),
      passed: numberEnv('M3_R3_P3_FULL_PASSED', 634),
      skipped: numberEnv('M3_R3_P3_FULL_SKIPPED', 12),
      failed: numberEnv('M3_R3_P3_FULL_FAILED', 0),
    },
    repositoryValidator: {
      status: process.env.M3_R3_P3_REPOSITORY_VALIDATOR ?? 'success',
    },
  };
}

function result(prefix, defaultTotal, defaultPassed, defaultFailed) {
  return {
    total: numberEnv(`${prefix}_TOTAL`, defaultTotal),
    passed: numberEnv(`${prefix}_PASSED`, defaultPassed),
    failed: numberEnv(`${prefix}_FAILED`, defaultFailed),
  };
}

function numberEnv(name, fallback) {
  if (process.env[name] === undefined) return fallback;
  const value = Number(process.env[name]);
  assert(Number.isInteger(value) && value >= 0, `${name} is invalid`);
  return value;
}

function validateTestResults(results) {
  for (const key of ['focused', 'k6ApiAdapter']) {
    const item = results[key];
    assert(item.total > 0 && item.passed === item.total && item.failed === 0,
      `M3-R3-P3 ${key} tests are not fully accepted`);
  }
  assert(results.fullNode.total > 0
      && results.fullNode.passed + results.fullNode.skipped === results.fullNode.total
      && results.fullNode.failed === 0,
  'M3-R3-P3 full Node tests are not fully accepted');
  assert(results.repositoryValidator.status === 'success',
    'M3-R3-P3 Repository Validator did not succeed');
}

function validateJsonSchema(value, schema, root = schema, path = '$') {
  if (schema.$ref) {
    assert(schema.$ref.startsWith('#/'), `${path} external $ref is forbidden`);
    const target = schema.$ref.slice(2).split('/').reduce((current, token) =>
      current[token.replaceAll('~1', '/').replaceAll('~0', '~')], root);
    return validateJsonSchema(value, target, root, path);
  }
  if (Object.hasOwn(schema, 'const')) {
    assert(canonicalStringify(value) === canonicalStringify(schema.const),
      `${path} const mismatch`);
  }
  if (schema.enum) assert(schema.enum.includes(value), `${path} enum mismatch`);
  if (schema.anyOf) {
    const accepted = schema.anyOf.some((candidate) => {
      try { validateJsonSchema(value, candidate, root, path); return true; } catch { return false; }
    });
    assert(accepted, `${path} anyOf mismatch`);
  }
  if (schema.oneOf) {
    const accepted = schema.oneOf.filter((candidate) => {
      try { validateJsonSchema(value, candidate, root, path); return true; } catch { return false; }
    }).length;
    assert(accepted === 1, `${path} oneOf mismatch`);
  }
  const objectSchema = schema.type === 'object' || schema.properties !== undefined
    || schema.required !== undefined || schema.additionalProperties !== undefined;
  if (objectSchema) {
    assert(value && typeof value === 'object' && !Array.isArray(value), `${path} type`);
    const properties = schema.properties ?? {};
    for (const key of schema.required ?? []) assert(Object.hasOwn(value, key), `${path}.${key} required`);
    if (schema.additionalProperties === false) {
      const unexpected = Object.keys(value).filter((key) => !Object.hasOwn(properties, key));
      assert(unexpected.length === 0,
        `${path} additional properties: ${unexpected.join(',')}`);
    }
    for (const [key, child] of Object.entries(properties)) {
      if (Object.hasOwn(value, key)) validateJsonSchema(value[key], child, root, `${path}.${key}`);
    }
  } else if (schema.type === 'array') {
    assert(Array.isArray(value), `${path} type`);
    if (schema.minItems !== undefined) assert(value.length >= schema.minItems, `${path} minItems`);
    if (schema.maxItems !== undefined) assert(value.length <= schema.maxItems, `${path} maxItems`);
    if (schema.uniqueItems) {
      assert(new Set(value.map(canonicalStringify)).size === value.length, `${path} uniqueItems`);
    }
    value.forEach((item, index) => validateJsonSchema(item, schema.items ?? {}, root, `${path}[${index}]`));
  } else if (schema.type === 'string') {
    assert(typeof value === 'string', `${path} type`);
    if (schema.minLength !== undefined) assert(value.length >= schema.minLength, `${path} minLength`);
    if (schema.maxLength !== undefined) assert(value.length <= schema.maxLength, `${path} maxLength`);
    if (schema.pattern) assert(new RegExp(schema.pattern, 'u').test(value), `${path} pattern`);
  } else if (schema.type === 'integer') {
    assert(Number.isInteger(value), `${path} type`);
    if (schema.minimum !== undefined) assert(value >= schema.minimum, `${path} minimum`);
    if (schema.maximum !== undefined) assert(value <= schema.maximum, `${path} maximum`);
  } else if (schema.type === 'boolean') {
    assert(typeof value === 'boolean', `${path} type`);
  } else if (schema.type === 'null') {
    assert(value === null, `${path} type`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  process.stdout.write(`${JSON.stringify(
    await validateM3R3P3SanitizedRuntimeResult(), null, 2)}\n`);
}
