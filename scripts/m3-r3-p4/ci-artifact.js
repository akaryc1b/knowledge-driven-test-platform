import { createHash } from 'node:crypto';
import {
  cp, lstat, mkdir, readFile, readdir, writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  P4_ARTIFACT_PATHS,
  createM3R3P4Evidence,
  validateM3R3P4EvidenceDocument,
  validateM3R3P4Repository,
} from '../validate-m3-r3-p4-fault-security-compatibility.js';

const root = '/tmp/m3-r3-p4-artifact';
const evidenceRelative =
  'evidence/m3-r3-p4-fault-security-compatibility-evidence.json';
const generated = new Set([
  evidenceRelative,
  'logs/m3-r3-p4-focused-node22.tap',
  'logs/m3-r3-p4-adapter-node22.tap',
  'logs/m3-r3-p4-full-node22.tap',
  'logs/m3-r3-p4-compatibility-node22.tap',
  'logs/m3-r3-p4-compatibility-node24.tap',
]);

await mkdir(root, { recursive: true });
const evidence = await createM3R3P4Evidence();
await writePayload(evidenceRelative, `${JSON.stringify(evidence, null, 2)}\n`);
for (const path of P4_ARTIFACT_PATHS) {
  if (generated.has(path)) continue;
  await mkdir(dirname(join(root, path)), { recursive: true });
  await cp(path, join(root, path));
}
for (const [source, target] of [
  ['/tmp/m3-r3-p4-focused-node22.tap', 'logs/m3-r3-p4-focused-node22.tap'],
  ['/tmp/m3-r3-p4-adapter-node22.tap', 'logs/m3-r3-p4-adapter-node22.tap'],
  ['/tmp/m3-r3-p4-full-node22.tap', 'logs/m3-r3-p4-full-node22.tap'],
  ['/tmp/m3-r3-p4-compatibility-node22.tap',
    'logs/m3-r3-p4-compatibility-node22.tap'],
  ['/tmp/m3-r3-p4-compatibility-node24.tap',
    'logs/m3-r3-p4-compatibility-node24.tap'],
]) {
  await mkdir(dirname(join(root, target)), { recursive: true });
  await cp(source, join(root, target));
}

const schemaPath = join(root,
  'schemas/execution/k6-api-runtime/v1/'
  + 'm3-r3-fault-security-compatibility-p4-evidence.schema.json');
const evidenceBytes = await readFile(join(root, evidenceRelative));
const parsedEvidence = JSON.parse(evidenceBytes.toString('utf8'));
const schema = JSON.parse(await readFile(schemaPath, 'utf8'));
validateM3R3P4EvidenceDocument(parsedEvidence, schema);
const repository = await validateM3R3P4Repository();
if (parsedEvidence.source.commitSha !== process.env.M3_R3_P4_EXACT_HEAD) {
  throw new Error('P4 Evidence exact Head mismatch');
}
if (parsedEvidence.contracts.p4SchemaCatalogDigest
    !== repository.p4SchemaCatalogDigest) {
  throw new Error('P4 Schema Catalog digest mismatch');
}
for (const [key, envName] of Object.entries({
  focused: 'M3_R3_P4_FOCUSED_TOTAL',
  allK6ApiAdapter: 'M3_R3_P4_ADAPTER_TOTAL',
  fullNode: 'M3_R3_P4_FULL_TOTAL',
  node22Compatibility: 'M3_R3_P4_NODE22_TOTAL',
  node24Compatibility: 'M3_R3_P4_NODE24_TOTAL',
})) {
  if (parsedEvidence.testResults[key].total !== Number(process.env[envName])) {
    throw new Error(`P4 TAP count mismatch: ${key}`);
  }
}

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = join(directory, entry.name);
    const status = await lstat(absolute);
    if (status.isSymbolicLink()) throw new Error(`symlink: ${absolute}`);
    if (status.isDirectory()) await walk(absolute);
    else {
      if (!status.isFile()) throw new Error(`special file: ${absolute}`);
      files.push(relative(root, absolute).split(sep).join('/'));
    }
  }
}
await walk(root);
const expected = [...P4_ARTIFACT_PATHS].sort();
const actual = [...files].sort();
const missing = expected.filter((path) => !actual.includes(path));
const unexpected = actual.filter((path) => !expected.includes(path));
if (missing.length || unexpected.length) {
  throw new Error(`Artifact layout mismatch missing=${missing} unexpected=${unexpected}`);
}
const normalized = new Set();
const folded = new Set();
for (const path of actual) {
  if (path.includes('\0') || path.startsWith('/') || path.includes('..')
      || /^[a-z]:/iu.test(path) || path.startsWith('\\\\')) {
    throw new Error(`unsafe Artifact path: ${path}`);
  }
  const unicode = path.normalize('NFC');
  if (normalized.has(unicode)) throw new Error(`Unicode collision: ${path}`);
  normalized.add(unicode);
  const lower = unicode.toLowerCase();
  if (folded.has(lower)) throw new Error(`case-fold collision: ${path}`);
  folded.add(lower);
  const bytes = await readFile(join(root, path));
  const text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  scanSensitiveValues({ path, text }, 'M3-R3-P4 Artifact');
}
console.log('evidence schema errors: 0');
console.log(`evidenceJsonSha256=${createHash('sha256')
  .update(evidenceBytes).digest('hex')}`);
console.log(`canonicalEvidenceDigest=${parsedEvidence.evidenceDigest}`);
console.log(`p4SchemaCatalogDigest=${repository.p4SchemaCatalogDigest}`);
console.log(`p3SchemaCatalogDigest=${repository.p3SchemaCatalogDigest}`);
console.log(`compatibilityProductDigest=${
  parsedEvidence.contracts.compatibilityProductDigest}`);
console.log(`artifactPathCount=${actual.length}`);
console.log('credentialShapedMatches=0');

async function writePayload(path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), value, 'utf8');
}
