import { execFileSync } from 'node:child_process';
import { appendFile, readFile } from 'node:fs/promises';
import { canonicalStringify, sha256 } from '@kdtp/knowledge-core';
import {
  ACCEPTED_BASE_MAIN,
  G1_SCOPE_MANIFEST_PATH,
} from './constants.js';

const baseSha = required('M3_R3_G1_BASE_SHA');
const headSha = required('M3_R3_G1_EXACT_HEAD');
invariant(baseSha === ACCEPTED_BASE_MAIN,
  'M3-R3-G1 event base is not the accepted main baseline');
invariant(/^[a-f0-9]{40}$/u.test(headSha),
  'M3-R3-G1 event Head is invalid');

const manifest = JSON.parse(
  await readFile(G1_SCOPE_MANIFEST_PATH, 'utf8'));
const actual = execFileSync(
  'git', ['diff', '--name-only', baseSha, headSha],
  { encoding: 'utf8' },
).trim().split('\n').filter(Boolean).sort();
const expected = [...manifest.paths].sort();
invariant(canonicalStringify(actual) === canonicalStringify(expected),
  `M3-R3-G1 scope mismatch missing=${
    expected.filter((path) => !actual.includes(path))
  } unexpected=${actual.filter((path) => !expected.includes(path))}`);
const commitCount = Number(execFileSync(
  'git', ['rev-list', '--count', `${baseSha}..${headSha}`],
  { encoding: 'utf8' },
).trim());
invariant(Number.isInteger(commitCount) && commitCount > 0,
  'M3-R3-G1 commit count is invalid');

await appendEnv('M3_R3_G1_SCOPE_PATH_COUNT', String(actual.length));
await appendEnv('M3_R3_G1_SCOPE_COMMIT_COUNT', String(commitCount));
await appendEnv('M3_R3_G1_SCOPE_EXACT_DIFF_MATCHED', 'true');
await appendEnv('M3_R3_G1_SCOPE_MANIFEST_DIGEST', sha256(manifest));
console.log(`g1ScopePathCount=${actual.length}`);
console.log(`g1ScopeCommitCount=${commitCount}`);
console.log(`g1ScopeManifestDigest=${sha256(manifest)}`);
console.log('g1ScopeExactDiffMatched=true');

async function appendEnv(name, value) {
  const envPath = process.env.GITHUB_ENV;
  invariant(typeof envPath === 'string' && envPath.length > 0,
    'GITHUB_ENV is required');
  await appendFile(envPath, `${name}=${value}\n`, 'utf8');
}
function required(name) {
  const value = process.env[name];
  invariant(typeof value === 'string' && value.length > 0,
    `${name} is required`);
  return value;
}
function invariant(condition, message) {
  if (!condition) throw new Error(message);
}
