import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import { sha256 } from '@kdtp/knowledge-core';
import assert from 'node:assert/strict';
import {
  K6_API_SOURCE_STATIC_CHECK_IDS,
  computeK6ApiSourceStaticValidationReportDigest,
  validateK6ApiSourceStatically,
} from '../src/index.js';
import { clone, p3SourceResult } from './p3-test-helpers.js';

function withSource(result, source) {
  const changed = clone(result);
  changed.source = source;
  changed.sourceDigest = createHash('sha256').update(source, 'utf8').digest('hex');
  changed.sourceByteLength = Buffer.byteLength(source, 'utf8');
  changed.sourceLineCount = (source.match(/\n/g) ?? []).length;
  const { resultDigest: _resultDigest, ...withoutDigest } = changed;
  changed.resultDigest = sha256(withoutDigest);
  return changed;
}

test('independent static validator accepts the exact P2 Source Result', () => {
  const result = p3SourceResult();
  const report = validateK6ApiSourceStatically(result);
  assert.equal(report.sourceDigest, result.sourceDigest);
  assert.deepEqual(report.checks.map((item) => item.checkId),
    [...K6_API_SOURCE_STATIC_CHECK_IDS]);
  assert.ok(report.checks.every((item) => item.status === 'PASS'));
  assert.equal(computeK6ApiSourceStaticValidationReportDigest(report), report.reportDigest);
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.checks), true);
});

test('indepent validator rejects tampered Result, identity and Source bytes', () => {
  const result = p3SourceResult();
  for (const changed of [
    { ...result, sourceDigest: '0'.repeat(64) },
    { ...result, sourceIdentity: { ...result.sourceIdentity, identityDigest: '0'.repeat(64) } },
    { ...result, source: `${result.source}x` },
    { ...result, sourceByteLength: result.sourceByteLength + 1 },
    { ...result, operationCount: result.operationCount + 1 },
  ]) assert.throws(() => validateK6ApiSourceStatically(changed));
});

test('independent validator rejects executable and environmental primitives', () => {
  const result = p3SourceResult();
  for (const text of [
    'eval(\'1\');',
    'Function(\'return 1\')();',
    'import(\'k6/http\');',
    'process.env.X;',
    'fetch(\'/target\');',
    'const x = __ENV.X;',
    'setTimeout(() => {}, 1);',
    'class Runtime {}',
  ]) {
    const source = result.source.replace('\nexport default function', `\n${text}\nexport default function`);
    assert.throws(() => validateK6ApiSourceStatically(withSource(result, source)));
  }
});

test('independent validator rejects extra top-level functions and absolute targets', () => {
  const result = p3SourceResult();
  const extraSource = result.source.replace('\nexport default function',
    '\nfunction hiddenExecutor() { return true; }\n\nexport default function');
  assert.throws(() => validateK6ApiSourceStatically(withSource(result, extraSource)));

  const targetSource = result.source.replace("'/v1/approvals/{approvalId}'",
    "'https://example.invalid/v1/approvals/{approvalId}'");
  assert.throws(() => validateK6ApiSourceStatically(withSource(result, targetSource)));
});

test('static validator implementation is independent from the renderer and execution APIs', async () => {
  const source = await readFile(new URL('../src/source-static-validator.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /source-renderer(?:-document|-input|-operation)?\.js/);
  assert.doesNotMatch(source, /from ['"](?:node:)?(?:vm|child_process)['"]/);
  assert.doesNotMatch(source, /\b(?:spawn|spawnSync|exec|execSync|runInContext|runInNewContext)\s*\(/);
});
