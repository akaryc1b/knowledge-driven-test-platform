import test from 'node:test';
import assert from 'node:assert/strict';
import {
  canonicalStringify, loadAcceptedP5Fixture, replayAcceptedProductIdentity,
} from './p5-test-helpers.js';

const expected = Object.freeze({
  sourceDigest: 'ffe417669eb4f242b9ab9d5df968fab80c90aacc52c45b7d11c3fe3e258c88d9',
  sourceIdentity: 'd2d75729802aa6a21d3f2deec9ba85bf31e35358e94b643004326067a0450f73',
  sourceArtifactDigest: '56d121390b08aee343c3ad49fd63d5d36c9d067a56ccbebba66fa65115588d13',
  validationEvidenceDigest: 'a7324d928ca56c48428d67cb8329adc532c65f461f98dbbc61969341030f70bd',
  p3EvidenceDigest: 'b013a5a14ad88a4b3fa97f1574dfe3006d0047776b95b7770a8c88a1aeb7e490',
  manifestDigest: 'fce734d0244118919e1927b17041200228b0010aa667b4d041c9bc4979860c36',
  bundleDigest: 'be37017095bfe927615a4487d0cb1f5775f4abd8bfb0070d40e32e8ecd49ae0f',
});

test('P5 independently reproduces the accepted product identities', async () => {
  const fixture = await loadAcceptedP5Fixture();
  assert.deepEqual(replayAcceptedProductIdentity(fixture), expected);
});

test('P5 product identity ignores field insertion order and unordered input order', async () => {
  const fixture = await loadAcceptedP5Fixture();
  const a = { capabilities: ['http', 'checks', 'thresholds'], tags: ['b', 'a'],
    context: { project: 'p', environment: 'e' } };
  const b = { context: { environment: 'e', project: 'p' }, tags: ['a', 'b'],
    capabilities: ['thresholds', 'checks', 'http'] };
  assert.equal(canonicalStringify({ x: 1, y: 2 }), canonicalStringify({ y: 2, x: 1 }));
  assert.deepEqual(replayAcceptedProductIdentity(fixture, a), expected);
  assert.deepEqual(replayAcceptedProductIdentity(fixture, b), expected);
});

test('P5 product identity ignores controlled request, CI and host metadata', async () => {
  const fixture = await loadAcceptedP5Fixture();
  for (const semanticInput of [
    { requestedAt: '2026-08-01T00:00:00.000Z', requestedBy: 'alice' },
    { requestedAt: '2027-01-01T00:00:00.000Z', requestedBy: 'bob' },
    { ci: { runId: 1, pullRequest: 46, ref: 'refs/pull/46/merge', head: 'a'.repeat(40) } },
    { ci: { runId: 2, pullRequest: 999, ref: 'refs/heads/other', head: 'b'.repeat(40) } },
    { temporaryDirectory: '/tmp/a', storageRoot: '/var/lib/a' },
    { temporaryDirectory: 'C:\\Temp\\a', storageRoot: '\\\\host\\share\\a' },
  ]) assert.deepEqual(replayAcceptedProductIdentity(fixture, semanticInput), expected);
});

test('P5 repeat and independent receipt reloads remain byte-identical', async () => {
  const first = await loadAcceptedP5Fixture();
  const second = await loadAcceptedP5Fixture();
  assert.notEqual(first.receipt, second.receipt);
  assert.equal(first.receiptRaw, second.receiptRaw);
  assert.deepEqual(first.identity, second.identity);
});
