import { createHash } from 'node:crypto';
import {
  cp, lstat, mkdir, readFile, readdir, writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  G1_ARTIFACT_PATHS,
  G1_EVIDENCE_SCHEMA_PATH,
} from './constants.js';
import {
  createM3R3G1Evidence,
  validateM3R3G1EvidenceDocument,
} from './evidence.js';
import { validateM3R3G1Repository } from './repository-validator.js';

const root = '/tmp/m3-r3-g1-artifact';
const evidenceRelative =
  'evidence/m3-r3-g1-formal-acceptance-evidence.json';
const generated = new Set([
  evidenceRelative,
  'logs/m3-r3-g1-focused-node22.tap',
  'logs/m3-r3-g1-adapter-node22.tap',
  'logs/m3-r3-g1-full-node22.tap',
  'logs/m3-r3-g1-compatibility-node22.tap',
  'logs/m3-r3-g1-compatibility-node24.tap',
]);

await mkdir(root, { recursive: true });
const evidence = await createM3R3G1Evidence();
await writePayload(evidenceRelative, `${JSON.stringify(evidence, null, 2)}\n`);

for (const path of G1_ARTIFACT_PATHS) {
  if (generated.has(path)) continue;
  await mkdir(dirname(join(root, path)), { recursive: true });
  await cp(path, join(root, path));
}

for (const [source, target] of [
  ['/tmp/m3-r3-g1-focused-node22.tap',
    'logs/m3-r3-g1-focused-node22.tap'],
  ['/tmp/m3-r3-g1-adapter-node22.tap',
    'logs/m3-r3-g1-adapter-node22.tap'],
  ['/tmp/m3-r3-g1-full-node22.tap',
    'logs/m3-r3-g1-full-node22.tap'],
  ['/tmp/m3-r3-g1-compatibility-node22.tap',
    'logs/m3-r3-g1-compatibility-node22.tap'],
  ['/tmp/m3-r3-g1-compatibility-node24.tap',
    'logs/m3-r3-g1-compatibility-node24.tap'],
]) {
  await mkdir(dirname(join(root, target)), { recursive: true });
  await cp(source, join(root, target));
}

const evidenceBytes = await readFile(join(root, evidenceRelative));
const parsedEvidence = JSON.parse(evidenceBytes.toString('utf8'));
const schema = JSON.parse(await readFile(
  join(root, G1_EVIDENCE_SCHEMA_PATH), 'utf8'));
validateM3R3G1EvidenceDocument(parsedEvidence, schema);
const repository = await validateM3R3G1Repository();
if (parsedEvidence.source.commitSha !== process.env.M3_R3_G1_EXACT_HEAD) {
  throw new Error('M3-R3-G1 Evidence exact Head mismatch');
}
if (parsedEvidence.source.baseSha !== process.env.M3_R3_G1_BASE_SHA) {
  throw new Error('M3-R3-G1 Evidence base SHA mismatch');
}
if (parsedEvidence.contracts.g1SchemaCatalogDigest
    !== repository.g1SchemaCatalogDigest) {
  throw new Error('M3-R3-G1 Schema Catalog digest mismatch');
}
if (parsedEvidence.scopeAudit.manifestDigest
    !== repository.scopeManifestDigest) {
  throw new Error('M3-R3-G1 scope manifest digest mismatch');
}

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const status = await lstat(absolute);
    if (status.isSymbolicLink()) {
      throw new Error(`M3-R3-G1 Artifact symlink: ${absolute}`);
    }
    if (status.isDirectory()) await walk(absolute);
    else {
      if (!status.isFile()) {
        throw new Error(`M3-R3-G1 Artifact special file: ${absolute}`);
      }
      files.push(relative(root, absolute).split(sep).join('/'));
    }
  }
}
await walk(root);
const expected = [...G1_ARTIFACT_PATHS].sort();
const actual = [...files].sort();
const missing = expected.filter((path) => !actual.includes(path));
const unexpected = actual.filter((path) => !expected.includes(path));
if (missing.length || unexpected.length) {
  throw new Error(
    `M3-R3-G1 Artifact layout mismatch missing=${missing}`
    + ` unexpected=${unexpected}`);
}

const normalized = new Set();
const folded = new Set();
for (const path of actual) {
  if (path.includes('\0') || path.startsWith('/')
      || path.split('/').includes('..') || /^[a-z]:/iu.test(path)
      || path.startsWith('\\\\')) {
    throw new Error(`M3-R3-G1 unsafe Artifact path: ${path}`);
  }
  const unicode = path.normalize('NFC');
  if (normalized.has(unicode)) {
    throw new Error(`M3-R3-G1 Unicode collision: ${path}`);
  }
  normalized.add(unicode);
  const lower = unicode.toLowerCase();
  if (folded.has(lower)) {
    throw new Error(`M3-R3-G1 case-fold collision: ${path}`);
  }
  folded.add(lower);
  const bytes = await readFile(join(root, path));
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  scanSensitiveValues({ path, text }, 'M3-R3-G1 Artifact');
}

console.log('evidence schema errors: 0');
console.log(`evidenceJsonSha256=${createHash('sha256')
  .update(evidenceBytes).digest('hex')}`);
console.log(`canonicalEvidenceDigest=${parsedEvidence.evidenceDigest}`);
console.log(`g1SchemaCatalogDigest=${repository.g1SchemaCatalogDigest}`);
console.log(`scopeManifestDigest=${repository.scopeManifestDigest}`);
console.log(`compatibilityProductDigest=${
  parsedEvidence.contracts.compatibilityProductDigest}`);
console.log(`artifactPathCount=${actual.length}`);
console.log('credentialShapedMatches=0');

async function writePayload(path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), value, 'utf8');
}
