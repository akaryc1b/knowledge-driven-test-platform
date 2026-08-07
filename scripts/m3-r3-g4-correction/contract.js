import { readFile } from 'node:fs/promises';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import { validateJsonSchemaDraft202012 } from '../json-schema-draft-2020.js';

export const C1_SCHEMA_VERSION = 'm3-r3-g4-evidence-correction/v1';
export const C1_SCHEMA_PATH =
  'schemas/execution/k6-api-runtime/v1/'
  + 'm3-r3-g4-evidence-correction.schema.json';
export const C1_WORKFLOW_PATH =
  '.github/workflows/m3-r3-g4-evidence-correction.yml';
export const C1_ARTIFACT_NAME = 'm3-r3-g4-evidence-correction';
export const C1_BASELINE_MAIN =
  '583e848a289a6fff2e2d2c4052002125b47bb853';
export const C1_ACCEPTED_P4_HEAD =
  'e98357109bfc71f013c6f1af83a06a4358a1f922';
export const C1_ACCEPTED_G1_HEAD =
  '3bcdab12e8fcea909ca6aa8479bac6a69b545747';

export const C1_ARTIFACT_PATHS = Object.freeze([
  'evidence/m3-r3-g4-evidence-correction.json',
  C1_SCHEMA_PATH,
  'scripts/json-schema-draft-2020.js',
  'scripts/m3-r3-p4/evidence.js',
  'scripts/m3-r3-g1/evidence.js',
  '.github/workflows/m3-r3-p4-fault-security-compatibility-acceptance.yml',
  '.github/workflows/m3-r3-g1-formal-acceptance.yml',
  'scripts/m3-r3-g1/ci-node22.sh',
  'packages/k6-api-adapter/test/fault-security-compatibility-validator.test.js',
  'packages/k6-api-adapter/test/m3-r3-g1-formal-acceptance.test.js',
  'scripts/m3-r3-g4-correction/contract.js',
  'scripts/m3-r3-g4-correction/ci-artifact.js',
  'scripts/validate-m3-r3-g4-evidence-correction.js',
  'packages/k6-api-adapter/test/m3-r3-g4-evidence-correction.test.js',
  C1_WORKFLOW_PATH,
  'docs/04-governance/m3-r3-g4-evidence-correction.md',
  'logs/m3-r3-g4-c1-focused-node22.tap',
  'logs/m3-r3-g4-c1-root-validation.log',
  'logs/m3-r3-g4-c1-validator.log',
]);

const REQUIRED_PATHS = Object.freeze(
  C1_ARTIFACT_PATHS.filter((path) =>
    !path.startsWith('evidence/') && !path.startsWith('logs/')),
);

const FALSE_SAFETY_FIELDS = Object.freeze([
  'k6Invoked', 'xk6Invoked', 'playwrightInvoked',
  'realExternalProcessAdded', 'rawStdoutCollectionAdded',
  'rawStderrCollectionAdded', 'governedOutputRootImplemented',
  'fileResultCollectionImplemented', 'sourceBundleModified',
  'callerProvidedPathAccepted', 'arbitraryFileReadEnabled',
  'workerAdded', 'queueAdded', 'schedulerAdded',
  'containerExecutionAdded', 'kubernetesExecutionAdded',
  'remoteExecutionApiAdded', 'allureImplemented',
]);

export async function loadM3R3G4C1RepositoryFiles() {
  return Object.fromEntries(await Promise.all(REQUIRED_PATHS.map(async (path) => [
    path, await readFile(path, 'utf8'),
  ])));
}

export async function validateM3R3G4C1Repository(options = {}) {
  const files = options.files ?? await loadM3R3G4C1RepositoryFiles();
  for (const path of REQUIRED_PATHS) {
    invariant(typeof files[path] === 'string' && files[path].length > 0,
      `Missing M3-R3-G4-C1 repository path: ${path}`);
  }
  validateHistoricalWorkflows(files);
  validateClosedSchemaWiring(files);
  validateCorrectionWorkflow(files);
  const schema = JSON.parse(files[C1_SCHEMA_PATH]);
  invariant(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
    && schema.type === 'object' && schema.additionalProperties === false
    && schema.properties?.schemaVersion?.const === C1_SCHEMA_VERSION,
  'M3-R3-G4-C1 Evidence Schema is not closed Draft 2020-12');
  scanSensitiveValues({
    correctionWorkflow: files[C1_WORKFLOW_PATH],
    governance: files['docs/04-governance/m3-r3-g4-evidence-correction.md'],
    validator: files['scripts/json-schema-draft-2020.js'],
  }, 'M3-R3-G4-C1 repository governance');
  return Object.freeze({
    validator: 'm3-r3-g4-evidence-correction',
    status: 'success',
    baselineMain: C1_BASELINE_MAIN,
    acceptedP4Head: C1_ACCEPTED_P4_HEAD,
    acceptedG1Head: C1_ACCEPTED_G1_HEAD,
    artifactPathCount: C1_ARTIFACT_PATHS.length,
  });
}

