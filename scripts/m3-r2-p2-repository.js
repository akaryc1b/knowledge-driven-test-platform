import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import {
  K6_API_SOURCE_RESULT_SCHEMA_VERSION,
} from '../packages/k6-api-adapter/src/index.js';
import {
  M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
  P2_PATHS,
  P2_SAFETY_BOUNDARY,
  assertP2,
} from './m3-r2-p2-baseline.js';

const ROOT = process.cwd();

export async function loadP2Repository() {
  const [packageJson, packageManifest, catalog, resultSchema, evidenceSchema, sources] =
    await Promise.all([
      loadJson(P2_PATHS.rootPackage),
      loadJson(P2_PATHS.packageManifest),
      loadJson(P2_PATHS.p2Catalog),
      loadJson(P2_PATHS.sourceResultSchema),
      loadJson(P2_PATHS.p2EvidenceSchema),
      loadSources(),
    ]);
  return { packageJson, packageManifest, catalog, resultSchema, evidenceSchema, sources };
}

export function validateP2Repository(repository) {
  validateCatalog(repository.catalog);
  validateSchemas(repository.resultSchema, repository.evidenceSchema);
  validateWiring(repository);
  validateStaticBoundary(repository.sources);
  validateDocumentation(repository.sources);
}

function validateCatalog(catalog) {
  assertP2(catalog.schemaVersion === 'k6-api-source-p2-schema-catalog/v1',
    'M3-R2 P2 Schema Catalog version is invalid');
  assertP2(catalog.currentSourceResult === K6_API_SOURCE_RESULT_SCHEMA_VERSION,
    'M3-R2 P2 current Source Result schema is invalid');
  assertP2(catalog.currentP2Evidence === M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
    'M3-R2 P2 current Evidence schema is invalid');
  const paths = Object.values(catalog.schemas ?? {});
  assertP2(paths.length === 2 && new Set(paths).size === paths.length,
    'M3-R2 P2 Schema Catalog must contain two unique paths');
}

function validateSchemas(resultSchema, evidenceSchema) {
  for (const schema of [resultSchema, evidenceSchema]) {
    assertP2(schema.$schema === 'https://json-schema.org/draft/2020-12/schema',
      'M3-R2 P2 schemas must use Draft 2020-12');
    assertP2(schema.type === 'object' && schema.additionalProperties === false,
      'M3-R2 P2 schemas must be strictly closed');
  }
  assertP2(resultSchema.properties?.schemaVersion?.const
      === K6_API_SOURCE_RESULT_SCHEMA_VERSION,
  'M3-R2 P2 Source Result schema version is invalid');
  assertP2(evidenceSchema.properties?.schemaVersion?.const
      === M3_R2_P2_EVIDENCE_SCHEMA_VERSION,
  'M3-R2 P2 Evidence schema version is invalid');

  const resultBoundary = resultSchema.properties?.safetyBoundary;
  assertP2(resultBoundary?.additionalProperties === false,
    'M3-R2 P2 Source Result safety boundary must be inline and closed');
  assertP2(resultBoundary?.properties?.sourceGenerated?.const === true,
    'M3-R2 P2 Source Result must record sourceGenerated=true');
  for (const [key, value] of Object.entries(P2_SAFETY_BOUNDARY)) {
    assertP2(resultBoundary?.properties?.[key]?.const === value,
      `M3-R2 P2 Source Result safety field changed: ${key}`);
    assertP2(evidenceSchema.properties?.safetyBoundary?.properties?.[key]?.const === value,
      `M3-R2 P2 Evidence safety field changed: ${key}`);
  }
  assertP2(evidenceSchema.properties?.decision?.properties?.nextRequiredSlice?.const
      === 'M3-R2-P3',
  'M3-R2 P2 Evidence next slice must remain M3-R2-P3');
}

function rendererImplementationSources(sources) {
  return [
    sources.renderer,
    sources.rendererAssertionValidation,
    sources.rendererDocument,
    sources.rendererInput,
    sources.rendererOperation,
    sources.rendererOperationValidation,
    sources.rendererOrder,
    sources.rendererShared,
    sources.rendererStatic,
  ];
}

