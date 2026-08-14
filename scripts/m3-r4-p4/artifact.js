import { createHash } from 'node:crypto';
import {
  copyFile, lstat, mkdir, readFile, readdir, rm, writeFile,
} from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import {
  scanSensitiveValues,
  validateStorePath,
} from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  M3_R4_P4_ARTIFACT_PATHS,
} from './constants.js';
import {
  validateM3R4P4Evidence,
} from '../validate-m3-r4-p4-fault-security-compatibility.js';

const DEFAULT_ROOT =
  '/tmp/m3-r4-p4-fault-security-compatibility-artifact';
const DEFAULT_EVIDENCE =
  '/tmp/m3-r4-p4-fault-security-compatibility-evidence.json';

const REPOSITORY_SOURCES = Object.freeze({
  'schemas/m3-r4-output-root-p4-evidence.schema.json':
    'schemas/execution/k6-api-runtime/v1/m3-r4-output-root-p4-evidence.schema.json',
  'schemas/m3-r4-output-root-p3-evidence.schema.json':
    'schemas/execution/k6-api-runtime/v1/m3-r4-output-root-p3-evidence.schema.json',
  'contracts/bounded-file-result-collector.js':
    'packages/k6-api-adapter/src/bounded-file-result-collector.js',
  'contracts/bounded-json-result-payload.js':
    'packages/k6-api-adapter/src/bounded-json-result-payload.js',
  'contracts/bounded-result-collector-contracts.js':
    'packages/k6-api-adapter/src/bounded-result-collector-contracts.js',
  'contracts/bounded-result-collector-definitions.js':
    'packages/k6-api-adapter/src/bounded-result-collector-definitions.js',
  'contracts/bounded-result-collector-validation.js':
    'packages/k6-api-adapter/src/bounded-result-collector-validation.js',
  'contracts/bounded-result-collector-predecessor.js':
    'packages/k6-api-adapter/src/bounded-result-collector-predecessor.js',
  'tests/m3-r4-p4-fault-security-compatibility.test.js':
    'packages/k6-api-adapter/test/m3-r4-p4-fault-security-compatibility.test.js',
  'tests/bounded-file-result-collector-test-helpers.js':
    'packages/k6-api-adapter/test/bounded-file-result-collector-test-helpers.js',
  'scripts/m3-r4-p4/constants.js': 'scripts/m3-r4-p4/constants.js',
  'scripts/m3-r4-p4/artifact.js': 'scripts/m3-r4-p4/artifact.js',
  'scripts/validate-m3-r4-p4-fault-security-compatibility.js':
    'scripts/validate-m3-r4-p4-fault-security-compatibility.js',
  'scripts/validate-m3-r4-p3-bounded-result-collector.js':
    'scripts/validate-m3-r4-p3-bounded-result-collector.js',
  'workflow/m3-r4-p4-fault-security-compatibility-acceptance.yml':
    '.github/workflows/m3-r4-p4-fault-security-compatibility-acceptance.yml',
  'metadata/package.json': 'package.json',
  'documents/m3-r4-p4-handoff.md':
    'docs/02-development/m3-r4-p4-fault-security-compatibility-handoff.md',
  'documents/m3-r4-governed-output-root.md':
    'docs/03-roadmap/m3-r4-governed-output-root.md',
  'documents/roadmap.md': 'docs/03-roadmap/roadmap.md',
  'documents/m3-r4-p4-acceptance.md':
    'docs/04-governance/m3-r4-p4-fault-security-compatibility-acceptance.md',
  'documents/ADR-0036-m3-r4-linux-filesystem-boundary.md':
    'docs/05-adr/ADR-0036-m3-r4-linux-filesystem-boundary.md',
  'documents/m3-r4-p4-threat-model.md':
    'docs/06-security/m3-r4-p4-output-root-threat-model.md',
  'documents/M3-R4-P4-release.md':
    'docs/releases/M3-R4-P4-fault-security-compatibility-acceptance.md',
  'documents/m3-r4-p4-index.md': 'docs/m3-r4-p4-index.md',
  'documents/schema-readme.md':
    'schemas/execution/k6-api-runtime/README.md',
});