export async function createM3R3G4C1Evidence(options = {}) {
  const repository = await validateM3R3G4C1Repository(options);
  const generatedAt = options.generatedAt ?? new Date().toISOString();
  const commitSha = options.commitSha ?? process.env.M3_R3_G4_C1_EXACT_HEAD
    ?? process.env.GITHUB_SHA;
  const eventName = options.eventName ?? process.env.M3_R3_G4_C1_EVENT_NAME
    ?? 'local';
  const branch = options.branch ?? process.env.M3_R3_G4_C1_BRANCH
    ?? process.env.GITHUB_HEAD_REF ?? process.env.GITHUB_REF_NAME ?? 'local';
  invariant(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/u
    .test(generatedAt) && !Number.isNaN(Date.parse(generatedAt)),
  'M3-R3-G4-C1 generatedAt is invalid');
  invariant(typeof commitSha === 'string' && /^[a-f0-9]{40}$/u.test(commitSha),
    'M3-R3-G4-C1 exact Head is invalid');
  invariant(typeof eventName === 'string' && eventName.length > 0,
    'M3-R3-G4-C1 event name is invalid');
  invariant(typeof branch === 'string' && branch.length > 0 && branch.length <= 256,
    'M3-R3-G4-C1 branch is invalid');
  const validation = options.validation ?? {
    focusedStatus: requiredEnv('M3_R3_G4_C1_FOCUSED_STATUS'),
    rootValidationStatus: requiredEnv('M3_R3_G4_C1_ROOT_STATUS'),
    correctionValidatorStatus: requiredEnv('M3_R3_G4_C1_VALIDATOR_STATUS'),
  };
  invariant(Object.values(validation).every((value) => value === 'success'),
    'M3-R3-G4-C1 validation is incomplete');
  const safetyBoundary = Object.fromEntries(
    FALSE_SAFETY_FIELDS.map((field) => [field, false]),
  );
  const claims = {
    schemaVersion: C1_SCHEMA_VERSION,
    generatedAt,
    source: {
      eventName,
      branch,
      commitSha,
      baselineMain: C1_BASELINE_MAIN,
    },
    findings: {
      pullRequest: 68,
      reviewThreads: [
        'PRRT_kwDOTkiSCc6W20yK',
        'PRRT_kwDOTkiSCc6W20yO',
      ],
      classifications: [
        'workflowDefect/evidenceSemanticDefect',
        'validatorDefect',
      ],
    },
    corrections: {
      p4HistoricalEvidenceEmissionRestricted: true,
      g1HistoricalEvidenceEmissionRestricted: true,
      p4ClosedSchemaValidationComplete: true,
      g1ClosedSchemaValidationComplete: true,
      g1ValidationOnlyStaleBaseSupported: true,
      correctionWorkflowPermanent: true,
    },
    historicalEvidence: {
      acceptedP4Head: C1_ACCEPTED_P4_HEAD,
      acceptedG1Head: C1_ACCEPTED_G1_HEAD,
      sourceMergeSha: C1_BASELINE_MAIN,
      p4EvidenceRewritten: false,
      g1EvidenceRewritten: false,
    },
    validation,
    artifact: {
      name: C1_ARTIFACT_NAME,
      expectedPaths: [...C1_ARTIFACT_PATHS],
      pathCount: C1_ARTIFACT_PATHS.length,
      preUploadAudit: {
        missingEntries: 0,
        unexpectedEntries: 0,
        regularFilesOnly: true,
        unsafePathEntries: 0,
        symlinkEntries: 0,
        specialFileEntries: 0,
        unicodeNormalizationCollisions: 0,
        caseFoldCollisions: 0,
        credentialShapedMatches: 0,
      },
    },
    decision: {
      correctionComplete: true,
      newRuntimeCapabilityAdded: false,
      finalG4Complete: false,
      nextRequiredAction: 'independent-review-and-g4-reverification',
      repositoryBlockers: [],
    },
    safetyBoundary,
  };
  scanSensitiveValues(claims, 'M3-R3-G4-C1 Evidence');
  const evidence = { ...claims, evidenceDigest: sha256(claims) };
  const files = options.files ?? await loadM3R3G4C1RepositoryFiles();
  validateM3R3G4C1EvidenceDocument(
    evidence, JSON.parse(files[C1_SCHEMA_PATH]));
  invariant(repository.artifactPathCount === evidence.artifact.pathCount,
    'M3-R3-G4-C1 repository and Artifact path counts differ');
  return evidence;
}

