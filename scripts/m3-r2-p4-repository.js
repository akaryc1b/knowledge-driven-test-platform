import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_STORAGE_KIND,
} from '../packages/k6-api-adapter/src/index.js';
import {
  ACCEPTED_P3,
  ACCEPTED_P3_BRANCH,
  ACCEPTED_P3_GENERATED_AT,
  M3_R2_P4_EVIDENCE_SCHEMA_VERSION,
  P4_PATHS,
  assertP4,
} from './m3-r2-p4-baseline.js';

const ROOT = process.cwd();
const P4_SCHEMA_VERSIONS = Object.freeze([
  K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION,
  K6_API_SOURCE_PUBLICATION_EVIDENCE_SCHEMA_VERSION,
  M3_R2_P4_EVIDENCE_SCHEMA_VERSION,
]);

export async function loadP4Repository() {
  const [packageJson, catalog, bundleSchema, receiptSchema, publicationEvidenceSchema,
    p4EvidenceSchema, acceptedP3EvidenceRaw, acceptedP3ArtifactRaw, sources] =
    await Promise.all([
      loadJson(P4_PATHS.rootPackage),
      loadJson(P4_PATHS.catalog),
      loadJson(P4_PATHS.bundleSchema),
      loadJson(P4_PATHS.receiptSchema),
      loadJson(P4_PATHS.publicationEvidenceSchema),
      loadJson(P4_PATHS.p4EvidenceSchema),
      readFile(join(ROOT, P4_PATHS.acceptedP3Evidence), 'utf8'),
      readFile(join(ROOT, P4_PATHS.acceptedP3ArtifactBundle), 'utf8'),
      loadSources(),
    ]);
  return {
    packageJson,
    catalog,
    bundleSchema,
    receiptSchema,
    publicationEvidenceSchema,
    p4EvidenceSchema,
    acceptedP3EvidenceRaw,
    acceptedP3ArtifactRaw,
    sources,
  };
}

export function validateP4Repository(repository) {
  validateCatalog(repository.catalog);
  validateSchemas(repository);
  validateAcceptedP3Receipts(repository);
  validateWiring(repository);
  validatePublicationBoundary(repository.sources);
  validateDocumentation(repository.sources);
}

function validateCatalog(catalog) {
  assertP4(catalog.schemaVersion === 'k6-api-source-p4-schema-catalog/v1',
    'M3-R2 P4 Schema Catalog version is invalid');
  assertP4(Array.isArray(catalog.schemas)
      && canonicalStringify(catalog.schemas.map((item) => item.schemaVersion))
        === canonicalStringify(P4_SCHEMA_VERSIONS),
  'M3-R2 P4 Schema Catalog versions changed');
  assertP4(catalog.schemas.every((item) => typeof item.path === 'string'
      && item.path.startsWith('schemas/execution/k6-api-source/v1/')),
  'M3-R2 P4 Schema Catalog paths changed');
}

