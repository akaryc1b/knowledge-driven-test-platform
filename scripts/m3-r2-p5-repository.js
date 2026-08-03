import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ACCEPTED_P3, ACCEPTED_P4, M3_R2_P5_EVIDENCE_SCHEMA_VERSION,
  P5_PATHS, assertP5,
} from './m3-r2-p5-baseline.js';
import {
  canonicalStringify, loadAcceptedP5Fixture,
} from '../packages/k6-api-adapter/test/p5-test-helpers.js';

const ROOT = process.cwd();

export async function loadP5Repository() {
  const paths = [P5_PATHS.rootPackage, P5_PATHS.evidenceSchema, P5_PATHS.catalog,
    P5_PATHS.baseline, P5_PATHS.repository, P5_PATHS.validator, P5_PATHS.workflow,
    P5_PATHS.anchor, ...P5_PATHS.anchorModules, P5_PATHS.helper, ...P5_PATHS.tests, P5_PATHS.handoff, P5_PATHS.roadmap,
    P5_PATHS.acceptance, P5_PATHS.threatModel, P5_PATHS.release];
  const entries = await Promise.all(paths.map(async (path) =>
    [path, await readFile(join(ROOT, path), 'utf8')]));
  return { files: Object.fromEntries(entries), fixture: await loadAcceptedP5Fixture() };
}

export function validateP5Repository(repository) {
  validateAcceptedPredecessors(repository.fixture);
  validateSchema(repository.files);
  validatePackageWiring(repository.files);
  validateWorkflow(repository.files[P5_PATHS.workflow]);
  validateHarness(repository.files);
  validateDocumentation(repository.files);
  return true;
}

function validateAcceptedPredecessors(fixture) {
  assertP5(fixture.evidence.source.commitSha === ACCEPTED_P4.headSha
      && fixture.evidence.evidenceDigest === ACCEPTED_P4.evidenceDigest
      && fixture.identity.bundleDigest === ACCEPTED_P4.bundleDigest
      && fixture.identity.manifestDigest === ACCEPTED_P4.manifestDigest,
  'P5 repository accepted P4 binding changed');
  assertP5(fixture.evidence.acceptedP3.headSha === ACCEPTED_P3.headSha
      && fixture.identity.p3EvidenceDigest === ACCEPTED_P3.evidenceDigest
      && fixture.identity.sourceArtifactDigest === ACCEPTED_P3.sourceArtifactDigest
      && fixture.identity.validationEvidenceDigest === ACCEPTED_P3.validationEvidenceDigest,
  'P5 repository accepted P3 trust anchor changed');
}

function validateSchema(files) {
  const schema = parseJson(files[P5_PATHS.evidenceSchema], 'P5 Evidence schema');
  const catalog = parseJson(files[P5_PATHS.catalog], 'P5 Schema Catalog');
  assertP5(schema.$schema === 'https://json-schema.org/draft/2020-12/schema'
      && schema.type === 'object' && schema.additionalProperties === false,
  'P5 Evidence schema must be closed Draft 2020-12');
  assertP5(schema.properties?.schemaVersion?.const === M3_R2_P5_EVIDENCE_SCHEMA_VERSION,
    'P5 Evidence schema version changed');
  assertP5(canonicalStringify([...schema.required].sort())
      === canonicalStringify(Object.keys(schema.properties).sort()),
  'Every P5 Evidence top-level property must be required');
  for (const field of ['acceptedP4', 'acceptedP3', 'sourceResult', 'acceptance',
    'testResults', 'decision', 'safetyBoundary']) {
    const nested = schema.properties[field];
    assertP5(nested.type === 'object' && nested.additionalProperties === false
        && canonicalStringify([...nested.required].sort())
          === canonicalStringify(Object.keys(nested.properties).sort()),
    `Every P5 Evidence ${field} property must be required and closed`);
  }
  const p4 = schema.properties.acceptedP4.properties;
  for (const [field, value] of Object.entries({
    headSha: ACCEPTED_P4.headSha, runId: ACCEPTED_P4.runId,
    artifactId: ACCEPTED_P4.artifactId, artifactApiDigest: ACCEPTED_P4.artifactApiDigest,
    evidenceDigest: ACCEPTED_P4.evidenceDigest, bundleDigest: ACCEPTED_P4.bundleDigest,
    manifestDigest: ACCEPTED_P4.manifestDigest, receiptDigest: ACCEPTED_P4.receiptDigest,
    publicationEvidenceDigest: ACCEPTED_P4.publicationEvidenceDigest,
    publicationArchiveSha256: ACCEPTED_P4.publicationArchiveSha256,
    publicationArchiveBlobSha: ACCEPTED_P4.publicationArchiveBlobSha,
    publicationPayloadSha256: ACCEPTED_P4.publicationPayloadSha256,
    publicationPayloadByteLength: ACCEPTED_P4.publicationPayloadByteLength,
  })) assertP5(p4[field]?.const === value, `P5 Evidence acceptedP4 ${field} changed`);
  assertP5(schema.properties?.decision?.properties?.nextRequiredSlice?.const === 'M3-R2-G1'
      && schema.properties?.decision?.properties?.sourceGenerationAcceptanceComplete?.const === true
      && schema.properties?.decision?.properties?.remoteArtifactPublished?.const === false
      && schema.properties?.decision?.properties?.sourceExecuted?.const === false,
  'P5 Evidence decision contract changed');
  assertP5(catalog.schemaVersion === 'k6-api-source-p5-schema-catalog/v1'
      && catalog.schemas?.length === 1
      && catalog.schemas[0].schemaVersion === M3_R2_P5_EVIDENCE_SCHEMA_VERSION
      && catalog.schemas[0].path === P5_PATHS.evidenceSchema,
  'P5 Schema Catalog changed');
}

