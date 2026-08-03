import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION,
  K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION,
  K6_API_SOURCE_STATIC_CHECK_IDS,
} from '../packages/k6-api-adapter/src/index.js';
import {
  M3_R2_P3_EVIDENCE_SCHEMA_VERSION,
  P3_PATHS,
  assertP3,
} from './m3-r2-p3-baseline.js';

const ROOT = process.cwd();

export async function loadP3Repository() {
  const [packageJson, packageManifest, catalog, artifactSchema, validationSchema,
    evidenceSchema, sources] = await Promise.all([
    loadJson(P3_PATHS.rootPackage),
    loadJson(P3_PATHS.packageManifest),
    loadJson(P3_PATHS.p3Catalog),
    loadJson(P3_PATHS.sourceArtifactSchema),
    loadJson(P3_PATHS.sourceValidationEvidenceSchema),
    loadJson(P3_PATHS.p3EvidenceSchema),
    loadSources(),
  ]);
  return { packageJson, packageManifest, catalog, artifactSchema, validationSchema,
    evidenceSchema, sources };
}

export function validateP3Repository(repository) {
  validateCatalog(repository.catalog);
  validateSchemas(repository);
  validateWiring(repository);
  validateStaticBoundary(repository.sources);
  validateDocumentation(repository.sources);
}

function validateCatalog(catalog) {
  assertP3(catalog.schemaVersion === 'k6-api-source-p3-schema-catalog/v1',
    'M3-R2 P3 Schema Catalog version is invalid');
  assertP3(JSON.stringify(catalog.schemas) === JSON.stringify({
    sourceArtifact: 'v1/k6-api-source-artifact.schema.json',
    sourceValidationEvidence: 'v1/k6-api-source-validation-evidence.schema.json',
    p3Evidence: 'v1/m3-r2-source-generation-p3-evidence.schema.json',
  }), 'M3-R2 P3 Schema Catalog paths changed');
}

function validateSchemas({ artifactSchema, validationSchema, evidenceSchema }) {
  for (const schema of [artifactSchema, validationSchema, evidenceSchema]) {
    assertP3(schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
      'M3-R2 P3 schemas must use Draft 2020-12');
    assertP3(schema.type === 'object' && schema.additionalProperties === false,
      'M3-R2 P3 schemas must be strictly closed');
  }
  assertP3(artifactSchema.properties?.schemaVersion?.const
      === K6_API_SOURCE_ARTIFACT_SCHEMA_VERSION,
  'M3-R2 P3 Source Artifact schema version changed');
  assertP3(artifactSchema.properties?.persistence?.const === 'IN_MEMORY_ONLY'
      && artifactSchema.properties?.published?.const === false,
  'M3-R2 P3 Source Artifact must remain in-memory and unpublished');
  assertP3(validationSchema.properties?.schemaVersion?.const
      === K6_API_SOURCE_VALIDATION_EVIDENCE_SCHEMA_VERSION,
  'M3-R2 P3 validation Evidence schema version changed');
  assertP3(validationSchema.properties?.validator?.properties?.checkIds?.prefixItems
      ?.map((item) => item.const).join(',') === K6_API_SOURCE_STATIC_CHECK_IDS.join(','),
  'M3-R2 P3 static check IDs changed');
  assertP3(evidenceSchema.properties?.schemaVersion?.const
      === M3_R2_P3_EVIDENCE_SCHEMA_VERSION,
  'M3-R2 P3 Evidence schema version changed');
  assertP3(evidenceSchema.properties?.decision?.properties?.nextRequiredSlice?.const
      === 'M3-R2-P4',
  'M3-R2 P3 next slice must remain M3-R2-P4');
}