function validateWiring({ packageJson, packageManifest, sources }) {
  assertP2(packageManifest.name === '@kdtp/k6-api-adapter'
      && packageManifest.exports === './src/index.js',
  'M3-R2 P2 package manifest is invalid');
  assertP2(packageJson.scripts?.['validate:m3-r2-source-generation-p2']
      === 'node scripts/validate-m3-r2-source-generation-p2.js',
  'Root package is missing M3-R2 P2 validator');
  assertP2(packageJson.scripts?.['example:k6-api-source-renderer']
      === 'node examples/k6-api-source-renderer.js',
  'Root package is missing M3-R2 P2 example');
  const validateScript = packageJson.scripts?.validate ?? '';
  for (const marker of [
    'validate-m3-r2-source-generation-r0.js',
    'validate-m3-r2-source-generation-p1.js',
    'validate-m3-r2-source-generation-p2.js',
  ]) assertP2(validateScript.includes(marker),
    `Repository validation is missing ${marker}`);
  assertP2(validateScript.indexOf('validate-m3-r2-source-generation-r0.js')
      < validateScript.indexOf('validate-m3-r2-source-generation-p1.js')
      && validateScript.indexOf('validate-m3-r2-source-generation-p1.js')
        < validateScript.indexOf('validate-m3-r2-source-generation-p2.js')
      && validateScript.endsWith('validate-m2-final-release-closure.js'),
  'Repository validation order must preserve R0, P1, P2 and M2 final closure');

  const implementation = [sources.index, ...rendererImplementationSources(sources)].join('\n');
  for (const marker of [
    "export * from './source-renderer.js'",
    'renderK6ApiSource',
    'validateK6ApiRenderedSource',
    'validateK6ApiSourceResult',
    'sha256Utf8',
    'K6_API_SOURCE_RESULT_SCHEMA_VERSION',
  ]) assertP2(implementation.includes(marker),
    `M3-R2 P2 implementation marker is missing: ${marker}`);

  for (const required of [
    'name: m3-r2-k6-api-source-generation',
    'contents: read',
    'Run focused M3-R2 P1 contract tests',
    'Run focused M3-R2 P2 renderer tests',
    'Run full Node test suite',
    'Run repository validation',
    'Run M3-R2 P1 anti-regression',
    'Generate P2 deterministic source evidence',
    'name: m3-r2-source-generation-p2-evidence',
    'Run PostgreSQL 18 integration suite',
    'name: m3-r2-source-generation-p2-postgres-log',
    'retention-days: 90',
  ]) assertP2(sources.workflow.includes(required),
    `M3-R2 P2 Workflow is missing ${required}`);
}

function validateStaticBoundary(sources) {
  const implementation = rendererImplementationSources(sources).join('\n');
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
  ]) assertP2(!pattern.test(implementation),
    'M3-R2 P2 Renderer imports or uses an execution, filesystem or network primitive');

  const workflow = sources.workflow.toLowerCase();
  for (const forbidden of [
    'actions: write',
    'contents: write',
    'packages: write',
    'k6 run',
    'xk6 build',
    'playwright test',
    'child_process',
    'node --experimental-vm',
    'kubectl',
    'helm install',
    'docker push',
    'npm publish',
    'continue-on-error',
  ]) assertP2(!workflow.includes(forbidden),
    `M3-R2 P2 Workflow contains forbidden capability: ${forbidden}`);

  for (const marker of [
    'sourceExecuted=false',
    'executionRuntimeStarted=false',
    'k6Invoked=false',
    'externalProcessExecuted=false',
    'nodeVmUsed=false',
    'targetNetworkAccessed=false',
    'secretAccessed=false',
    'temporaryExecutionDirectoryCreated=false',
  ]) assertP2(Object.values(sources).some((source) => source.includes(marker)),
    `M3-R2 P2 safety marker is missing: ${marker}`);
}

function validateDocumentation(sources) {
  for (const key of ['handoff', 'roadmap', 'acceptance', 'adr', 'threatModel', 'release']) {
    const doc = sources[key];
    for (const marker of [
      'deterministicSourceRendererReady=true',
      'sourceGenerationStarted=true',
      'sourceGenerated=true',
      'sourceExecuted=false',
      'executionRuntimeStarted=false',
      'k6Invoked=false',
      'nextRequiredSlice=M3-R2-P3',
      'M3-R3',
    ]) assertP2(doc.includes(marker),
      `M3-R2 P2 ${key} documentation is missing ${marker}`);
  }
}

async function loadSources() {
  return Object.fromEntries(await Promise.all(Object.entries(P2_PATHS)
    .filter(([key]) => ![
      'rootPackage', 'packageManifest', 'p2Catalog', 'sourceResultSchema',
      'p2EvidenceSchema',
    ].includes(key))
    .map(async ([key, path]) => [key, await readFile(join(ROOT, path), 'utf8')])));
}

async function loadJson(path) {
  return JSON.parse(await readFile(join(ROOT, path), 'utf8'));
}