function validatePackageWiring(files) {
  const pkg = parseJson(files[P5_PATHS.rootPackage], 'root package');
  assertP5(pkg.engines?.node === '>=22', 'P5 requires Node.js 22');
  const script = pkg.scripts?.validate ?? '';
  const ordered = [
    'validate-m3-r2-source-generation-p1.js',
    'validate-m3-r2-source-generation-p2.js',
    'validate-m3-r2-source-generation-p3.js',
    'validate-m3-r2-source-generation-p4.js',
    'validate-m2-final-release-closure.js',
  ];
  assertP5(ordered.every((item) => script.includes(item)),
    'Repository validation is missing a P1-P4 or M2 closure stage');
  assertP5(ordered.every((item, index) => index === 0
      || script.indexOf(ordered[index - 1]) < script.indexOf(item)),
  'Repository validation order must preserve P1, P2, P3, P4 and M2 closure');
}

function validateWorkflow(source) {
  for (const marker of [
    'name: m3-r2-p5-source-generation-acceptance',
    'persist-credentials: false', 'node-version: 22', 'npm ci --ignore-scripts',
    'source-generation-p5-*.test.js', 'packages/k6-api-adapter/test/*.test.js',
    'npm test', 'npm run validate', 'postgres:18',
    'github.event.pull_request.head.sha', 'actions/upload-artifact@v4',
    'if-no-files-found: error', 'retention-days: 90',
    'M3-R2-G1', 'credential-shaped', 'accepted-publication.json.gz.b64.*',
  ]) assertP5(source.includes(marker), `P5 workflow is missing ${marker}`);
  for (const forbidden of ['k6 run', 'xk6 run', 'playwright test', 'docker run',
    'kubectl', 'eval ', 'node:vm', 'child_process']) {
    assertP5(!source.includes(forbidden), `P5 workflow introduces forbidden execution: ${forbidden}`);
  }
}

function validateHarness(files) {
  const harness = [files[P5_PATHS.anchor], ...P5_PATHS.anchorModules.map((path) => files[path]), files[P5_PATHS.helper], ...P5_PATHS.tests.map((path) => files[path]),
    files[P5_PATHS.validator]].join('\n');
  for (const marker of [
    'evidenceRawSha256', 'gitBlobSha', 'recomputeSelfConsistentForgery',
    'validateStorePath', 'scanSensitiveValues', 'verifyAcceptedP4', 'gunzipSync',
    'concurrent publication', 'missing Receipt', 'M3-R2-G1',
  ]) assertP5(harness.includes(marker), `P5 independent harness is missing ${marker}`);
  for (const forbidden of [
    "from 'node:child_process'", "from 'node:vm'", "from 'node:worker_threads'",
    'eval(', 'new Function(', 'import(source', 'require(source',
  ]) assertP5(!harness.includes(forbidden), `P5 harness uses forbidden execution primitive: ${forbidden}`);
  const productionAdditions = Object.keys(files).filter((path) =>
    path.startsWith('packages/k6-api-adapter/src/') && path.includes('p5'));
  assertP5(productionAdditions.length === 0, 'P5 must not add a production Source or Runtime module');
}

function validateDocumentation(files) {
  for (const path of [P5_PATHS.handoff, P5_PATHS.roadmap, P5_PATHS.acceptance,
    P5_PATHS.threatModel, P5_PATHS.release]) {
    const source = files[path];
    for (const marker of ['M3-R2-P5', 'nextRequiredSlice=M3-R2-G1',
      'sourceExecuted=false', 'remoteArtifactPublished=false']) {
      assertP5(source.includes(marker), `${path} is missing ${marker}`);
    }
    assertP5(!source.includes('M3-R2-G1 started') && !source.includes('Ready=true'),
      `${path} starts a forbidden next slice or Ready transition`);
  }
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch { throw new Error(`${label} is not valid JSON`); }
}