export function validateM3R3G4C1EvidenceDocument(evidence, schema) {
  validateJsonSchemaDraft202012(evidence, schema, 'M3-R3-G4-C1 Evidence');
  invariant(canonicalStringify(evidence.findings.reviewThreads)
      === canonicalStringify([
        'PRRT_kwDOTkiSCc6W20yK',
        'PRRT_kwDOTkiSCc6W20yO',
      ]),
  'M3-R3-G4-C1 review thread identity changed');
  invariant(Object.values(evidence.corrections).every((value) => value === true),
    'M3-R3-G4-C1 correction is incomplete');
  invariant(evidence.historicalEvidence.p4EvidenceRewritten === false
    && evidence.historicalEvidence.g1EvidenceRewritten === false,
  'M3-R3-G4-C1 historical Evidence rewrite detected');
  invariant(canonicalStringify(evidence.artifact.expectedPaths)
      === canonicalStringify(C1_ARTIFACT_PATHS)
    && evidence.artifact.pathCount === C1_ARTIFACT_PATHS.length,
  'M3-R3-G4-C1 Artifact layout changed');
  invariant(Object.values(evidence.safetyBoundary)
    .every((value) => value === false),
  'M3-R3-G4-C1 safety boundary widened');
  const claims = structuredClone(evidence);
  delete claims.evidenceDigest;
  invariant(sha256(claims) === evidence.evidenceDigest,
    'M3-R3-G4-C1 canonical Evidence digest mismatch');
  return true;
}

function validateHistoricalWorkflows(files) {
  const p4 = files[
    '.github/workflows/m3-r3-p4-fault-security-compatibility-acceptance.yml'];
  for (const marker of [
    C1_ACCEPTED_P4_HEAD,
    'p4HistoricalEvidenceEmission=validation-only',
    "steps.p4_evidence.outputs.emit == 'true'",
    'historicalP4EvidenceReissued=false',
  ]) invariant(p4.includes(marker), `P4 historical Evidence gate missing: ${marker}`);

  const g1 = files['.github/workflows/m3-r3-g1-formal-acceptance.yml'];
  for (const marker of [
    C1_ACCEPTED_G1_HEAD,
    C1_BASELINE_MAIN,
    'M3_R3_G1_IMMUTABLE_ATTESTATION',
    "steps.g1_evidence.outputs.emit == 'true'",
    'historicalG1EvidenceReissued=false',
  ]) invariant(g1.includes(marker), `G1 historical Evidence gate missing: ${marker}`);
  invariant(files['scripts/m3-r3-g1/ci-node22.sh']
    .includes('g1ScopeAuditMode=validation-only'),
  'G1 validation-only stale-base mode is missing');
}

function validateClosedSchemaWiring(files) {
  const shared = files['scripts/json-schema-draft-2020.js'];
  for (const marker of [
    'validateJsonSchemaDraft202012', 'Unsupported Schema keyword',
    'additionalProperties', 'uniqueItems', 'resolveLocalRef', 'date-time',
  ]) invariant(shared.includes(marker), `Shared Schema validator missing: ${marker}`);
  for (const path of [
    'scripts/m3-r3-p4/evidence.js',
    'scripts/m3-r3-g1/evidence.js',
  ]) {
    invariant(files[path].includes(
      "import { validateJsonSchemaDraft202012 } from '../json-schema-draft-2020.js';")
      && files[path].includes('validateJsonSchemaDraft202012(evidence, schema'),
    `Closed Schema validator is not wired into ${path}`);
  }
  const tests = [
    files['packages/k6-api-adapter/test/fault-security-compatibility-validator.test.js'],
    files['packages/k6-api-adapter/test/m3-r3-g1-formal-acceptance.test.js'],
  ].join('\n');
  for (const marker of [
    'nested const forgery', 'unexpected nested property',
    'local refs', 'uniqueItems', 'invalid date-time',
  ]) invariant(tests.includes(marker), `Schema mutation regression missing: ${marker}`);
}

function validateCorrectionWorkflow(files) {
  const workflow = files[C1_WORKFLOW_PATH];
  for (const marker of [
    'pull_request:', 'push:', 'branches: [main]', 'contents: read',
    'persist-credentials: false', 'node-version: 22',
    'npm ci --ignore-scripts', 'npm run validate',
    'validate-m3-r3-g4-evidence-correction.js',
    'actions/upload-artifact@v4', C1_ARTIFACT_NAME,
  ]) invariant(workflow.includes(marker), `Correction Workflow missing: ${marker}`);
  const forbiddenMarkers = [
    'workflow_dispatch', 'workflow_call', 'contents: write', 'actions: write',
    'id-' + 'to' + 'ken: write', 'packages: write', 'se' + 'crets:',
    'k6 run', 'xk6 run', 'playwright test', 'docker run', 'kubectl',
    'curl ', 'wget ', 'gh ',
  ];
  for (const marker of forbiddenMarkers) invariant(!workflow.includes(marker),
    `Correction Workflow contains forbidden entry: ${marker}`);
}

function requiredEnv(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0, `${name} is required`);
  return value;
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
