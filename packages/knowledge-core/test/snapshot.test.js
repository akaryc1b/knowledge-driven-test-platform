import test from 'node:test';
import assert from 'node:assert/strict';
import { buildKnowledgeSnapshot, resolveKnowledge } from '../src/index.js';
import { context, rule } from './test-helpers.js';

function snapshot(globalRules) {
  return buildKnowledgeSnapshot(resolveKnowledge({
    context: context({ domainPacks: [] }),
    layers: {
      global: globalRules,
      domains: [],
      project: [],
      environment: [],
      release: [],
    },
  }));
}

test('snapshot digest is independent from input rule order', () => {
  const first = rule({ id: 'G1', boundaryKey: 'a.boundary', value: { a: 1, b: 2 } });
  const second = rule({ id: 'G2', boundaryKey: 'b.boundary', value: { z: 3 } });
  const left = snapshot([first, second]);
  const right = snapshot([second, first]);

  assert.equal(left.digest, right.digest);
  assert.equal(left.snapshotId, right.snapshotId);
});

test('snapshot changes when effective knowledge changes', () => {
  const left = snapshot([rule({ id: 'G1', value: { timeout: 10 } })]);
  const right = snapshot([rule({ id: 'G1', value: { timeout: 20 } })]);
  assert.notEqual(left.digest, right.digest);
});