function validateWiring({ packageJson, packageManifest, sources }) {
  assertP3(packageManifest.name === '@kdtp/k6-api-adapter'
      && packageManifest.exports === './src/index.js',
  'M3-R2 P3 package manifest is invalid');
  assertP3(packageJson.scripts?.['validate:m3-r2-source-generation-p3']
      === 'node scripts/validate-m3-r2-source-generation-p3.js',
  'Root package is missing M3-R2 P3 validator');
  assertP3(packageJson.scripts?.['example:k6-api-source-artifact']
      === 'node examples/k6-api-source-artifact.js',
  'Root package is missing M3-R2 P3 example');
  const validateScript = packageJson.scripts?.validate ?? '';
  for (const marker of [
    'validate-m3-r2-source-generation-p1.js',
    'validate-m3-r2-source-generation-p2.js',
    'validate-m3-r2-source-generation-p3.js',
  ]) assertP3(validateScript.includes(marker), `Repository validation is missing ${marker}`);
  assertP3(validateScript.indexOf('validate-m3-r2-source-generation-p1.js')
      < validateScript.indexOf('validate-m3-r2-source-generation-p2.js')
      && validateScript.indexOf('validate-m3-r2-source-generation-p2.js')
        < validateScript.indexOf('validate-m3-r2-source-generation-p3.js')
      && validateScript.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must preserve P1, P2, P3 and M2 final closure');

  const implementation = [sources.index, sources.staticValidator, sources.sourceArtifact].join('\n');
  for (const marker of [
    "export * from './source-static-validator.js'",
    "export * from './source-artifact.js'",
    'validateK6ApiSourceStatically',
    'createK6ApiSourceArtifact',
    'createK6ApiSourceValidationEvidence',
    'IN_MEMORY_ONLY',
  ]) assertP3(implementation.includes(marker), `M3-R2 P3 marker is missing: ${marker}`);

  for (const marker of [
    'name: m3-r2-p3-source-artifact-validation',
    'contents: read',
    'Run focused M3-R2 P3 tests',
    'Run M3-R2 P2 anti-regression',
    'Run repository validation',
    'Generate P3 Source Artifact and validation evidence',
    'name: m3-r2-source-generation-p3-evidence',
    'Run PostgreSQL 18 integration suite',
    'name: m3-r2-source-generation-p3-postgres-log',
    'retention-days: 90',
  ]) assertP3(sources.workflow.includes(marker), `M3-R2 P3 Workflow is missing ${marker}`);
}

function validateStaticBoundary(sources) {
  const implementation = [sources.validationShared, sources.staticValidator, sources.sourceArtifact]
    .join('\n');
  const imports = [...implementation.matchAll(/from\s+['"]([^'"]+)['"]/g)].map((match) => match[1]);
  for (const forbidden of ['node:vm', 'vm', 'node:child_process', 'child_process',
    'node:fs', 'fs', 'node:http', 'http', 'node:https', 'https', 'node:net', 'net']) {
    assertP3(!imports.includes(forbidden), `M3-R2 P3 implementation imports ${forbidden}`);
  }
  assertP3(!sources.staticValidator.includes("from './source-renderer"),
    'Independent P3 validator must not import Renderer implementation modules');
  assertP3(!sources.sourceArtifact.includes('writeFile(')
      && !sources.sourceArtifact.includes('mkdir(')
      && !sources.sourceArtifact.includes('publish('),
  'M3-R2 P3 Artifact contract must not persist or publish Source');

  const workflow = sources.workflow.toLowerCase();
  for (const forbidden of [
    'actions: write', 'contents: write', 'packages: write', 'continue-on-error',
    'k6 run', 'xk6 build', 'playwright test', 'kubectl', 'helm install',
    'docker push', 'npm publish',
  ]) assertP3(!workflow.includes(forbidden), `M3-R2 P3 Workflow contains ${forbidden}`);
}

function validateDocumentation(sources) {
  for (const key of ['handoff', 'roadmap', 'acceptance', 'adr', 'threatModel', 'release']) {
    const doc = sources[key];
    for (const marker of [
      'independentStaticValidatorReady=true',
      'sourceArtifactContractReady=true',
      'sourceStaticallyValidated=true',
      'sourceArtifactCreated=true',
      'sourcePersisted=false',
      'artifactPublished=false',
      'sourceExecuted=false',
      'executionRuntimeStarted=false',
      'nextRequiredSlice=M3-R2-P4',
      'M3-R3',
    ]) assertP3(doc.includes(marker), `M3-R2 P3 ${key} documentation is missing ${marker}`);
  }
}

async function loadSources() {
  return Object.fromEntries(await Promise.all(Object.entries(P3_PATHS)
    .filter(([key]) => !['rootPackage', 'packageManifest', 'p3Catalog',
      'sourceArtifactSchema', 'sourceValidationEvidenceSchema', 'p3EvidenceSchema']
      .includes(key))
    .map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')])));
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(ROOT, path), 'utf8'));
}
