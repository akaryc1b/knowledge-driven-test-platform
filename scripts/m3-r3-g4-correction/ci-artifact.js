import { createHash } from 'node:crypto';
import {
  cp, lstat, mkdir, readFile, readdir, rm, writeFile,
} from 'node:fs/promises';
import { dirname, join, relative, sep } from 'node:path';
import { scanSensitiveValues } from '../../packages/k6-api-adapter/test/p5-test-helpers.js';
import {
  C1_ARTIFACT_PATHS,
  C1_SCHEMA_PATH,
  createM3R3G4C1Evidence,
  validateM3R3G4C1EvidenceDocument,
  validateM3R3G4C1Repository,
} from './contract.js';

const root = '/tmp/m3-r3-g4-c1-artifact';
const evidenceRelative = 'evidence/m3-r3-g4-evidence-correction.json';
const generated = new Set([
  evidenceRelative,
  'logs/m3-r3-g4-c1-focused-node22.tap',
  'logs/m3-r3-g4-c1-root-validation.log',
  'logs/m3-r3-g4-c1-validator.log',
]);

await rm(root, { recursive: true, force: true });
await mkdir(root, { recursive: true });
const evidence = await createM3R3G4C1Evidence();
await writePayload(evidenceRelative, `${JSON.stringify(evidence, null, 2)}\n`);
for (const path of C1_ARTIFACT_PATHS) {
  if (generated.has(path)) continue;
  await mkdir(dirname(join(root, path)), { recursive: true });
  await cp(path, join(root, path));
}
for (const [source, target] of [
  ['/tmp/m3-r3-g4-c1-focused-node22.tap',
    'logs/m3-r3-g4-c1-focused-node22.tap'],
  ['/tmp/m3-r3-g4-c1-root-validation.log',
    'logs/m3-r3-g4-c1-root-validation.log'],
  ['/tmp/m3-r3-g4-c1-validator.log',
    'logs/m3-r3-g4-c1-validator.log'],
]) {
  await mkdir(dirname(join(root, target)), { recursive: true });
  await cp(source, join(root, target));
}

const evidenceBytes = await readFile(join(root, evidenceRelative));
const parsedEvidence = JSON.parse(evidenceBytes.toString('utf8'));
const schema = JSON.parse(await readFile(join(root, C1_SCHEMA_PATH), 'utf8'));
validateM3R3G4C1EvidenceDocument(parsedEvidence, schema);
const repository = await validateM3R3G4C1Repository();
if (parsedEvidence.source.commitSha !== process.env.M3_R3_G4_C1_EXACT_HEAD) {
  throw new Error('M3-R3-G4-C1 Evidence exact Head mismatch');
}
if (repository.artifactPathCount !== C1_ARTIFACT_PATHS.length) {
  throw new Error('M3-R3-G4-C1 repository Artifact count mismatch');
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
const expected = [...C1_ARTIFACT_PATHS].sort();
const actual = [...files].sort();
const missing = expected.filter((path) => !actual.includes(path));
const unexpected = actual.filter((path) => !expected.includes(path));
if (missing.length || unexpected.length) {
  throw new Error(
    `M3-R3-G4-C1 Artifact layout mismatch missing=${missing} unexpected=${unexpected}`,
  );
}
const normalized = new Set();
const folded = new Set();
for (const path of actual) {
  if (path.includes('\0') || path.startsWith('/') || path.split('/').includes('..')
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
  scanSensitiveValues({ path, text }, 'M3-R3-G4-C1 Artifact');
}
console.log('evidenceSchemaErrors=0');
console.log(`evidenceJsonSha256=${createHash('sha256')
  .update(evidenceBytes).digest('hex')}`);
console.log(`canonicalEvidenceDigest=${parsedEvidence.evidenceDigest}`);
console.log(`artifactPathCount=${actual.length}`);
console.log('missingEntries=0');
console.log('unexpectedEntries=0');
console.log('unsafePathEntries=0');
console.log('symlinkEntries=0');
console.log('specialFileEntries=0');
console.log('unicodeNormalizationCollisions=0');
console.log('caseFoldCollisions=0');
console.log('credentialShapedMatches=0');

async function writePayload(path, value) {
  await mkdir(dirname(join(root, path)), { recursive: true });
  await writeFile(join(root, path), value, 'utf8');
}