const LOG_SOURCES = Object.freeze({
  'logs/m3-r4-p4-focused-node22.tap':
    '/tmp/m3-r4-p4-focused-node22.tap',
  'logs/m3-r4-p4-focused-node24.tap':
    '/tmp/m3-r4-p4-focused-node24.tap',
  'logs/m3-r4-p4-adapter-node22.tap':
    '/tmp/m3-r4-p4-adapter-node22.tap',
  'logs/m3-r4-p4-full-node22.tap':
    '/tmp/m3-r4-p4-full-node22.tap',
  'logs/m3-r4-p4-repository-validator.log':
    '/tmp/m3-r4-p4-repository-validator.log',
});

export async function assembleM3R4P4Artifact(options = {}) {
  const root = options.root ?? process.env.M3_R4_P4_ARTIFACT_ROOT
    ?? DEFAULT_ROOT;
  const evidencePath = options.evidencePath
    ?? process.env.M3_R4_P4_EVIDENCE_PATH ?? DEFAULT_EVIDENCE;
  const headSha = options.headSha ?? process.env.M3_R4_P4_EXACT_HEAD
    ?? process.env.GITHUB_SHA ?? 'local';

  await rm(root, { recursive: true, force: true });
  await mkdir(root, { recursive: true });

  await copy(root,
    'evidence/m3-r4-output-root-p4-evidence.json', evidencePath);
  for (const [target, source] of Object.entries(REPOSITORY_SOURCES)) {
    await copy(root, target, source);
  }
  for (const [target, source] of Object.entries(LOG_SOURCES)) {
    await copy(root, target, source);
  }

  const payloadPaths = M3_R4_P4_ARTIFACT_PATHS.filter(
    (path) => path !== 'metadata/manifest.json');
  const sensitiveScan = {};
  const entries = [];
  for (const path of payloadPaths) {
    validateStorePath(path);
    const absolute = join(root, path);
    const info = await lstat(absolute);
    invariant(info.isFile() && !info.isSymbolicLink(),
      `M3-R4-P4 Artifact entry is not a regular file: ${path}`);
    const bytes = await readFile(absolute);
    const text = bytes.toString('utf8');
    invariant(Buffer.from(text, 'utf8').equals(bytes),
      `M3-R4-P4 Artifact entry is not valid UTF-8: ${path}`);
    sensitiveScan[path] = path.endsWith('.json') ? JSON.parse(text) : text;
    entries.push({
      path,
      byteLength: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex'),
    });
  }
  scanSensitiveValues(sensitiveScan, 'M3-R4-P4 Artifact');

  const evidence = JSON.parse(await readFile(
    join(root, 'evidence/m3-r4-output-root-p4-evidence.json'), 'utf8'));
  const schema = JSON.parse(await readFile(
    join(root, 'schemas/m3-r4-output-root-p4-evidence.schema.json'), 'utf8'));
  validateM3R4P4Evidence(evidence, schema);

  const manifest = {
    schemaVersion: 'm3-r4-p4-artifact-manifest/v1',
    repository: 'akaryc1b/knowledge-driven-test-platform',
    headSha,
    artifactPathCount: M3_R4_P4_ARTIFACT_PATHS.length,
    manifestedPayloadPathCount: entries.length,
    entries,
    sensitiveScanPassed: true,
    evidenceSchemaValidated: true,
  };
  const manifestPath = join(root, 'metadata/manifest.json');
  await mkdir(dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);

  const actual = (await listFiles(root)).sort();
  const expected = [...M3_R4_P4_ARTIFACT_PATHS].sort();
  invariant(JSON.stringify(actual) === JSON.stringify(expected),
    'M3-R4-P4 Artifact path set changed');
  invariant(entries.length === M3_R4_P4_ARTIFACT_PATHS.length - 1,
    'M3-R4-P4 manifested payload count changed');

  return Object.freeze({
    root,
    headSha,
    artifactPathCount: actual.length,
    manifestedPayloadPathCount: entries.length,
    evidenceDigest: evidence.evidenceDigest,
  });
}

async function copy(root, target, source) {
  validateStorePath(target);
  const targetPath = join(root, target);
  await mkdir(dirname(targetPath), { recursive: true });
  await copyFile(source, targetPath);
}

async function listFiles(root, prefix = '') {
  const directory = join(root, prefix);
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      paths.push(...await listFiles(root, relative));
    } else {
      invariant(entry.isFile(),
        `M3-R4-P4 Artifact contains a special entry: ${relative}`);
      paths.push(relative);
    }
  }
  return paths;
}

function invariant(condition, message) {
  if (!condition) throw new Error(message);
}

if (process.argv[1]
    && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  process.stdout.write(`${JSON.stringify(
    await assembleM3R4P4Artifact(), null, 2)}\n`);
}