function validateSchemas({ bundleSchema, receiptSchema, publicationEvidenceSchema,
  p4EvidenceSchema }) {
  for (const schema of [bundleSchema, receiptSchema, publicationEvidenceSchema,
    p4EvidenceSchema]) {
    assertP4(schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
      'M3-R2 P4 schemas must use Draft 2020-12');
    assertP4(schema.type === 'object' && schema.additionalProperties === false,
      'M3-R2 P4 schemas must be strictly closed');
    assertP4(canonicalStringify([...schema.required].sort())
        === canonicalStringify(Object.keys(schema.properties).sort()),
    'M3-R2 P4 top-level schema fields must all be required');
  }
  assertP4(bundleSchema.properties?.schemaVersion?.const
      === K6_API_SOURCE_PUBLICATION_BUNDLE_SCHEMA_VERSION,
  'M3-R2 P4 Source Bundle schema version changed');
  assertP4(bundleSchema.properties?.immutable?.const === true
      && bundleSchema.properties?.contentAddressed?.const === true,
  'M3-R2 P4 Source Bundle must remain immutable and content-addressed');
  assertP4(receiptSchema.properties?.schemaVersion?.const
      === K6_API_SOURCE_PUBLICATION_RECEIPT_SCHEMA_VERSION,
  'M3-R2 P4 publication Receipt schema version changed');
  assertP4(receiptSchema.properties?.storage?.additionalProperties === false
      && receiptSchema.properties?.storage?.properties?.kind?.const
        === K6_API_SOURCE_PUBLICATION_STORAGE_KIND
      && receiptSchema.properties?.storage?.properties?.remote?.const === false,
  'M3-R2 P4 publication Receipt storage boundary changed');
  assertP4(publicationEvidenceSchema.properties?.schemaVersion?.const
      === K6_API_SOURCE_PUBLICATION_EVIDENCE_SCHEMA_VERSION,
  'M3-R2 P4 publication Evidence schema version changed');
  assertP4(publicationEvidenceSchema.properties?.decision?.properties
      ?.sourcePersisted?.const === true
      && publicationEvidenceSchema.properties?.decision?.properties
        ?.artifactPublished?.const === true
      && publicationEvidenceSchema.properties?.decision?.properties
        ?.remoteArtifactPublished?.const === false
      && publicationEvidenceSchema.properties?.decision?.properties
        ?.sourceExecuted?.const === false
      && publicationEvidenceSchema.properties?.decision?.properties
        ?.nextRequiredSlice?.const === 'M3-R2-P5',
  'M3-R2 P4 publication decision boundary changed');
  assertP4(p4EvidenceSchema.properties?.schemaVersion?.const
      === M3_R2_P4_EVIDENCE_SCHEMA_VERSION,
  'M3-R2 P4 Evidence schema version changed');
  assertP4(p4EvidenceSchema.properties?.acceptedP3?.properties
      ?.artifactReceiptBlobSha?.pattern === '^[a-f0-9]{40}$'
      && !Object.hasOwn(p4EvidenceSchema.properties?.acceptedP3?.properties ?? {},
        'artifactBundleReceiptFileDigest'),
  'M3-R2 P4 accepted P3 Artifact receipt binding changed');
}

function validateAcceptedP3Receipts(repository) {
  const evidenceRawDigest = createHash('sha256')
    .update(repository.acceptedP3EvidenceRaw, 'utf8').digest('hex');
  assertP4(evidenceRawDigest === ACCEPTED_P3.evidenceReceiptFileDigest,
    'Accepted M3-R2 P3 Evidence receipt file digest changed');
  const artifactBlobSha = gitBlobSha(repository.acceptedP3ArtifactRaw);
  assertP4(artifactBlobSha === ACCEPTED_P3.artifactReceiptBlobSha,
    'Accepted M3-R2 P3 Artifact receipt Git blob SHA changed');

  const evidence = parseJson(repository.acceptedP3EvidenceRaw,
    'Accepted M3-R2 P3 Evidence receipt');
  const artifactReceipt = parseJson(repository.acceptedP3ArtifactRaw,
    'Accepted M3-R2 P3 Artifact receipt');
  const { evidenceDigest, ...evidenceClaims } = evidence;
  assertP4(evidenceDigest === ACCEPTED_P3.evidenceDigest
      && sha256(evidenceClaims) === evidenceDigest,
  'Accepted M3-R2 P3 Evidence canonical digest changed');
  assertP4(evidence.generatedAt === ACCEPTED_P3_GENERATED_AT
      && evidence.source?.branch === ACCEPTED_P3_BRANCH
      && evidence.source?.commitSha === ACCEPTED_P3.headSha,
  'Accepted M3-R2 P3 Evidence source binding changed');
  assertP4(evidence.sourceArtifact?.artifactDigest === ACCEPTED_P3.sourceArtifactDigest
      && evidence.validationEvidence?.evidenceDigest
        === ACCEPTED_P3.validationEvidenceDigest
      && evidence.sourceArtifact?.sourceDigest === ACCEPTED_P3.sourceDigest,
  'Accepted M3-R2 P3 Evidence Artifact binding changed');
  assertP4(evidence.decision?.sourcePersisted === false
      && evidence.decision?.artifactPublished === false
      && evidence.decision?.sourceExecuted === false
      && evidence.decision?.executionRuntimeStarted === false
      && evidence.decision?.nextRequiredSlice === 'M3-R2-P4'
      && evidence.decision?.repositoryBlockers?.length === 0
      && Object.values(evidence.safetyBoundary ?? {}).every((value) => value === false),
  'Accepted M3-R2 P3 Evidence decision changed');

  assertP4(canonicalStringify(Object.keys(artifactReceipt).sort())
      === canonicalStringify(['sourceArtifact', 'validationEvidence']),
  'Accepted M3-R2 P3 Artifact receipt shape changed');
  const sourceArtifact = artifactReceipt.sourceArtifact;
  const validationEvidence = artifactReceipt.validationEvidence;
  assertP4(sourceArtifact?.artifactDigest === ACCEPTED_P3.sourceArtifactDigest
      && sourceArtifact?.sourceDigest === ACCEPTED_P3.sourceDigest
      && sha256(stripDigest(sourceArtifact, 'artifactDigest'))
        === sourceArtifact.artifactDigest,
  'Accepted M3-R2 P3 Source Artifact changed');
  assertP4(validationEvidence?.evidenceDigest === ACCEPTED_P3.validationEvidenceDigest
      && validationEvidence?.artifactDigest === sourceArtifact.artifactDigest
      && sha256(stripDigest(validationEvidence, 'evidenceDigest'))
        === validationEvidence.evidenceDigest,
  'Accepted M3-R2 P3 validation Evidence changed');
}

function validateWiring({ packageJson, sources }) {
  assertP4(packageJson.scripts?.['validate:m3-r2-source-generation-p4']
      === 'node scripts/validate-m3-r2-source-generation-p4.js',
  'Root package is missing M3-R2 P4 validator');
  assertP4(packageJson.scripts?.['example:k6-api-source-bundle-publication']
      === 'node examples/k6-api-source-bundle-publication.js',
  'Root package is missing M3-R2 P4 example');
  const validateScript = packageJson.scripts?.validate ?? '';
  const ordered = [
    'validate-m3-r2-source-generation-p1.js',
    'validate-m3-r2-source-generation-p2.js',
    'validate-m3-r2-source-generation-p3.js',
    'validate-m3-r2-source-generation-p4.js',
  ];
  assertP4(ordered.every((marker) => validateScript.includes(marker)),
    'Repository validation is missing an M3-R2 stage');
  assertP4(ordered.every((marker, index) => index === 0
      || validateScript.indexOf(ordered[index - 1]) < validateScript.indexOf(marker))
      && validateScript.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must preserve P1, P2, P3, P4 and M2 final closure');

  const implementation = [sources.index, sources.publicationBundle, sources.publisher].join('\n');
  for (const marker of [
    "export * from './source-publication-bundle.js'",
    "export * from './source-bundle-publisher.js'",
    'createK6ApiSourcePublicationBundle',
    'validateK6ApiSourcePublicationBundleIntegrity',
    'publishK6ApiSourceBundle',
    'verifyPublishedK6ApiSourceBundle',
    'createK6ApiSourcePublicationEvidence',
    'CONTENT_ADDRESSED_FILESYSTEM',
    'kdtp-source-bundle://sha256/',
  ]) assertP4(implementation.includes(marker), `M3-R2 P4 marker is missing: ${marker}`);

  for (const marker of [
    'name: m3-r2-p4-source-bundle-publication',
    'contents: read',
    'Run focused M3-R2 P4 tests',
    'Run M3-R2 P3 anti-regression',
    'Run repository validation',
    'Generate P4 Source Bundle publication evidence',
    'name: m3-r2-source-generation-p4-evidence',
    'Run PostgreSQL 18 integration suite',
    'name: m3-r2-source-generation-p4-postgres-log',
    'retention-days: 90',
  ]) assertP4(sources.workflow.includes(marker), `M3-R2 P4 Workflow is missing ${marker}`);
}

function validatePublicationBoundary(sources) {
  const bundleImports = importsFrom(sources.publicationBundle);
  for (const forbidden of ['node:fs', 'node:fs/promises', 'fs', 'node:http', 'http',
    'node:https', 'https', 'node:net', 'net', 'node:child_process', 'child_process',
    'node:vm', 'vm']) {
    assertP4(!bundleImports.includes(forbidden),
      `M3-R2 P4 Bundle implementation imports ${forbidden}`);
  }
  const publisherImports = importsFrom(sources.publisher);
  for (const forbidden of ['node:http', 'http', 'node:https', 'https', 'node:net', 'net',
    'node:tls', 'tls', 'node:dns', 'dns', 'node:dgram', 'dgram',
    'node:child_process', 'child_process', 'node:vm', 'vm',
    'node:worker_threads', 'worker_threads']) {
    assertP4(!publisherImports.includes(forbidden),
      `M3-R2 P4 Publisher imports ${forbidden}`);
  }
  for (const forbidden of ['fetch(', 'axios', 'exec(', 'spawn(', 'fork(', 'eval(',
    'new Function(', 'process.env.', 'k6 run', 'xk6']) {
    assertP4(!sources.publisher.includes(forbidden),
      `M3-R2 P4 Publisher contains ${forbidden}`);
  }
  assertP4(sources.publisher.includes("remote: false")
      && sources.publisher.includes('isAbsolute(rootDirectory)')
      && sources.publisher.includes('!stat.isSymbolicLink()')
      && sources.publisher.includes('await rename(staging, target)')
      && sources.publisher.includes("flag: 'wx'"),
  'M3-R2 P4 Publisher safety controls changed');

  const workflow = sources.workflow.toLowerCase();
  for (const forbidden of [
    'actions: write', 'contents: write', 'packages: write', 'id-token: write',
    'continue-on-error', 'k6 run', 'xk6 build', 'playwright test', 'kubectl',
    'helm install', 'docker push', 'npm publish', 'gh release',
  ]) assertP4(!workflow.includes(forbidden), `M3-R2 P4 Workflow contains ${forbidden}`);
}

function validateDocumentation(sources) {
  for (const key of ['handoff', 'roadmap', 'acceptance', 'adr', 'threatModel', 'release']) {
    const doc = sources[key];
    for (const marker of [
      'sourceBundleContractReady=true',
      'sourceBundleCreated=true',
      'sourceManifestCreated=true',
      'sourceProvenanceBound=true',
      'sourcePersisted=true',
      'artifactPublished=true',
      'remoteArtifactPublished=false',
      'sourceExecuted=false',
      'executionRuntimeStarted=false',
      'nextRequiredSlice=M3-R2-P5',
      'M3-R3',
    ]) assertP4(doc.includes(marker), `M3-R2 P4 ${key} documentation is missing ${marker}`);
  }
}

async function loadSources() {
  const excluded = new Set([
    'rootPackage', 'catalog', 'bundleSchema', 'receiptSchema',
    'publicationEvidenceSchema', 'p4EvidenceSchema',
    'acceptedP3Evidence', 'acceptedP3ArtifactBundle',
  ]);
  return Object.fromEntries(await Promise.all(Object.entries(P4_PATHS)
    .filter(([key]) => !excluded.has(key))
    .map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')])));
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(ROOT, path), 'utf8'));
}

function parseJson(raw, label) {
  try { return JSON.parse(raw); } catch {
    throw new Error(`${label} is not valid JSON`);
  }
}

function gitBlobSha(raw) {
  const length = Buffer.byteLength(raw, 'utf8');
  return createHash('sha1').update(`blob ${length}\0`, 'utf8').update(raw, 'utf8').digest('hex');
}

function stripDigest(value, field) {
  const copy = structuredClone(value);
  delete copy[field];
  return copy;
}

function importsFrom(source) {
  return [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
}
